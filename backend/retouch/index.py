import json
import os
import time
import hmac
import hashlib
import secrets
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import requests


RETOUCH_BASE_URL = os.environ.get("RETOUCH_BASE_URL", "").rstrip("/")
HMAC_CLIENT_ID = "foto-mix"
HMAC_SECRET = os.environ.get("HMAC_SECRET_FOTO_MIX", "")
S3_BUCKET = "foto-mix"


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


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Ретушь фотографий — отправка на обработку и проверка статуса задачи"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': '', 'isBase64Encoded': False}

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
            'SELECT id, s3_key, file_name FROM photo_bank WHERE id = %s AND user_id = %s AND is_trashed = FALSE',
            (photo_id, user_id)
        )
        photo = cur.fetchone()

    if not photo:
        return _response(404, {'error': 'Photo not found'})

    if not photo['s3_key']:
        return _response(400, {'error': 'Photo has no S3 file'})

    in_key = photo['s3_key']
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

    try:
        r = requests.post(
            RETOUCH_BASE_URL + path,
            data=body_str.encode("utf-8"),
            headers=sign_headers,
            timeout=60
        )
        r.raise_for_status()
        result = r.json()
    except requests.RequestException as e:
        print(f"[ERROR] Retouch API call failed: {e}")
        return _response(502, {'error': 'Retouch service unavailable'})

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
        try:
            r = requests.get(RETOUCH_BASE_URL + api_path, headers=sign_headers, timeout=30)
            r.raise_for_status()
            remote = r.json()
        except requests.RequestException as e:
            print(f"[ERROR] Retouch status check failed: {e}")
            return _response(200, {
                'task_id': task['task_id'],
                'status': task['status'],
                'result_url': task['result_url'],
                'error_message': task['error_message'],
            })

        new_status = remote.get("status", task['status'])
        result_key = remote.get("out_key") or remote.get("result_key")
        error_msg = remote.get("error")

        update_fields = ['status = %s', 'updated_at = NOW()']
        update_values = [new_status]

        if result_key:
            yc_key_id = os.environ.get('YC_S3_KEY_ID') or os.environ.get('AWS_ACCESS_KEY_ID', '')
            result_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{result_key}"
            update_fields.append('result_key = %s')
            update_values.append(result_key)
            update_fields.append('result_url = %s')
            update_values.append(result_url)

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

        return _response(200, {
            'task_id': task_id,
            'status': new_status,
            'result_url': result_url if result_key else task['result_url'],
            'error_message': error_msg or task['error_message'],
        })

    return _response(200, {
        'task_id': task['task_id'],
        'status': task['status'],
        'result_url': task['result_url'],
        'error_message': task['error_message'],
    })
