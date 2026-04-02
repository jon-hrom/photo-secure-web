import json
import os
import io
import time
import uuid
import hashlib
import hmac as hmac_mod
import secrets as secrets_mod
import base64
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
from requests.auth import HTTPBasicAuth
import boto3
from botocore.client import Config
from PIL import Image
import numpy as np


_raw_retouch_url = os.environ.get("RETOUCH_BASE_URL", "").strip().rstrip("/")
if _raw_retouch_url and ":8080" not in _raw_retouch_url and _raw_retouch_url.startswith("http://84.252.138.16"):
    _raw_retouch_url = _raw_retouch_url.replace("http://84.252.138.16", "http://84.252.138.16:8080")
RETOUCH_BASE_URL = _raw_retouch_url

RETOUCH_USER = os.environ.get("RETOUCH_BASIC_USER", "admin")
RETOUCH_PASS = os.environ.get("RETOUCH_BASIC_PASS", "")
S3_BUCKET = "foto-mix"
RETOUCH_API_URL = "https://retouch.foto-mix.ru"
HMAC_SECRET = os.environ.get("HMAC_SECRET_FOTO_MIX", "")

YC_INSTANCE_ID = os.environ.get("YC_INSTANCE_ID", "")
YC_OAUTH_TOKEN = os.environ.get("YC_OAUTH_TOKEN", "")
IAM_URL = "https://iam.api.cloud.yandex.net/iam/v1/tokens"
COMPUTE_BASE = "https://compute.api.cloud.yandex.net/compute/v1"


def _ensure_iopaint_ready(max_wait=120):
    health_url = RETOUCH_BASE_URL + "/health"
    try:
        r = requests.get(health_url, timeout=(3, 5))
        if r.status_code == 200:
            print("[WAKE] IOPaint already healthy")
            return True
    except Exception:
        pass

    print("[WAKE] IOPaint not responding, waking VM...")
    if YC_INSTANCE_ID and YC_OAUTH_TOKEN:
        try:
            from urllib import request as urlreq
            iam_data = json.dumps({"yandexPassportOauthToken": YC_OAUTH_TOKEN}).encode()
            iam_req = urlreq.Request(IAM_URL, data=iam_data, headers={"Content-Type": "application/json"}, method="POST")
            with urlreq.urlopen(iam_req, timeout=10) as resp:
                iam_token = json.loads(resp.read())["iamToken"]

            status_req = urlreq.Request(
                f"{COMPUTE_BASE}/instances/{YC_INSTANCE_ID}",
                headers={"Authorization": f"Bearer {iam_token}", "Content-Type": "application/json"},
                method="GET",
            )
            with urlreq.urlopen(status_req, timeout=10) as resp:
                vm_status = json.loads(resp.read()).get("status", "UNKNOWN")
            print(f"[WAKE] VM status: {vm_status}")

            if vm_status == "STOPPED":
                start_req = urlreq.Request(
                    f"{COMPUTE_BASE}/instances/{YC_INSTANCE_ID}:start",
                    headers={"Authorization": f"Bearer {iam_token}", "Content-Type": "application/json"},
                    method="POST",
                )
                with urlreq.urlopen(start_req, timeout=10) as resp:
                    pass
                print("[WAKE] VM start command sent")
        except Exception as e:
            print(f"[WAKE] Failed to wake VM: {e}")

    deadline = time.time() + max_wait
    attempt = 0
    while time.time() < deadline:
        attempt += 1
        try:
            r = requests.get(health_url, timeout=(5, 10))
            if r.status_code == 200:
                print(f"[WAKE] IOPaint ready after {attempt} attempts")
                return True
        except Exception:
            pass
        wait = min(5, 2 + attempt)
        print(f"[WAKE] Attempt {attempt} failed, waiting {wait}s...")
        time.sleep(wait)

    print(f"[WAKE] IOPaint not ready after {max_wait}s")
    return False


def _basic_auth():
    return HTTPBasicAuth(RETOUCH_USER, RETOUCH_PASS)


def _get_s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )


def _presigned_url(s3_key):
    return _get_s3_client().generate_presigned_url(
        'get_object',
        Params={'Bucket': S3_BUCKET, 'Key': s3_key},
        ExpiresIn=3600
    )





def _cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
        'Access-Control-Max-Age': '86400'
    }


def _response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body, default=str),
        'isBase64Encoded': False
    }





DEFAULT_PIPELINE = [
    {"op": "highlights", "strength": 0.08},
    {"op": "shadows", "strength": 0.06},
    {"op": "deshine", "strength": 0.30, "mask": {"max_det_side": 2500}},
    {"op": "blackheads", "strength": 0.45, "ksize": 11, "thr_q": 95, "thr_min": 10, "max_area": 500, "inpaint_radius": 3, "dilate_spots": 1},
    {"op": "skin_fs", "strength": 0.55, "tone_sigma_s": 220, "tone_sigma_r": 0.11, "texture_radius": 6.0, "texture_amount": 0.25, "mask": {"max_det_side": 2500}},
    {"op": "skin_smooth", "strength": 0.12, "mask": {"max_det_side": 2500}},
    {"op": "face_enhance", "strength": 0.18},
    {"op": "sharpen", "strength": 0.18}
]


