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


def build_invite_link(user_id: str, account_id=None):
    '''Ссылка на диалог с сообществом или страницей фотографа, чтобы клиент написал первым.'''
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if account_id:
            cur.execute(
                f'SELECT kind, vk_target_id, vk_screen_name FROM {SCHEMA}.vk_accounts '
                f'WHERE id = %s AND user_id = %s',
                (str(account_id), user_id)
            )
        else:
            cur.execute(
                f'SELECT kind, vk_target_id, vk_screen_name FROM {SCHEMA}.vk_accounts '
                f'WHERE user_id = %s AND is_active ORDER BY is_default DESC, id LIMIT 1',
                (user_id,)
            )
        acc = cur.fetchone()
        if acc:
            screen = (acc.get('vk_screen_name') or '').strip()
            target = (acc.get('vk_target_id') or '').strip()
            if acc.get('kind') == 'user':
                path = screen or f'id{target}'
            else:
                path = screen or f'club{target}'
            return resp(200, {
                'success': True,
                'invite_url': f'https://vk.me/{path}',
                'group_url': f'https://vk.com/{path}',
            })

        cur.execute(
            f'SELECT vk_group_id, vk_group_token FROM {SCHEMA}.vk_settings WHERE user_id = %s',
            (user_id,)
        )
        settings = cur.fetchone() or {}
        group_id = (settings.get('vk_group_id') or '').strip()
        group_token = decrypt_token(settings.get('vk_group_token') or '').strip()

        if not group_id:
            return resp(400, {'error': 'Сначала укажите сообщество ВК в настройках'})

        numeric_id = group_id if group_id.isdigit() else ''
        screen_name = '' if group_id.isdigit() else group_id

        if group_token:
            r = requests.get('https://api.vk.com/method/groups.getById', params={
                'group_id': group_id,
                'access_token': group_token,
                'v': VK_API_VERSION,
            }, timeout=15)
            info = r.json().get('response')
            group = None
            if isinstance(info, dict):
                group = (info.get('groups') or [None])[0]
            elif isinstance(info, list) and info:
                group = info[0]
            if group:
                numeric_id = str(group.get('id') or numeric_id)
                screen_name = group.get('screen_name') or screen_name

        if numeric_id:
            invite_url = f'https://vk.me/club{numeric_id}'
        else:
            invite_url = f'https://vk.me/{screen_name}'

        return resp(200, {
            'success': True,
            'invite_url': invite_url,
            'group_url': f'https://vk.com/{screen_name or ("club" + numeric_id)}',
        })
    finally:
        cur.close()
        conn.close()


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
    action = (body.get('action') or '').strip()

    if not DATABASE_URL:
        return resp(500, {'error': 'Database not configured'})

    if action == 'invite_link':
        return build_invite_link(user_id, body.get('account_id'))

    if not client_id or not message:
        return resp(400, {'error': 'Нужны client_id и текст сообщения'})

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            f'SELECT name, vk_client_id, vk_profile, vk_username, vk_account_id '
            f'FROM {SCHEMA}.clients WHERE id = %s AND user_id = %s',
            (str(client_id), user_id)
        )
        client = cur.fetchone()

        if not client:
            return resp(404, {'error': 'Клиент не найден'})

        account_id = body.get('account_id') or client.get('vk_account_id')
        account = None

        if account_id:
            cur.execute(
                f'SELECT id, kind, title, access_token FROM {SCHEMA}.vk_accounts '
                f'WHERE id = %s AND user_id = %s AND is_active',
                (str(account_id), user_id)
            )
            account = cur.fetchone()

        if not account:
            cur.execute(
                f'SELECT id, kind, title, access_token FROM {SCHEMA}.vk_accounts '
                f'WHERE user_id = %s AND is_active ORDER BY is_default DESC, id LIMIT 1',
                (user_id,)
            )
            account = cur.fetchone()

        send_token = ''
        account_kind = 'group'
        if account:
            send_token = decrypt_token(account.get('access_token') or '').strip()
            account_kind = account.get('kind') or 'group'
        else:
            cur.execute(
                f'SELECT vk_group_token FROM {SCHEMA}.vk_settings WHERE user_id = %s',
                (user_id,)
            )
            settings = cur.fetchone()
            send_token = decrypt_token((settings.get('vk_group_token') if settings else '') or '').strip()

        if not send_token:
            return resp(400, {'error': 'Не подключён аккаунт ВК для отправки сообщений. Добавьте сообщество или личную страницу в настройках.'})

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
            'access_token': send_token,
            'v': VK_API_VERSION,
        }, timeout=20)
        data = r.json()

        if 'error' in data:
            err = data['error']
            code = err.get('error_code')
            print(f'[vk-notify] VK error {code}: {err.get("error_msg")} (vk_id={vk_client_id})')

            if code == 901:
                return resp(200, {
                    'success': False,
                    'need_permission': True,
                    'vk_error_code': code,
                    'error': (
                        'ВКонтакте запрещает писать первым от лица страницы. Клиент должен сам написать вам хотя бы одно сообщение.'
                        if account_kind == 'user' else
                        'ВКонтакте запрещает сообществу писать первым. Клиент должен сам написать в вашу группу ВК хотя бы одно сообщение (кнопка «Написать сообщение» на странице группы) — подписки на группу недостаточно.'
                    )
                })
            if code == 902:
                return resp(200, {
                    'success': False,
                    'need_permission': True,
                    'vk_error_code': code,
                    'error': 'Клиент запретил сообщения от сообществ в настройках приватности ВКонтакте.'
                })
            if code in (7, 15):
                return resp(200, {
                    'success': False,
                    'need_permission': True,
                    'vk_error_code': code,
                    'error': 'Нет прав на отправку. Проверьте: в настройках группы ВК включены «Сообщения сообщества», а токен создан с правом «Сообщения сообщества».'
                })
            if code in (5, 27, 28):
                return resp(200, {
                    'success': False,
                    'vk_error_code': code,
                    'error': 'Токен сообщества недействителен или устарел. Создайте новый токен группы в настройках и сохраните его.'
                })
            return resp(400, {
                'success': False,
                'vk_error_code': code,
                'error': f'ВКонтакте отклонил отправку: {err.get("error_msg", "неизвестная ошибка")}',
            })

        if account:
            cur.execute(
                f'UPDATE {SCHEMA}.clients SET vk_messages_allowed = TRUE, vk_account_id = %s WHERE id = %s',
                (account['id'], str(client_id))
            )
        else:
            cur.execute(
                f'UPDATE {SCHEMA}.clients SET vk_messages_allowed = TRUE WHERE id = %s',
                (str(client_id),)
            )
        conn.commit()

        return resp(200, {
            'success': True,
            'message_id': data.get('response'),
            'account_title': (account or {}).get('title', ''),
        })
    except Exception as e:
        return resp(400, {'success': False, 'error': str(e)})
    finally:
        cur.close()
        conn.close()