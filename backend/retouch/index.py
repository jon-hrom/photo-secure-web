import json
import os
import io
import time
import uuid
import hashlib
import hmac as hmac_mod
import secrets as secrets_mod
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import boto3
from botocore.client import Config
from PIL import Image


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

S3_BUCKET = "foto-mix"
RETOUCH_API_URL = "https://retouch.foto-mix.ru"
HMAC_SECRET = os.environ.get("HMAC_SECRET_FOTO_MIX", "")
HMAC_CLIENT_ID = "foto-mix"

MAX_ACTIVE_TASKS_PER_USER = 10
POLL_INTERVAL = 3
POLL_TIMEOUT = 120

DEFAULT_PIPELINE = [
    {"op": "blackheads", "strength": 3.0, "thr_q": 80, "thr_min": 2, "max_area": 8000, "dilate_spots": 5, "inpaint_radius": 2, "mask": {"max_det_side": 3000, "dilate_px": 6, "blur_sigma": 1.0, "skin_erode_px": 10}, "exclude": {"exclude_nose": False}, "mask_only": True},
    {"op": "lama_inpaint", "dilate": 28, "use_exclude": True}
]


# ---------------------------------------------------------------------------
# S3 helpers
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# HTTP response helpers
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# HMAC auth for Retouch API
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Pipeline / settings helpers
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Retouch API interaction
# ---------------------------------------------------------------------------

def _build_out_key(in_key):
    """photobank/12/222/file.jpg -> photobank/12/222/retouch/file.jpg"""
    parts = in_key.rsplit("/", 1)
    if len(parts) == 2:
        return f"{parts[0]}/retouch/{parts[1]}"
    return f"retouch/{in_key}"


def _submit_retouch_task(in_key, out_prefix, pipeline, out_key=None):
    """POST /v1/retouch -- create a new retouch task on the API server."""
    body_data = {
        "in_bucket": S3_BUCKET,
        "in_key": in_key,
        "out_bucket": S3_BUCKET,
        "out_prefix": out_prefix,
        "pipeline": pipeline,
        "debug": True,
    }
    if out_key:
        body_data["out_key"] = out_key
    body_str = json.dumps(body_data, separators=(",", ":"), ensure_ascii=False)
    headers = _retouch_api_headers("POST", "/v1/retouch", body_str)

    print(f"[RETOUCH API] POST /v1/retouch  in_key={in_key}  out_prefix={out_prefix}  out_key={out_key}")
    r = requests.post(
        f"{RETOUCH_API_URL}/v1/retouch",
        data=body_str.encode("utf-8"),
        headers=headers,
        timeout=(10, 30),
    )
    print(f"[RETOUCH API] Response: status={r.status_code} body={r.text[:500]}")

    if r.status_code not in (200, 201):
        raise RuntimeError(f"Retouch API error {r.status_code}: {r.text[:300]}")

    data = r.json()
    task_id = data.get("task_id") or data.get("id")
    if not task_id:
        raise RuntimeError(f"No task_id in response: {r.text[:300]}")

    return task_id, data.get("status", "queued")


def _poll_retouch_task(task_id, timeout=POLL_TIMEOUT, interval=POLL_INTERVAL):
    """GET /v1/tasks/{task_id} -- poll until terminal status or timeout."""
    path = f"/v1/tasks/{task_id}"
    deadline = time.time() + timeout
    last_status = "queued"

    while time.time() < deadline:
        headers = _retouch_api_headers("GET", path, "")
        try:
            r = requests.get(
                f"{RETOUCH_API_URL}{path}",
                headers=headers,
                timeout=(5, 15),
            )
        except requests.RequestException as e:
            print(f"[RETOUCH API] Poll error: {e}")
            time.sleep(interval)
            continue

        if r.status_code != 200:
            print(f"[RETOUCH API] Poll non-200: {r.status_code} {r.text[:200]}")
            time.sleep(interval)
            continue

        data = r.json()
        last_status = data.get("status", last_status)
        print(f"[RETOUCH API] Poll task={task_id} status={last_status}")

        if last_status not in ("queued", "processing"):
            return data

        time.sleep(interval)

    return {"status": last_status, "error": "Timeout waiting for task to complete"}


# ---------------------------------------------------------------------------
# Probe / check endpoints
# ---------------------------------------------------------------------------

def _check_plugins_available():
    """Check that the Retouch API is reachable."""
    try:
        r = requests.get(f"{RETOUCH_API_URL}/health", timeout=10)
        api_ok = r.status_code == 200
    except Exception as e:
        api_ok = False

    return {
        "retouch_api": {
            "available": api_ok,
            "label": "Retouch API (retouch.foto-mix.ru)",
            "url": RETOUCH_API_URL,
        }
    }