def _load_pipeline(conn, preset_name='default'):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT pipeline_json FROM retouch_presets WHERE name = %s LIMIT 1',
            (preset_name,)
        )
        row = cur.fetchone()
    if row and row['pipeline_json']:
        pipeline = row['pipeline_json']
        if isinstance(pipeline, str):
            pipeline = json.loads(pipeline)
        if isinstance(pipeline, list) and len(pipeline) > 0:
            if len(pipeline) == 1 and pipeline[0].get('op') == 'auto':
                if 'ai_plugins' in pipeline[0]:
                    return pipeline
                return DEFAULT_PIPELINE
            return pipeline
    return DEFAULT_PIPELINE


def _get_setting(conn, key, default='20'):
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT value FROM retouch_settings WHERE key = %s LIMIT 1", (key,))
            row = cur.fetchone()
            return row['value'] if row else default
    except Exception:
        return default


def _get_ldm_steps(conn):
    val = _get_setting(conn, 'ldm_steps', '20')
    try:
        steps = int(val)
        return max(1, min(50, steps))
    except (ValueError, TypeError):
        return 20


PLUGIN_CONFIGS = {
    'gfpgan': {
        'api_path': '/api/v1/run_plugin_gen_image',
        'plugin_name': 'GFPGAN',
        'label': 'Улучшение лиц',
        'body_field': 'image',
        'name_field': 'name',
    },
    'remove_bg': {
        'api_path': '/api/v1/run_plugin_gen_mask',
        'plugin_name': 'briaai/RMBG-1.4',
        'label': 'Удаление фона',
        'body_field': 'image',
        'name_field': 'name',
    },
    'upscale': {
        'api_path': '/api/v1/run_plugin_gen_image',
        'plugin_name': 'RealESRGAN',
        'label': 'Увеличение разрешения',
        'body_field': 'image',
        'name_field': 'name',
    },
    'inpaint': {
        'api_path': '/api/v1/inpaint',
        'plugin_name': 'lama',
        'label': 'Точечная ретушь (LaMa)',
        'body_field': 'image',
        'name_field': None,
        'requires_mask': True,
    },
    'skin_retouch': {
        'api_path': '/api/v1/run_plugin_gen_mask',
        'plugin_name': 'SkinRetouch',
        'label': 'Маска дефектов кожи',
        'body_field': 'image',
        'name_field': 'name',
    },
}


def _run_plugin(s3_client, in_key, plugin_key, user_id, photo_id, mask_b64=None, conn=None):
    cfg = PLUGIN_CONFIGS.get(plugin_key)
    if not cfg:
        return None, f"Unknown plugin: {plugin_key}"

    if cfg.get('requires_mask') and not mask_b64:
        return None, f"Plugin {plugin_key} requires mask"

    print(f"[RETOUCH PLUGIN] Running {plugin_key} on {in_key}")

    resp = s3_client.get_object(Bucket=S3_BUCKET, Key=in_key)
    file_bytes = resp['Body'].read()

    img_b64 = base64.b64encode(file_bytes).decode('utf-8')

    api_url = RETOUCH_BASE_URL + cfg['api_path']

    if plugin_key == 'inpaint':
        ldm_steps = _get_ldm_steps(conn) if conn else 20
        print(f"[RETOUCH PLUGIN] Using ldm_steps={ldm_steps}")
        req_body = {
            'image': img_b64,
            'mask': mask_b64,
            'ldm_steps': ldm_steps,
        }
    else:
        body_field = cfg.get('body_field', 'img')
        name_field = cfg.get('name_field', 'plugin')
        req_body = {
            name_field: cfg['plugin_name'],
            body_field: img_b64,
        }

    body_str = json.dumps(req_body)

    print(f"[RETOUCH PLUGIN] POST {api_url}, body_size={len(body_str)}")
    t0 = time.time()
    r = requests.post(api_url, data=body_str.encode("utf-8"), headers={"Content-Type": "application/json"}, auth=_basic_auth(), timeout=(10, 180))
    elapsed = round(time.time() - t0, 3)
    print(f"[RETOUCH PLUGIN] Response: status={r.status_code}, time={elapsed}s, size={len(r.content)}")

    if r.status_code != 200:
        return None, f"Plugin error: {r.status_code} {r.text[:200]}"

    content_type = r.headers.get('Content-Type', '')
    if 'image' in content_type:
        result_bytes = r.content
    elif 'json' in content_type:
        data = r.json()
        if data.get('image'):
            result_bytes = base64.b64decode(data['image'])
        elif data.get('output'):
            result_bytes = base64.b64decode(data['output'])
        else:
            return None, "No image in plugin response"
    else:
        result_bytes = r.content

    out_key = f"retouch/{user_id}/{photo_id}/plugin_{plugin_key}_{uuid.uuid4().hex[:8]}.png"
    s3_client.put_object(Bucket=S3_BUCKET, Key=out_key, Body=result_bytes, ContentType='image/png')
    print(f"[RETOUCH PLUGIN] Saved result: {out_key}")

    return out_key, None


