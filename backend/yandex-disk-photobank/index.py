"""
Business: Интеграция фотобанка фотографа с личным Яндекс.Диском.
Импорт: берёт фото из выбранной папки на Яндекс.Диске фотографа и загружает их в фотобанк.
Экспорт: сохраняет фото выбранной папки фотобанка на Яндекс.Диск фотографа (upload-by-url).
Авторизация разовая: фотограф вводит код подтверждения Яндекса, код меняется на токен.
Args: event с action (auth_url|list_folders|import|export), token/auth_code, folder_id/disk_path, offset/limit
Returns: HTTP JSON с auth_url, списком папок или статистикой обработки пачки
"""

import json
import os
import urllib.request
import urllib.error
import urllib.parse
from io import BytesIO
from typing import Dict, Any, List

import boto3
from botocore.client import Config
import psycopg2
from PIL import Image

SCHEMA = 't_p28211681_photo_secure_web'
YANDEX_OAUTH_AUTHORIZE = 'https://oauth.yandex.ru/authorize'
YANDEX_OAUTH_TOKEN = 'https://oauth.yandex.ru/token'
YANDEX_DISK_API = 'https://cloud-api.yandex.net/v1/disk'
BUCKET = 'foto-mix'
S3_ENDPOINT = 'https://storage.yandexcloud.net'
IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
              '.webp', '.heic', '.raw', '.cr2', '.nef', '.arw', '.dng')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
}


def _resp(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {'statusCode': status, 'headers': CORS_HEADERS, 'body': json.dumps(body), 'isBase64Encoded': False}


def _redirect_uri() -> str:
    # Приложение показывает страницу с кодом подтверждения, который фотограф вводит вручную.
    return 'https://oauth.yandex.ru/verification_code'


def _s3():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=os.environ['YC_S3_KEY_ID'],
        aws_secret_access_key=os.environ['YC_S3_SECRET'],
        region_name='ru-central1',
        config=Config(signature_version='s3v4'),
    )


def _presign(s3, key: str) -> str:
    return s3.generate_presigned_url('get_object', Params={'Bucket': BUCKET, 'Key': key}, ExpiresIn=3600)


