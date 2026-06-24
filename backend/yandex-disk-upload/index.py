"""
Business: Загрузка всех фото галереи по общей ссылке напрямую на Яндекс.Диск клиента.
Клиент авторизуется в своём Яндекс.Диске, фото копируются с нашего S3 в его облако
методом upload-by-url (Яндекс сам скачивает файлы на большой скорости).
Args: event с action (auth_url|upload), code (короткая ссылка галереи), token (OAuth Яндекс.Диска)
Returns: HTTP JSON с auth_url либо со статистикой постановки фото в загрузку
"""

import json
import os
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, List
import boto3
from botocore.client import Config
import psycopg2

SCHEMA = 't_p28211681_photo_secure_web'
YANDEX_OAUTH_AUTHORIZE = 'https://oauth.yandex.ru/authorize'
YANDEX_OAUTH_TOKEN = 'https://oauth.yandex.ru/token'
YANDEX_DISK_API = 'https://cloud-api.yandex.net/v1/disk'

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
    # Приложение типа "десктопное": Яндекс показывает страницу с кодом подтверждения,
    # который клиент вводит вручную. Этот redirect_uri фиксирован самим Яндексом.
    return 'https://oauth.yandex.ru/verification_code'


def _get_s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=os.environ['YC_S3_KEY_ID'],
        aws_secret_access_key=os.environ['YC_S3_SECRET'],
        region_name='ru-central1',
        config=Config(signature_version='s3v4'),
    )


def _presign(s3, key: str) -> str:
    return s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': 'foto-mix', 'Key': key},
        ExpiresIn=3600,
    )


