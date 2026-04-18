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
MAX_INSTANCE_ID = os.environ.get('MAX_INSTANCE_ID', '')
MAX_TOKEN = os.environ.get('MAX_TOKEN', '')


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


def send_max_notification(phone: str, message: str) -> bool:
    """Отправка уведомления через MAX (WhatsApp)"""
    if not MAX_INSTANCE_ID or not MAX_TOKEN:
        print("[NOTIFY] MAX credentials not configured")
        return False
    
    url = f"https://api.green-api.com/waInstance{MAX_INSTANCE_ID}/sendMessage/{MAX_TOKEN}"
    
    try:
        response = requests.post(url, json={
            'chatId': f"{phone.replace('+', '')}@c.us",
            'message': message
        }, timeout=10)
        
        if response.status_code == 200:
            return True
        else:
            print(f"[NOTIFY] MAX API error: {response.text}")
            return False
    except Exception as e:
        print(f"[NOTIFY] Failed to send MAX notification: {e}")
        return False


def notify_photographer(conn, photographer_id: int, client_name: str, 
                       message_type: str, extra_data: dict = None):
    """Отправка сервисного уведомления фотографу"""
    with conn.cursor() as cur:
        # Получаем контакты фотографа
        cur.execute(f"""
            SELECT phone_number, telegram_chat_id, telegram_verified
            FROM {SCHEMA}.users
            WHERE id = {photographer_id}
        """)
        photographer = cur.fetchone()
        
        if not photographer:
            return
        
        # Формируем текст уведомления
        if message_type == 'delivered':
            text = f"✅ Клиент {client_name} получил уведомление о съёмке"
            if extra_data and extra_data.get('booking_date'):
                text += f" на {extra_data['booking_date']}"
        elif message_type == 'queued':
            text = f"⏳ Клиент {client_name} ещё не подключил Telegram\nУведомление ждёт в очереди"
        elif message_type == 'bulk_delivered':
            count = extra_data.get('count', 0) if extra_data else 0
            text = f"🎉 Клиент {client_name} подключил Telegram!\nДоставлено {count} сообщений"
        elif message_type == 'expired':
            text = f"⚠️ Клиент {client_name} не подключил Telegram\nУведомление удалено (истекло 7 дней)"
        else:
            text = f"📢 Обновление по клиенту {client_name}"
        
        # Отправляем через Telegram если подключен
        if photographer['telegram_verified'] and photographer['telegram_chat_id']:
            send_telegram_message(photographer['telegram_chat_id'], text)
        
        # Отправляем через MAX (WhatsApp)
        if photographer['phone_number']:
            send_max_notification(photographer['phone_number'], text)


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
                # Уведомляем фотографа об успешной доставке
                notify_photographer(conn, photographer_id, client['name'], 'delivered', 
                                  {'booking_date': booking_date} if 'booking_date' in locals() else None)
                
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
        
        # Уведомляем фотографа что сообщение в очереди
        notify_photographer(conn, photographer_id, client['name'], 'queued')
        
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
        
        # Уведомляем фотографа о массовой доставке
        if sent_count > 0 and len(messages) > 0:
            # Берём photographer_id из первого сообщения
            first_msg = messages[0]
            cur.execute(f"""
                SELECT photographer_id, client_id
                FROM {SCHEMA}.telegram_message_queue
                WHERE id = {first_msg['id']}
            """)
            queue_info = cur.fetchone()
            
            if queue_info:
                cur.execute(f"""
                    SELECT name FROM {SCHEMA}.clients WHERE id = {queue_info['client_id']}
                """)
                client = cur.fetchone()
                
                if client:
                    notify_photographer(conn, queue_info['photographer_id'], 
                                      client['name'], 'bulk_delivered', 
                                      {'count': sent_count})
        
        return {
            'sent': sent_count,
            'failed': failed_count,
            'total': len(messages)
        }


def cleanup_expired_messages(conn) -> dict:
    """Очистка истекших сообщений из буфера (бывший telegram-cleanup-cron).
    Помечает сообщения старше срока expires_at как 'expired',
    уведомляет фотографов об этом, а также удаляет старые записи >30 дней."""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT DISTINCT tmq.photographer_id, c.name as client_name
            FROM {SCHEMA}.telegram_message_queue tmq
            JOIN {SCHEMA}.clients c ON c.id = tmq.client_id
            WHERE tmq.status = 'pending'
              AND tmq.expires_at < CURRENT_TIMESTAMP
        """)
        expired_messages = cur.fetchall()

        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_message_queue
            SET status = 'expired'
            WHERE status = 'pending'
              AND expires_at < CURRENT_TIMESTAMP
        """)
        expired_count = cur.rowcount

        # Уведомляем фотографов
        for msg in expired_messages:
            try:
                notify_photographer(conn, msg['photographer_id'],
                                     msg['client_name'], 'expired')
            except Exception as e:
                print(f"[CLEANUP] Notify error: {e}")

        # Удаляем старые записи (>30 дней)
        cur.execute(f"""
            DELETE FROM {SCHEMA}.telegram_message_queue
            WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
        """)
        deleted_count = cur.rowcount
        conn.commit()

        return {'expired': expired_count, 'deleted': deleted_count}


def send_direct_message(conn, client_id: int, user_id: int, message_text: str) -> dict:
    """Прямая отправка сообщения клиенту в Telegram"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT telegram_chat_id, telegram_verified, name
            FROM {SCHEMA}.clients
            WHERE id = {client_id}
        """)
        client = cur.fetchone()

        if not client:
            return {'success': False, 'error': 'Клиент не найден'}

        if not client['telegram_verified'] or not client['telegram_chat_id']:
            return {'success': False, 'error': 'У клиента не подключен Telegram'}

        success = send_telegram_message(client['telegram_chat_id'], message_text)

        if success:
            return {'success': True, 'status': 'sent', 'message': 'Сообщение доставлено'}
        else:
            return {'success': False, 'error': 'Не удалось отправить сообщение'}


def get_cors_headers() -> dict:
    """CORS заголовки"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Cron-Token",
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
    POST ?action=send_direct - прямая отправка сообщения клиенту
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
    
    body = {}
    if method == "POST":
        raw_body = event.get("body", "{}")
        try:
            body = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            return cors_response(400, {"error": "Invalid JSON"})
    
    action = params.get("action") or body.get("action", "")
    
    conn = None
    try:
        conn = get_db_connection()
        
        user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id') or ''

        if action == "send_direct" and method == "POST":
            client_id = body.get("client_id")
            message = body.get("message")

            if not client_id or not message:
                return cors_response(400, {"error": "Missing client_id or message"})

            result = send_direct_message(conn, int(client_id), int(user_id) if user_id else 0, message)
            return cors_response(200, result)

        # Отправка уведомления о бронировании
        elif action == "send_booking" and method == "POST":
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

        # CRON: очистка истекших сообщений (бывший telegram-cleanup-cron)
        elif action == "cleanup_expired":
            cron_token = os.environ.get('CRON_TOKEN', '')
            headers_in = event.get('headers', {}) or {}
            provided = headers_in.get('X-Cron-Token') or headers_in.get('x-cron-token') or ''
            if cron_token and provided != cron_token:
                return cors_response(401, {"error": "Unauthorized cron call"})

            result = cleanup_expired_messages(conn)
            print(f"[CLEANUP] Expired: {result['expired']}, Deleted: {result['deleted']}")
            return cors_response(200, {
                "success": True,
                "timestamp": datetime.utcnow().isoformat(),
                **result,
            })

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