def _check_plugins_available():
    results = {}
    for key, cfg in PLUGIN_CONFIGS.items():
        try:
            url = RETOUCH_BASE_URL + cfg['api_path']
            r = requests.get(url, auth=_basic_auth(), timeout=(3, 5))
            results[key] = {
                'available': r.status_code in (200, 405, 400, 422),
                'status_code': r.status_code,
                'label': cfg['label'],
                'plugin_name': cfg['plugin_name'],
            }
            print(f"[PLUGIN CHECK] {key}: status={r.status_code}, available={results[key]['available']}")
        except requests.RequestException as e:
            results[key] = {
                'available': False,
                'status_code': 0,
                'label': cfg['label'],
                'plugin_name': cfg['plugin_name'],
                'error': str(e)[:100],
            }
            print(f"[PLUGIN CHECK] {key}: FAILED — {e}")
    return results


HMAC_CLIENT_ID = os.environ.get("HMAC_CLIENT_ID", "client1")


def _retouch_api_headers(method="POST", path="/v1/retouch", body_str=""):
    hdrs = {"Content-Type": "application/json"}
    if HMAC_SECRET:
        ts = str(int(time.time()))
        nonce = secrets_mod.token_hex(16)
        msg = f"{method}\n{path}\n{ts}\n{nonce}\n{body_str}"
        sig = hmac_mod.new(HMAC_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
        hdrs["X-Client-Id"] = HMAC_CLIENT_ID
        hdrs["X-Timestamp"] = ts
        hdrs["X-Nonce"] = nonce
        hdrs["X-Signature"] = sig
    return hdrs


def _probe_retouch_api():
    results = {}
    try:
        r = requests.get(f"{RETOUCH_API_URL}/health", timeout=10)
        results["health"] = {"status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        results["health"] = {"error": str(e)}

    test_key = "photobank/12/222/8ddc92c3-ef32-4694-8e5b-d61bc05be36d.jpg"
    body_data = {
        "in_bucket": "foto-mix",
        "in_key": test_key,
        "out_bucket": "foto-mix",
        "out_prefix": "retouch/probe_test/",
    }
    body_str = json.dumps(body_data, separators=(",", ":"), ensure_ascii=False)

    hdrs = _retouch_api_headers("POST", "/v1/retouch", body_str)
    results["sent_headers"] = {k: v for k, v in hdrs.items()}
    results["client_id"] = HMAC_CLIENT_ID
    results["hmac_secret_len"] = len(HMAC_SECRET)

    try:
        r = requests.post(f"{RETOUCH_API_URL}/v1/retouch", data=body_str.encode(),
                          headers=hdrs, timeout=30)
        results["retouch_response"] = {"status": r.status_code, "body": r.text[:2000]}
    except Exception as e:
        results["retouch_response"] = {"error": str(e)}

    task_id = None
    try:
        data = json.loads(results.get("retouch_response", {}).get("body", "{}"))
        task_id = data.get("task_id") or data.get("id")
    except Exception:
        pass

    if task_id:
        results["task_id"] = task_id
        time.sleep(5)
        try:
            get_hdrs = _retouch_api_headers("GET", f"/v1/tasks/{task_id}", "")
            r2 = requests.get(f"{RETOUCH_API_URL}/v1/tasks/{task_id}", headers=get_hdrs, timeout=15)
            results["task_status"] = {"status": r2.status_code, "body": r2.text[:2000]}
        except Exception as e:
            results["task_status"] = {"error": str(e)}

    return _response(200, results)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Ретушь фотографий — отправка на обработку, AI-плагины и проверка статуса задачи"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')

    if not user_id:
        return _response(401, {'error': 'User not authenticated'})

    params = event.get('queryStringParameters', {}) or {}
    if params.get('check_plugins') == '1':
        plugins_status = _check_plugins_available()
        return _response(200, {'plugins': plugins_status})

    if params.get('probe_api') == '1':
        return _probe_retouch_api()

    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT id, email_verified_at FROM users WHERE id = %s', (user_id,))
            user = cur.fetchone()
            if not user or not user['email_verified_at']:
                return _response(403, {'error': 'Email not verified'})

        if method == 'POST':
            body = json.loads(event.get('body', '{}') or '{}')
            if body.get('action') == 'plugin':
                return _handle_plugin(body, conn, user_id)
            return _handle_create(event, conn, user_id)
        elif method == 'GET':
            return _handle_status(event, conn, user_id)
        else:
            return _response(405, {'error': 'Method not allowed'})
    finally:
        conn.close()


MAX_ACTIVE_TASKS_PER_USER = 10


def _handle_plugin(body, conn, user_id):
    photo_id = body.get('photo_id')
    plugin = body.get('plugin')
    plugins = body.get('plugins')
    mask_b64 = body.get('mask')

    if not photo_id:
        return _response(400, {'error': 'photo_id is required'})

    plugin_list = []
    if plugins and isinstance(plugins, list):
        plugin_list = [p for p in plugins if p in PLUGIN_CONFIGS]
    elif plugin and plugin in PLUGIN_CONFIGS:
        plugin_list = [plugin]

    if not plugin_list:
        return _response(400, {'error': f'No valid plugins. Available: {", ".join(PLUGIN_CONFIGS.keys())}'})

    for p_key in plugin_list:
        cfg = PLUGIN_CONFIGS.get(p_key, {})
        if cfg.get('requires_mask') and not mask_b64:
            return _response(400, {'error': f'Plugin {p_key} requires mask field (base64 B&W image)'})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT id, s3_key, file_name FROM photo_bank WHERE id = %s AND user_id = %s AND is_trashed = FALSE',
            (photo_id, user_id)
        )
        photo = cur.fetchone()

    if not photo or not photo['s3_key']:
        return _response(404, {'error': 'Photo not found'})

    if not _ensure_iopaint_ready(max_wait=90):
        return _response(503, {'error': 'Сервер ретуши не готов. Попробуйте через 1-2 минуты'})

    s3_client = _get_s3_client()
    current_key = photo['s3_key']
    results = []

    for p_key in plugin_list:
        print(f"[RETOUCH PLUGIN CHAIN] Step: {p_key}, input: {current_key}")
        result_key, error = _run_plugin(s3_client, current_key, p_key, user_id, photo_id, mask_b64=mask_b64, conn=conn)
        if error:
            results.append({'plugin': p_key, 'success': False, 'error': error})
            print(f"[RETOUCH PLUGIN CHAIN] {p_key} failed: {error}")
            break

        storage_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{result_key}"
        results.append({'plugin': p_key, 'success': True, 'result_key': result_key})
        current_key = result_key

    last_success = None
    for r in reversed(results):
        if r.get('success') and r.get('result_key'):
            last_success = r
            break

    if last_success:
        final_key = last_success['result_key']
        presigned = _presigned_url(final_key)
        final_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{final_key}"
        label_parts = [PLUGIN_CONFIGS[p]['label'] for p in plugin_list if any(r.get('plugin') == p and r.get('success') for r in results)]
        _save_plugin_result(conn, user_id, photo, final_key, final_url, s3_client, '+'.join(plugin_list))

        return _response(200, {
            'success': True,
            'result_url': presigned,
            'result_key': final_key,
            'plugins_applied': [r['plugin'] for r in results if r.get('success')],
            'steps': results,
        })

    return _response(500, {'error': 'All plugins failed', 'steps': results})


def _save_plugin_result(conn, user_id, original_photo, result_key, result_url, s3_client, plugin_key):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT folder_id, file_name, file_size, width, height FROM photo_bank WHERE id = %s",
            (original_photo['id'],)
        )
        original = cur.fetchone()

    if not original:
        return

    retouch_folder_id = _get_or_create_retouch_folder(conn, user_id, original['folder_id'])

    try:
        resp = s3_client.get_object(Bucket=S3_BUCKET, Key=result_key)
        file_bytes = resp['Body'].read()
        thumb_key, thumb_url, grid_key, grid_url = _generate_thumbnails_from_bytes(s3_client, result_key, file_bytes)
    except Exception as e:
        print(f"[RETOUCH PLUGIN] Could not generate thumbnails: {e}")
        thumb_key, thumb_url, grid_key, grid_url = None, None, None, None

    base_name = original['file_name'].rsplit('.', 1)[0] if '.' in original['file_name'] else original['file_name']
    label = PLUGIN_CONFIGS.get(plugin_key, {}).get('label', plugin_key)
    file_name = f"{base_name}_{plugin_key}.png"

    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO photo_bank (folder_id, user_id, file_name, s3_key, s3_url,
               thumbnail_s3_key, thumbnail_s3_url, grid_thumbnail_s3_key, grid_thumbnail_s3_url,
               file_size, width, height, content_type)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            (retouch_folder_id, user_id, file_name, result_key, result_url,
             thumb_key, thumb_url, grid_key, grid_url,
             original['file_size'] or 0, original['width'], original['height'],
             'image/png')
        )
        conn.commit()
    print(f"[RETOUCH PLUGIN] Saved {plugin_key} result to folder {retouch_folder_id}: {file_name}")


