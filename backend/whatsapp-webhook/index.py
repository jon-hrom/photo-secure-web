import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Webhook для получения входящих WhatsApp сообщений от Green-API
    Сохраняет входящие сообщения в БД и обновляет счётчики непрочитанных
    '''
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Метод не поддерживается'}),
            'isBase64Encoded': False
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        print(f"Webhook received: {json.dumps(body)}")
        
        # Green-API отправляет разные типы уведомлений
        type_webhook = body.get('typeWebhook')
        
        if type_webhook == 'incomingMessageReceived':
            message_data = body.get('messageData', {})
            sender_data = body.get('senderData', {})
            
            # Извлекаем данные
            message_id = message_data.get('idMessage')
            message_text = message_data.get('textMessageData', {}).get('textMessage', '')
            timestamp = message_data.get('timestamp')
            sender_phone = sender_data.get('chatId', '').replace('@c.us', '')
            sender_name = sender_data.get('senderName', '')
            
            if not message_id or not sender_phone:
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'status': 'ignored', 'reason': 'invalid_data'}),
                    'isBase64Encoded': False
                }
            
            # Сохраняем в БД
            conn = get_db_connection()
            save_incoming_message(conn, message_id, sender_phone, sender_name, message_text, timestamp)
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'status': 'success', 'message_id': message_id}),
                'isBase64Encoded': False
            }
        
        # Для остальных типов просто возвращаем успех
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'status': 'received', 'type': type_webhook}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'status': 'error', 'error': str(e)}),
            'isBase64Encoded': False
        }

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL не настроен')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def save_incoming_message(conn, message_id: str, sender_phone: str, sender_name: str, message_text: str, timestamp: int):
    with conn.cursor() as cur:
        # Находим или создаём чат для администратора
        # Ищем первого администратора в системе
        cur.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")
        admin = cur.fetchone()
        
        if not admin:
            print("No admin found in system")
            return
        
        admin_id = admin['id']
        
        # Создаём или обновляем чат
        cur.execute("""
            INSERT INTO whatsapp_chats 
            (user_id, phone_number, contact_name, last_message_text, last_message_time, is_admin_chat, unread_count, updated_at)
            VALUES (%s, %s, %s, %s, to_timestamp(%s), TRUE, 1, NOW())
            ON CONFLICT (user_id, phone_number) 
            DO UPDATE SET 
                contact_name = COALESCE(EXCLUDED.contact_name, whatsapp_chats.contact_name),
                last_message_text = EXCLUDED.last_message_text,
                last_message_time = EXCLUDED.last_message_time,
                unread_count = whatsapp_chats.unread_count + 1,
                updated_at = NOW()
            RETURNING id
        """, (admin_id, sender_phone, sender_name, message_text, timestamp))
        
        chat = cur.fetchone()
        chat_id = chat['id']
        
        # Сохраняем сообщение
        cur.execute("""
            INSERT INTO whatsapp_messages 
            (chat_id, message_id, sender_phone, receiver_phone, message_text, is_from_me, is_read, status, timestamp)
            VALUES (%s, %s, %s, %s, %s, FALSE, FALSE, 'received', to_timestamp(%s))
            ON CONFLICT (message_id) DO NOTHING
        """, (chat_id, message_id, sender_phone, 'admin', message_text, timestamp))
        
        conn.commit()
        print(f"Message saved: chat_id={chat_id}, message_id={message_id}")
        
        # Зеркалим входящее во вкладку "Переписка" в карточке клиента,
        # если номер совпадает с клиентом какого-либо фотографа.
        try:
            digits = ''.join(ch for ch in sender_phone if ch.isdigit())
            if len(digits) >= 10:
                tail = digits[-10:]
                cur.execute("""
                    SELECT id, photographer_id
                    FROM t_p28211681_photo_secure_web.clients
                    WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') LIKE %s
                    ORDER BY id DESC LIMIT 1
                """, (f'%{tail}',))
                client_row = cur.fetchone()
                if client_row and client_row.get('photographer_id'):
                    author_name = sender_name or 'Клиент'
                    cur.execute("""
                        INSERT INTO t_p28211681_photo_secure_web.client_messages
                        (client_id, photographer_id, sender_type, content, type, author, message_date, is_delivered, is_read)
                        VALUES (%s, %s, 'client', %s, 'whatsapp', %s, to_timestamp(%s), TRUE, FALSE)
                    """, (
                        client_row['id'],
                        client_row['photographer_id'],
                        message_text,
                        author_name,
                        timestamp,
                    ))
                    conn.commit()
                    print(f"[WH-WEBHOOK] Mirrored incoming to client_messages: client_id={client_row['id']}")
        except Exception as mirror_err:
            print(f"[WH-WEBHOOK] Mirror to client_messages failed: {mirror_err}")
            try:
                conn.rollback()
            except Exception:
                pass