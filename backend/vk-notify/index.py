import json
import os
import random
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
from crypto_utils import decrypt_token

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')
VK_API_VERSION = '5.199'
VK_SERVICE_TOKEN = os.environ.get('VK_SERVICE_TOKEN', '')

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Content-Type': 'application/json',
}

FOOTER = '\n\n———\nСообщение отправлено автоматически через Foto-Mix.ru'


def resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False),
        'isBase64Encoded': False,
    }


def resolve_vk_id(screen_name: str) -> str:
    '''Определяет числовой VK id по ссылке/короткому имени через utils.resolveScreenName (сервисный токен).'''
    if not screen_name or not VK_SERVICE_TOKEN:
        return ''
    name = screen_name.strip()
    for prefix in ('https://vk.com/', 'http://vk.com/', 'vk.com/', '@'):
        if name.startswith(prefix):
            name = name[len(prefix):]
    name = name.strip('/')
    if name.startswith('id') and name[2:].isdigit():
        return name[2:]
    if name.isdigit():
        return name
    r = requests.post('https://api.vk.com/method/utils.resolveScreenName', data={
        'screen_name': name,
        'access_token': VK_SERVICE_TOKEN,
        'v': VK_API_VERSION,
    }, timeout=15)
    data = r.json().get('response') or {}
    if data.get('type') == 'user':
        return str(data.get('object_id'))
    return ''


def handler(event: dict, context):
    '''Отправка уведомления клиенту в личные сообщения ВКонтакте от имени сообщества фотографа.'''
    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return resp(405, {'error': 'Method not allowed'})

    user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id')
    if not user_id:
        return resp(401, {'error': 'User ID required'})

    raw_body = event.get('body') or '{}'
    try:
        body = json.loads(raw_body) if raw_body.strip() else {}
    except (ValueError, AttributeError):
        body = {}
    client_id = body.get('client_id')
    message = (body.get('message') or '').strip()

    if not client_id or not message:
        return resp(400, {'error': 'Нужны client_id и текст сообщения'})

    if not DATABASE_URL:
        return resp(500, {'error': 'Database not configured'})

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            f'SELECT vk_group_token FROM {SCHEMA}.vk_settings WHERE user_id = %s',
            (user_id,)
        )
        settings = cur.fetchone()
        group_token = (settings.get('vk_group_token') if settings else '') or ''
        group_token = decrypt_token(group_token).strip()

        cur.execute(
            f'SELECT name, vk_client_id, vk_profile, vk_username '
            f'FROM {SCHEMA}.clients WHERE id = %s AND user_id = %s',
            (str(client_id), user_id)
        )
        client = cur.fetchone()

        if not client:
            return resp(404, {'error': 'Клиент не найден'})

        if not group_token:
            return resp(400, {'error': 'Не подключено сообщество ВК для отправки сообщений (укажите токен группы в настройках)'})

        vk_client_id = (client.get('vk_client_id') or '').strip()
        if not vk_client_id:
            vk_client_id = resolve_vk_id(client.get('vk_profile') or client.get('vk_username') or '')
            if vk_client_id:
                cur.execute(
                    f'UPDATE {SCHEMA}.clients SET vk_client_id = %s WHERE id = %s',
                    (vk_client_id, str(client_id))
                )
                conn.commit()

        if not vk_client_id:
            return resp(400, {'error': 'У клиента не указана страница ВКонтакте (заполните VK в карточке клиента)'})

        r = requests.post('https://api.vk.com/method/messages.send', data={
            'user_id': vk_client_id,
            'message': message + FOOTER,
            'random_id': random.randint(1, 2_000_000_000),
            'access_token': group_token,
            'v': VK_API_VERSION,
        }, timeout=20)
        data = r.json()

        if 'error' in data:
            err = data['error']
            code = err.get('error_code')
            if code == 901:
                return resp(200, {
                    'success': False,
                    'need_permission': True,
                    'error': 'Клиент ещё не разрешил сообщения от сообщества. Попросите его написать в вашу группу ВК или нажать «Разрешить сообщения».'
                })
            return resp(400, {'success': False, 'error': err.get('error_msg', 'Ошибка VK')})

        cur.execute(
            f'UPDATE {SCHEMA}.clients SET vk_messages_allowed = TRUE WHERE id = %s',
            (str(client_id),)
        )
        conn.commit()

        return resp(200, {'success': True, 'message_id': data.get('response')})
    except Exception as e:
        return resp(400, {'success': False, 'error': str(e)})
    finally:
        cur.close()
        conn.close()