def _disk_request(method: str, path: str, token: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    url = f'{YANDEX_DISK_API}{path}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method=method)
    req.add_header('Authorization', f'OAuth {token}')
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            data = r.read().decode()
            return {'status': r.status, 'data': json.loads(data) if data else {}}
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {'raw': body}
        return {'status': e.code, 'data': parsed}


def _exchange_code(auth_code: str) -> str:
    """Обменять код подтверждения Яндекса на access_token. Бросает ValueError при ошибке."""
    client_id = os.environ.get('YANDEX_DISK_CLIENT_ID', '')
    client_secret = os.environ.get('YANDEX_DISK_CLIENT_SECRET', '')
    if not client_id or not client_secret:
        raise ValueError('Яндекс.Диск не настроен')
    data = urllib.parse.urlencode({
        'grant_type': 'authorization_code',
        'code': auth_code,
        'client_id': client_id,
        'client_secret': client_secret,
    }).encode()
    try:
        req = urllib.request.Request(YANDEX_OAUTH_TOKEN, data=data, method='POST')
        req.add_header('Content-Type', 'application/x-www-form-urlencoded')
        with urllib.request.urlopen(req, timeout=20) as r:
            tok = json.loads(r.read().decode())
        access = tok.get('access_token', '')
        if not access:
            raise ValueError('Не удалось получить токен Яндекс.Диска')
        return access
    except urllib.error.HTTPError as e:
        body_err = e.read().decode() if e.fp else ''
        raise ValueError(f'Неверный код подтверждения: {body_err[:200]}')


def _resolve_token(body: Dict[str, Any]) -> str:
    token = str(body.get('token', '') or '').strip()
    auth_code = str(body.get('auth_code', '') or '').strip()
    if not token and auth_code:
        token = _exchange_code(auth_code)
    return token


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')
    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')

    # 1) Ссылка на авторизацию Яндекс.Диска (нужны права чтения и записи)
    if action == 'auth_url':
        client_id = os.environ.get('YANDEX_DISK_CLIENT_ID', '')
        if not client_id:
            return _resp(500, {'error': 'YANDEX_DISK_CLIENT_ID not configured'})
        params = {
            'response_type': 'code',
            'client_id': client_id,
            'redirect_uri': _redirect_uri(),
            'force_confirm': 'yes',
        }
        return _resp(200, {'auth_url': f'{YANDEX_OAUTH_AUTHORIZE}?{urllib.parse.urlencode(params)}'})

    # 1.5) Прокси изображения Яндекс.Диска (превью или оригинал) — для показа в <img>.
    # Превью-ссылки Яндекса требуют OAuth-заголовок, поэтому качаем на бэкенде.
    if action == 'image':
        img_token = str(qs.get('token', '') or '').strip()
        img_path = str(qs.get('path', '') or '').strip()
        size = str(qs.get('size', 'preview') or 'preview').strip()
        if not img_token or not img_path:
            return _resp(400, {'error': 'Не переданы token или path'})
        try:
            if size == 'orig':
                src_url = _download_href(img_token, img_path)
            else:
                info = _disk_request('GET', '/resources', img_token, {
                    'path': img_path,
                    'preview_size': 'XXXL',
                    'preview_crop': 'false',
                    'fields': 'preview,file',
                })
                src_url = (info['data'].get('preview') if info['status'] == 200 else '') or ''
                if not src_url:
                    src_url = _download_href(img_token, img_path)
            if not src_url:
                return _resp(404, {'error': 'Изображение не найдено'})
            req = urllib.request.Request(src_url)
            req.add_header('Authorization', f'OAuth {img_token}')
            with urllib.request.urlopen(req, timeout=25) as r:
                content = r.read()
                ctype = r.headers.get('Content-Type', 'image/jpeg')
            import base64 as _b64
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': ctype,
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'public, max-age=3600',
                },
                'body': _b64.b64encode(content).decode(),
                'isBase64Encoded': True,
            }
        except Exception as e:
            return _resp(400, {'error': f'Не удалось загрузить изображение: {str(e)[:120]}'})

    if method != 'POST':
        return _resp(405, {'error': 'Method not allowed'})

    if not user_id:
        return _resp(401, {'error': 'Unauthorized'})

    try:
        body = json.loads(event.get('body', '{}') or '{}')
    except Exception:
        body = {}

    op = body.get('op', '')

    try:
        token = _resolve_token(body)
    except ValueError as e:
        return _resp(400, {'error': str(e)})
    if not token:
        return _resp(400, {'error': 'Не передан токен или код Яндекс.Диска'})

    if op == 'list_folders':
        return _list_folders(token, str(body.get('path', '/') or '/'))
    if op == 'list_photos':
        return _list_photos(token, str(body.get('path', '/') or '/'))
    if op == 'exchange':
        return _resp(200, {'token': token})
    if op == 'import':
        return _import(token, user_id, body)
    if op == 'export':
        return _export(token, user_id, body)

    return _resp(400, {'error': 'Неизвестная операция'})


def _list_folders(token: str, path: str) -> Dict[str, Any]:
    """Список подпапок и количество фото по указанному пути Диска."""
    res = _disk_request('GET', '/resources', token, {
        'path': path,
        'limit': 500,
        'fields': '_embedded.items.name,_embedded.items.path,_embedded.items.type,_embedded.items.media_type',
    })
    if res['status'] == 401:
        return _resp(401, {'error': 'Нет доступа к Яндекс.Диску. Авторизуйтесь заново.'})
    if res['status'] == 403:
        return _resp(403, {'error': 'Недостаточно прав. Разрешите приложению чтение Диска (cloud_api:disk.read).'})
    if res['status'] != 200:
        return _resp(400, {'error': 'Не удалось получить список папок Яндекс.Диска'})

    items = (res['data'].get('_embedded', {}) or {}).get('items', []) or []
    folders = []
    photos_here = 0
    for it in items:
        if it.get('type') == 'dir':
            folders.append({'name': it.get('name'), 'path': it.get('path', '').replace('disk:', '')})
        elif it.get('type') == 'file':
            nm = (it.get('name') or '').lower()
            if it.get('media_type') == 'image' or nm.endswith(IMAGE_EXTS):
                photos_here += 1
    folders.sort(key=lambda f: (f['name'] or '').lower())
    return _resp(200, {'path': path, 'folders': folders, 'photos_here': photos_here, 'token': token})