def _try_lama_prepass(s3_client, in_key, user_id, photo_id, conn=None):
    print(f"[LAMA PREPASS] Generating mask via SkinRetouch plugin on IOPaint server")

    resp = s3_client.get_object(Bucket=S3_BUCKET, Key=in_key)
    file_bytes = resp['Body'].read()
    img_b64 = base64.b64encode(file_bytes).decode('utf-8')

    mask_url = RETOUCH_BASE_URL + '/api/v1/run_plugin_gen_mask'
    mask_body = json.dumps({'name': 'SkinRetouch', 'image': img_b64})

    r = None
    for attempt in range(3):
        t0 = time.time()
        try:
            r = requests.post(
                mask_url,
                data=mask_body.encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                auth=_basic_auth(),
                timeout=(15, 120),
            )
            elapsed = round(time.time() - t0, 3)
            print(f"[LAMA PREPASS] Mask response: status={r.status_code}, time={elapsed}s, size={len(r.content)}, attempt={attempt+1}")
            break
        except requests.RequestException as e:
            elapsed = round(time.time() - t0, 3)
            print(f"[LAMA PREPASS] SkinRetouch attempt {attempt+1} failed after {elapsed}s: {e}")
            if attempt < 2:
                time.sleep(5)
            else:
                return in_key

    if r is None:
        return in_key

    if r.status_code != 200:
        print(f"[LAMA PREPASS] SkinRetouch plugin error: {r.status_code} {r.text[:200]}")
        return in_key

    content_type = r.headers.get('Content-Type', '')
    if 'image' in content_type:
        mask_bytes = r.content
    elif 'json' in content_type:
        data = r.json()
        b64 = data.get('mask') or data.get('image') or data.get('output')
        if not b64:
            print("[LAMA PREPASS] No mask in plugin response")
            return in_key
        mask_bytes = base64.b64decode(b64)
    else:
        mask_bytes = r.content

    if len(mask_bytes) < 100:
        print("[LAMA PREPASS] Mask too small, skipping inpaint")
        return in_key

    mask_arr = np.frombuffer(mask_bytes, dtype=np.uint8)
    mask_img = Image.open(io.BytesIO(mask_bytes)).convert('L')
    mask_np = np.array(mask_img)
    white_pct = np.count_nonzero(mask_np) * 100 / max(1, mask_np.size)
    print(f"[LAMA PREPASS] Mask coverage: {white_pct:.2f}%")

    if white_pct < 0.01:
        print("[LAMA PREPASS] Mask is empty, no defects found — skipping inpaint")
        return in_key

    mask_b64 = base64.b64encode(mask_bytes).decode('utf-8')

    inpaint_bytes, err = _iopaint_inpaint(s3_client, in_key, mask_b64, conn=conn)
    if err or not inpaint_bytes or len(inpaint_bytes) < 1000:
        print(f"[LAMA PREPASS] Inpaint failed: {err}")
        return in_key

    out_key = f"retouch/{user_id}/{photo_id}/lama_prepass_{uuid.uuid4().hex[:8]}.png"
    s3_client.put_object(Bucket=S3_BUCKET, Key=out_key, Body=inpaint_bytes, ContentType='image/png')
    print(f"[LAMA PREPASS] Saved cleaned image: {out_key}")
    return out_key


