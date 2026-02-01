"""
Telegram OAuth авторизация с JWT сессиями
Работает так же как VK/Google авторизация
"""

import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt

DATABASE_URL = os.environ.get('DATABASE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret-change-me')
SCHEMA = 't_p28211681_photo_secure_web'


def generate_state() -> str:
    """Генерация state для защиты от CSRF"""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Хеширование токена"""
    return hashlib.sha256(token.encode()).hexdigest()


def escape_sql(value: Any) -> str:
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


def create_jwt(user_id: int, expires_in: int = 900) -> str:
    """Создание JWT токена"""
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(seconds=expires_in),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def get_auth_token(conn, token: str) -> Optional[dict]:
    """Получение данных токена авторизации"""
    token_hash = hash_token(token)
    
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT telegram_id, telegram_username, telegram_first_name,
                   telegram_last_name, telegram_photo_url, expires_at, used_at
            FROM {SCHEMA}.telegram_auth_tokens
            WHERE token_hash = {escape_sql(token_hash)}
        """)
        result = cur.fetchone()
        return dict(result) if result else None


def mark_token_used(conn, token: str) -> bool:
    """Пометить токен как использованный"""
    token_hash = hash_token(token)
    
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_auth_tokens
            SET used_at = CURRENT_TIMESTAMP
            WHERE token_hash = {escape_sql(token_hash)} AND used_at IS NULL
        """)
        conn.commit()
        return cur.rowcount > 0


def create_or_update_user(
    conn,
    telegram_id: str,
    username: Optional[str],
    first_name: Optional[str],
    last_name: Optional[str],
    photo_url: Optional[str],
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> int:
    """Создать или обновить пользователя через Telegram"""
    
    with conn.cursor() as cur:
        # Формируем display_name
        name_parts = []
        if first_name:
            name_parts.append(first_name)
        if last_name:
            name_parts.append(last_name)
        display_name = " ".join(name_parts) if name_parts else username or f"User {telegram_id}"
        
        print(f"[TG_AUTH] Creating/updating user: telegram_id={telegram_id}, name={display_name}")
        
        # Проверяем есть ли пользователь с таким telegram_id
        cur.execute(f"""
            SELECT id FROM {SCHEMA}.users
            WHERE telegram_id = {escape_sql(telegram_id)}
        """)
        existing = cur.fetchone()
        
        if existing:
            user_id = existing['id']
            print(f"[TG_AUTH] User exists, updating: user_id={user_id}")
            
            # Обновляем существующего пользователя
            cur.execute(f"""
                UPDATE {SCHEMA}.users
                SET display_name = COALESCE(display_name, {escape_sql(display_name)}),
                    avatar_url = {escape_sql(photo_url)},
                    last_login = CURRENT_TIMESTAMP,
                    ip_address = {escape_sql(ip_address)},
                    user_agent = {escape_sql(user_agent)}
                WHERE id = {user_id}
            """)
            conn.commit()
            return user_id
        else:
            print(f"[TG_AUTH] Creating new user")
            
            # Создаём нового пользователя
            cur.execute(f"""
                INSERT INTO {SCHEMA}.users
                (telegram_id, display_name, avatar_url, is_active, source, 
                 registered_at, created_at, updated_at, last_login,
                 ip_address, user_agent, role)
                VALUES ({escape_sql(telegram_id)}, {escape_sql(display_name)}, {escape_sql(photo_url)},
                        TRUE, 'telegram', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                        {escape_sql(ip_address)}, {escape_sql(user_agent)}, 'user')
                RETURNING id
            """)
            new_user = cur.fetchone()
            user_id = new_user['id']
            conn.commit()
            
            print(f"[TG_AUTH] New user created: user_id={user_id}")
            return user_id


def save_refresh_token(conn, user_id: int, token_hash: str, expires_at: datetime) -> None:
    """Сохранить refresh token"""
    import uuid
    token_id = str(uuid.uuid4())
    session_id = str(uuid.uuid4())
    
    with conn.cursor() as cur:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.refresh_tokens 
            (token_id, user_id, token_hash, session_id, expires_at, created_at)
            VALUES ({escape_sql(token_id)}, {user_id}, {escape_sql(token_hash)}, 
                    {escape_sql(session_id)}, {escape_sql(expires_at.isoformat())}, CURRENT_TIMESTAMP)
        """)
        conn.commit()


def cleanup_expired_tokens(conn) -> None:
    """Очистка просроченных токенов"""
    with conn.cursor() as cur:
        cur.execute(f"""
            DELETE FROM {SCHEMA}.telegram_auth_tokens
            WHERE expires_at < CURRENT_TIMESTAMP OR (used_at IS NOT NULL AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 hour')
        """)
        conn.commit()


