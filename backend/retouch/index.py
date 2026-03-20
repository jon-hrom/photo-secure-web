import json
import os
import io
import time
import sys
import hmac
import hashlib
import secrets
import uuid
import base64
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from typing import Dict, Any
from urllib import request as urlreq
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import boto3
from botocore.client import Config
from PIL import Image


RETOUCH_BASE_URL = os.environ.get("RETOUCH_BASE_URL", "").rstrip("/")
HMAC_CLIENT_ID = "foto-mix"
HMAC_SECRET = os.environ.get("HMAC_SECRET_FOTO_MIX", "")
S3_BUCKET = "foto-mix"


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


def _sign(method: str, path: str, body_str: str = "") -> dict:
    ts = str(int(time.time()))
    nonce = secrets.token_hex(16)
    msg = f"{method}\n{path}\n{ts}\n{nonce}\n{body_str}"
    sig = hmac.new(HMAC_SECRET.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return {
        "X-Client-Id": HMAC_CLIENT_ID,
        "X-Timestamp": ts,
        "X-Nonce": nonce,
        "X-Signature": sig,
    }


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


def _probe_health():
    """Проверка доступности Retouch API через /health с коротким таймаутом"""
    if not RETOUCH_BASE_URL:
        return {"reachable": False, "error": "RETOUCH_BASE_URL is empty"}
    url = RETOUCH_BASE_URL + "/health"
    print(f"[PROBE] Checking health at: {url}")
    try:
        t0 = time.time()
        r = requests.get(url, timeout=(3, 5))
        elapsed = round(time.time() - t0, 3)
        print(f"[PROBE] Health responded: status={r.status_code}, time={elapsed}s, body={r.text[:200]}")
        return {"reachable": True, "status_code": r.status_code, "elapsed_s": elapsed, "body": r.text[:200]}
    except requests.RequestException as e:
        elapsed = round(time.time() - t0, 3)
        print(f"[PROBE] Health FAILED after {elapsed}s: {e}")
        return {"reachable": False, "elapsed_s": elapsed, "error": str(e)}


# Wake VM
YC_INSTANCE_ID = os.environ.get("YC_INSTANCE_ID", "")
IAM_URL = "https://iam.api.cloud.yandex.net/iam/v1/tokens"
COMPUTE_BASE = "https://compute.api.cloud.yandex.net/compute/v1"

_SA_KEY_PATH = os.path.join(os.path.dirname(__file__), "sa_key.json")
_SA_KEY_CACHE = None

def _load_sa_key():
    global _SA_KEY_CACHE
    if _SA_KEY_CACHE is None:
        with open(_SA_KEY_PATH, "r") as f:
            _SA_KEY_CACHE = json.load(f)
    return _SA_KEY_CACHE


def _b64url(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _make_jwt(sa):
    now = int(time.time())
    hdr = json.dumps({"alg": "PS256", "typ": "JWT", "kid": sa["id"]})
    pay = json.dumps({"aud": IAM_URL, "iss": sa["service_account_id"], "iat": now, "exp": now + 3600})
    unsigned = _b64url(hdr) + "." + _b64url(pay)
    private_key = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    signature = private_key.sign(
        unsigned.encode(),
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
        hashes.SHA256()
    )
    return unsigned + "." + _b64url(signature)


def _yc_http(method, url, headers=None, body=None):
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urlreq.Request(url, data=data, headers=hdrs, method=method)
    with urlreq.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def _handle_wake():
    if not YC_INSTANCE_ID:
        return _response(500, {"error": "YC_INSTANCE_ID not configured"})
    if not os.path.exists(_SA_KEY_PATH):
        return _response(500, {"error": "sa_key.json not found"})
    try:
        sa = _load_sa_key()
        tok = _make_jwt(sa)
        iam = _yc_http("POST", IAM_URL, body={"jwt": tok})["iamToken"]
    except Exception as e:
        print(f"[WAKE] IAM error: {e}")
        return _response(500, {"error": f"IAM: {e}"})
    try:
        st = _yc_http("GET", f"{COMPUTE_BASE}/instances/{YC_INSTANCE_ID}",
                       headers={"Authorization": f"Bearer {iam}"}).get("status", "UNKNOWN")
    except Exception as e:
        print(f"[WAKE] Status error: {e}")
        return _response(500, {"error": f"Status: {e}"})
    print(f"[WAKE] VM={st}")
    if st == "STOPPED":
        try:
            op = _yc_http("POST", f"{COMPUTE_BASE}/instances/{YC_INSTANCE_ID}:start",
                          headers={"Authorization": f"Bearer {iam}"})
            return _response(200, {"action": "starting", "statusBefore": st, "operationId": op.get("id")})
        except Exception as e:
            return _response(500, {"error": f"Start: {e}"})
    if st == "STARTING":
        return _response(200, {"action": "already_starting", "status": st})
    if st == "RUNNING":
        return _response(200, {"action": "already_running", "status": st})
    return _response(200, {"action": "noop", "status": st})


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Ретушь фотографий — отправка на обработку, проверка статуса задачи и запуск VM"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': '', 'isBase64Encoded': False}

    print(f"[DIAG] RETOUCH_BASE_URL = '{RETOUCH_BASE_URL}'")
    print(f"[DIAG] HMAC_SECRET set = {bool(HMAC_SECRET)}")

    params = event.get('queryStringParameters', {}) or {}

    if params.get('action') == 'wake':
        return _handle_wake()

    if params.get('probe') == '1':
        result = _probe_health()
        return _response(200, {"probe": result})

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')

    if not user_id:
        return _response(401, {'error': 'User not authenticated'})

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

    in_key = photo['s3_key']
    if photo.get('is_raw'):
        print(f"[RETOUCH] RAW file detected, sending original: {in_key}")
    out_prefix = f"retouch/{user_id}/{photo_id}"

    path = "/v1/retouch"
    req_body = {
        "in_bucket": S3_BUCKET,
        "in_key": in_key,
        "out_bucket": S3_BUCKET,
        "out_prefix": out_prefix,
    }
    body_str = json.dumps(req_body, separators=(",", ":"), ensure_ascii=False)
    sign_headers = {"Content-Type": "application/json", **_sign("POST", path, body_str)}

    full_url = RETOUCH_BASE_URL + path
    print(f"[RETOUCH] POST {full_url}")
    print(f"[RETOUCH] Body: {body_str[:300]}")

    try:
        t0 = time.time()
        r = requests.post(
            full_url,
            data=body_str.encode("utf-8"),
            headers=sign_headers,
            timeout=(5, 25)
        )
        elapsed = round(time.time() - t0, 3)
        print(f"[RETOUCH] Response: status={r.status_code}, time={elapsed}s, body={r.text[:500]}")
        r.raise_for_status()
        result = r.json()
    except requests.ConnectionError as e:
        elapsed = round(time.time() - t0, 3)
        print(f"[ERROR] Retouch connection failed after {elapsed}s: {e}")
        return _response(502, {'error': f'Cannot connect to retouch server ({elapsed}s)', 'url': full_url})
    except requests.Timeout as e:
        elapsed = round(time.time() - t0, 3)
        print(f"[ERROR] Retouch timeout after {elapsed}s: {e}")
        return _response(504, {'error': f'Retouch server timeout ({elapsed}s)', 'url': full_url})
    except requests.RequestException as e:
        elapsed = round(time.time() - t0, 3)
        print(f"[ERROR] Retouch API call failed after {elapsed}s: {e}")
        return _response(502, {'error': f'Retouch service error ({elapsed}s): {e}'})

    task_id = result.get("task_id", "")
    status = result.get("status", "queued")

    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO retouch_tasks (user_id, photo_id, task_id, status, in_bucket, in_key, out_bucket, out_prefix)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
            (user_id, photo_id, task_id, status, S3_BUCKET, in_key, S3_BUCKET, out_prefix)
        )
        conn.commit()

    return _response(200, {'task_id': task_id, 'status': status})


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


def _generate_thumbnails(s3_client, result_key):
    """Скачивает фото из S3 и генерирует thumbnail + grid thumbnail"""
    try:
        print(f"[RETOUCH] Downloading {result_key} for thumbnail generation")
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=result_key)
        file_bytes = response['Body'].read()

        img = Image.open(io.BytesIO(file_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        orig_img = img.copy()

        prefix = result_key.rsplit('/', 1)[0] if '/' in result_key else ''
        thumb_prefix = f"{prefix}/thumbnails" if prefix else "thumbnails"

        img.thumbnail((800, 800), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        img.save(thumb_buf, format='JPEG', quality=85)
        thumb_key = f"{thumb_prefix}/{uuid.uuid4()}.jpg"
        s3_client.put_object(Bucket=S3_BUCKET, Key=thumb_key, Body=thumb_buf.getvalue(), ContentType='image/jpeg')
        thumb_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{thumb_key}"
        print(f"[RETOUCH] Thumbnail created: {thumb_key}")

        orig_img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        grid_buf = io.BytesIO()
        orig_img.save(grid_buf, format='JPEG', quality=60, optimize=True)
        grid_key = f"{thumb_prefix}/grid_{uuid.uuid4()}.jpg"
        s3_client.put_object(Bucket=S3_BUCKET, Key=grid_key, Body=grid_buf.getvalue(), ContentType='image/jpeg')
        grid_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{grid_key}"
        print(f"[RETOUCH] Grid thumbnail created: {grid_key}")

        return thumb_key, thumb_url, grid_key, grid_url
    except Exception as e:
        print(f"[RETOUCH] Thumbnail generation failed: {e}")
        return None, None, None, None


def _save_retouched_photo(conn, user_id, task, result_key, result_url):
    """Сохраняет обработанное фото в подпапку 'Ретушь' с генерацией thumbnail. Сервер ретуши сам конвертирует RAW→TIFF→JPG и загружает JPG в S3."""
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
    thumb_key, thumb_url, grid_key, grid_url = _generate_thumbnails(s3_client, result_key)

    orig_name = original['file_name']
    base_name = orig_name.rsplit('.', 1)[0] if '.' in orig_name else orig_name
    file_name = f"retouch_{base_name}.jpg"

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


def _handle_status(event, conn, user_id):
    params = event.get('queryStringParameters', {}) or {}
    task_id = params.get('task_id')

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

    if task['status'] in ('queued', 'started'):
        api_path = f"/v1/tasks/{task_id}"
        sign_headers = _sign("GET", api_path, "")
        status_url = RETOUCH_BASE_URL + api_path
        print(f"[RETOUCH] GET {status_url}")
        try:
            t0 = time.time()
            r = requests.get(status_url, headers=sign_headers, timeout=(5, 25))
            elapsed = round(time.time() - t0, 3)
            print(f"[RETOUCH] Status response: status={r.status_code}, time={elapsed}s, body={r.text[:500]}")
            r.raise_for_status()
            remote = r.json()
        except requests.RequestException as e:
            elapsed = round(time.time() - t0, 3)
            print(f"[ERROR] Retouch status check failed after {elapsed}s: {e}")
            return _response(200, {
                'task_id': task['task_id'],
                'status': task['status'],
                'result_url': _presigned_from_task(task),
                'error_message': task['error_message'],
            })

        new_status = remote.get("status", task['status'])
        result_data = remote.get("result", {}) or {}
        result_key = result_data.get("out_key") or remote.get("out_key") or remote.get("result_key")
        error_msg = remote.get("error") or result_data.get("error")

        update_fields = ['status = %s', 'updated_at = NOW()']
        update_values = [new_status]
        result_url = task['result_url']

        if result_key:
            storage_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{result_key}"
            update_fields.append('result_key = %s')
            update_values.append(result_key)
            update_fields.append('result_url = %s')
            update_values.append(storage_url)

        if error_msg:
            update_fields.append('error_message = %s')
            update_values.append(error_msg)

        update_values.append(task_id)
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE retouch_tasks SET {', '.join(update_fields)} WHERE task_id = %s",
                update_values
            )
            conn.commit()

        if new_status == 'finished' and result_key:
            _save_retouched_photo(conn, user_id, task, result_key, storage_url)

        presigned = _presigned_url(result_key) if result_key else _presigned_from_task(task)
        return _response(200, {
            'task_id': task_id,
            'status': new_status,
            'result_url': presigned,
            'error_message': error_msg or task['error_message'],
        })

    presigned = _presigned_from_task(task)
    return _response(200, {
        'task_id': task['task_id'],
        'status': task['status'],
        'result_url': presigned,
        'error_message': task['error_message'],
    })