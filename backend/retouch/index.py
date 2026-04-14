import json
import os
import io
import base64
import uuid
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import boto3
from botocore.client import Config
from PIL import Image


S3_BUCKET = "foto-mix"
API_BASE = "https://io.foto-mix.ru/api/v2"
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


def _auth_header():
    auth_str = base64.b64encode(f"{RETOUCH_BASIC_USER}:{RETOUCH_BASIC_PASS}".encode()).decode()
    return f"Basic {auth_str}"


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


def _extract_s3_key(url):
    prefix = f"https://storage.yandexcloud.net/{S3_BUCKET}/"
    if url and url.startswith(prefix):
        return url[len(prefix):]
    return None


def _build_out_key(in_key):
    parts = in_key.rsplit("/", 1)
    if len(parts) == 2:
        return f"{parts[0]}/retouch/{parts[1]}"
    return f"retouch/{in_key}"


def _load_retouch_settings(conn):
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


def _submit_async_task(image_base64, strength=0.6, enhance_face=False):
    """POST /api/v2/submit — поставить задачу в очередь, получить task_id."""
    resp = requests.post(
        f"{API_BASE}/submit",
        headers={
            'Content-Type': 'application/json',
            'Authorization': _auth_header()
        },
        json={
            'image': image_base64,
            'strength': strength,
            'enhance_face': enhance_face
        },
        timeout=(30, 120)
    )
    print(f"[RETOUCH] Submit response: status={resp.status_code} body={resp.text[:500]}")

    if resp.status_code in (200, 201, 202):
        data = resp.json()
        api_task_id = data.get('task_id')
        if not api_task_id:
            raise RuntimeError(f"No task_id in submit response: {resp.text[:300]}")
        return api_task_id, data.get('status', 'queued')
    else:
        try:
            error_data = resp.json()
            error_msg = error_data.get('error', f'HTTP {resp.status_code}')
        except Exception:
            error_msg = f'HTTP {resp.status_code}: {resp.text[:200]}'
        raise RuntimeError(f"Retouch API submit error: {error_msg}")