def _iopaint_inpaint(s3_client, in_key, mask_b64, conn=None):
    resp = s3_client.get_object(Bucket=S3_BUCKET, Key=in_key)
    file_bytes = resp['Body'].read()
    img_b64 = base64.b64encode(file_bytes).decode('utf-8')

    api_url = RETOUCH_BASE_URL + '/api/v1/inpaint'
    ldm_steps = _get_ldm_steps(conn) if conn else 20
    req_body = {'image': img_b64, 'mask': mask_b64, 'ldm_steps': ldm_steps}
    body_str = json.dumps(req_body)

    print(f"[IOPAINT] POST {api_url}, ldm_steps={ldm_steps}, body_size={len(body_str)}")
    t0 = time.time()
    r = requests.post(api_url, data=body_str.encode("utf-8"), headers={"Content-Type": "application/json"}, auth=_basic_auth(), timeout=(10, 180))
    elapsed = round(time.time() - t0, 3)
    print(f"[IOPAINT] inpaint response: status={r.status_code}, time={elapsed}s, size={len(r.content)}")

    if r.status_code != 200:
        return None, f"Inpaint error: {r.status_code} {r.text[:200]}"

    content_type = r.headers.get('Content-Type', '')
    if 'image' in content_type:
        return r.content, None
    elif 'json' in content_type:
        data = r.json()
        b64 = data.get('image') or data.get('output')
        if b64:
            return base64.b64decode(b64), None
    return r.content, None