def _try_client_id(client_id, body_str):
    ts = str(int(time.time()))
    nonce = secrets_mod.token_hex(16)
    msg = f"POST\n/v1/retouch\n{ts}\n{nonce}\n{body_str}"
    sig = hmac_mod.new(HMAC_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
    hdrs = {
        "Content-Type": "application/json",
        "X-Client-Id": client_id,
        "X-Timestamp": ts,
        "X-Nonce": nonce,
        "X-Signature": sig,
    }
    try:
        r = requests.post(f"{RETOUCH_API_URL}/v1/retouch", data=body_str.encode(), headers=hdrs, timeout=15)
        return {"status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        return {"error": str(e)}


def _probe_retouch_api():
    results = {}
    try:
        r = requests.get(f"{RETOUCH_API_URL}/health", timeout=10)
        results["health"] = {"status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        results["health"] = {"error": str(e)}

    test_key = "photobank/12/222/8ddc92c3-ef32-4694-8e5b-d61bc05be36d.jpg"

    pipelines_to_test = {
        "blackheads_lama": [
            {"op": "blackheads", "strength": 0.45, "ksize": 11, "thr_q": 95, "thr_min": 10, "max_area": 500, "dilate_spots": 1, "mask_only": True},
            {"op": "lama_inpaint", "strength": 1.0, "dilate": 2},
        ],
        "lama_inpaint_only": [
            {"op": "lama_inpaint", "strength": 1.0},
        ],
        "lama_only": [
            {"op": "lama"},
        ],
        "inpaint_only": [
            {"op": "inpaint"},
        ],
        "full_no_lama": [
            {"op": "highlights", "strength": 0.08},
            {"op": "shadows", "strength": 0.06},
            {"op": "deshine", "strength": 0.30, "mask": {"max_det_side": 2500}},
            {"op": "skin_fs", "strength": 0.55, "tone_sigma_s": 220, "tone_sigma_r": 0.11, "texture_radius": 6.0, "texture_amount": 0.25, "mask": {"max_det_side": 2500}},
            {"op": "skin_smooth", "strength": 0.12, "mask": {"max_det_side": 2500}},
            {"op": "face_enhance", "strength": 0.18},
            {"op": "sharpen", "strength": 0.18},
        ],
    }

    for name, pipeline in pipelines_to_test.items():
        probe_out_key = _build_out_key(test_key)
        probe_out_prefix = probe_out_key.rsplit("/", 1)[0] + "/"
        body_data = {
            "in_bucket": "foto-mix",
            "in_key": test_key,
            "out_bucket": "foto-mix",
            "out_prefix": probe_out_prefix,
            "out_key": probe_out_key.replace(".jpg", f"_probe_{name}.jpg"),
            "pipeline": pipeline,
        }
        body_str = json.dumps(body_data, separators=(",", ":"), ensure_ascii=False)
        hdrs = _retouch_api_headers("POST", "/v1/retouch", body_str)
        try:
            r = requests.post(f"{RETOUCH_API_URL}/v1/retouch", data=body_str.encode(), headers=hdrs, timeout=15)
            results[f"submit_{name}"] = {"status": r.status_code, "body": r.text[:500]}
        except Exception as e:
            results[f"submit_{name}"] = {"error": str(e)}

    time.sleep(20)

    for name in pipelines_to_test:
        submit = results.get(f"submit_{name}", {})
        try:
            data = json.loads(submit.get("body", "{}"))
            tid = data.get("task_id") or data.get("id")
        except Exception:
            tid = None
        if tid:
            try:
                path = f"/v1/tasks/{tid}"
                hdrs = _retouch_api_headers("GET", path, "")
                r2 = requests.get(f"{RETOUCH_API_URL}{path}", headers=hdrs, timeout=15)
                results[f"result_{name}"] = {"status": r2.status_code, "body": r2.text[:1000]}
            except Exception as e:
                results[f"result_{name}"] = {"error": str(e)}

    return _response(200, results)


# ---------------------------------------------------------------------------
# Thumbnails and saving results
# ---------------------------------------------------------------------------

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


def _get_or_create_retouch_folder(conn, user_id, parent_folder_id):
    """Find or create a 'Retouch' subfolder inside the original folder."""
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


def _save_retouched_photo(conn, user_id, photo_id, result_key, result_url, result_bytes=None):
    """Save the retouched photo as a new entry in photo_bank under the retouch folder."""
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

    s3_client = _get_s3_client()
    thumb_key, thumb_url, grid_key, grid_url = None, None, None, None
    if result_bytes:
        thumb_key, thumb_url, grid_key, grid_url = _generate_thumbnails_from_bytes(s3_client, result_key, result_bytes)

    orig_name = original['file_name']
    base_name = orig_name.rsplit('.', 1)[0] if '.' in orig_name else orig_name
    file_name = f"{base_name}.jpg"

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM photo_bank WHERE folder_id = %s AND s3_key = %s AND is_trashed = FALSE LIMIT 1",
            (retouch_folder_id, result_key)
        )
        existing = cur.fetchone()

    if existing:
        with conn.cursor() as cur:
            cur.execute(
                '''UPDATE photo_bank SET s3_url = %s,
                   thumbnail_s3_key = COALESCE(%s, thumbnail_s3_key), thumbnail_s3_url = COALESCE(%s, thumbnail_s3_url),
                   grid_thumbnail_s3_key = COALESCE(%s, grid_thumbnail_s3_key), grid_thumbnail_s3_url = COALESCE(%s, grid_thumbnail_s3_url),
                   updated_at = NOW()
                   WHERE id = %s''',
                (result_url, thumb_key, thumb_url, grid_key, grid_url, existing['id'])
            )
            conn.commit()
        print(f"[RETOUCH] Updated existing retouched photo {existing['id']} in folder {retouch_folder_id}")
    else:
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


# ---------------------------------------------------------------------------
# Task status helpers
# ---------------------------------------------------------------------------

def _presigned_from_task(task):
    if task.get('result_key'):
        return _presigned_url(task['result_key'])
    return None


def _sync_task_from_api(conn, user_id, task):
    """If task is still active, check API for updates and sync to DB."""
    if task['status'] not in ('queued', 'started', 'processing'):
        return task

    db_task_id = task['task_id']
    retry_marker = task.get('error_message') or ''
    if retry_marker.startswith('__retry__:'):
        api_task_id = retry_marker.split(':', 1)[1]
    else:
        api_task_id = db_task_id
    path = f"/v1/tasks/{api_task_id}"
    headers = _retouch_api_headers("GET", path, "")
    try:
        r = requests.get(f"{RETOUCH_API_URL}{path}", headers=headers, timeout=(5, 15))
        if r.status_code != 200:
            return task
        data = r.json()
    except Exception as e:
        print(f"[RETOUCH] API check failed for {api_task_id}: {e}")
        return task

    api_status = data.get("status", task['status'])

    if api_status == "finished":
        inner = data.get("result") or {}
        result_key = inner.get("out_key")
        if result_key:
            result_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{result_key}"
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE retouch_tasks SET status='finished', result_key=%s, result_url=%s, error_message=NULL, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                    (result_key, result_url, db_task_id, user_id)
                )
                conn.commit()
            try:
                photo_id = task.get('photo_id')
                if photo_id:
                    s3_client = _get_s3_client()
                    print(f"[RETOUCH] Downloading result from S3: bucket={S3_BUCKET} key={result_key}")
                    for attempt in range(3):
                        try:
                            resp = s3_client.get_object(Bucket=S3_BUCKET, Key=result_key)
                            result_bytes = resp['Body'].read()
                            print(f"[RETOUCH] Downloaded {len(result_bytes)} bytes from S3")
                            break
                        except Exception as s3_err:
                            print(f"[RETOUCH] S3 download attempt {attempt+1}/3 failed: {s3_err}")
                            if attempt < 2:
                                time.sleep(3)
                            else:
                                raise
                    _save_retouched_photo(conn, user_id, photo_id, result_key, result_url, result_bytes=result_bytes)
            except Exception as e:
                import traceback
                print(f"[RETOUCH] Failed to save result photo: {e}")
                print(f"[RETOUCH] Traceback: {traceback.format_exc()}")
            task = dict(task)
            task['status'] = 'finished'
            task['result_key'] = result_key
            task['result_url'] = result_url
        return task

    if api_status in ("failed", "error"):
        result_inner = data.get("result")
        error_msg = data.get("error") or (result_inner.get("error") if isinstance(result_inner, dict) else None) or "Processing failed"

        is_lama_error = 'iopaint_inpaint_lama' in str(error_msg) or 'lama_inpaint' in str(error_msg)
        prev_err = task.get('error_message') or ''
        already_retried = prev_err.startswith('__retry__:')

        if is_lama_error and not already_retried:
            print(f"[RETOUCH] lama_inpaint failed, retrying without blackheads+lama_inpaint")
            try:
                pipeline = _load_pipeline(conn, 'default')
                pipeline = [s for s in pipeline if s.get('op') not in ('blackheads', 'lama_inpaint')]
                print(f"[RETOUCH] Fallback pipeline ({len(pipeline)} steps): {[s.get('op') for s in pipeline]}")

                in_key = task['in_key']
                fallback_out_key = _build_out_key(in_key)
                out_prefix = fallback_out_key.rsplit("/", 1)[0] + "/" if "/" in fallback_out_key else "retouch/"
                new_api_task_id, new_status = _submit_retouch_task(in_key, out_prefix, pipeline, out_key=fallback_out_key)

                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE retouch_tasks SET status='started', out_prefix=%s, error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                        (out_prefix, f"__retry__:{new_api_task_id}", db_task_id, user_id)
                    )
                    conn.commit()
                print(f"[RETOUCH] Fallback: original={api_task_id} retry={new_api_task_id}")
                task = dict(task)
                task['status'] = 'started'
                task['out_prefix'] = out_prefix
                task['error_message'] = f"__retry__:{new_api_task_id}"
                return task
            except Exception as retry_err:
                print(f"[RETOUCH] Fallback retry failed: {retry_err}")

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                (error_msg, db_task_id, user_id)
            )
            conn.commit()
        task = dict(task)
        task['status'] = 'failed'
        task['error_message'] = error_msg
        return task

    return task


