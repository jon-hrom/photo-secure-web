import json
import os
import io
import base64
import time
import uuid
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import boto3
from botocore.client import Config
from PIL import Image


S3_BUCKET = "foto-mix"
RETOUCH_API_URL = "https://io.foto-mix.ru/api/v2/retouch"
RETOUCH_BASIC_USER = os.environ.get("RETOUCH_BASIC_USER", "admin")
RETOUCH_BASIC_PASS = os.environ.get("RETOUCH_BASIC_PASS", "")
MAX_ACTIVE_TASKS_PER_USER = 10
DEFAULT_STRENGTH = 0.6
DEFAULT_ENHANCE_FACE = False


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


def _build_out_key(in_key):
    parts = in_key.rsplit("/", 1)
    if len(parts) == 2:
        return f"{parts[0]}/retouch/{parts[1]}"
    return f"retouch/{in_key}"


def _load_retouch_settings(conn):
    """Загрузить настройки ретуши из retouch_presets."""
    strength = DEFAULT_STRENGTH
    enhance_face = DEFAULT_ENHANCE_FACE
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT pipeline_json FROM retouch_presets WHERE name = 'default' LIMIT 1")
            row = cur.fetchone()
            if row and row['pipeline_json']:
                pipeline = row['pipeline_json']
                if isinstance(pipeline, str):
                    pipeline = json.loads(pipeline)
                if isinstance(pipeline, list) and len(pipeline) > 0:
                    first = pipeline[0]
                    if isinstance(first, dict):
                        strength = first.get('strength', DEFAULT_STRENGTH)
                        enhance_face = first.get('enhance_face', DEFAULT_ENHANCE_FACE)
    except Exception as e:
        print(f"[RETOUCH] Failed to load preset settings: {e}")
    return strength, enhance_face


def _call_retouch_api(image_base64, strength=0.6, enhance_face=False):
    """Отправить фото на io.foto-mix.ru и получить результат."""
    auth_str = base64.b64encode(f"{RETOUCH_BASIC_USER}:{RETOUCH_BASIC_PASS}".encode()).decode()

    print(f"[RETOUCH] Sending to API: strength={strength}, enhance_face={enhance_face}, image_size={len(image_base64)} chars")

    resp = requests.post(
        RETOUCH_API_URL,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {auth_str}'
        },
        json={
            'image': image_base64,
            'strength': strength,
            'enhance_face': enhance_face
        },
        timeout=(30, 300)
    )

    if resp.status_code == 200:
        content_type = resp.headers.get('Content-Type', '')
        print(f"[RETOUCH] API returned {len(resp.content)} bytes, content-type: {content_type}")
        return resp.content
    else:
        try:
            error_data = resp.json()
            error_msg = error_data.get('error', f'HTTP {resp.status_code}')
        except Exception:
            error_msg = f'HTTP {resp.status_code}: {resp.text[:200]}'
        raise RuntimeError(f"Retouch API error: {error_msg}")


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
                 len(result_bytes) if result_bytes else original['file_size'] or 0,
                 original['width'], original['height'], 'image/jpeg')
            )
            conn.commit()
        print(f"[RETOUCH] Saved retouched photo to folder {retouch_folder_id}: {file_name}")


