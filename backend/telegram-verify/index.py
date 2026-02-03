"""
Backend функция для генерации кодов верификации Telegram
Позволяет пользователям привязать номер телефона к Telegram для получения уведомлений
"""

import json
import os
import random
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
from typing import Optional
import requests

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_NOTIFY_URL = 'https://functions.poehali.dev/acd42a29-3e28-415f-b82a-b5b29439cc80'


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


def generate_code() -> str:
    """Генерация 6-значного кода"""
    return str(random.randint(100000, 999999))


def create_verification_code(conn, user_id: int, phone_number: str) -> str:
    """Создание кода верификации"""
    code = generate_code()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    with conn.cursor() as cur:
        # Деактивируем старые коды
        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_verification_codes
            SET used = TRUE
            WHERE user_id = {user_id} AND used = FALSE
        """)
        
        # Создаем новый код
        cur.execute(f"""
            INSERT INTO {SCHEMA}.telegram_verification_codes
            (user_id, phone_number, code, expires_at)
            VALUES ({user_id}, {escape_sql(phone_number)}, {escape_sql(code)}, 
                    {escape_sql(expires_at.isoformat())})
        """)
        conn.commit()
    
    return code


def verify_code(conn, code: str, telegram_chat_id: str) -> Optional[dict]:
    """Проверка и активация кода верификации"""
    with conn.cursor() as cur:
        # Находим активный код
        cur.execute(f"""
            SELECT v.id, v.user_id, v.phone_number
            FROM {SCHEMA}.telegram_verification_codes v
            WHERE v.code = {escape_sql(code)}
              AND v.used = FALSE
              AND v.expires_at > CURRENT_TIMESTAMP
            LIMIT 1
        """)
        result = cur.fetchone()
        
        if not result:
            return None
        
        verification = dict(result)
        
        # Помечаем код использованным
        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_verification_codes
            SET used = TRUE
            WHERE id = {verification['id']}
        """)
        
        # Обновляем пользователя
        cur.execute(f"""
            UPDATE {SCHEMA}.users
            SET telegram_chat_id = {escape_sql(telegram_chat_id)},
                phone_number = {escape_sql(verification['phone_number'])},
                telegram_verified = TRUE,
                telegram_verified_at = CURRENT_TIMESTAMP
            WHERE id = {verification['user_id']}
        """)
        conn.commit()
        
        return verification


def flush_pending_messages(client_id: int, telegram_chat_id: str):
    """Отправка запроса на отправку буфера сообщений"""
    try:
        response = requests.post(
            f"{TELEGRAM_NOTIFY_URL}?action=flush",
            json={
                'client_id': client_id,
                'telegram_chat_id': telegram_chat_id
            },
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            print(f"[VERIFY] Flushed {data.get('sent', 0)} pending messages for client {client_id}")
        else:
            print(f"[VERIFY] Failed to flush messages: {response.text}")
    except Exception as e:
        print(f"[VERIFY] Error flushing messages: {e}")


def verify_invite(conn, invite_code: str, telegram_chat_id: str) -> Optional[dict]:
    """Проверка и активация invite-кода для клиента"""
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
            return None
        
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
        
        # Отправляем буфер сообщений
        flush_pending_messages(invite['client_id'], telegram_chat_id)
        
        return invite


def check_user_verification(conn, user_id: int) -> dict:
    """Проверка статуса верификации пользователя"""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT telegram_verified, phone_number, telegram_chat_id
            FROM {SCHEMA}.users
            WHERE id = {user_id}
        """)
        result = cur.fetchone()
        
        if not result:
            return {'verified': False}
        
        return {
            'verified': result['telegram_verified'] or False,
            'phone_number': result['phone_number'],
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
    Обработка запросов верификации Telegram
    
    GET ?action=check&user_id=123 - проверка статуса верификации
    POST ?action=generate - генерация кода (body: {user_id, phone_number})
    POST ?action=verify - проверка кода (body: {code, telegram_chat_id})
    POST ?action=verify_invite - проверка invite (body: {invite_code, telegram_chat_id})
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
        
        # Проверка статуса
        if action == "check" and method == "GET":
            user_id = params.get("user_id")
            if not user_id:
                return cors_response(400, {"error": "Missing user_id"})
            
            status = check_user_verification(conn, int(user_id))
            return cors_response(200, status)
        
        # Генерация кода
        elif action == "generate" and method == "POST":
            user_id = body.get("user_id")
            phone_number = body.get("phone_number")
            
            if not user_id or not phone_number:
                return cors_response(400, {"error": "Missing user_id or phone_number"})
            
            # Проверяем формат номера
            if not phone_number.startswith('+'):
                return cors_response(400, {"error": "Phone number must start with +"})
            
            code = create_verification_code(conn, user_id, phone_number)
            
            return cors_response(200, {
                "success": True,
                "code": code,
                "message": "Код сгенерирован. Отправьте боту команду: /verify " + code
            })
        
        # Проверка кода (вызывается ботом)
        elif action == "verify" and method == "POST":
            code = body.get("code")
            telegram_chat_id = body.get("telegram_chat_id")
            
            if not code or not telegram_chat_id:
                return cors_response(400, {"error": "Missing code or telegram_chat_id"})
            
            verification = verify_code(conn, code, telegram_chat_id)
            
            if not verification:
                return cors_response(404, {"error": "Код не найден или истёк"})
            
            return cors_response(200, {
                "success": True,
                "user_id": verification['user_id'],
                "phone_number": verification['phone_number'],
                "message": "Telegram успешно подключен!"
            })
        
        # Проверка invite-кода (вызывается ботом)
        elif action == "verify_invite" and method == "POST":
            invite_code = body.get("invite_code")
            telegram_chat_id = body.get("telegram_chat_id")
            
            if not invite_code or not telegram_chat_id:
                return cors_response(400, {"error": "Missing invite_code or telegram_chat_id"})
            
            invite = verify_invite(conn, invite_code, telegram_chat_id)
            
            if not invite:
                return cors_response(404, {"error": "Приглашение не найдено или истекло"})
            
            return cors_response(200, {
                "success": True,
                "client_id": invite['client_id'],
                "client_name": invite['client_name'],
                "client_phone": invite['client_phone'],
                "photographer_id": invite['photographer_id'],
                "message": f"Telegram успешно подключен для клиента {invite['client_name']}!"
            })
        
        else:
            return cors_response(400, {"error": f"Unknown action: {action}"})
    
    except Exception as e:
        print(f"[VERIFY] Error: {e}")
        import traceback
        print(traceback.format_exc())
        return cors_response(500, {"error": "Internal server error"})
    finally:
        if conn:
            conn.close()