def _yandex_disk_request(method: str, path: str, token: str, params: Dict[str, str] = None) -> Dict[str, Any]:
    url = f'{YANDEX_DISK_API}{path}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, method=method)
    req.add_header('Authorization', f'OAuth {token}')
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read().decode()
            return {'status': r.status, 'data': json.loads(data) if data else {}}
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ''
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {'raw': body}
        return {'status': e.code, 'data': parsed}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')

    # 1) Отдаём ссылку на авторизацию Яндекс.Диска
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

    # 2) Загрузка фото галереи на Диск клиента
    if method == 'POST':
        try:
            body = json.loads(event.get('body', '{}') or '{}')
        except Exception:
            body = {}
        token = body.get('token', '')
        auth_code = str(body.get('auth_code', '') or '').strip()
        share_code = body.get('code', '')
        subfolder_id = body.get('subfolder_id')
        try:
            batch_offset = int(body.get('offset', 0) or 0)
        except (ValueError, TypeError):
            batch_offset = 0
        try:
            batch_limit = int(body.get('limit', 0) or 0)
        except (ValueError, TypeError):
            batch_limit = 0
        try:
            subfolder_id = int(subfolder_id) if subfolder_id is not None and str(subfolder_id) != '' else None
        except (ValueError, TypeError):
            subfolder_id = None

        if not share_code:
            return _resp(400, {'error': 'Не передан код галереи'})

        # Обмен кода подтверждения Яндекса на токен доступа
        if not token and auth_code:
            client_id = os.environ.get('YANDEX_DISK_CLIENT_ID', '')
            client_secret = os.environ.get('YANDEX_DISK_CLIENT_SECRET', '')
            if not client_id or not client_secret:
                return _resp(500, {'error': 'Яндекс.Диск не настроен'})
            data = urllib.parse.urlencode({
                'grant_type': 'authorization_code',
                'code': auth_code,
                'client_id': client_id,
                'client_secret': client_secret,
            }).encode()
            try:
                req = urllib.request.Request(YANDEX_OAUTH_TOKEN, data=data, method='POST')
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')
                with urllib.request.urlopen(req) as r:
                    tok_data = json.loads(r.read().decode())
                token = tok_data.get('access_token', '')
            except urllib.error.HTTPError as e:
                body_err = e.read().decode() if e.fp else ''
                return _resp(400, {'error': f'Неверный код подтверждения: {body_err[:200]}'})

        if not token:
            return _resp(400, {'error': 'Не передан токен или код Яндекс.Диска'})

        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        try:
            cur = conn.cursor()
            cur.execute(
                f"""
                SELECT fsl.folder_id, pf.folder_name, fsl.download_disabled
                FROM {SCHEMA}.folder_short_links fsl
                JOIN {SCHEMA}.photo_folders pf ON pf.id = fsl.folder_id
                WHERE fsl.short_code = %s
                """,
                (share_code,),
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {'error': 'Галерея не найдена'})
            folder_id, folder_name, download_disabled = row
            if download_disabled:
                return _resp(403, {'error': 'Скачивание для этой галереи отключено'})

            # Если открыта подпапка — грузим именно её (проверяем, что она
            # принадлежит дереву папки короткой ссылки).
            if subfolder_id:
                target_id = subfolder_id
                belongs = False
                for _ in range(10):
                    if target_id == folder_id:
                        belongs = True
                        break
                    cur.execute(
                        f"SELECT parent_folder_id FROM {SCHEMA}.photo_folders WHERE id = %s",
                        (target_id,),
                    )
                    pr = cur.fetchone()
                    if not pr or not pr[0]:
                        break
                    target_id = pr[0]
                if belongs:
                    cur.execute(
                        f"SELECT folder_name FROM {SCHEMA}.photo_folders WHERE id = %s",
                        (subfolder_id,),
                    )
                    nm = cur.fetchone()
                    if nm:
                        folder_id = subfolder_id
                        folder_name = nm[0]

            cur.execute(
                f"""
                SELECT s3_key, file_name FROM (
                    SELECT DISTINCT ON (s3_key) s3_key, file_name, id
                    FROM {SCHEMA}.photo_bank
                    WHERE folder_id = %s AND s3_key IS NOT NULL AND is_trashed = false
                    ORDER BY s3_key, id
                ) sub
                ORDER BY CAST(NULLIF(regexp_replace(file_name, '[^0-9]', '', 'g'), '') AS bigint) ASC NULLS LAST, file_name ASC
                """,
                (folder_id,),
            )
            photos: List = cur.fetchall()
        finally:
            conn.close()

        if not photos:
            return _resp(400, {'error': 'В галерее нет фото'})

        total = len(photos)

        # Папка назначения на Диске клиента
        safe_name = ''.join(ch for ch in str(folder_name or 'Галерея') if ch not in '\\/:*?"<>|').strip() or 'Галерея'
        disk_dir = f'/{safe_name}'

        # Создаём папку только на первом батче
        if batch_offset <= 0:
            _yandex_disk_request('PUT', '/resources', token, {'path': disk_dir})

        # Берём срез фото для этого батча (для прогресса). Если limit не задан — грузим все.
        if batch_limit and batch_limit > 0:
            batch = photos[batch_offset:batch_offset + batch_limit]
        else:
            batch = photos[batch_offset:] if batch_offset else photos

        s3 = _get_s3_client()
        queued = 0
        failed = 0
        errors: List[str] = []
        # Уникальность имён по позиции файла во всём списке (стабильно между батчами)
        used_names: Dict[str, int] = {}
        for idx, (sk, fn) in enumerate(photos):
            base = (fn or '').strip() or sk.split('/')[-1]
            used_names[base] = used_names.get(base, 0) + 1

        seen: Dict[str, int] = {}

        def unique_name(raw: str) -> str:
            seen[raw] = seen.get(raw, 0)
            if used_names.get(raw, 0) > 1 and seen[raw] > 0:
                dot = raw.rfind('.')
                out = f'{raw[:dot]}_{seen[raw]}{raw[dot:]}' if dot > 0 else f'{raw}_{seen[raw]}'
            else:
                out = raw
            seen[raw] += 1
            return out

        # Восстанавливаем счётчик seen до текущего offset, чтобы имена не конфликтовали между батчами
        for s3_key, file_name in photos[:batch_offset]:
            unique_name((file_name or '').strip() or s3_key.split('/')[-1])

        for s3_key, file_name in batch:
            try:
                name = unique_name((file_name or '').strip() or s3_key.split('/')[-1])
                source_url = _presign(s3, s3_key)
                dest_path = f'{disk_dir}/{name}'
                result = _yandex_disk_request('POST', '/resources/upload', token, {
                    'path': dest_path,
                    'url': source_url,
                })
                if result['status'] in (200, 201, 202):
                    queued += 1
                else:
                    failed += 1
                    if len(errors) < 5:
                        errors.append(f"{name}: {result['data'].get('message', result['status'])}")
            except Exception as e:
                failed += 1
                if len(errors) < 5:
                    errors.append(f"{file_name}: {str(e)}")

        processed = batch_offset + len(batch)
        done = processed >= total

        return _resp(200, {
            'success': queued > 0 or done,
            'folder_name': folder_name,
            'disk_folder': disk_dir,
            'total': total,
            'processed': processed,
            'queued': queued,
            'failed': failed,
            'done': done,
            'token': token,
            'errors': errors,
        })

    return _resp(400, {'error': 'Unknown action'})