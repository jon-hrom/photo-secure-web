"""
Backend функция для отправки уведомлений клиентам через Telegram
Поддерживает буферизацию сообщений для клиентов без подключенного Telegram
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import requests

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')


def escape_sql(value) -> str:
    """Безопасное экранирование для Simple Query Protocol"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def get_db_connection():
    """Создание подключения к БД"""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not configured")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def send_telegram_message(chat_id: str, text: str) -> bool:
    """Отправка сообщения через Telegram Bot API"""
    if not TELEGRAM_BOT_TOKEN:
        print("[NOTIFY] TELEGRAM_BOT_TOKEN not configured")
        return False
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    try:
        response = requests.post(url, json={
            'chat_id': chat_id,
            'text': text,
            'parse_mode': 'HTML'
        }, timeout=10)
        
        if response.status_code == 200:
            return True
        else:
            print(f"[NOTIFY] Telegram API error: {response.text}")
            return False
    except Exception as e:
        print(f"[NOTIFY] Failed to send Telegram message: {e}")
        return False


def queue_message(conn, client_id: int, photographer_id: int, booking_id: int | None, 
                  message_type: str, message_text: str) -> int:
    """Добавление сообщения в очередь с буферизацией на 7 дней"""
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    with conn.cursor() as cur:
        booking_id_val = booking_id if booking_id else 'NULL'
        cur.execute(f"""
            INSERT INTO {SCHEMA}.telegram_message_queue
            (client_id, photographer_id, booking_id, message_type, message_text, expires_at)
            VALUES ({client_id}, {photographer_id}, {booking_id_val}, 
                    {escape_sql(message_type)}, {escape_sql(message_text)}, 
                    {escape_sql(expires_at.isoformat())})
            RETURNING id
        """)
        result = cur.fetchone()
        conn.commit()
        return result['id']


def send_or_queue_message(conn, client_id: int, photographer_id: int, 
                          booking_id: int, message_type: str, message_text: str) -> dict:
    """Отправка сообщения или добавление в буфер"""
    with conn.cursor() as cur:
        # Проверяем, подключен ли Telegram у клиента
        cur.execute(f"""
            SELECT telegram_chat_id, telegram_verified, name
            FROM {SCHEMA}.clients
            WHERE id = {client_id}
        """)
        client = cur.fetchone()
        
        if not client:
            return {'success': False, 'error': 'Client not found'}
        
        # Если Telegram подключен - отправляем сразу
        if client['telegram_verified'] and client['telegram_chat_id']:
            success = send_telegram_message(client['telegram_chat_id'], message_text)
            
            if success:
                return {
                    'success': True,
                    'status': 'sent',
                    'message': 'Сообщение доставлено'
                }
            else:
                # Если не удалось отправить - добавляем в буфер
                queue_id = queue_message(conn, client_id, photographer_id, 
                                        booking_id, message_type, message_text)
                return {
                    'success': True,
                    'status': 'queued',
                    'queue_id': queue_id,
                    'message': 'Не удалось доставить, добавлено в очередь'
                }
        
        # Если Telegram не подключен - добавляем в буфер
        queue_id = queue_message(conn, client_id, photographer_id, 
                                booking_id, message_type, message_text)
        
        return {
            'success': True,
            'status': 'queued',
            'queue_id': queue_id,
            'message': 'Ожидает подключения Telegram'
        }


def get_message_status(conn, booking_id: int) -> dict:
    """Получение статуса доставки сообщения о бронировании"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT status, created_at, sent_at, expires_at
            FROM {SCHEMA}.telegram_message_queue
            WHERE booking_id = {booking_id}
            ORDER BY created_at DESC
            LIMIT 1
        """)
        result = cur.fetchone()
        
        if not result:
            return {'status': 'not_found'}
        
        message = dict(result)
        
        if message['status'] == 'sent':
            return {
                'status': 'delivered',
                'message': 'Доставлено',
                'sent_at': message['sent_at'].isoformat() if message['sent_at'] else None
            }
        elif message['status'] == 'expired':
            return {
                'status': 'expired',
                'message': 'Не доставлено (истекло)'
            }
        else:
            return {
                'status': 'pending',
                'message': 'Ожидает подключения Telegram',
                'expires_at': message['expires_at'].isoformat() if message['expires_at'] else None
            }