def _list_photos(token: str, path: str) -> Dict[str, Any]:
    """Список фото в папке с превью для просмотра (без импорта)."""
    photos: List[Dict[str, Any]] = []
    offset = 0
    while True:
        res = _disk_request('GET', '/resources', token, {
            'path': path,
            'limit': 200,
            'offset': offset,
            'preview_size': 'XXXL',
            'preview_crop': 'false',
            'fields': ('_embedded.total,_embedded.items.name,_embedded.items.path,'
                       '_embedded.items.type,_embedded.items.media_type,_embedded.items.mime_type,'
                       '_embedded.items.size,_embedded.items.preview,_embedded.items.file'),
        })
        if res['status'] == 401:
            return _resp(401, {'error': 'Нет доступа к Яндекс.Диску. Авторизуйтесь заново.'})
        if res['status'] == 403:
            return _resp(403, {'error': 'Недостаточно прав. Разрешите приложению чтение Диска (cloud_api:disk.read).'})
        if res['status'] != 200:
            return _resp(400, {'error': 'Не удалось получить список фото Яндекс.Диска'})
        emb = res['data'].get('_embedded', {}) or {}
        items = emb.get('items', []) or []
        for it in items:
            if it.get('type') != 'file':
                continue
            nm = (it.get('name') or '')
            if it.get('media_type') == 'image' or nm.lower().endswith(IMAGE_EXTS):
                photos.append({
                    'name': nm.strip(),
                    'path': (it.get('path', '') or '').replace('disk:', ''),
                    'preview': it.get('preview', '') or '',
                    'file': it.get('file', '') or '',
                    'size': it.get('size', 0) or 0,
                    'mime_type': it.get('mime_type', '') or '',
                })
        total = emb.get('total', 0)
        offset += len(items)
        if not items or offset >= total:
            break
    photos.sort(key=lambda p: (p['name'] or '').lower())
    return _resp(200, {'path': path, 'photos': photos, 'count': len(photos), 'token': token})


def _list_images(token: str, path: str) -> List[Dict[str, str]]:
    """Все файлы-изображения в папке (без рекурсии)."""
    images = []
    offset = 0
    while True:
        res = _disk_request('GET', '/resources', token, {
            'path': path,
            'limit': 200,
            'offset': offset,
            'fields': '_embedded.items.name,_embedded.items.type,_embedded.items.media_type,_embedded.items.file,_embedded.total',
        })
        if res['status'] != 200:
            break
        emb = res['data'].get('_embedded', {}) or {}
        items = emb.get('items', []) or []
        for it in items:
            if it.get('type') != 'file':
                continue
            nm = (it.get('name') or '')
            if it.get('media_type') == 'image' or nm.lower().endswith(IMAGE_EXTS):
                images.append({'name': nm.strip()})
        total = emb.get('total', 0)
        offset += len(items)
        if not items or offset >= total:
            break
    return images


def _download_href(token: str, disk_file_path: str) -> str:
    res = _disk_request('GET', '/resources/download', token, {'path': disk_file_path})
    if res['status'] == 200:
        return res['data'].get('href', '')
    return ''


