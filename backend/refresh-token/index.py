"""
Business: Управление Refresh Tokens для продления сессий без повторного входа
Args: event с refresh_token в body и action (refresh/revoke)
Returns: HTTP response с новым access token или ошибкой
"""

import json
import os
import hashlib
import hmac
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret-change-me')
SCHEMA = 't_p28211681_photo_secure_web'


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
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def get_security_settings() -> Dict[str, int]:
    """Получение настроек безопасности из БД"""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT setting_key, setting_value 
                    FROM {SCHEMA}.app_settings 
                    WHERE setting_key IN ('jwt_expiration_minutes', 'refresh_token_expiration_days')
                """)
                rows = cur.fetchall()
                settings = {row['setting_key']: int(row['setting_value']) for row in rows}
                return {
                    'jwt_expiration_minutes': settings.get('jwt_expiration_minutes', 30),
                    'refresh_token_expiration_days': settings.get('refresh_token_expiration_days', 30)
                }
        finally:
            conn.close()
    except Exception as e:
        print(f"[REFRESH_TOKEN] Error loading settings: {e}, using defaults")
        return {'jwt_expiration_minutes': 30, 'refresh_token_expiration_days': 30}


def generate_refresh_token(user_id: int, session_id: str, ip_address: str, user_agent: str) -> str:
    """Генерация Refresh Token"""
    security_settings = get_security_settings()
    expiration_days = security_settings['refresh_token_expiration_days']
    
    token_id = str(uuid.uuid4())
    issued_at = datetime.now()
    expires_at = issued_at + timedelta(days=expiration_days)
    
    payload = f"{user_id}:{token_id}:{int(issued_at.timestamp())}:{int(expires_at.timestamp())}"
    signature = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token = f"{payload}:{signature}"
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.refresh_tokens 
                (token_id, user_id, token_hash, session_id, created_at, expires_at, ip_address, user_agent)
                VALUES ({escape_sql(token_id)}, {user_id}, {escape_sql(token_hash)}, 
                        {escape_sql(session_id)}, {escape_sql(issued_at.isoformat())}, 
                        {escape_sql(expires_at.isoformat())}, {escape_sql(ip_address)}, {escape_sql(user_agent)})
            """)
        conn.commit()
        print(f"[REFRESH_TOKEN] Created: token_id={token_id}, expires_at={expires_at}")
    except Exception as e:
        print(f"[REFRESH_TOKEN] Error saving token: {e}")
    finally:
        conn.close()
    
    return token


def validate_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """Проверка Refresh Token"""
    try:
        parts = token.split(':')
        if len(parts) != 5:
            return None
        
        user_id, token_id, issued_at, expires_at, signature = parts
        
        payload = f"{user_id}:{token_id}:{issued_at}:{expires_at}"
        expected_signature = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        
        if signature != expected_signature:
            print(f"[REFRESH_TOKEN] Invalid signature")
            return None
        
        expires_timestamp = int(expires_at)
        if datetime.now().timestamp() > expires_timestamp:
            print(f"[REFRESH_TOKEN] Token expired")
            return None
        
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT 
                        rt.token_id,
                        rt.user_id,
                        rt.session_id,
                        rt.is_valid,
                        rt.used_at,
                        rt.revoked_at,
                        u.email,
                        u.display_name,
                        u.is_active
                    FROM {SCHEMA}.refresh_tokens rt
                    JOIN {SCHEMA}.users u ON rt.user_id = u.id
                    WHERE rt.token_hash = {escape_sql(token_hash)}
                        AND rt.is_valid = TRUE
                        AND rt.expires_at > CURRENT_TIMESTAMP
                        AND rt.revoked_at IS NULL
                """)
                result = cur.fetchone()
                
                if not result:
                    print(f"[REFRESH_TOKEN] Token not found or invalid")
                    return None
                
                if not result['is_active']:
                    print(f"[REFRESH_TOKEN] User is inactive")
                    return None
                
                cur.execute(f"""
                    UPDATE {SCHEMA}.refresh_tokens
                    SET used_at = CURRENT_TIMESTAMP
                    WHERE token_id = {escape_sql(result['token_id'])}
                """)
                conn.commit()
                
                return dict(result)
        finally:
            conn.close()
    except Exception as e:
        print(f"[REFRESH_TOKEN] Validation error: {e}")
        return None


def generate_access_token(user_id: int, session_id: str, ip_address: str, user_agent: str) -> str:
    """Генерация нового Access Token"""
    security_settings = get_security_settings()
    jwt_expiration_minutes = security_settings['jwt_expiration_minutes']
    
    issued_at = datetime.now()
    expires_at = issued_at + timedelta(minutes=jwt_expiration_minutes)
    
    payload = f"{user_id}:{session_id}:{int(issued_at.timestamp())}:{int(expires_at.timestamp())}"
    signature = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token = f"{payload}:{signature}"
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE {SCHEMA}.active_sessions
                SET token_hash = {escape_sql(token_hash)},
                    expires_at = {escape_sql(expires_at.isoformat())},
                    last_activity = CURRENT_TIMESTAMP
                WHERE session_id = {escape_sql(session_id)}
            """)
        conn.commit()
    finally:
        conn.close()
    
    return token


def revoke_refresh_token(token: str) -> bool:
    """Отзыв Refresh Token"""
    try:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {SCHEMA}.refresh_tokens
                    SET is_valid = FALSE,
                        revoked_at = CURRENT_TIMESTAMP
                    WHERE token_hash = {escape_sql(token_hash)}
                """)
            conn.commit()
            return True
        finally:
            conn.close()
    except Exception as e:
        print(f"[REFRESH_TOKEN] Revoke error: {e}")
        return False


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик Refresh Token"""
    method = event.get('httpMethod', 'POST')
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        body = event.get('body', '{}')
        data = json.loads(body) if body else {}
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': 'Invalid JSON'
            }),
            'isBase64Encoded': False
        }
    
    refresh_token = data.get('refresh_token')
    action = data.get('action', 'refresh')
    
    if not refresh_token:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': 'Refresh token is required'
            }),
            'isBase64Encoded': False
        }
    
    request_context = event.get('requestContext', {})
    identity = request_context.get('identity', {})
    ip_address = identity.get('sourceIp', 'unknown')
    user_agent = identity.get('userAgent', 'unknown')
    
    try:
        if action == 'refresh':
            token_data = validate_refresh_token(refresh_token)
            
            if not token_data:
                return {
                    'statusCode': 401,
                    'headers': cors_headers,
                    'body': json.dumps({
                        'success': False,
                        'error': 'Invalid or expired refresh token'
                    }),
                    'isBase64Encoded': False
                }
            
            new_access_token = generate_access_token(
                token_data['user_id'],
                token_data['session_id'],
                ip_address,
                user_agent
            )
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'access_token': new_access_token,
                    'user': {
                        'user_id': token_data['user_id'],
                        'email': token_data['email'],
                        'display_name': token_data['display_name']
                    }
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'revoke':
            success = revoke_refresh_token(refresh_token)
            
            return {
                'statusCode': 200 if success else 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': success,
                    'message': 'Token revoked' if success else 'Failed to revoke token'
                }),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': 'Invalid action'
            }),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[REFRESH_TOKEN] ERROR: {str(e)}")
        print(f"[REFRESH_TOKEN] TRACEBACK: {error_trace}")
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': f'Server error: {str(e)}'
            }),
            'isBase64Encoded': False
        }
