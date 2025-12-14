import json
import os
import psycopg2
from typing import Dict, Any, List
import requests
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    MAX мессенджер с multi-tenant поддержкой
    Каждый фотограф использует свой GREEN-API аккаунт
    Админ видит агрегированные чаты всех фотографов
    '''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Session-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    headers = event.get('headers', {})
    user_id = headers.get('x-user-id') or headers.get('X-User-Id')
    
    print(f"[MAX] Request: method={method}, user_id={user_id}")
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Требуется авторизация'}),
            'isBase64Encoded': False
        }
    
    try:
        conn = get_db_connection()
    except Exception as e:
        print(f"[MAX] DB connection error: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Ошибка подключения к БД: {str(e)}'}),
            'isBase64Encoded': False
        }
    
    if not verify_user(conn, user_id):
        conn.close()
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Пользователь не найден'}),
            'isBase64Encoded': False
        }
    
    try:
        if method == 'GET':
            path = event.get('queryStringParameters', {}).get('action', 'chats')
            
            if path == 'chats':
                result = get_chats(conn, user_id)
            elif path == 'messages':
                chat_id = event.get('queryStringParameters', {}).get('chat_id')
                result = get_messages(conn, chat_id, user_id)
            elif path == 'unread_count':
                result = get_unread_count(conn, user_id)
            else:
                result = {'error': 'Неизвестный action'}
                
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result, default=str),
                'isBase64Encoded': False
            }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            print(f"[MAX] POST action: {action}, body: {body}")
            
            if action == 'send_message':
                result = send_message(conn, user_id, body)
            elif action == 'mark_as_read':
                result = mark_as_read(conn, body.get('chat_id'), user_id)
            else:
                result = {'error': 'Неизвестный action'}
                
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result, default=str),
                'isBase64Encoded': False
            }
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            result = update_notification_settings(conn, user_id, body)
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result),
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
        print(f"[MAX] Error: {str(e)}")
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
    print(f"[MAX] Connecting to DB...")
    return psycopg2.connect(database_url)

def dict_from_row(cursor, row):
    if not row:
        return None
    return dict(zip([desc[0] for desc in cursor.description], row))

def verify_user(conn, user_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(f"SELECT id FROM users WHERE id = {user_id}")
        return cur.fetchone() is not None

def get_user_credentials(conn, user_id: str) -> Dict[str, Any]:
    """Получить GREEN-API credentials пользователя"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT 
                green_api_instance_id,
                green_api_token,
                max_connected,
                role
            FROM users
            WHERE id = {user_id}
        """)
        row = cur.fetchone()
        return dict_from_row(cur, row) if row else {}

def get_chats(conn, user_id: str) -> Dict[str, Any]:
    """Получить чаты пользователя или все чаты для админа"""
    with conn.cursor() as cur:
        user_creds = get_user_credentials(conn, user_id)
        is_admin = user_creds.get('role') == 'admin'
        
        if is_admin:
            # Админ видит все чаты всех фотографов
            cur.execute("""
                SELECT 
                    c.*,
                    u.full_name as photographer_name,
                    u.id as photographer_id
                FROM whatsapp_chats c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE u.max_connected = TRUE
                ORDER BY c.updated_at DESC
            """)
        else:
            # Фотограф видит только свои чаты
            if not user_creds.get('max_connected'):
                return {
                    'chats': [],
                    'error': 'MAX не подключён',
                    'needs_setup': True
                }
            
            cur.execute(f"""
                SELECT * FROM whatsapp_chats
                WHERE user_id = {user_id}
                ORDER BY updated_at DESC
            """)
        
        rows = cur.fetchall()
        chats = [dict_from_row(cur, row) for row in rows]
        print(f"[MAX] Found {len(chats)} chats for user {user_id}")
        
        return {
            'chats': chats,
            'is_admin': is_admin,
            'max_connected': user_creds.get('max_connected', False)
        }

def get_messages(conn, chat_id: str, user_id: str) -> Dict[str, Any]:
    """Получить сообщения из чата"""
    with conn.cursor() as cur:
        user_creds = get_user_credentials(conn, user_id)
        is_admin = user_creds.get('role') == 'admin'
        
        # Проверяем доступ к чату
        if is_admin:
            cur.execute(f"""
                SELECT c.*, u.full_name as photographer_name
                FROM whatsapp_chats c
                JOIN users u ON c.user_id = u.id
                WHERE c.id = {chat_id}
            """)
        else:
            cur.execute(f"""
                SELECT * FROM whatsapp_chats
                WHERE id = {chat_id} AND user_id = {user_id}
            """)
        
        row = cur.fetchone()
        chat = dict_from_row(cur, row) if row else None
        
        if not chat:
            return {'error': 'Чат не найден или нет доступа'}
        
        # Получаем сообщения
        cur.execute(f"""
            SELECT * FROM whatsapp_messages
            WHERE chat_id = {chat_id}
            ORDER BY timestamp ASC
        """)
        
        rows = cur.fetchall()
        messages = [dict_from_row(cur, row) for row in rows]
        return {'messages': messages, 'chat': chat}

def get_unread_count(conn, user_id: str) -> Dict[str, Any]:
    """Получить количество непрочитанных сообщений"""
    with conn.cursor() as cur:
        user_creds = get_user_credentials(conn, user_id)
        is_admin = user_creds.get('role') == 'admin'
        
        if is_admin:
            # Админ видит все непрочитанные всех фотографов
            cur.execute("""
                SELECT COALESCE(SUM(unread_count), 0) as total
                FROM whatsapp_chats c
                JOIN users u ON c.user_id = u.id
                WHERE u.max_connected = TRUE
            """)
        else:
            # Фотограф видит только свои
            cur.execute(f"""
                SELECT COALESCE(SUM(unread_count), 0) as total
                FROM whatsapp_chats
                WHERE user_id = {user_id}
            """)
        
        row = cur.fetchone()
        result = dict_from_row(cur, row) if row else None
        return {'unread_count': int(result['total']) if result else 0}

def send_message(conn, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Отправить сообщение через GREEN-API конкретного фотографа"""
    phone = data.get('phone')
    message = data.get('message')
    
    print(f"[MAX] send_message: phone={phone}, message_len={len(message) if message else 0}")
    
    if not phone or not message:
        return {'error': 'Необходимо указать phone и message'}
    
    # Получаем credentials фотографа
    user_creds = get_user_credentials(conn, user_id)
    
    if not user_creds.get('max_connected'):
        return {
            'error': 'MAX не подключён',
            'details': 'Подключите свой MAX аккаунт в настройках',
            'needs_setup': True
        }
    
    instance_id = user_creds.get('green_api_instance_id')
    token = user_creds.get('green_api_token')
    
    if not instance_id or not token:
        return {
            'error': 'GREEN-API credentials не настроены',
            'needs_setup': True
        }
    
    # Форматируем номер для MAX
    phone_formatted = phone.replace('+', '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if not phone_formatted.endswith('@c.us'):
        phone_formatted = f"{phone_formatted}@c.us"
    
    print(f"[MAX] Using photographer's credentials: instance={instance_id[:5]}...")
    
    url = f"https://api.green-api.com/waInstance{instance_id}/sendMessage/{token}"
    
    payload = {
        "chatId": phone_formatted,
        "message": message
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"[MAX] GREEN-API response: status={response.status_code}")
        
        if response.status_code != 200:
            error_text = response.text
            print(f"[MAX] GREEN-API error: {error_text}")
            return {
                'error': f'Ошибка отправки: {response.status_code}',
                'details': error_text
            }
            
        result = response.json()
        print(f"[MAX] Message sent successfully: {result}")
        
        # Сохраняем в БД
        message_id = result.get('idMessage', f"msg_{datetime.now().timestamp()}")
        save_message_to_db(conn, user_id, phone, message, message_id, is_from_me=True)
        
        return {
            'success': True,
            'message_id': message_id,
            'status': 'sent'
        }
        
    except requests.exceptions.Timeout:
        return {'error': 'Превышено время ожидания ответа от GREEN-API'}
    except Exception as e:
        print(f"[MAX] Send error: {str(e)}")
        return {'error': f'Ошибка отправки: {str(e)}'}

def save_message_to_db(conn, user_id: str, phone: str, message: str, message_id: str, is_from_me: bool):
    """Сохранить сообщение в БД"""
    with conn.cursor() as cur:
        user_creds = get_user_credentials(conn, user_id)
        is_admin = user_creds.get('role') == 'admin'
        
        # Экранируем спецсимволы
        message_escaped = message.replace("'", "''")
        phone_escaped = phone.replace("'", "''")
        
        # Находим или создаём чат
        cur.execute(f"""
            SELECT id FROM whatsapp_chats 
            WHERE user_id = {user_id} AND phone_number = '{phone_escaped}'
        """)
        row = cur.fetchone()
        existing_chat = dict_from_row(cur, row) if row else None
        
        if existing_chat:
            chat_id = existing_chat['id']
            cur.execute(f"""
                UPDATE whatsapp_chats 
                SET last_message_text = '{message_escaped}',
                    last_message_time = NOW(),
                    updated_at = NOW()
                WHERE id = {chat_id}
            """)
        else:
            cur.execute(f"""
                INSERT INTO whatsapp_chats (user_id, phone_number, last_message_text, last_message_time, is_admin_chat, updated_at)
                VALUES ({user_id}, '{phone_escaped}', '{message_escaped}', NOW(), {is_admin}, NOW())
                RETURNING id
            """)
            row = cur.fetchone()
            chat_id = row[0] if row else None
        
        # Сохраняем сообщение
        sender_phone = 'photographer' if is_from_me else phone_escaped
        receiver_phone = phone_escaped if is_from_me else 'photographer'
        
        cur.execute(f"""
            INSERT INTO whatsapp_messages (chat_id, message_id, sender_phone, receiver_phone, message_text, is_from_me, is_read, status, timestamp)
            VALUES ({chat_id}, '{message_id}', '{sender_phone}', '{receiver_phone}', '{message_escaped}', {is_from_me}, TRUE, 'sent', NOW())
            ON CONFLICT (message_id) DO NOTHING
        """)
        
        conn.commit()
        print(f"[MAX] Message saved to DB: chat_id={chat_id}")

def mark_as_read(conn, chat_id: str, user_id: str) -> Dict[str, Any]:
    """Отметить чат как прочитанный"""
    with conn.cursor() as cur:
        user_creds = get_user_credentials(conn, user_id)
        is_admin = user_creds.get('role') == 'admin'
        
        # Проверяем доступ
        if is_admin:
            cur.execute(f"UPDATE whatsapp_chats SET unread_count = 0 WHERE id = {chat_id}")
        else:
            cur.execute(f"UPDATE whatsapp_chats SET unread_count = 0 WHERE id = {chat_id} AND user_id = {user_id}")
        
        conn.commit()
        return {'success': True}

def update_notification_settings(conn, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Обновить настройки уведомлений"""
    with conn.cursor() as cur:
        enabled = data.get('enabled', True)
        cur.execute(f"""
            INSERT INTO whatsapp_notification_settings (user_id, enabled)
            VALUES ({user_id}, {enabled})
            ON CONFLICT (user_id) DO UPDATE SET enabled = {enabled}
        """)
        conn.commit()
        return {'success': True, 'enabled': enabled}