def _make_thumbnails(s3, file_content: bytes, s3_prefix: str, filename: str):
    """Возвращает (width, height, thumb_key, thumb_url, grid_key, grid_url) либо None-поля."""
    width = height = None
    thumb_key = thumb_url = grid_key = grid_url = None
    is_raw = filename.lower().endswith(('.cr2', '.nef', '.arw', '.dng', '.raw'))
    if is_raw:
        return width, height, thumb_key, thumb_url, grid_key, grid_url, is_raw
    try:
        img = Image.open(BytesIO(file_content))
        width, height = img.size
        base_name = os.path.splitext(filename)[0]

        big = img.copy()
        big.thumbnail((2000, 2000), Image.Resampling.LANCZOS)
        if big.mode in ('RGBA', 'LA', 'P'):
            bg = Image.new('RGB', big.size, (255, 255, 255))
            if big.mode == 'P':
                big = big.convert('RGBA')
            bg.paste(big, mask=big.getchannel('A') if 'A' in big.getbands() else None)
            big = bg
        elif big.mode != 'RGB':
            big = big.convert('RGB')
        buf = BytesIO()
        big.save(buf, format='JPEG', quality=85, optimize=True)
        thumb_key = f'{s3_prefix}thumbnails/{base_name}.jpg'
        s3.put_object(Bucket=BUCKET, Key=thumb_key, Body=buf.getvalue(), ContentType='image/jpeg')
        thumb_url = f'{S3_ENDPOINT}/{BUCKET}/{thumb_key}'

        grid = Image.open(BytesIO(file_content))
        grid.thumbnail((400, 400), Image.Resampling.LANCZOS)
        if grid.mode != 'RGB':
            grid = grid.convert('RGB')
        gbuf = BytesIO()
        grid.save(gbuf, format='JPEG', quality=60, optimize=True)
        grid_key = f'{s3_prefix}thumbnails/grid_{base_name}.jpg'
        s3.put_object(Bucket=BUCKET, Key=grid_key, Body=gbuf.getvalue(), ContentType='image/jpeg')
        grid_url = f'{S3_ENDPOINT}/{BUCKET}/{grid_key}'
    except Exception as e:
        print(f'[YD_PB] thumbnail error for {filename}: {e}')
    return width, height, thumb_key, thumb_url, grid_key, grid_url, is_raw


def _import(token: str, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Импорт пачки фото из папки Яндекс.Диска в папку фотобанка."""
    import requests

    disk_path = str(body.get('disk_path', '') or '').strip()
    if not disk_path:
        return _resp(400, {'error': 'Не указана папка на Яндекс.Диске'})
    target_folder_id = body.get('folder_id')
    disk_folder_name = disk_path.rstrip('/').split('/')[-1] or 'Яндекс.Диск'
    try:
        offset = int(body.get('offset', 0) or 0)
    except (ValueError, TypeError):
        offset = 0
    batch = 5

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        cur = conn.cursor()

        # Создаём папку фотобанка при первом батче, если не передана
        if not target_folder_id:
            import time as _t
            s3_prefix = f'uploads/{user_id}/{int(_t.time())}/'
            cur.execute(
                f"""INSERT INTO {SCHEMA}.photo_folders
                    (user_id, folder_name, s3_prefix, folder_type, created_at, updated_at)
                    VALUES (%s, %s, %s, 'originals', NOW(), NOW()) RETURNING id""",
                (user_id, disk_folder_name, s3_prefix),
            )
            target_folder_id = cur.fetchone()[0]
            conn.commit()
        else:
            cur.execute(f"SELECT s3_prefix FROM {SCHEMA}.photo_folders WHERE id = %s AND user_id = %s",
                        (target_folder_id, user_id))
            r = cur.fetchone()
            if not r:
                return _resp(404, {'error': 'Папка фотобанка не найдена'})

        # Полный список изображений папки Диска
        images = _list_images(token, disk_path)
        total = len(images)
        if total == 0:
            return _resp(400, {'error': 'В папке Яндекс.Диска нет фото', 'folder_id': target_folder_id})

        chunk = images[offset:offset + batch]

        cur.execute(f"SELECT s3_prefix FROM {SCHEMA}.photo_folders WHERE id = %s", (target_folder_id,))
        s3_prefix = cur.fetchone()[0]

        s3 = _s3()
        uploaded = 0
        failed = 0
        errors: List[str] = []

        for img in chunk:
            filename = img['name']
            file_path = disk_path.rstrip('/') + '/' + filename
            try:
                href = _download_href(token, file_path)
                if not href:
                    failed += 1
                    continue
                resp = requests.get(href, timeout=25)
                resp.raise_for_status()
                content = resp.content
                file_size = len(content)

                s3_key = f'{s3_prefix}{filename}'
                s3.put_object(Bucket=BUCKET, Key=s3_key, Body=content,
                              ContentType=resp.headers.get('content-type', 'application/octet-stream'))
                s3_url = f'{S3_ENDPOINT}/{BUCKET}/{s3_key}'

                (width, height, tk, tu, gk, gu, is_raw) = _make_thumbnails(s3, content, s3_prefix, filename)

                cur.execute(
                    f"SELECT id FROM {SCHEMA}.photo_bank WHERE folder_id = %s AND s3_key = %s AND is_trashed = false",
                    (target_folder_id, s3_key))
                if cur.fetchone():
                    uploaded += 1
                    continue
                cur.execute(
                    f"""INSERT INTO {SCHEMA}.photo_bank
                        (user_id, folder_id, file_name, s3_key, s3_url, file_size, width, height,
                         thumbnail_s3_key, thumbnail_s3_url, grid_thumbnail_s3_key, grid_thumbnail_s3_url, is_raw)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (user_id, target_folder_id, filename, s3_key, s3_url, file_size, width, height,
                     tk, tu, gk, gu, is_raw))
                conn.commit()
                uploaded += 1
            except Exception as e:
                failed += 1
                if len(errors) < 5:
                    errors.append(f'{filename}: {str(e)[:120]}')
                print(f'[YD_PB] import error {filename}: {e}')

        processed_next = offset + len(chunk)
        done = processed_next >= total
        return _resp(200, {
            'success': True,
            'folder_id': target_folder_id,
            'folder_name': disk_folder_name,
            'total': total,
            'processed': processed_next,
            'uploaded': uploaded,
            'failed': failed,
            'done': done,
            'token': token,
            'errors': errors,
        })
    finally:
        conn.close()