def _iopaint_plugin(s3_client, in_key, plugin_name, api_path, max_retries=2):
    resp = s3_client.get_object(Bucket=S3_BUCKET, Key=in_key)
    file_bytes = resp['Body'].read()
    img_b64 = base64.b64encode(file_bytes).decode('utf-8')

    api_url = RETOUCH_BASE_URL + api_path
    req_body = {'name': plugin_name, 'image': img_b64}
    body_str = json.dumps(req_body)

    last_err = None
    for attempt in range(max_retries + 1):
        print(f"[IOPAINT] POST {api_url}, plugin={plugin_name}, body_size={len(body_str)}, attempt={attempt+1}")
        t0 = time.time()
        try:
            r = requests.post(api_url, data=body_str.encode("utf-8"), headers={"Content-Type": "application/json"}, auth=_basic_auth(), timeout=(15, 180))
            elapsed = round(time.time() - t0, 3)
            print(f"[IOPAINT] plugin response: status={r.status_code}, time={elapsed}s, size={len(r.content)}")

            if r.status_code != 200:
                last_err = f"Plugin {plugin_name} error: {r.status_code} {r.text[:200]}"
                if attempt < max_retries:
                    time.sleep(3)
                    continue
                return None, last_err

            content_type = r.headers.get('Content-Type', '')
            if 'image' in content_type:
                return r.content, None
            elif 'json' in content_type:
                data = r.json()
                b64 = data.get('image') or data.get('output')
                if b64:
                    return base64.b64decode(b64), None
            return r.content, None
        except requests.RequestException as e:
            elapsed = round(time.time() - t0, 3)
            last_err = f"Plugin {plugin_name} request failed: {e}"
            print(f"[IOPAINT] Attempt {attempt+1} failed after {elapsed}s: {e}")
            if attempt < max_retries:
                time.sleep(5)

    return None, last_err


def _get_enabled_ai_plugins(conn):
    pipeline = _load_pipeline(conn, 'default')
    if isinstance(pipeline, list) and len(pipeline) == 1 and pipeline[0].get('op') == 'auto':
        return None
    if isinstance(pipeline, list):
        for step in pipeline:
            if step.get('op') == 'auto' and 'ai_plugins' in step:
                plugins = step['ai_plugins']
                if isinstance(plugins, list):
                    return plugins
    return None