def _check_single_task(conn, user_id, task):
    task = _sync_task_from_api(conn, user_id, task)
    err = task.get('error_message') or ''
    if err.startswith('__retry__:'):
        err = None
    return {
        'task_id': task['task_id'],
        'status': task['status'],
        'result_url': _presigned_from_task(task),
        'error_message': err,
    }


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Retouch photos via the Retouch API, check task status."""
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
            return _handle_create(event, conn, user_id)
        elif method == 'GET':
            return _handle_status(event, conn, user_id)
        else:
            return _response(405, {'error': 'Method not allowed'})
    finally:
        conn.close()


def _handle_create(event, conn, user_id):
    body = json.loads(event.get('body', '{}') or '{}')
    photo_id = body.get('photo_id')

    if not photo_id:
        return _response(400, {'error': 'photo_id is required'})

    # --- rate-limit active tasks ---
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT COUNT(*) as cnt FROM retouch_tasks WHERE user_id = %s AND status IN ('queued', 'processing') AND created_at > NOW() - INTERVAL '10 minutes'",
            (user_id,)
        )
        active = cur.fetchone()
        if active and active['cnt'] >= MAX_ACTIVE_TASKS_PER_USER:
            print(f"[RETOUCH] User {user_id} has {active['cnt']} active tasks, rejecting")
            return _response(429, {
                'error': f'Слишком много задач в очереди ({active["cnt"]}). Подождите завершения текущих',
                'active_tasks': active['cnt'],
            })

    # --- load photo ---
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT id, s3_key, file_name FROM photo_bank WHERE id = %s AND user_id = %s AND is_trashed = FALSE',
            (photo_id, user_id)
        )
        photo = cur.fetchone()

    if not photo:
        return _response(404, {'error': 'Photo not found'})
    if not photo['s3_key']:
        return _response(400, {'error': 'Photo has no S3 file'})

    in_key = photo['s3_key']
    out_key = _build_out_key(in_key)
    out_prefix = out_key.rsplit("/", 1)[0] + "/" if "/" in out_key else "retouch/"

    pipeline = _load_pipeline(conn, 'debug_test')
    if len(pipeline) == 1 and pipeline[0].get('op') == 'auto':
        pipeline = DEFAULT_PIPELINE
    print(f"[RETOUCH] Pipeline ({len(pipeline)} steps): {[s.get('op') for s in pipeline]}")
    print(f"[RETOUCH] in_key={in_key}  out_key={out_key}  out_prefix={out_prefix}")

    # --- submit task to Retouch API ---
    try:
        api_task_id, api_status = _submit_retouch_task(in_key, out_prefix, pipeline, out_key=out_key)
    except Exception as e:
        print(f"[RETOUCH] Failed to submit task: {e}")
        return _response(503, {'error': f'Сервер ретуши недоступен: {e}'})

    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO retouch_tasks (user_id, photo_id, task_id, status, in_bucket, in_key, out_bucket, out_prefix)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
            (user_id, photo_id, api_task_id, 'started', S3_BUCKET, in_key, S3_BUCKET, out_prefix)
        )
        conn.commit()

    print(f"[RETOUCH] Submitted: task_id={api_task_id}, api_status={api_status}")
    return _response(200, {
        'task_id': api_task_id,
        'status': 'started',
        'result_url': None,
        'steps': [],
    })


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
        results = [_check_single_task(conn, user_id, t) for t in db_tasks]
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