def _export(token: str, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Экспорт пачки фото папки фотобанка на Яндекс.Диск (upload-by-url)."""
    folder_id = body.get('folder_id')
    if not folder_id:
        return _resp(400, {'error': 'Не указана папка фотобанка'})
    try:
        offset = int(body.get('offset', 0) or 0)
    except (ValueError, TypeError):
        offset = 0
    batch = 15

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT folder_name FROM {SCHEMA}.photo_folders WHERE id = %s AND user_id = %s",
                    (folder_id, user_id))
        row = cur.fetchone()
        if not row:
            return _resp(404, {'error': 'Папка фотобанка не найдена'})
        folder_name = row[0] or 'Фотобанк'

        cur.execute(
            f"""SELECT s3_key, file_name FROM (
                    SELECT DISTINCT ON (s3_key) s3_key, file_name, id
                    FROM {SCHEMA}.photo_bank
                    WHERE folder_id = %s AND s3_key IS NOT NULL AND is_trashed = false
                    ORDER BY s3_key, id
                ) sub
                ORDER BY CAST(NULLIF(regexp_replace(file_name, '[^0-9]', '', 'g'), '') AS bigint) ASC NULLS LAST, file_name ASC""",
            (folder_id,))
        photos = cur.fetchall()
    finally:
        conn.close()

    total = len(photos)
    if total == 0:
        return _resp(400, {'error': 'В папке нет фото'})

    # Целевая папка на Диске
    disk_folder = '/' + folder_name.replace('/', '_').strip()
    _disk_request('PUT', '/resources', token, {'path': disk_folder})

    s3 = _s3()
    chunk = photos[offset:offset + batch]
    queued = 0
    failed = 0
    errors: List[str] = []
    for s3_key, file_name in chunk:
        try:
            src = _presign(s3, s3_key)
            dst = f'{disk_folder}/{file_name}'
            res = _disk_request('POST', '/resources/upload', token, {'url': src, 'path': dst, 'disable_redirects': 'true'})
            if res['status'] in (200, 201, 202):
                queued += 1
            elif res['status'] == 409:
                queued += 1  # уже существует — считаем успешным
            elif res['status'] in (401, 403):
                return _resp(res['status'], {'error': 'Нет прав на запись в Яндекс.Диск. Авторизуйтесь заново.'})
            else:
                failed += 1
                if len(errors) < 5:
                    errors.append(f'{file_name}: HTTP {res["status"]}')
        except Exception as e:
            failed += 1
            if len(errors) < 5:
                errors.append(f'{file_name}: {str(e)[:120]}')

    processed_next = offset + len(chunk)
    done = processed_next >= total
    return _resp(200, {
        'success': True,
        'folder_name': folder_name,
        'disk_folder': disk_folder,
        'total': total,
        'processed': processed_next,
        'queued': queued,
        'failed': failed,
        'done': done,
        'token': token,
        'errors': errors,
    })