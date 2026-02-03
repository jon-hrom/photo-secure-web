"""
Backend функция для генерации invite-ссылок для клиентов
Позволяет фотографам приглашать клиентов подключить Telegram для уведомлений
"""

import json
import os
import secrets
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'
BOT_USERNAME = 'FotooMixx_bot'


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


def generate_invite_code() -> str:
    """Генерация уникального кода приглашения"""
    return secrets.token_urlsafe(16)


def create_invite(conn, client_id: int, photographer_id: int, client_phone: str) -> dict:
    """Создание invite-ссылки для клиента"""
    invite_code = generate_invite_code()
    expires_at = datetime.utcnow() + timedelta(days=30)  # Ссылка действительна 30 дней
    
    with conn.cursor() as cur:
        # Деактивируем старые неиспользованные приглашения
        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_invites
            SET is_used = TRUE
            WHERE client_id = {client_id} AND is_used = FALSE
        """)
        
        # Создаем новое приглашение
        cur.execute(f"""
            INSERT INTO {SCHEMA}.telegram_invites
            (invite_code, client_id, photographer_id, client_phone, expires_at)
            VALUES ({escape_sql(invite_code)}, {client_id}, {photographer_id}, 
                    {escape_sql(client_phone)}, {escape_sql(expires_at.isoformat())})
            RETURNING invite_code
        """)
        result = cur.fetchone()
        conn.commit()
    
    invite_url = f"https://t.me/{BOT_USERNAME}?start={invite_code}"
    
    return {
        'invite_code': result['invite_code'],
        'invite_url': invite_url,
        'expires_at': expires_at.isoformat()
    }


def verify_invite(conn, invite_code: str, telegram_chat_id: str) -> dict:
    """Проверка и активация invite-кода"""
    with conn.cursor() as cur:
        # Находим активное приглашение
        cur.execute(f"""
            SELECT ti.id, ti.client_id, ti.photographer_id, ti.client_phone,
                   c.name as client_name
            FROM {SCHEMA}.telegram_invites ti
            JOIN {SCHEMA}.clients c ON c.id = ti.client_id
            WHERE ti.invite_code = {escape_sql(invite_code)}
              AND ti.is_used = FALSE
              AND ti.expires_at > CURRENT_TIMESTAMP
            LIMIT 1
        """)
        result = cur.fetchone()
        
        if not result:
            return {'success': False, 'error': 'Приглашение не найдено или истекло'}
        
        invite = dict(result)
        
        # Помечаем приглашение использованным
        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_invites
            SET is_used = TRUE, used_at = CURRENT_TIMESTAMP
            WHERE id = {invite['id']}
        """)
        
        # Обновляем клиента - привязываем Telegram
        cur.execute(f"""
            UPDATE {SCHEMA}.clients
            SET telegram_chat_id = {escape_sql(telegram_chat_id)},
                telegram_verified = TRUE,
                telegram_verified_at = CURRENT_TIMESTAMP
            WHERE id = {invite['client_id']}
        """)
        conn.commit()
        
        return {
            'success': True,
            'client_id': invite['client_id'],
            'client_name': invite['client_name'],
            'client_phone': invite['client_phone'],
            'photographer_id': invite['photographer_id']
        }


def check_client_telegram_status(conn, client_id: int) -> dict:
    """Проверка статуса подключения Telegram у клиента"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT telegram_verified, telegram_chat_id
            FROM {SCHEMA}.clients
            WHERE id = {client_id}
        """)
        result = cur.fetchone()
        
        if not result:
            return {'connected': False}
        
        return {
            'connected': result['telegram_verified'] or False,
            'has_chat_id': bool(result['telegram_chat_id'])
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
    Обработка запросов для invite-ссылок
    
    POST ?action=create - создание invite (body: {client_id, photographer_id, client_phone})
    POST ?action=verify - проверка invite (body: {invite_code, telegram_chat_id})
    GET ?action=check&client_id=123 - проверка статуса подключения клиента
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
        
        # Создание invite-ссылки
        if action == "create" and method == "POST":
            client_id = body.get("client_id")
            photographer_id = body.get("photographer_id")
            client_phone = body.get("client_phone")
            
            if not all([client_id, photographer_id, client_phone]):
                return cors_response(400, {"error": "Missing required fields"})
            
            invite_data = create_invite(conn, client_id, photographer_id, client_phone)
            
            return cors_response(200, {
                "success": True,
                **invite_data
            })
        
        # Проверка и активация invite (вызывается ботом)
        elif action == "verify" and method == "POST":
            invite_code = body.get("invite_code")
            telegram_chat_id = body.get("telegram_chat_id")
            
            if not invite_code or not telegram_chat_id:
                return cors_response(400, {"error": "Missing invite_code or telegram_chat_id"})
            
            result = verify_invite(conn, invite_code, telegram_chat_id)
            
            if not result.get('success'):
                return cors_response(404, result)
            
            return cors_response(200, result)
        
        # Проверка статуса подключения
        elif action == "check" and method == "GET":
            client_id = params.get("client_id")
            if not client_id:
                return cors_response(400, {"error": "Missing client_id"})
            
            status = check_client_telegram_status(conn, int(client_id))
            return cors_response(200, status)
        
        else:
            return cors_response(400, {"error": f"Unknown action: {action}"})
    
    except Exception as e:
        print(f"[INVITE] Error: {e}")
        import traceback
        print(traceback.format_exc())
        return cors_response(500, {"error": "Internal server error"})
    finally:
        if conn:
            conn.close()