def _check_api_status(api_task_id):
    """GET /api/v2/status/<task_id> — проверить статус задачи."""
    resp = requests.get(
        f"{API_BASE}/status/{api_task_id}",
        headers={'Authorization': _auth_header()},
        timeout=(5, 30)
    )
    print(f"[RETOUCH] Status check {api_task_id}: status={resp.status_code} body={resp.text[:500]}")

    if resp.status_code in (200, 202):
        try:
            return resp.json()
        except Exception:
            text = resp.text.strip()
            if text:
                return json.loads(text)
    return {'status': 'pending'}


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

        cur.execute("SELECT folder_name FROM photo_folders WHERE id = %s", (parent_folder_id,))
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
                   grid_thumbnail_s3_key = COALESCE(%s, grid_thumbnail_s3_key), grid_thumbnail_s3_url = COALESCE(%s, grid_thumbnail_s3_url)
                   WHERE id = %s''',
                (result_url, thumb_key, thumb_url, grid_key, grid_url, existing['id'])
            )
            conn.commit()
        print(f"[RETOUCH] Updated existing retouched photo {existing['id']}")
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


def _download_result_and_save(conn, user_id, task, result_url_from_api):
    """Скачать результат из S3 (result_url), сохранить в свой бакет и в БД."""
    s3_client = _get_s3_client()
    db_task_id = task['task_id']
    photo_id = task.get('photo_id')
    in_key = task.get('in_key', '')
    out_key = _build_out_key(in_key)

    if not out_key.endswith('.jpg'):
        out_key = out_key.rsplit('.', 1)[0] + '.jpg' if '.' in out_key else out_key + '.jpg'

    print(f"[RETOUCH] Downloading result from: {result_url_from_api}")
    result_bytes = None
    s3_key_from_url = _extract_s3_key(result_url_from_api)
    if s3_key_from_url:
        try:
            print(f"[RETOUCH] Trying S3 direct download: {s3_key_from_url}")
            obj = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key_from_url)
            result_bytes = obj['Body'].read()
            print(f"[RETOUCH] S3 direct download OK: {len(result_bytes)} bytes")
        except Exception as e:
            print(f"[RETOUCH] S3 direct download failed: {e}")

    if not result_bytes:
        download_headers = {}
        if 'io.foto-mix.ru' in result_url_from_api:
            download_headers['Authorization'] = _auth_header()
        resp = requests.get(result_url_from_api, headers=download_headers, timeout=(10, 120))
        if resp.status_code == 403:
            resp = requests.get(
                result_url_from_api,
                headers={'Authorization': _auth_header()},
                timeout=(10, 120)
            )
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to download result: HTTP {resp.status_code}")
        result_bytes = resp.content

    print(f"[RETOUCH] Downloaded {len(result_bytes)} bytes")

    if result_bytes[:2] == b'P6' or result_bytes[:2] == b'P3':
        print(f"[RETOUCH] PPM format detected, converting to JPEG")
        img = Image.open(io.BytesIO(result_bytes))
        buf = io.BytesIO()
        img.convert('RGB').save(buf, format='JPEG', quality=95)
        result_bytes = buf.getvalue()

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=out_key,
        Body=result_bytes,
        ContentType='image/jpeg'
    )
    final_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{out_key}"
    print(f"[RETOUCH] Uploaded to S3: {out_key}")

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE retouch_tasks SET status='finished', result_key=%s, result_url=%s, error_message=NULL, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
            (out_key, final_url, db_task_id, user_id)
        )
        conn.commit()

    if photo_id:
        _save_retouched_photo(conn, user_id, photo_id, out_key, final_url, result_bytes=result_bytes)

    return out_key, final_url


def _check_plugins_available():
    try:
        r = requests.get(
            f"{API_BASE}/health",
            headers={'Authorization': _auth_header()},
            timeout=10
        )
        api_ok = r.status_code == 200
    except Exception:
        api_ok = False

    return {
        "retouch_api": {
            "available": api_ok,
            "label": "Retouch API (io.foto-mix.ru)",
            "url": API_BASE,
        }
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Ретушь фотографий через API io.foto-mix.ru — асинхронная очередь (submit → poll status → скачать результат)."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')

    if not user_id:
        return _response(401, {'error': 'User not authenticated'})

    params = event.get('queryStringParameters', {}) or {}
    if params.get('check_plugins') == '1':
        return _response(200, {'plugins': _check_plugins_available()})

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

    strength = body.get('strength', None)
    enhance_face = body.get('enhance_face', None)
    if strength is None or enhance_face is None:
        db_strength, db_enhance_face = _load_retouch_settings(conn)
        if strength is None:
            strength = db_strength
        if enhance_face is None:
            enhance_face = db_enhance_face

    print(f"[RETOUCH] Starting: photo_id={photo_id}, in_key={in_key}, strength={strength}")

    try:
        s3_client = _get_s3_client()
        print(f"[RETOUCH] Downloading from S3: {in_key}")
        s3_resp = s3_client.get_object(Bucket=S3_BUCKET, Key=in_key)
        image_bytes = s3_resp['Body'].read()
        print(f"[RETOUCH] Downloaded {len(image_bytes)} bytes")

        image_base64 = base64.b64encode(image_bytes).decode('utf-8')

        api_task_id, api_status = _submit_async_task(image_base64, strength=strength, enhance_face=enhance_face)
        print(f"[RETOUCH] Submitted: api_task_id={api_task_id}, status={api_status}")

        with conn.cursor() as cur:
            cur.execute(
                '''INSERT INTO retouch_tasks (user_id, photo_id, task_id, status, in_bucket, in_key, out_bucket, out_prefix)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
                (user_id, photo_id, api_task_id, 'started', S3_BUCKET, in_key, S3_BUCKET, out_prefix)
            )
            conn.commit()

        return _response(200, {
            'task_id': api_task_id,
            'status': 'started',
            'result_url': None,
        })

    except Exception as e:
        import traceback
        print(f"[RETOUCH] Submit failed: {e}")
        print(f"[RETOUCH] Traceback: {traceback.format_exc()}")
        return _response(503, {'error': f'Сервер ретуши недоступен: {str(e)[:200]}'})


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
                f'SELECT task_id, photo_id, status, result_key, result_url, in_key, error_message, created_at, updated_at FROM retouch_tasks WHERE task_id IN ({placeholders}) AND user_id = %s',
                (*ids, user_id)
            )
            tasks = cur.fetchall()
        results = [_check_single_task(conn, user_id, t) for t in tasks]
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
            'SELECT task_id, photo_id, status, result_key, result_url, in_key, error_message, created_at, updated_at FROM retouch_tasks WHERE task_id = %s AND user_id = %s',
            (task_id, user_id)
        )
        task = cur.fetchone()

    if not task:
        return _response(404, {'error': 'Task not found'})

    return _response(200, _check_single_task(conn, user_id, task))


