import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
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
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Требуется авторизация'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    
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
        print(f"Error: {str(e)}")
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
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def verify_user(conn, user_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id FROM users WHERE id = %s",
            (user_id,)
        )
        return cur.fetchone() is not None

def get_chats(conn, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        # Проверяем является ли пользователь админом
        cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        is_admin = user and user['role'] == 'admin'
        
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
            cur.execute("""
                SELECT * FROM whatsapp_chats
                WHERE user_id = %s
                ORDER BY updated_at DESC
            """, (user_id,))
        
        chats = cur.fetchall()
        return {'chats': chats}

def get_messages(conn, chat_id: str, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        # Проверяем доступ к чату
        cur.execute("""
            SELECT c.*, u.role FROM whatsapp_chats c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = %s AND (c.user_id = %s OR u.role = 'admin')
        """, (chat_id, user_id))
        
        chat = cur.fetchone()
        if not chat:
            return {'error': 'Чат не найден или нет доступа'}
        
        # Получаем сообщения
        cur.execute("""
            SELECT * FROM whatsapp_messages
            WHERE chat_id = %s
            ORDER BY timestamp ASC
        """, (chat_id,))
        
        messages = cur.fetchall()
        return {'messages': messages, 'chat': chat}

def get_unread_count(conn, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        is_admin = user and user['role'] == 'admin'
        
        if is_admin:
            cur.execute("""
                SELECT COALESCE(SUM(unread_count), 0) as total
                FROM whatsapp_chats
                WHERE is_admin_chat = TRUE
            """)
        else:
            cur.execute("""
                SELECT COALESCE(SUM(unread_count), 0) as total
                FROM whatsapp_chats
                WHERE user_id = %s
            """, (user_id,))
        
        result = cur.fetchone()
        return {'unread_count': int(result['total']) if result else 0}

def send_message(conn, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    phone = data.get('phone')
    message = data.get('message')
    
    if not phone or not message:
        return {'error': 'Необходимо указать phone и message'}
    
    # Отправка через Green-API
    instance_id = os.environ.get('GREEN_API_INSTANCE')
    token = os.environ.get('GREEN_API_TOKEN')
    
    if not instance_id or not token:
        return {'error': 'Green-API не настроен'}
    
    # Форматируем номер для WhatsApp
    phone_formatted = phone.replace('+', '').replace(' ', '').replace('-', '')
    if not phone_formatted.endswith('@c.us'):
        phone_formatted = f"{phone_formatted}@c.us"
    
    url = f"https://3100.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"
    
    payload = {
        "chatId": phone_formatted,
        "message": message
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        response.raise_for_status()
        result = response.json()
        
        # Сохраняем в БД
        with conn.cursor() as cur:
            # Проверяем роль пользователя
            cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            is_admin = user and user['role'] == 'admin'
            
            # Создаём или получаем чат
            cur.execute("""
                INSERT INTO whatsapp_chats (user_id, phone_number, last_message_text, last_message_time, is_admin_chat, updated_at)
                VALUES (%s, %s, %s, NOW(), %s, NOW())
                ON CONFLICT (user_id, phone_number) 
                DO UPDATE SET 
                    last_message_text = EXCLUDED.last_message_text,
                    last_message_time = EXCLUDED.last_message_time,
                    updated_at = NOW()
                RETURNING id
            """, (user_id, phone, message, is_admin))
            
            chat = cur.fetchone()
            chat_id = chat['id']
            
            # Сохраняем сообщение
            cur.execute("""
                INSERT INTO whatsapp_messages 
                (chat_id, message_id, sender_phone, receiver_phone, message_text, is_from_me, status)
                VALUES (%s, %s, %s, %s, %s, TRUE, 'sent')
                RETURNING id
            """, (chat_id, result.get('idMessage', ''), phone, phone, message))
            
            conn.commit()
        
        return {'success': True, 'message_id': result.get('idMessage')}
    
    except Exception as e:
        print(f"Green-API error: {str(e)}")
        return {'error': f'Ошибка отправки: {str(e)}'}

def mark_as_read(conn, chat_id: str, user_id: str) -> Dict[str, Any]:
    with conn.cursor() as cur:
        # Проверяем доступ
        cur.execute("""
            SELECT c.* FROM whatsapp_chats c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = %s AND (c.user_id = %s OR u.role = 'admin')
        """, (chat_id, user_id))
        
        if not cur.fetchone():
            return {'error': 'Чат не найден'}
        
        # Обновляем статус
        cur.execute("""
            UPDATE whatsapp_messages
            SET is_read = TRUE
            WHERE chat_id = %s AND is_from_me = FALSE
        """, (chat_id,))
        
        cur.execute("""
            UPDATE whatsapp_chats
            SET unread_count = 0
            WHERE id = %s
        """, (chat_id,))
        
        conn.commit()
        return {'success': True}

def update_notification_settings(conn, user_id: str, settings: Dict[str, Any]) -> Dict[str, Any]:
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO whatsapp_notification_settings (user_id, sound_enabled, sound_url, desktop_notifications)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                sound_enabled = EXCLUDED.sound_enabled,
                sound_url = EXCLUDED.sound_url,
                desktop_notifications = EXCLUDED.desktop_notifications,
                updated_at = NOW()
        """, (
            user_id,
            settings.get('sound_enabled', True),
            settings.get('sound_url', '/sounds/notification.mp3'),
            settings.get('desktop_notifications', True)
        ))
        conn.commit()
        return {'success': True}