def _handle_create(event, conn, user_id):
    body = json.loads(event.get('body', '{}') or '{}')
    photo_id = body.get('photo_id')

    if not photo_id:
        return _response(400, {'error': 'photo_id is required'})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT COUNT(*) as cnt FROM retouch_tasks WHERE user_id = %s AND status IN ('queued', 'started') AND created_at > NOW() - INTERVAL '10 minutes'",
            (user_id,)
        )
        active = cur.fetchone()
        if active and active['cnt'] >= MAX_ACTIVE_TASKS_PER_USER:
            print(f"[RETOUCH] User {user_id} has {active['cnt']} active tasks, rejecting new task")
            return _response(429, {'error': f'Слишком много задач в очереди ({active["cnt"]}). Подождите завершения текущих', 'active_tasks': active['cnt']})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT id, s3_key, thumbnail_s3_key, is_raw, file_name FROM photo_bank WHERE id = %s AND user_id = %s AND is_trashed = FALSE',
            (photo_id, user_id)
        )
        photo = cur.fetchone()

    if not photo:
        return _response(404, {'error': 'Photo not found'})

    if not photo['s3_key']:
        return _response(400, {'error': 'Photo has no S3 file'})

    ai_plugins = _get_enabled_ai_plugins(conn)
    print(f"[RETOUCH] AI plugins from preset: {ai_plugins}")

    use_lama = ai_plugins is None or 'inpaint' in ai_plugins
    use_gfpgan = ai_plugins is None or 'gfpgan' in ai_plugins
    use_upscale = ai_plugins is not None and 'upscale' in ai_plugins
    use_remove_bg = ai_plugins is not None and 'remove_bg' in ai_plugins

    if ai_plugins is not None and len(ai_plugins) == 0:
        use_lama = False
        use_gfpgan = False

    print(f"[RETOUCH] Steps enabled: lama={use_lama}, gfpgan={use_gfpgan}, upscale={use_upscale}, remove_bg={use_remove_bg}")

    if not _ensure_iopaint_ready(max_wait=90):
        return _response(503, {'error': 'Сервер ретуши не готов. Попробуйте через 1-2 минуты — сервер запускается'})

    in_key = photo['s3_key']
    if photo.get('is_raw'):
        print(f"[RETOUCH] RAW file detected: {in_key}")
    out_prefix = f"retouch/{user_id}/{photo_id}"

    s3_client = _get_s3_client()
    task_id = uuid.uuid4().hex
    current_key = in_key
    steps_done = []
    last_bytes = None

    try:
        if use_lama and not photo.get('is_raw'):
            cleaned_key = _try_lama_prepass(s3_client, current_key, user_id, photo_id, conn=conn)
            if cleaned_key != current_key:
                print(f"[RETOUCH] LaMa pre-pass applied: {current_key} -> {cleaned_key}")
                current_key = cleaned_key
                steps_done.append('lama_prepass')

        if use_gfpgan:
            gfpgan_bytes, err = _iopaint_plugin(s3_client, current_key, 'GFPGAN', '/api/v1/run_plugin_gen_image')
            if gfpgan_bytes and not err and len(gfpgan_bytes) > 1000:
                out_key = f"{out_prefix}/gfpgan_{uuid.uuid4().hex[:8]}.png"
                s3_client.put_object(Bucket=S3_BUCKET, Key=out_key, Body=gfpgan_bytes, ContentType='image/png')
                current_key = out_key
                last_bytes = gfpgan_bytes
                steps_done.append('face_enhance')
                print(f"[RETOUCH] GFPGAN done: {out_key}")
            else:
                print(f"[RETOUCH] GFPGAN skipped or failed: {err}")

        if use_upscale:
            upscale_bytes, err = _iopaint_plugin(s3_client, current_key, 'RealESRGAN', '/api/v1/run_plugin_gen_image')
            if upscale_bytes and not err and len(upscale_bytes) > 1000:
                out_key = f"{out_prefix}/upscale_{uuid.uuid4().hex[:8]}.png"
                s3_client.put_object(Bucket=S3_BUCKET, Key=out_key, Body=upscale_bytes, ContentType='image/png')
                current_key = out_key
                last_bytes = upscale_bytes
                steps_done.append('upscale')
                print(f"[RETOUCH] Upscale done: {out_key}")
            else:
                print(f"[RETOUCH] Upscale skipped or failed: {err}")

        if use_remove_bg:
            rmbg_bytes, err = _iopaint_plugin(s3_client, current_key, 'briaai/RMBG-1.4', '/api/v1/run_plugin_gen_mask')
            if rmbg_bytes and not err and len(rmbg_bytes) > 1000:
                out_key = f"{out_prefix}/rmbg_{uuid.uuid4().hex[:8]}.png"
                s3_client.put_object(Bucket=S3_BUCKET, Key=out_key, Body=rmbg_bytes, ContentType='image/png')
                current_key = out_key
                last_bytes = rmbg_bytes
                steps_done.append('remove_bg')
                print(f"[RETOUCH] Remove BG done: {out_key}")
            else:
                print(f"[RETOUCH] Remove BG skipped or failed: {err}")

    except Exception as e:
        last_bytes = None
        print(f"[RETOUCH] Processing error: {e}")

    result_key = current_key if current_key != in_key else None
    status = 'finished' if result_key else 'failed'
    error_msg = None if result_key else 'Не удалось обработать фото. Сервер ретуши недоступен или не смог обработать файл'

    result_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{result_key}" if result_key else None

    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO retouch_tasks (user_id, photo_id, task_id, status, in_bucket, in_key, out_bucket, out_prefix, result_key, result_url, error_message)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            (user_id, photo_id, task_id, status, S3_BUCKET, in_key, S3_BUCKET, out_prefix, result_key, result_url, error_msg)
        )
        conn.commit()

    if status == 'finished' and result_key:
        _save_retouched_photo(conn, user_id, {'photo_id': photo_id, 'result_key': result_key}, result_key, result_url, result_bytes=last_bytes)

    print(f"[RETOUCH] Done: task_id={task_id}, status={status}, steps={steps_done}")
    presigned = _presigned_url(result_key) if result_key else None
    return _response(200, {'task_id': task_id, 'status': status, 'result_url': presigned, 'steps': steps_done})


def _presigned_from_task(task):
    if task.get('result_key'):
        return _presigned_url(task['result_key'])
    return None