def _check_plugins_available():
    try:
        auth_str = base64.b64encode(f"{RETOUCH_BASIC_USER}:{RETOUCH_BASIC_PASS}".encode()).decode()
        r = requests.post(
            RETOUCH_API_URL,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Basic {auth_str}'
            },
            json={'image': '', 'strength': 0.1, 'enhance_face': False},
            timeout=10
        )
        api_ok = r.status_code in (200, 400, 422)
    except Exception:
        api_ok = False

    return {
        "retouch_api": {
            "available": api_ok,
            "label": "Retouch API (io.foto-mix.ru)",
            "url": RETOUCH_API_URL,
        }
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Ретушь фотографий через API io.foto-mix.ru — синхронная обработка."""
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
            "SELECT COUNT(*) as cnt FROM retouch_tasks WHERE user_id = %s AND status IN ('queued', 'processing', 'started') AND created_at > NOW() - INTERVAL '10 minutes'",
            (user_id,)
        )
        active = cur.fetchone()
        if active and active['cnt'] >= MAX_ACTIVE_TASKS_PER_USER:
            return _response(429, {
                'error': f'Слишком много задач в очереди ({active["cnt"]}). Подождите завершения текущих',
                'active_tasks': active['cnt'],
            })

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
    task_id = str(uuid.uuid4())

    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO retouch_tasks (user_id, photo_id, task_id, status, in_bucket, in_key, out_bucket, out_prefix)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
            (user_id, photo_id, task_id, 'processing', S3_BUCKET, in_key, S3_BUCKET, out_prefix)
        )
        conn.commit()

    print(f"[RETOUCH] Starting: task_id={task_id}, photo_id={photo_id}, in_key={in_key}")

    try:
        s3_client = _get_s3_client()
        print(f"[RETOUCH] Downloading from S3: {in_key}")
        s3_resp = s3_client.get_object(Bucket=S3_BUCKET, Key=in_key)
        image_bytes = s3_resp['Body'].read()
        print(f"[RETOUCH] Downloaded {len(image_bytes)} bytes")

        image_base64 = base64.b64encode(image_bytes).decode('utf-8')

        strength = body.get('strength', None)
        enhance_face = body.get('enhance_face', None)
        if strength is None or enhance_face is None:
            db_strength, db_enhance_face = _load_retouch_settings(conn)
            if strength is None:
                strength = db_strength
            if enhance_face is None:
                enhance_face = db_enhance_face

        result_bytes = _call_retouch_api(image_base64, strength=strength, enhance_face=enhance_face)
        print(f"[RETOUCH] Got result: {len(result_bytes)} bytes")

        content_type = 'image/jpeg'
        if result_bytes[:4] == b'\x89PNG':
            content_type = 'image/png'
            ext = '.png'
        else:
            ext = '.jpg'

        if not out_key.endswith(ext):
            out_key = out_key.rsplit('.', 1)[0] + ext if '.' in out_key else out_key + ext

        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=out_key,
            Body=result_bytes,
            ContentType=content_type
        )
        result_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{out_key}"
        print(f"[RETOUCH] Uploaded result to S3: {out_key}")

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE retouch_tasks SET status='finished', result_key=%s, result_url=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                (out_key, result_url, task_id, user_id)
            )
            conn.commit()

        _save_retouched_photo(conn, user_id, photo_id, out_key, result_url, result_bytes=result_bytes)

        presigned = _presigned_url(out_key)
        print(f"[RETOUCH] Done: task_id={task_id}")

        return _response(200, {
            'task_id': task_id,
            'status': 'finished',
            'result_url': presigned,
        })

    except Exception as e:
        import traceback
        print(f"[RETOUCH] Failed: {e}")
        print(f"[RETOUCH] Traceback: {traceback.format_exc()}")

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                (str(e)[:500], task_id, user_id)
            )
            conn.commit()

        return _response(503, {'error': f'Ошибка ретуши: {str(e)[:200]}'})


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
                f'SELECT task_id, status, result_key, result_url, error_message, created_at, updated_at FROM retouch_tasks WHERE task_id IN ({placeholders}) AND user_id = %s',
                (*ids, user_id)
            )
            tasks = cur.fetchall()
        results = []
        for t in tasks:
            results.append({
                'task_id': t['task_id'],
                'status': t['status'],
                'result_url': _presigned_url(t['result_key']) if t.get('result_key') else None,
                'error_message': t.get('error_message'),
            })
        return _response(200, {'tasks': results})

    if not task_id:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                '''SELECT task_id, photo_id, status, result_url, error_message, created_at, updated_at
                   FROM retouch_tasks WHERE user_id = %s ORDER BY created_at DESC LIMIT 50''',
                (user_id,)
            )
            tasks = cur.fetchall()
        return _response(200, {'tasks': tasks})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT task_id, status, result_key, result_url, error_message, created_at, updated_at FROM retouch_tasks WHERE task_id = %s AND user_id = %s',
            (task_id, user_id)
        )
        task = cur.fetchone()

    if not task:
        return _response(404, {'error': 'Task not found'})

    return _response(200, {
        'task_id': task['task_id'],
        'status': task['status'],
        'result_url': _presigned_url(task['result_key']) if task.get('result_key') else None,
        'error_message': task.get('error_message'),
    })
