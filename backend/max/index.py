import json
import os
import re
import psycopg2
from typing import Dict, Any
import requests
from datetime import datetime, timedelta

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Отправка сервисных сообщений через MAX мессенджер
    Используется для уведомлений клиентам: восстановление пароля, брони, статусы проектов
    '''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    headers = event.get('headers', {})
    user_id = headers.get('x-user-id') or headers.get('X-User-Id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Требуется авторизация'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    
    try:
        if method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'send_service_message':
                result = send_service_message(conn, user_id, body)
            elif action == 'send_message_to_client':
                result = send_message_to_client(conn, user_id, body)
            elif action == 'get_templates':
                result = get_templates(conn)
            elif action == 'save_template':
                result = save_template(conn, user_id, body)
            elif action == 'toggle_template':
                result = toggle_template(conn, user_id, body)
            elif action == 'get_admin_settings':
                result = get_admin_settings(conn, user_id)
            elif action == 'save_admin_settings':
                result = save_admin_settings(conn, user_id, body)
            elif action == 'check_expiring_links':
                result = check_expiring_links(conn, user_id)
            elif action == 'trash_expired_folders':
                result = trash_expired_folders(conn, user_id)
            else:
                result = {'error': 'Неизвестный action'}
            
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result, default=str),
                'isBase64Encoded': False
            }
        
        conn.close()
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Метод не поддерживается'}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        print(f"[MAX Service] Error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        conn.close()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL не настроен')
    return psycopg2.connect(database_url)

def dict_from_row(cursor, row):
    if not row:
        return None
    return dict(zip([desc[0] for desc in cursor.description], row))

def get_admin_credentials() -> Dict[str, Any]:
    """Получить GREEN-API credentials из секретов"""
    instance_id = os.environ.get('MAX_INSTANCE_ID', '')
    token = os.environ.get('MAX_TOKEN', '')
    return {
        'instance_id': instance_id,
        'token': token
    }

def get_user_credentials(conn, user_id: str) -> Dict[str, Any]:
    """Получить GREEN-API credentials пользователя"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT 
                green_api_instance_id,
                green_api_token,
                max_connected,
                max_phone
            FROM t_p28211681_photo_secure_web.users
            WHERE id = {user_id}
        """)
        row = cur.fetchone()
        return dict_from_row(cur, row) if row else {}

def check_rate_limit(conn, user_id: str, client_phone: str) -> bool:
    """Проверить антиспам (отключен)"""
    return True

def log_message(conn, user_id: str, client_phone: str, template_type: str, success: bool, error: str = None, message_id: str = None):
    """Логировать отправленное сообщение"""
    with conn.cursor() as cur:
        cur.execute(
            "INSERT INTO t_p28211681_photo_secure_web.max_service_logs "
            "(user_id, client_phone, template_type, success, error_message, message_id, "
            "delivery_status, sent_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())",
            (int(user_id), client_phone, template_type, success, error, message_id,
             'sent' if (success and message_id) else None),
        )
        conn.commit()

def normalize_phone(phone: str) -> str:
    """Нормализовать номер к формату 7XXXXXXXXXX"""
    clean_phone = ''.join(filter(str.isdigit, phone or ''))
    if not clean_phone.startswith('7') and not clean_phone.startswith('375'):
        clean_phone = '7' + clean_phone.lstrip('8')
    return clean_phone


def check_account(instance_id: str, token: str, phone: str, force: bool = False) -> Dict[str, Any]:
    """
    Проверить наличие MAX-аккаунта на номере через метод checkAccount.
    force=True игнорирует кэш green-api и делает прямой запрос в MAX
    (помогает при iOS-аккаунтах, ошибочно закэшированных как noAccount).
    Возвращает {'exist': bool, 'chatId': str, 'limited': bool}.
    """
    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    url = f"https://{media_server}.api.green-api.com/waInstance{instance_id}/checkAccount/{token}"
    clean_phone = normalize_phone(phone)
    payload: Dict[str, Any] = {"phoneNumber": int(clean_phone)}
    if force:
        payload["force"] = True
    try:
        response = requests.post(url, json=payload, timeout=15)
        print(f'[MAX] checkAccount(force={force}) {clean_phone} -> {response.status_code} {response.text}')
        # 469 — лимит проверок, приостановить проверки
        if response.status_code == 469:
            return {'exist': True, 'chatId': '', 'limited': True}
        data = response.json()
        # instance starting/notAuthorized или лимит -> status:false
        if data.get('status') is False:
            return {'exist': True, 'chatId': '', 'limited': True}
        return {'exist': bool(data.get('exist')), 'chatId': data.get('chatId') or '', 'limited': False}
    except Exception as e:
        print(f'[MAX] checkAccount error: {e}')
        # При ошибке проверки не блокируем отправку
        return {'exist': True, 'chatId': '', 'limited': True}


# Сколько дней доверять кэшу проверки аккаунта
CACHE_EXIST_DAYS = 30      # аккаунт есть — перепроверяем редко
CACHE_NOACCOUNT_DAYS = 7   # аккаунта нет — перепроверяем чаще (вдруг установили MAX)


def get_cached_account(conn, phone: str) -> Dict[str, Any]:
    """Прочитать кэш проверки MAX-аккаунта. Возвращает {} если кэш отсутствует/устарел."""
    if conn is None:
        return {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT exists_flag, chat_id, checked_at FROM t_p28211681_photo_secure_web.max_account_cache WHERE phone = %s",
                (phone,),
            )
            row = cur.fetchone()
        if not row:
            return {}
        exists_flag, chat_id, checked_at = row[0], row[1], row[2]
        age_days = (datetime.now() - checked_at).days
        ttl = CACHE_EXIST_DAYS if exists_flag else CACHE_NOACCOUNT_DAYS
        if age_days > ttl:
            return {}
        return {'exist': bool(exists_flag), 'chatId': chat_id or ''}
    except Exception as e:
        print(f'[MAX] cache read error: {e}')
        return {}


def save_cached_account(conn, phone: str, exists_flag: bool, chat_id: str = '') -> None:
    """Сохранить/обновить кэш проверки MAX-аккаунта."""
    if conn is None:
        return
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO t_p28211681_photo_secure_web.max_account_cache (phone, exists_flag, chat_id, checked_at) "
                "VALUES (%s, %s, %s, NOW()) "
                "ON CONFLICT (phone) DO UPDATE SET exists_flag = EXCLUDED.exists_flag, "
                "chat_id = EXCLUDED.chat_id, checked_at = NOW()",
                (phone, exists_flag, chat_id or ''),
            )
        conn.commit()
    except Exception as e:
        print(f'[MAX] cache write error: {e}')


def send_via_green_api(instance_id: str, token: str, phone: str, message: str, verify_account: bool = True, conn=None) -> Dict[str, Any]:
    """Отправить сообщение через GREEN-API.

    Перед отправкой проверяет наличие MAX-аккаунта (checkAccount) с кэшированием
    результата в БД, чтобы не дёргать один номер повторно. Если проверка вернула
    exist=false (часто из-за устаревшего кэша для iOS), делает повторную проверку
    с force=true напрямую в MAX. Если и тогда аккаунта нет — возвращает ошибку.
    """
    clean_phone = normalize_phone(phone)

    if verify_account:
        cached = get_cached_account(conn, clean_phone)
        if cached:
            if not cached['exist']:
                print(f'[MAX] cache: no account for {clean_phone}, skip send')
                return {'no_account': True, 'error': 'У номера нет аккаунта MAX'}
            # cached exist=True — шлём без обращения к checkAccount
        else:
            check = check_account(instance_id, token, clean_phone, force=False)
            # Если по кэшу green-api аккаунта нет — перепроверяем напрямую с force
            if not check['exist'] and not check['limited']:
                check = check_account(instance_id, token, clean_phone, force=True)
            # Сохраняем результат только когда проверка достоверна (не лимит/ошибка)
            if not check['limited']:
                save_cached_account(conn, clean_phone, check['exist'], check.get('chatId', ''))
                if not check['exist']:
                    print(f'[MAX] account does not exist for {clean_phone}, skip send')
                    return {'no_account': True, 'error': 'У номера нет аккаунта MAX'}

    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"

    payload = {
        "chatId": f"{clean_phone}@c.us",
        "message": message
    }

    print(f'[MAX] Sending to {url} with chatId={clean_phone}@c.us')

    response = requests.post(url, json=payload, timeout=10)
    print(f'[MAX] Response status: {response.status_code}')
    print(f'[MAX] Response body: {response.text}')

    response.raise_for_status()
    return response.json()

def get_templates(conn) -> Dict[str, Any]:
    """Получить список шаблонов сообщений"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT template_type, template_text, variables
            FROM t_p28211681_photo_secure_web.max_service_templates
            WHERE is_active = TRUE
            ORDER BY template_type
        """)
        rows = cur.fetchall()
        templates = [dict_from_row(cur, row) for row in rows]
        return {'templates': templates}

def send_service_message(conn, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Отправить сервисное сообщение клиенту"""
    client_phone = body.get('client_phone')
    template_type = body.get('template_type')
    variables = body.get('variables', {})
    
    if not client_phone or not template_type:
        return {'error': 'Требуется client_phone и template_type'}
    
    if not check_rate_limit(conn, user_id, client_phone):
        return {'error': 'Превышен лимит отправки (5 сообщений в час)'}
    
    # Используем админские credentials из секретов
    creds = get_admin_credentials()
    if not creds.get('instance_id') or not creds.get('token'):
        return {'error': 'MAX не настроен (отсутствуют секреты)'}
    
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT template_text, variables as required_vars
            FROM t_p28211681_photo_secure_web.max_service_templates
            WHERE template_type = '{template_type}' AND is_active = TRUE
        """)
        row = cur.fetchone()
        
        if not row:
            return {'error': f'Шаблон {template_type} не найден'}
        
        template = dict_from_row(cur, row)
        message = template['template_text']
        
        for key, value in variables.items():
            message = message.replace(f'{{{key}}}', str(value))
    
    try:
        result = send_via_green_api(
            creds['instance_id'],
            creds['token'],
            client_phone,
            message,
            conn=conn
        )
        
        if result.get('no_account'):
            log_message(conn, user_id, client_phone, template_type, False, 'no MAX account')
            return {'error': 'У номера нет аккаунта MAX', 'no_account': True}
        
        msg_id = result.get('idMessage')
        log_message(conn, user_id, client_phone, template_type, True, None, msg_id)
        
        return {
            'success': True,
            'message_id': msg_id,
            'sent_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        log_message(conn, user_id, client_phone, template_type, False, str(e))
        return {
            'error': 'Ошибка отправки',
            'details': str(e)
        }

def is_admin(conn, user_id: str) -> bool:
    """Проверить является ли пользователь админом"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT role FROM t_p28211681_photo_secure_web.users WHERE id = {user_id}
        """)
        row = cur.fetchone()
        return row and row[0] == 'admin'

def save_template(conn, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Сохранить или обновить шаблон (только для админа)"""
    if not is_admin(conn, user_id):
        return {'error': 'Доступ запрещён'}
    
    template_id = body.get('id')
    template_type = body.get('template_type')
    template_text = body.get('template_text')
    is_active = body.get('is_active', True)
    
    if not template_type or not template_text:
        return {'error': 'Требуется template_type и template_text'}
    
    import re
    variables = list(set(re.findall(r'\{([^}]+)\}', template_text)))
    
    with conn.cursor() as cur:
        if template_id:
            cur.execute(f"""
                UPDATE t_p28211681_photo_secure_web.max_service_templates
                SET template_text = %s,
                    variables = %s::jsonb,
                    is_active = {is_active},
                    updated_at = NOW()
                WHERE id = {template_id}
                RETURNING id
            """, (template_text, json.dumps(variables)))
        else:
            cur.execute(f"""
                INSERT INTO t_p28211681_photo_secure_web.max_service_templates
                (template_type, template_text, variables, is_active)
                VALUES (%s, %s, %s::jsonb, {is_active})
                RETURNING id
            """, (template_type, template_text, json.dumps(variables)))
        
        result_id = cur.fetchone()[0]
        conn.commit()
        
        return {
            'success': True,
            'id': result_id,
            'message': 'Шаблон сохранён'
        }

def toggle_template(conn, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Включить/выключить шаблон (только для админа)"""
    if not is_admin(conn, user_id):
        return {'error': 'Доступ запрещён'}
    
    template_id = body.get('id')
    is_active = body.get('is_active')
    
    if template_id is None:
        return {'error': 'Требуется id'}
    
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE t_p28211681_photo_secure_web.max_service_templates
            SET is_active = {is_active}, updated_at = NOW()
            WHERE id = {template_id}
        """)
        conn.commit()
        
        return {
            'success': True,
            'message': 'Статус обновлён'
        }

def check_client_belongs_to_photographer(conn, photographer_id: str, client_id: str) -> bool:
    """Проверить что клиент принадлежит фотографу"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) as count
            FROM t_p28211681_photo_secure_web.clients
            WHERE id = %s AND user_id = %s
        """, (client_id, photographer_id))
        row = cur.fetchone()
        return row and row[0] > 0

def send_message_to_client(conn, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Отправить сообщение клиенту от фотографа через MAX"""
    client_id = body.get('client_id')
    message = body.get('message')
    
    if not client_id or not message:
        return {'error': 'Требуется client_id и message'}
    
    # Проверить что клиент принадлежит фотографу
    if not check_client_belongs_to_photographer(conn, user_id, client_id):
        return {'error': 'Доступ запрещён: клиент не принадлежит вам'}
    
    # Получить телефон и имя клиента
    with conn.cursor() as cur:
        cur.execute("""
            SELECT phone, name FROM t_p28211681_photo_secure_web.clients
            WHERE id = %s
        """, (client_id,))
        row = cur.fetchone()
        if not row or not row[0]:
            return {'error': 'У клиента не указан телефон'}
        client_phone = row[0]
        client_name = row[1] or ''
    
    # Найти ссылку на чат (галерею, привязанную к клиенту), чтобы клиент мог ответить.
    # Берём самую свежую активную ссылку на папку этого клиента.
    chat_url = ''
    with conn.cursor() as cur:
        cur.execute("""
            SELECT fsl.short_code
            FROM t_p28211681_photo_secure_web.folder_short_links fsl
            JOIN t_p28211681_photo_secure_web.photo_folders pf ON pf.id = fsl.folder_id
            WHERE pf.client_id = %s
              AND COALESCE(fsl.is_blocked, FALSE) = FALSE
            ORDER BY fsl.created_at DESC NULLS LAST, fsl.id DESC
            LIMIT 1
        """, (client_id,))
        link_row = cur.fetchone()
        if link_row and link_row[0]:
            chat_url = f"https://foto-mix.ru/g/{link_row[0]}"
    
    # Собираем текст для MAX: обращение по имени + сообщение + приписка со ссылкой на чат.
    # В базе (в истории чата) сохраняем оригинальный текст без приписки, чтобы чат оставался чистым.
    first_name = client_name.strip().split()[0] if client_name.strip() else ''
    max_message = message
    if first_name:
        max_message = f"{first_name}, вам написал фотограф:\n\n{message}"
    else:
        max_message = f"Вам написал фотограф:\n\n{message}"
    if chat_url:
        max_message += f"\n\n💬 Чтобы ответить, перейдите в чат: {chat_url}"
    
    # Получить админские credentials из секретов
    creds = get_admin_credentials()
    if not creds.get('instance_id') or not creds.get('token'):
        return {'error': 'MAX не настроен (отсутствуют секреты)'}
    
    # Проверить rate limit
    if not check_rate_limit(conn, user_id, client_phone):
        return {'error': 'Превышен лимит отправки (5 сообщений в час)'}
    
    try:
        result = send_via_green_api(
            creds['instance_id'],
            creds['token'],
            client_phone,
            max_message,
            conn=conn
        )
        
        if result.get('no_account'):
            return {'error': 'У номера нет аккаунта MAX', 'no_account': True}
        
        green_msg_id = result.get('idMessage')
        # Сохранить сообщение в БД с привязкой к идентификатору green-api
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO t_p28211681_photo_secure_web.client_messages
                (client_id, photographer_id, sender_type, content, type, author, message_date,
                 external_message_id, delivery_status)
                VALUES (%s, %s, 'photographer', %s, 'whatsapp', 'Фотограф', NOW(), %s, 'sent')
                RETURNING id
            """, (client_id, user_id, message, green_msg_id))
            message_id = cur.fetchone()[0]
            conn.commit()
        
        log_message(conn, user_id, client_phone, 'direct_message', True, None, green_msg_id)
        
        return {
            'success': True,
            'message_id': green_msg_id,
            'db_message_id': message_id,
            'delivery_status': 'sent',
            'sent_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        log_message(conn, user_id, client_phone, 'direct_message', False, str(e))
        return {
            'error': 'Ошибка отправки',
            'details': str(e)
        }

def get_admin_settings(conn, user_id: str) -> Dict[str, Any]:
    """Получить статус настроек MAX (credentials теперь в секретах)"""
    if not is_admin(conn, user_id):
        return {'error': 'Доступ запрещён'}
    
    creds = get_admin_credentials()
    instance_id = creds.get('instance_id', '')
    token = creds.get('token', '')
    
    configured = bool(instance_id and token)
    token_masked = ''
    
    if token:
        if len(token) > 8:
            token_masked = f"{token[:4]}***{token[-4:]}"
        else:
            token_masked = '***'
    
    return {
        'instance_id': instance_id,
        'token_masked': token_masked,
        'configured': configured
    }

def save_admin_settings(conn, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Deprecated: Настройки теперь хранятся в секретах платформы"""
    if not is_admin(conn, user_id):
        return {'error': 'Доступ запрещён'}
    
    return {
        'error': 'Настройки MAX теперь хранятся в секретах платформы. Используйте панель секретов для обновления MAX_INSTANCE_ID и MAX_TOKEN.'
    }


def _format_ru_date(dt: datetime) -> str:
    months = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
    ]
    return f"{dt.day} {months[dt.month - 1]} {dt.year}"


def check_expiring_links(conn, user_id: str) -> Dict[str, Any]:
    """Найти ссылки фотографа с истечением через 3-8 дней и отправить MAX клиенту и фотографу.
    Идемпотентно через folder_short_links.expire_notified_at.
    """
    app_base_url = 'https://foto-mix.ru'
    creds = get_admin_credentials()
    if not creds.get('instance_id') or not creds.get('token'):
        return {'success': False, 'error': 'MAX не настроен'}

    with conn.cursor() as cur:
        cur.execute("""
            SELECT template_text
            FROM t_p28211681_photo_secure_web.max_service_templates
            WHERE template_type = 'link_expiring' AND is_active = TRUE
            LIMIT 1
        """)
        tpl_row = cur.fetchone()
        if not tpl_row:
            return {'success': False, 'error': 'Шаблон link_expiring не найден'}
        template_text = tpl_row[0]

        cur.execute(f"""
            SELECT
                fsl.id,
                fsl.short_code,
                fsl.expires_at,
                fsl.folder_id,
                pf.folder_name,
                pf.client_id,
                c.phone,
                c.name,
                u.name,
                u.phone
            FROM t_p28211681_photo_secure_web.folder_short_links fsl
            JOIN t_p28211681_photo_secure_web.photo_folders pf ON pf.id = fsl.folder_id
            LEFT JOIN t_p28211681_photo_secure_web.clients c ON c.id = pf.client_id
            JOIN t_p28211681_photo_secure_web.users u ON u.id = fsl.user_id
            WHERE fsl.user_id = {int(user_id)}
              AND fsl.expires_at IS NOT NULL
              AND fsl.expire_notified_at IS NULL
              AND COALESCE(fsl.is_blocked, FALSE) = FALSE
              AND fsl.expires_at > NOW() + INTERVAL '3 days'
              AND fsl.expires_at <= NOW() + INTERVAL '8 days'
            ORDER BY fsl.expires_at ASC
        """)
        rows = cur.fetchall()

    notified_items = []

    for row in rows:
        (link_id, short_code, expires_at, _folder_id, folder_name,
         _client_id, client_phone, _client_name, photographer_name, photographer_phone) = row

        try:
            days_left = max(1, (expires_at - datetime.now()).days)
        except Exception:
            days_left = 1
        link_title = folder_name or 'Ваша галерея'
        link_url = f"{app_base_url}/g/{short_code}"
        chat_url = f"{app_base_url}/chat/{short_code}"
        photographer_link = f"{photographer_name or 'фотографу'} ({chat_url})"

        message = template_text
        replacements = {
            '{link_title}': link_title,
            '{days_left}': str(days_left),
            '{expires_date}': _format_ru_date(expires_at),
            '{link_url}': link_url,
            '{photographer_link}': photographer_link,
        }
        for k, v in replacements.items():
            message = message.replace(k, v)

        sent_client = False
        sent_photographer = False

        if client_phone:
            try:
                send_via_green_api(creds['instance_id'], creds['token'], client_phone, message)
                log_message(conn, user_id, client_phone, 'link_expiring', True)
                sent_client = True
            except Exception as e:
                log_message(conn, user_id, client_phone, 'link_expiring', False, str(e))

        if photographer_phone:
            try:
                send_via_green_api(creds['instance_id'], creds['token'], photographer_phone, message)
                log_message(conn, user_id, photographer_phone, 'link_expiring', True)
                sent_photographer = True
            except Exception as e:
                log_message(conn, user_id, photographer_phone, 'link_expiring', False, str(e))

        if sent_client or sent_photographer:
            with conn.cursor() as cur2:
                cur2.execute(
                    "UPDATE t_p28211681_photo_secure_web.folder_short_links SET expire_notified_at = NOW() WHERE id = %s",
                    (link_id,),
                )
                conn.commit()

        notified_items.append({
            'link_id': link_id,
            'short_code': short_code,
            'folder_name': link_title,
            'days_left': days_left,
            'client_notified': sent_client,
            'photographer_notified': sent_photographer,
        })

    return {'success': True, 'checked': len(notified_items), 'items': notified_items}


def trash_expired_folders(conn, user_id: str) -> Dict[str, Any]:
    """Найти ссылки фотографа, у которых срок истёк и папка ещё не в корзине.
    Переместить такие папки в корзину (is_trashed=TRUE) и отправить уведомление фотографу.
    Идемпотентно через folder_short_links.expired_trash_notified_at.
    """
    app_base_url = 'https://foto-mix.ru'
    creds = get_admin_credentials()

    cur_main = conn.cursor()
    cur_main.execute(f"""
        SELECT
            fsl.id,
            fsl.folder_id,
            fsl.expires_at,
            pf.folder_name,
            u.display_name,
            u.phone,
            u.email
        FROM t_p28211681_photo_secure_web.folder_short_links fsl
        JOIN t_p28211681_photo_secure_web.photo_folders pf ON pf.id = fsl.folder_id
        JOIN t_p28211681_photo_secure_web.users u ON u.id = fsl.user_id
        WHERE fsl.user_id = {int(user_id)}
          AND fsl.expires_at IS NOT NULL
          AND fsl.expires_at < NOW()
          AND fsl.expired_trash_notified_at IS NULL
          AND COALESCE(pf.is_trashed, FALSE) = FALSE
    """)
    rows = cur_main.fetchall()
    cur_main.close()

    processed = []
    for row in rows:
        link_id, folder_id, expires_at, folder_name, photographer_name, photographer_phone, photographer_email = row

        try:
            cur_upd = conn.cursor()
            cur_upd.execute(
                "UPDATE t_p28211681_photo_secure_web.photo_folders SET is_trashed = TRUE, trashed_at = NOW() WHERE id = %s",
                (folder_id,)
            )
            cur_upd.close()
            conn.commit()
        except Exception as e:
            print(f'[TRASH_EXPIRED] error trashing folder {folder_id}: {e}')
            continue

        try:
            expired_date = expires_at.strftime('%d.%m.%Y')
            from datetime import timedelta as _td
            restore_until = (expires_at + _td(days=7)).strftime('%d.%m.%Y')
        except Exception:
            expired_date = str(expires_at)
            restore_until = ''

        title = folder_name or 'Ваша галерея'
        _pn = (photographer_name or '').strip()
        if not _pn or '@' in _pn or re.match(r'^\+?[\d\s()-]{7,}$', _pn) or (
            photographer_email and '@' in photographer_email
            and _pn.lower() == photographer_email.split('@')[0].strip().lower()
        ):
            _pn = 'Фотограф'
        photographer_name_safe = _pn
        trash_url = f"{app_base_url}/photobank?trash=1"

        notified_max = False
        notified_email = False

        if creds.get('instance_id') and creds.get('token') and photographer_phone:
            try:
                cur_tpl = conn.cursor()
                cur_tpl.execute("""
                    SELECT template_text
                    FROM t_p28211681_photo_secure_web.max_service_templates
                    WHERE template_type = 'link_expired_folder_trashed' AND is_active = TRUE
                    LIMIT 1
                """)
                tpl_row = cur_tpl.fetchone()
                cur_tpl.close()
                if tpl_row:
                    message = tpl_row[0]
                    for k, v in {
                        '{photographer_name}': photographer_name_safe,
                        '{folder_name}': title,
                        '{expired_date}': expired_date,
                        '{restore_until}': restore_until,
                        '{trash_url}': trash_url,
                    }.items():
                        message = message.replace(k, v)
                    send_via_green_api(creds['instance_id'], creds['token'], photographer_phone, message)
                    log_message(conn, user_id, photographer_phone, 'link_expired_folder_trashed', True)
                    notified_max = True
            except Exception as e:
                print(f'[TRASH_EXPIRED] MAX send error: {e}')
                try:
                    log_message(conn, user_id, photographer_phone or '', 'link_expired_folder_trashed', False, str(e))
                except Exception:
                    pass

        if photographer_email:
            try:
                import requests as _req
                html_body = f"""<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">
<div style="background:linear-gradient(135deg,#ef4444 0%,#f97316 100%);padding:30px;border-radius:10px;text-align:center;margin-bottom:24px;">
<h1 style="color:#fff;margin:0;font-size:24px;">🗑 Папка перемещена в корзину</h1>
</div>
<div style="background:#f8f9fa;padding:24px;border-radius:10px;">
<p style="font-size:16px;">Здравствуйте, {photographer_name_safe}!</p>
<p style="font-size:15px;">Срок действия общей ссылки на папку <b>«{title}»</b> истёк {expired_date}. Папка автоматически перемещена в корзину фото-банка.</p>
<div style="background:#fff3cd;border-left:4px solid #f59e0b;padding:14px 16px;border-radius:6px;margin:20px 0;">
<strong>⏳ У вас есть 7 дней (до {restore_until})</strong>, чтобы восстановить папку. После этого все фотографии будут удалены без возможности восстановления.
</div>
<p style="font-size:15px;">📂 Восстановить можно в разделе «Фото-банк → Корзина»:</p>
<p><a href="{trash_url}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Открыть корзину</a></p>
</div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
<p style="color:#9ca3af;font-size:12px;text-align:center;">🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!</p>
</body></html>"""
                email_api = 'https://functions.poehali.dev/26301a69-7e80-461b-bc17-2ad62cd57d4f'
                resp = _req.post(email_api, json={
                    'action': 'send-booking-notification',
                    'to_email': photographer_email,
                    'client_name': photographer_name_safe,
                    'html_body': html_body,
                    'subject': f'🗑 Папка «{title}» перемещена в корзину — Foto-mix.ru'
                }, timeout=10)
                notified_email = resp.ok
            except Exception as e:
                print(f'[TRASH_EXPIRED] email send error: {e}')

        try:
            cur_mark = conn.cursor()
            cur_mark.execute(
                "UPDATE t_p28211681_photo_secure_web.folder_short_links SET expired_trash_notified_at = NOW() WHERE id = %s",
                (link_id,)
            )
            cur_mark.close()
            conn.commit()
        except Exception as e:
            print(f'[TRASH_EXPIRED] notify mark error: {e}')

        processed.append({
            'link_id': link_id,
            'folder_id': folder_id,
            'folder_name': title,
            'expired_date': expired_date,
            'restore_until': restore_until,
            'notified_max': notified_max,
            'notified_email': notified_email,
        })

    return {'success': True, 'trashed': len(processed), 'items': processed}