def get_cors_headers() -> dict:
    """CORS заголовки"""
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def cors_response(status: int, body: dict) -> dict:
    """Ответ с CORS"""
    return {
        "statusCode": status,
        "headers": {**get_cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def handle_callback(conn, body: dict, ip_address: str = None, user_agent: str = None) -> dict:
    """
    Обмен токена на JWT
    POST ?action=callback
    """
    print(f"[TG_AUTH] Callback request: {body}")
    
    token = body.get("token")
    if not token:
        print("[TG_AUTH] Error: Missing token")
        return cors_response(400, {"error": "Missing token"})
    
    print(f"[TG_AUTH] Token: {token[:20]}...")
    
    # Получаем данные токена
    token_data = get_auth_token(conn, token)
    
    if not token_data:
        print("[TG_AUTH] Error: Token not found")
        return cors_response(404, {"error": "Token not found"})
    
    print(f"[TG_AUTH] Token data: telegram_id={token_data.get('telegram_id')}, expires_at={token_data.get('expires_at')}")
    
    # Проверяем срок действия
    expires_at = token_data["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at.replace('Z', ''))
    
    if expires_at < datetime.utcnow():
        print("[TG_AUTH] Error: Token expired")
        return cors_response(410, {"error": "Token expired"})
    
    # Проверяем использование
    if token_data.get("used_at"):
        print("[TG_AUTH] Error: Token already used")
        return cors_response(410, {"error": "Token already used"})
    
    # Проверяем наличие telegram_id
    if not token_data["telegram_id"]:
        print("[TG_AUTH] Error: Token not authenticated")
        return cors_response(400, {"error": "Token not authenticated"})
    
    # Создаём или обновляем пользователя
    try:
        user_id = create_or_update_user(
            conn,
            telegram_id=token_data["telegram_id"],
            username=token_data["telegram_username"],
            first_name=token_data["telegram_first_name"],
            last_name=token_data["telegram_last_name"],
            photo_url=token_data["telegram_photo_url"],
            ip_address=ip_address,
            user_agent=user_agent
        )
        print(f"[TG_AUTH] User ID: {user_id}")
    except Exception as e:
        print(f"[TG_AUTH] Error creating user: {e}")
        import traceback
        print(traceback.format_exc())
        return cors_response(500, {"error": f"Failed to create user: {str(e)}"})
    
    # Помечаем токен как использованный
    mark_token_used(conn, token)
    
    # Генерируем JWT токены
    access_token = create_jwt(user_id, expires_in=900)  # 15 минут
    refresh_token = secrets.token_urlsafe(48)
    refresh_token_hash = hash_token(refresh_token)
    refresh_expires = datetime.utcnow() + timedelta(days=30)
    
    save_refresh_token(conn, user_id, refresh_token_hash, refresh_expires)
    
    # Получаем данные пользователя
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT id, email, display_name as name, avatar_url, telegram_id
            FROM {SCHEMA}.users
            WHERE id = {user_id}
        """)
        user_data = cur.fetchone()
    
    response_data = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": 900,
        "user": dict(user_data) if user_data else {"id": user_id}
    }
    
    print(f"[TG_AUTH] Success! Returning tokens for user {user_id}")
    return cors_response(200, response_data)


def handler(event, context):
    """
    Обработка авторизации через Telegram
    """
    print(f"[TG_AUTH] Request: {event.get('httpMethod')} {event.get('queryStringParameters')}")
    
    method = event.get("httpMethod", "GET")
    
    # CORS preflight
    if method == "OPTIONS":
        return {
            "statusCode": 204,
            "headers": get_cors_headers(),
            "body": "",
        }
    
    # Парсим параметры
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
    
    # Получаем IP и User-Agent
    request_context = event.get("requestContext", {})
    identity = request_context.get("identity", {})
    ip_address = identity.get("sourceIp")
    user_agent = identity.get("userAgent")
    
    # Проверяем конфигурацию до подключения к БД
    if not DATABASE_URL:
        print("[TG_AUTH] Error: DATABASE_URL not configured")
        return cors_response(500, {"error": "Server configuration error: DATABASE_URL not set"})
    
    conn = None
    try:
        print("[TG_AUTH] Connecting to database...")
        conn = get_db_connection()
        print("[TG_AUTH] Database connected")
        
        # Очистка просроченных токенов
        cleanup_expired_tokens(conn)
        
        # Маршрутизация
        if action == "callback" and method == "POST":
            return handle_callback(conn, body, ip_address, user_agent)
        else:
            return cors_response(400, {"error": f"Unknown action: {action}"})
    
    except ValueError as e:
        print(f"[TG_AUTH] Configuration error: {e}")
        return cors_response(500, {"error": f"Server configuration error: {str(e)}"})
    except Exception as e:
        print(f"[TG_AUTH] Error: {e}")
        import traceback
        print(traceback.format_exc())
        return cors_response(500, {"error": "Internal server error"})
    finally:
        if conn:
            conn.close()