def _get_or_create_retouch_folder(conn, user_id, parent_folder_id):
    """Находит или создаёт подпапку 'Ретушь' внутри исходной папки"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM photo_folders WHERE user_id = %s AND parent_folder_id = %s AND folder_type = 'retouch' AND is_trashed = FALSE LIMIT 1",
            (user_id, parent_folder_id)
        )
        existing = cur.fetchone()
        if existing:
            return existing['id']

        cur.execute(
            "SELECT folder_name FROM photo_folders WHERE id = %s",
            (parent_folder_id,)
        )
        parent = cur.fetchone()
        parent_name = parent['folder_name'] if parent else 'Папка'

        cur.execute(
            "INSERT INTO photo_folders (user_id, folder_name, folder_type, parent_folder_id) VALUES (%s, %s, 'retouch', %s) RETURNING id",
            (user_id, f"{parent_name} — Ретушь", parent_folder_id)
        )
        new_folder = cur.fetchone()
        conn.commit()
        print(f"[RETOUCH] Created retouch folder id={new_folder['id']} for parent={parent_folder_id}")
        return new_folder['id']


def _generate_thumbnails_from_bytes(s3_client, result_key, file_bytes):
    try:
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')

        prefix = result_key.rsplit('/', 1)[0] if '/' in result_key else ''
        thumb_prefix = f"{prefix}/thumbnails" if prefix else "thumbnails"

        img.thumbnail((800, 800), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        img.save(thumb_buf, format='JPEG', quality=85)
        thumb_key = f"{thumb_prefix}/{uuid.uuid4()}.jpg"
        s3_client.put_object(Bucket=S3_BUCKET, Key=thumb_key, Body=thumb_buf.getvalue(), ContentType='image/jpeg')
        thumb_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{thumb_key}"

        img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        grid_buf = io.BytesIO()
        img.save(grid_buf, format='JPEG', quality=60, optimize=True)
        grid_key = f"{thumb_prefix}/grid_{uuid.uuid4()}.jpg"
        s3_client.put_object(Bucket=S3_BUCKET, Key=grid_key, Body=grid_buf.getvalue(), ContentType='image/jpeg')
        grid_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{grid_key}"

        print(f"[RETOUCH] Thumbnails created: {thumb_key}, {grid_key}")
        return thumb_key, thumb_url, grid_key, grid_url
    except Exception as e:
        print(f"[RETOUCH] Thumbnail generation failed: {e}")
        return None, None, None, None


def _save_retouched_photo(conn, user_id, task, result_key, result_url, result_bytes=None):
    photo_id = task['photo_id']
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT folder_id, file_name, file_size, width, height, content_type FROM photo_bank WHERE id = %s",
            (photo_id,)
        )
        original = cur.fetchone()

    if not original:
        print(f"[RETOUCH] Original photo {photo_id} not found, skipping save")
        return

    retouch_folder_id = _get_or_create_retouch_folder(conn, user_id, original['folder_id'])

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM photo_bank WHERE folder_id = %s AND s3_key = %s AND is_trashed = FALSE LIMIT 1",
            (retouch_folder_id, result_key)
        )
        if cur.fetchone():
            print(f"[RETOUCH] Photo already exists in retouch folder, skipping")
            return

    s3_client = _get_s3_client()
    thumb_key, thumb_url, grid_key, grid_url = None, None, None, None
    if result_bytes:
        thumb_key, thumb_url, grid_key, grid_url = _generate_thumbnails_from_bytes(s3_client, result_key, result_bytes)

    orig_name = original['file_name']
    base_name = orig_name.rsplit('.', 1)[0] if '.' in orig_name else orig_name
    file_name = f"{base_name}.jpg"

    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO photo_bank (folder_id, user_id, file_name, s3_key, s3_url,
               thumbnail_s3_key, thumbnail_s3_url, grid_thumbnail_s3_key, grid_thumbnail_s3_url,
               file_size, width, height, content_type)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
            (retouch_folder_id, user_id, file_name, result_key, result_url,
             thumb_key, thumb_url, grid_key, grid_url,
             original['file_size'] or 0, original['width'], original['height'],
             'image/jpeg')
        )
        conn.commit()
    print(f"[RETOUCH] Saved retouched photo to folder {retouch_folder_id}: {file_name} (thumbnails: {'yes' if thumb_key else 'no'})")


TASK_TIMEOUT_SECONDS = 300


def _check_single_task(conn, user_id, task):
    task_id = task['task_id']
    return {
        'task_id': task_id,
        'status': task['status'],
        'result_url': _presigned_from_task(task),
        'error_message': task.get('error_message'),
    }


def _handle_status(event, conn, user_id):
    params = event.get('queryStringParameters', {}) or {}
    task_id = params.get('task_id')
    task_ids_param = params.get('task_ids')

    if task_ids_param:
        ids = [t.strip() for t in task_ids_param.split(',') if t.strip()]
        if not ids:
            return _response(400, {'error': 'task_ids is empty'})
        placeholders = ','.join(['%s'] * len(ids))
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f'SELECT id, photo_id, task_id, status, result_key, result_url, out_prefix, error_message, created_at, updated_at FROM retouch_tasks WHERE task_id IN ({placeholders}) AND user_id = %s',
                (*ids, user_id)
            )
            db_tasks = cur.fetchall()

        results = []
        for t in db_tasks:
            results.append(_check_single_task(conn, user_id, t))
        return _response(200, {'tasks': results})

    if not task_id:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                '''SELECT id, photo_id, task_id, status, result_url, error_message, created_at, updated_at
                   FROM retouch_tasks WHERE user_id = %s ORDER BY created_at DESC LIMIT 50''',
                (user_id,)
            )
            tasks = cur.fetchall()
        return _response(200, {'tasks': tasks})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT id, photo_id, task_id, status, result_key, result_url, out_prefix, error_message, created_at, updated_at FROM retouch_tasks WHERE task_id = %s AND user_id = %s',
            (task_id, user_id)
        )
        task = cur.fetchone()

    if not task:
        return _response(404, {'error': 'Task not found'})

    return _response(200, _check_single_task(conn, user_id, task))