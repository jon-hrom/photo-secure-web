"""
Cron-задача для очистки истекших сообщений из буфера
Удаляет сообщения старше 7 дней и помечает их как expired
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'
CRON_TOKEN = os.environ.get('CRON_TOKEN', '')


def get_db_connection():
    """Создание подключения к БД"""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL not configured")
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def cleanup_expired_messages(conn) -> dict:
    """Удаление истекших сообщений"""
    with conn.cursor() as cur:
        # Помечаем истекшие сообщения
        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_message_queue
            SET status = 'expired'
            WHERE status = 'pending'
              AND expires_at < CURRENT_TIMESTAMP
        """)
        
        expired_count = cur.rowcount
        
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