def _check_single_task(conn, user_id, task):
    """Проверить статус задачи — если ещё не finished, опросить API."""
    task = _sync_task_from_api(conn, user_id, task)
    return {
        'task_id': task['task_id'],
        'status': task['status'],
        'result_url': _presigned_url(task['result_key']) if task.get('result_key') else None,
        'error_message': task.get('error_message'),
    }


def _sync_task_from_api(conn, user_id, task):
    """Если задача ещё активна — проверить статус через API и обновить."""
    if task['status'] not in ('queued', 'started', 'processing', 'pending'):
        return task

    api_task_id = task['task_id']
    try:
        data = _check_api_status(api_task_id)
    except Exception as e:
        print(f"[RETOUCH] API status check failed for {api_task_id}: {e}")
        return task

    api_status = data.get('status', 'pending')

    if api_status == 'completed':
        result_url_from_api = data.get('result_url')
        if result_url_from_api:
            try:
                out_key, final_url = _download_result_and_save(conn, user_id, task, result_url_from_api)
                task = dict(task)
                task['status'] = 'finished'
                task['result_key'] = out_key
                task['result_url'] = final_url
            except Exception as e:
                import traceback
                print(f"[RETOUCH] Failed to download/save result: {e}")
                print(f"[RETOUCH] Traceback: {traceback.format_exc()}")
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                        (f"Ошибка сохранения: {str(e)[:300]}", api_task_id, user_id)
                    )
                    conn.commit()
                task = dict(task)
                task['status'] = 'failed'
                task['error_message'] = str(e)[:300]
        else:
            fallback_urls = [
                f"{API_BASE}/result/{api_task_id}",
                f"https://storage.yandexcloud.net/{S3_BUCKET}/retouch_results/{api_task_id}.jpg",
            ]
            downloaded = False
            for fallback_url in fallback_urls:
                try:
                    print(f"[RETOUCH] Trying fallback URL: {fallback_url}")
                    out_key, final_url = _download_result_and_save(conn, user_id, task, fallback_url)
                    task = dict(task)
                    task['status'] = 'finished'
                    task['result_key'] = out_key
                    task['result_url'] = final_url
                    downloaded = True
                    break
                except Exception as e:
                    print(f"[RETOUCH] Fallback {fallback_url} failed: {e}")
            if not downloaded:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                        ("Не удалось скачать результат ретуши", api_task_id, user_id)
                    )
                    conn.commit()
                task = dict(task)
                task['status'] = 'failed'
                task['error_message'] = 'Не удалось скачать результат ретуши'

        return task

    if api_status in ('failed', 'error'):
        error_msg = data.get('error', 'Processing failed')
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                (error_msg[:500], api_task_id, user_id)
            )
            conn.commit()
        task = dict(task)
        task['status'] = 'failed'
        task['error_message'] = error_msg
        return task

    if api_status in ('pending', 'processing'):
        new_status = 'processing'
        if task['status'] != new_status:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE retouch_tasks SET status=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                    (new_status, api_task_id, user_id)
                )
                conn.commit()
            task = dict(task)
            task['status'] = new_status

    return task


def _probe_retouch_api():
    results = {}
    try:
        r = requests.get(
            f"{API_BASE}/health",
            headers={'Authorization': _auth_header()},
            timeout=10
        )
        results["health"] = {"status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        results["health"] = {"error": str(e)}

    try:
        test_pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        r = requests.post(
            f"{API_BASE}/submit",
            headers={
                'Content-Type': 'application/json',
                'Authorization': _auth_header()
            },
            json={'image': test_pixel, 'strength': 0.6, 'enhance_face': False},
            timeout=15
        )
        results["submit_test"] = {"status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        results["submit_test"] = {"error": str(e)}

    return _response(200, results)