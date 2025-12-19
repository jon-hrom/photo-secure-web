import json
import os
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

def get_admin_credentials(conn) -> Dict[str, Any]:
    """Получить GREEN-API credentials из админ-настроек"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT instance_id, token
            FROM t_p28211681_photo_secure_web.max_admin_settings
            WHERE id = 1
        """)
        row = cur.fetchone()
        return dict_from_row(cur, row) if row else {}

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
    """Проверить антиспам (не более 5 сообщений в час одному клиенту)"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT COUNT(*) as count
            FROM t_p28211681_photo_secure_web.max_service_logs
            WHERE user_id = {user_id} 
                AND client_phone = '{client_phone}'
                AND sent_at > NOW() - INTERVAL '1 hour'
        """)
        row = cur.fetchone()
        count = row[0] if row else 0
        return count < 5

def log_message(conn, user_id: str, client_phone: str, template_type: str, success: bool, error: str = None):
    """Логировать отправленное сообщение"""
    with conn.cursor() as cur:
        cur.execute(f"""
            INSERT INTO t_p28211681_photo_secure_web.max_service_logs 
            (user_id, client_phone, template_type, success, error_message, sent_at)
            VALUES ({user_id}, '{client_phone}', '{template_type}', {success}, %s, NOW())
        """, (error,))
        conn.commit()

def send_via_green_api(instance_id: str, token: str, phone: str, message: str) -> Dict[str, Any]:
    """Отправить сообщение через GREEN-API"""
    url = f"https://api.green-api.com/waInstance{instance_id}/sendMessage/{token}"
    
    clean_phone = ''.join(filter(str.isdigit, phone))
    if not clean_phone.startswith('7'):
        clean_phone = '7' + clean_phone.lstrip('8')
    
    payload = {
        "chatId": f"{clean_phone}@c.us",
        "message": message
    }
    
    response = requests.post(url, json=payload, timeout=10)
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
    
    # Используем админские credentials вместо пользовательских
    creds = get_admin_credentials(conn)
    if not creds.get('instance_id') or not creds.get('token'):
        return {'error': 'MAX не настроен в админ-панели'}
    
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
            message
        )
        
        log_message(conn, user_id, client_phone, template_type, True)
        
        return {
            'success': True,
            'message_id': result.get('idMessage'),
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
        cur.execute(f"""
            SELECT COUNT(*) as count
            FROM t_p28211681_photo_secure_web.clients
            WHERE id = {client_id} AND user_id = {photographer_id}
        """)
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
    
    # Получить телефон клиента
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT phone FROM t_p28211681_photo_secure_web.clients
            WHERE id = {client_id}
        """)
        row = cur.fetchone()
        if not row or not row[0]:
            return {'error': 'У клиента не указан телефон'}
        client_phone = row[0]
    
    # Получить админские credentials
    creds = get_admin_credentials(conn)
    if not creds.get('instance_id') or not creds.get('token'):
        return {'error': 'MAX не настроен в админ-панели'}
    
    # Проверить rate limit
    if not check_rate_limit(conn, user_id, client_phone):
        return {'error': 'Превышен лимит отправки (5 сообщений в час)'}
    
    try:
        result = send_via_green_api(
            creds['instance_id'],
            creds['token'],
            client_phone,
            message
        )
        
        # Сохранить сообщение в БД
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO t_p28211681_photo_secure_web.client_messages
                (client_id, content, type, author, date, sent_via_max)
                VALUES ({client_id}, %s, 'phone', 'Фотограф', NOW(), TRUE)
                RETURNING id
            """, (message,))
            message_id = cur.fetchone()[0]
            conn.commit()
        
        log_message(conn, user_id, client_phone, 'direct_message', True)
        
        return {
            'success': True,
            'message_id': result.get('idMessage'),
            'db_message_id': message_id,
            'sent_at': datetime.now().isoformat()
        }
        
    except Exception as e:
        log_message(conn, user_id, client_phone, 'direct_message', False, str(e))
        return {
            'error': 'Ошибка отправки',
            'details': str(e)
        }

def get_admin_settings(conn, user_id: str) -> Dict[str, Any]:
    """Получить настройки MAX из админ-панели"""
    if not is_admin(conn, user_id):
        return {'error': 'Доступ запрещён'}
    
    with conn.cursor() as cur:
        cur.execute("""
            SELECT instance_id, 
                   CASE 
                       WHEN token IS NOT NULL AND token != '' 
                       THEN CONCAT(LEFT(token, 4), '***', RIGHT(token, 4))
                       ELSE ''
                   END as token_masked,
                   CASE 
                       WHEN token IS NOT NULL AND token != '' 
                       THEN TRUE
                       ELSE FALSE
                   END as configured
            FROM t_p28211681_photo_secure_web.max_admin_settings
            WHERE id = 1
        """)
        row = cur.fetchone()
        if row:
            return dict_from_row(cur, row)
        else:
            return {'instance_id': '', 'token_masked': '', 'configured': False}

def save_admin_settings(conn, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Сохранить настройки MAX в админ-панели"""
    if not is_admin(conn, user_id):
        return {'error': 'Доступ запрещён'}
    
    instance_id = body.get('instance_id')
    token = body.get('token')
    
    if not instance_id or not token:
        return {'error': 'Требуется instance_id и token'}
    
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO t_p28211681_photo_secure_web.max_admin_settings (id, instance_id, token, updated_at)
            VALUES (1, %s, %s, NOW())
            ON CONFLICT (id) DO UPDATE
            SET instance_id = %s, token = %s, updated_at = NOW()
        """, (instance_id, token, instance_id, token))
        conn.commit()
    
    return {
        'success': True,
        'message': 'Настройки MAX сохранены'
    }