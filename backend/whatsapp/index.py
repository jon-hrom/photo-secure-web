import json
import os
import psycopg2
from typing import Dict, Any, List
import requests
from datetime import datetime

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Управление MAX сообщениями через Green-API
    Функционал: отправка сообщений, получение истории, список чатов, счётчик непрочитанных
    Пользователь использует свой подтверждённый номер телефона из Настроек для доступа к MAX
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
    
    # Проверяем что пользователь существует
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
    """Преобразует строку результата в словарь"""
    if not row:
        return None
    return dict(zip([desc[0] for desc in cursor.description], row))

def verify_user(conn, user_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(f"SELECT id FROM users WHERE id = '{user_id}'")
        return cur.fetchone() is not None

def get_chats(conn, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        # Проверяем является ли пользователь админом
        cur.execute(f"SELECT role FROM users WHERE id = '{user_id}'")
        row = cur.fetchone()
        user = dict_from_row(cur, row) if row else None
        is_admin = user and user.get('role') == 'admin'
        
        if is_admin:
            # Админ видит все чаты (включая чаты с клиентами)
            cur.execute("""
                SELECT 
                    c.*,
                    u.full_name as user_name
                FROM whatsapp_chats c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.is_admin_chat = TRUE
                ORDER BY c.updated_at DESC
            """)
        else:
            # Обычный пользователь видит только свои чаты
            cur.execute(f"""
                SELECT * FROM whatsapp_chats
                WHERE user_id = '{user_id}'
                ORDER BY updated_at DESC
            """)
        
        rows = cur.fetchall()
        chats = [dict_from_row(cur, row) for row in rows]
        print(f"[MAX] Found {len(chats)} chats for user {user_id}")
        return {'chats': chats}

def get_messages(conn, chat_id: str, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        # Проверяем доступ к чату
        cur.execute(f"""
            SELECT c.*, u.role FROM whatsapp_chats c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = '{chat_id}' AND (c.user_id = '{user_id}' OR u.role = 'admin')
        """)
        
        row = cur.fetchone()
        chat = dict_from_row(cur, row) if row else None
        
        if not chat:
            return {'error': 'Чат не найден или нет доступа'}
        
        # Получаем сообщения
        cur.execute(f"""
            SELECT * FROM whatsapp_messages
            WHERE chat_id = '{chat_id}'
            ORDER BY timestamp ASC
        """)
        
        rows = cur.fetchall()
        messages = [dict_from_row(cur, row) for row in rows]
        return {'messages': messages, 'chat': chat}

def get_unread_count(conn, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute(f"SELECT role FROM users WHERE id = '{user_id}'")
        row = cur.fetchone()
        user = dict_from_row(cur, row) if row else None
        is_admin = user and user.get('role') == 'admin'
        
        if is_admin:
            cur.execute("""
                SELECT COALESCE(SUM(unread_count), 0) as total
                FROM whatsapp_chats
                WHERE is_admin_chat = TRUE
            """)
        else:
            cur.execute(f"""
                SELECT COALESCE(SUM(unread_count), 0) as total
                FROM whatsapp_chats
                WHERE user_id = '{user_id}'
            """)
        
        row = cur.fetchone()
        result = dict_from_row(cur, row) if row else None
        return {'unread_count': int(result['total']) if result else 0}

def send_message(conn, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    phone = data.get('phone')
    message = data.get('message')
    
    print(f"[MAX] send_message: phone={phone}, message_len={len(message) if message else 0}")
    
    if not phone or not message:
        return {'error': 'Необходимо указать phone и message'}
    
    # Проверяем наличие секретов
    instance_id = os.environ.get('GREEN_API_INSTANCE')
    token = os.environ.get('GREEN_API_TOKEN')
    
    print(f"[MAX] Env check: instance_id={'SET' if instance_id else 'MISSING'}, token={'SET' if token else 'MISSING'}")
    
    if not instance_id or not token:
        error_msg = 'Green-API не настроен: '
        if not instance_id:
            error_msg += 'GREEN_API_INSTANCE отсутствует '
        if not token:
            error_msg += 'GREEN_API_TOKEN отсутствует'
        print(f"[MAX] {error_msg}")
        return {'error': error_msg}
    
    # Форматируем номер для WhatsApp
    phone_formatted = phone.replace('+', '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if not phone_formatted.endswith('@c.us'):
        phone_formatted = f"{phone_formatted}@c.us"
    
    print(f"[MAX] Formatted phone: {phone_formatted}")
    
    url = f"https://3100.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"
    
    payload = {
        "chatId": phone_formatted,
        "message": message
    }
    
    print(f"[MAX] Sending to Green-API: url={url[:80]}..., payload={payload}")
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        print(f"[MAX] Green-API response: status={response.status_code}")
        
        if response.status_code != 200:
            error_text = response.text
            print(f"[MAX] Green-API error response: {error_text}")
            return {'error': f'Green-API error: {response.status_code}', 'details': error_text}
            
        result = response.json()
        print(f"[MAX] Green-API success: {result}")
        
        # Сохраняем в БД
        with conn.cursor() as cur:
            # Проверяем роль пользователя
            cur.execute(f"SELECT role FROM users WHERE id = '{user_id}'")
            row = cur.fetchone()
            user = dict_from_row(cur, row) if row else None
            is_admin = user and user.get('role') == 'admin'
            
            # Экранируем спецсимволы в сообщении
            message_escaped = message.replace("'", "''")
            
            # Создаём или получаем чат - используем простые SQL запросы
            cur.execute(f"""
                SELECT id FROM whatsapp_chats 
                WHERE user_id = '{user_id}' AND phone_number = '{phone}'
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
                    WHERE id = '{chat_id}'
                """)
            else:
                cur.execute(f"""
                    INSERT INTO whatsapp_chats (user_id, phone_number, last_message_text, last_message_time, is_admin_chat, updated_at)
                    VALUES ('{user_id}', '{phone}', '{message_escaped}', NOW(), {is_admin}, NOW())
                    RETURNING id
                """)
                row = cur.fetchone()
                chat_id = row[0] if row else None
            
            print(f"[MAX] Chat saved: chat_id={chat_id}")
            
            # Сохраняем сообщение
            cur.execute(f"""
                INSERT INTO whatsapp_messages (chat_id, message_text, is_from_me, timestamp, status, is_read)
                VALUES ('{chat_id}', '{message_escaped}', TRUE, NOW(), 'sent', TRUE)
            """)
            
            conn.commit()
            print(f"[MAX] Message saved to DB")
        
        return {'success': True, 'idMessage': result.get('idMessage')}
        
    except requests.exceptions.RequestException as e:
        error_msg = f'Green-API request error: {str(e)}'
        print(f"[MAX] {error_msg}")
        return {'error': error_msg}
    except Exception as e:
        error_msg = f'Error saving to DB: {str(e)}'
        print(f"[MAX] {error_msg}")
        import traceback
        print(traceback.format_exc())
        return {'error': error_msg}

def mark_as_read(conn, chat_id: str, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        # Проверяем доступ
        cur.execute(f"""
            SELECT c.id FROM whatsapp_chats c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = '{chat_id}' AND (c.user_id = '{user_id}' OR u.role = 'admin')
        """)
        
        if not cur.fetchone():
            return {'error': 'Чат не найден или нет доступа'}
        
        # Обнуляем счётчик непрочитанных
        cur.execute(f"""
            UPDATE whatsapp_chats 
            SET unread_count = 0 
            WHERE id = '{chat_id}'
        """)
        
        # Помечаем сообщения как прочитанные
        cur.execute(f"""
            UPDATE whatsapp_messages 
            SET is_read = TRUE 
            WHERE chat_id = '{chat_id}' AND is_from_me = FALSE
        """)
        
        conn.commit()
        return {'success': True}

def update_notification_settings(conn, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    enabled = data.get('enabled', True)
    
    with conn.cursor() as cur:
        cur.execute(f"""
            INSERT INTO whatsapp_notification_settings (user_id, enabled, updated_at)
            VALUES ('{user_id}', {enabled}, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                enabled = {enabled},
                updated_at = NOW()
        """)
        conn.commit()
        
    return {'success': True}