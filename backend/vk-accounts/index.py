import json
import os
import psycopg2
import requests
from psycopg2.extras import RealDictCursor
from crypto_utils import encrypt_token, decrypt_token

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')
DATABASE_URL = os.environ.get('DATABASE_URL', '')
VK_API_VERSION = '5.199'

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
}


def resp(status: int, payload: dict):
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(payload, ensure_ascii=False),
        'isBase64Encoded': False,
    }


def extract_token(raw: str) -> str:
    '''Достаёт токен из вставленной ссылки oauth.vk.com или возвращает как есть.'''
    value = (raw or '').strip()
    if not value:
        return ''
    if 'access_token=' in value:
        tail = value.split('access_token=', 1)[1]
        for sep in ('&', '#', ' '):
            tail = tail.split(sep, 1)[0]
        return tail.strip()
    return value


def verify_token(kind: str, target: str, token: str):
    '''Проверяет токен в ВК и возвращает название и числовой id.'''
    if kind == 'group':
        r = requests.get('https://api.vk.com/method/groups.getById', params={
            'group_id': target,
            'access_token': token,
            'v': VK_API_VERSION,
        }, timeout=15)
        data = r.json()
        if 'error' in data:
            return None, data['error'].get('error_msg', 'Ошибка ВК')
        info = data.get('response')
        group = None
        if isinstance(info, dict):
            group = (info.get('groups') or [None])[0]
        elif isinstance(info, list) and info:
            group = info[0]
        if not group:
            return None, 'Сообщество не найдено'
        return {
            'vk_target_id': str(group.get('id') or ''),
            'vk_screen_name': group.get('screen_name') or '',
            'title': group.get('name') or 'Сообщество ВК',
        }, None

    r = requests.get('https://api.vk.com/method/users.get', params={
        'access_token': token,
        'fields': 'screen_name',
        'v': VK_API_VERSION,
    }, timeout=15)
    data = r.json()
    if 'error' in data:
        return None, data['error'].get('error_msg', 'Ошибка ВК')
    users = data.get('response') or []
    if not users:
        return None, 'Не удалось определить страницу ВК'
    u = users[0]
    name = f"{u.get('first_name', '')} {u.get('last_name', '')}".strip()
    return {
        'vk_target_id': str(u.get('id') or ''),
        'vk_screen_name': u.get('screen_name') or '',
        'title': name or 'Личная страница',
    }, None


def list_accounts(cur, user_id: str):
    cur.execute(
        f'SELECT id, title, kind, vk_target_id, vk_screen_name, is_default, is_active, '
        f'(access_token <> %s) AS has_token '
        f'FROM {SCHEMA}.vk_accounts WHERE user_id = %s ORDER BY is_default DESC, id',
        ('', user_id)
    )
    rows = cur.fetchall()
    return [dict(r) for r in rows]


def handler(event: dict, context):
    '''Управление несколькими подключениями ВКонтакте: сообщества и личные страницы фотографа.'''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return resp(401, {'error': 'User ID required'})

    if not DATABASE_URL:
        return resp(500, {'error': 'Database not configured'})

    raw_body = event.get('body') or '{}'
    try:
        body = json.loads(raw_body) if raw_body.strip() else {}
    except (ValueError, AttributeError):
        body = {}

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if method == 'GET':
            return resp(200, {'success': True, 'accounts': list_accounts(cur, user_id)})

        if method != 'POST':
            return resp(405, {'error': 'Method not allowed'})

        action = (body.get('action') or 'save').strip()

        if action == 'auth_url':
            client_id = os.environ.get('VK_CLIENT_ID', '').strip()
            if not client_id:
                return resp(400, {'error': 'Приложение ВК не настроено'})
            url = (
                'https://oauth.vk.com/authorize'
                f'?client_id={client_id}'
                '&scope=messages,offline'
                '&redirect_uri=https://oauth.vk.com/blank.html'
                '&display=page&response_type=token&revoke=1'
            )
            return resp(200, {'success': True, 'auth_url': url})

        if action == 'delete':
            account_id = body.get('id')
            if not account_id:
                return resp(400, {'error': 'Не указан аккаунт'})
            cur.execute(
                f'DELETE FROM {SCHEMA}.vk_accounts WHERE id = %s AND user_id = %s',
                (str(account_id), user_id)
            )
            conn.commit()
            return resp(200, {'success': True, 'accounts': list_accounts(cur, user_id)})

        if action == 'set_default':
            account_id = body.get('id')
            if not account_id:
                return resp(400, {'error': 'Не указан аккаунт'})
            cur.execute(
                f'UPDATE {SCHEMA}.vk_accounts SET is_default = FALSE WHERE user_id = %s',
                (user_id,)
            )
            cur.execute(
                f'UPDATE {SCHEMA}.vk_accounts SET is_default = TRUE WHERE id = %s AND user_id = %s',
                (str(account_id), user_id)
            )
            conn.commit()
            return resp(200, {'success': True, 'accounts': list_accounts(cur, user_id)})

        kind = (body.get('kind') or 'group').strip()
        target = (body.get('vk_target_id') or '').strip()
        token = (body.get('access_token') or '').strip()
        custom_title = (body.get('title') or '').strip()
        account_id = body.get('id')

        if kind not in ('group', 'user'):
            return resp(400, {'error': 'Неверный тип подключения'})

        if account_id and not token:
            cur.execute(
                f'SELECT access_token FROM {SCHEMA}.vk_accounts WHERE id = %s AND user_id = %s',
                (str(account_id), user_id)
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {'error': 'Подключение не найдено'})
            token = decrypt_token(row['access_token'] or '')

        token = extract_token(token)

        if not token:
            return resp(400, {'error': 'Укажите токен доступа'})

        if not token.startswith('vk1.'):
            return resp(400, {
                'error': 'Не похоже на токен ВК. Вставьте ссылку из адресной строки целиком — токен начинается с vk1.a'
            })

        if kind == 'group' and not target:
            return resp(400, {'error': 'Укажите ID или короткое имя сообщества'})

        info, error = verify_token(kind, target, token)
        if error:
            return resp(400, {'error': f'ВКонтакте не принял токен: {error}'})

        title = custom_title or info['title']

        cur.execute(f'SELECT COUNT(*) AS cnt FROM {SCHEMA}.vk_accounts WHERE user_id = %s', (user_id,))
        is_first = (cur.fetchone() or {}).get('cnt', 0) == 0

        if account_id:
            cur.execute(
                f'UPDATE {SCHEMA}.vk_accounts SET title = %s, kind = %s, vk_target_id = %s, '
                f'vk_screen_name = %s, access_token = %s, updated_at = CURRENT_TIMESTAMP '
                f'WHERE id = %s AND user_id = %s',
                (title, kind, info['vk_target_id'], info['vk_screen_name'],
                 encrypt_token(token), str(account_id), user_id)
            )
        else:
            cur.execute(
                f'INSERT INTO {SCHEMA}.vk_accounts '
                f'(user_id, title, kind, vk_target_id, vk_screen_name, access_token, is_default) '
                f'VALUES (%s, %s, %s, %s, %s, %s, %s)',
                (user_id, title, kind, info['vk_target_id'], info['vk_screen_name'],
                 encrypt_token(token), is_first)
            )
        conn.commit()

        return resp(200, {'success': True, 'accounts': list_accounts(cur, user_id)})
    finally:
        cur.close()
        conn.close()