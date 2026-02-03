"""
Cron-задача для очистки истекших сообщений из буфера
Удаляет сообщения старше 7 дней и помечает их как expired
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import requests

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'
CRON_TOKEN = os.environ.get('CRON_TOKEN', '')
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
MAX_INSTANCE_ID = os.environ.get('MAX_INSTANCE_ID', '')
MAX_TOKEN = os.environ.get('MAX_TOKEN', '')


def get_db_connection():
    """Создание подключения к БД"""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not configured")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def send_telegram_message(chat_id: str, text: str) -> bool:
    """Отправка сообщения через Telegram Bot API"""
    if not TELEGRAM_BOT_TOKEN:
        return False
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    
    try:
        response = requests.post(url, json={
            'chat_id': chat_id,
            'text': text
        }, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"[CLEANUP] Telegram error: {e}")
        return False


def send_max_notification(phone: str, message: str) -> bool:
    """Отправка уведомления через MAX (WhatsApp)"""
    if not MAX_INSTANCE_ID or not MAX_TOKEN:
        return False
    
    url = f"https://api.green-api.com/waInstance{MAX_INSTANCE_ID}/sendMessage/{MAX_TOKEN}"
    
    try:
        response = requests.post(url, json={
            'chatId': f"{phone.replace('+', '')}@c.us",
            'message': message
        }, timeout=10)
        return response.status_code == 200
    except Exception as e:
        print(f"[CLEANUP] MAX error: {e}")
        return False


def notify_photographer_expired(conn, photographer_id: int, client_name: str):
    """Уведомление фотографа об истекшем сообщении"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT phone_number, telegram_chat_id, telegram_verified
            FROM {SCHEMA}.users
            WHERE id = {photographer_id}
        """)
        photographer = cur.fetchone()
        
        if not photographer:
            return
        
        text = f"⚠️ Клиент {client_name} не подключил Telegram\nУведомление удалено (истекло 7 дней)"
        
        # Отправляем через Telegram
        if photographer['telegram_verified'] and photographer['telegram_chat_id']:
            send_telegram_message(photographer['telegram_chat_id'], text)
        
        # Отправляем через MAX
        if photographer['phone_number']:
            send_max_notification(photographer['phone_number'], text)


def cleanup_expired_messages(conn) -> dict:
    """Удаление истекших сообщений"""
    with conn.cursor() as cur:
        # Находим истекшие сообщения для уведомлений
        cur.execute(f"""
            SELECT DISTINCT tmq.photographer_id, c.name as client_name
            FROM {SCHEMA}.telegram_message_queue tmq
            JOIN {SCHEMA}.clients c ON c.id = tmq.client_id
            WHERE tmq.status = 'pending'
              AND tmq.expires_at < CURRENT_TIMESTAMP
        """)
        expired_messages = cur.fetchall()
        
        # Помечаем истекшие сообщения
        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_message_queue
            SET status = 'expired'
            WHERE status = 'pending'
              AND expires_at < CURRENT_TIMESTAMP
        """)
        
        expired_count = cur.rowcount
        
        # Уведомляем фотографов об истекших сообщениях
        for msg in expired_messages:
            notify_photographer_expired(conn, msg['photographer_id'], msg['client_name'])
        
        # Удаляем старые записи (старше 30 дней)
        cur.execute(f"""
            DELETE FROM {SCHEMA}.telegram_message_queue
            WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
        """)
        
        deleted_count = cur.rowcount
        conn.commit()
        
        return {
            'expired': expired_count,
            'deleted': deleted_count
        }


def get_cors_headers() -> dict:
    """CORS заголовки"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Cron-Token",
    }


def handler(event, context):
    """
    Cron handler для очистки буфера сообщений
    Запускается периодически (например, раз в день)
    """
    method = event.get("httpMethod", "GET")
    
    # CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": get_cors_headers(),
            "body": "",
        }
    
    # Проверка токена безопасности
    headers = event.get("headers", {})
    cron_token = headers.get("X-Cron-Token") or headers.get("x-cron-token")
    
    if not CRON_TOKEN or cron_token != CRON_TOKEN:
        return {
            "statusCode": 401,
            "headers": {**get_cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": "Unauthorized"})
        }
    
    conn = None
    try:
        conn = get_db_connection()
        result = cleanup_expired_messages(conn)
        
        print(f"[CLEANUP] Expired: {result['expired']}, Deleted: {result['deleted']}")
        
        return {
            "statusCode": 200,
            "headers": {**get_cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({
                "success": True,
                "timestamp": datetime.utcnow().isoformat(),
                **result
            })
        }
    
    except Exception as e:
        print(f"[CLEANUP] Error: {e}")
        import traceback
        print(traceback.format_exc())
        return {
            "statusCode": 500,
            "headers": {**get_cors_headers(), "Content-Type": "application/json"},
            "body": json.dumps({"error": "Internal server error"})
        }
    finally:
        if conn:
            conn.close()