def flush_pending_messages(conn, client_id: int, telegram_chat_id: str) -> dict:
    """Отправка всех накопленных сообщений клиенту"""
    with conn.cursor() as cur:
        # Находим все неотправленные сообщения
        cur.execute(f"""
            SELECT id, message_text, booking_id
            FROM {SCHEMA}.telegram_message_queue
            WHERE client_id = {client_id}
              AND status = 'pending'
              AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at ASC
        """)
        messages = cur.fetchall()
        
        sent_count = 0
        failed_count = 0
        
        for msg in messages:
            success = send_telegram_message(telegram_chat_id, msg['message_text'])
            
            if success:
                cur.execute(f"""
                    UPDATE {SCHEMA}.telegram_message_queue
                    SET status = 'sent', sent_at = CURRENT_TIMESTAMP
                    WHERE id = {msg['id']}
                """)
                sent_count += 1
            else:
                cur.execute(f"""
                    UPDATE {SCHEMA}.telegram_message_queue
                    SET attempts = attempts + 1,
                        last_error = 'Failed to send'
                    WHERE id = {msg['id']}
                """)
                failed_count += 1
        
        conn.commit()
        
        return {
            'sent': sent_count,
            'failed': failed_count,
            'total': len(messages)
        }


def get_cors_headers() -> dict:
    """CORS заголовки"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def cors_response(status: int, body: dict) -> dict:
    """Ответ с CORS"""
    return {
        "statusCode": status,
        "headers": {**get_cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handler(event, context):
    """
    Обработка отправки уведомлений клиентам
    
    POST ?action=send_booking - отправка уведомления о бронировании
    GET ?action=status&booking_id=123 - проверка статуса доставки
    POST ?action=flush&client_id=123 - отправка буфера при подключении Telegram
    """
    method = event.get("httpMethod", "GET")
    
    # CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": get_cors_headers(),
            "body": "",
        }
    
    params = event.get("queryStringParameters") or {}
    action = params.get("action", "")
    
    # Парсим body
    body = {}
    if method == "POST":
        raw_body = event.get("body", "{}")
        try:
            body = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            return cors_response(400, {"error": "Invalid JSON"})
    
    conn = None
    try:
        conn = get_db_connection()
        
        # Отправка уведомления о бронировании
        if action == "send_booking" and method == "POST":
            client_id = body.get("client_id")
            photographer_id = body.get("photographer_id")
            booking_id = body.get("booking_id")
            booking_date = body.get("booking_date")
            booking_time = body.get("booking_time")
            location = body.get("location", "Не указано")
            
            if not all([client_id, photographer_id, booking_id, booking_date, booking_time]):
                return cors_response(400, {"error": "Missing required fields"})
            
            message_text = (
                f"📸 <b>Новая фотосессия!</b>\n\n"
                f"📅 Дата: {booking_date}\n"
                f"🕐 Время: {booking_time}\n"
                f"📍 Место: {location}\n\n"
                f"Ждём вас! 🎉"
            )
            
            result = send_or_queue_message(
                conn, client_id, photographer_id, booking_id,
                'booking_created', message_text
            )
            
            return cors_response(200, result)
        
        # Проверка статуса доставки
        elif action == "status" and method == "GET":
            booking_id = params.get("booking_id")
            if not booking_id:
                return cors_response(400, {"error": "Missing booking_id"})
            
            status = get_message_status(conn, int(booking_id))
            return cors_response(200, status)
        
        # Отправка буфера при подключении Telegram
        elif action == "flush" and method == "POST":
            client_id = body.get("client_id")
            telegram_chat_id = body.get("telegram_chat_id")
            
            if not client_id or not telegram_chat_id:
                return cors_response(400, {"error": "Missing client_id or telegram_chat_id"})
            
            result = flush_pending_messages(conn, client_id, telegram_chat_id)
            return cors_response(200, result)
        
        else:
            return cors_response(400, {"error": f"Unknown action: {action}"})
    
    except Exception as e:
        print(f"[NOTIFY] Error: {e}")
        import traceback
        print(traceback.format_exc())
        return cors_response(500, {"error": "Internal server error"})
    finally:
        if conn:
            conn.close()