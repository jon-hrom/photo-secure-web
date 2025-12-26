"""
Business: Проверка валидности JWT токенов и активных сессий
Args: event с X-Auth-Token header или token в queryStringParameters
Returns: HTTP response с результатом валидации и данными пользователя
"""

import json
import os
import hashlib
import hmac
from datetime import datetime
from typing import Dict, Any, Optional
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


def validate_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Проверка JWT токена и извлечение данных"""
    try:
        parts = token.split(':')
        if len(parts) != 5:
            print(f"[VALIDATE] Invalid token format: expected 5 parts, got {len(parts)}")
            return None
        
        user_id, session_id, issued_at, expires_at, signature = parts
        
        payload = f"{user_id}:{session_id}:{issued_at}:{expires_at}"
        expected_signature = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        
        if signature != expected_signature:
            print(f"[VALIDATE] Invalid signature")
            return None
        
        expires_timestamp = int(expires_at)
        if datetime.now().timestamp() > expires_timestamp:
            print(f"[VALIDATE] Token expired: expires_at={datetime.fromtimestamp(expires_timestamp)}")
            return None
        
        return {
            'user_id': int(user_id),
            'session_id': session_id,
            'issued_at': datetime.fromtimestamp(int(issued_at)),
            'expires_at': datetime.fromtimestamp(expires_timestamp)
        }
    except Exception as e:
        print(f"[VALIDATE] Token validation error: {e}")
        return None


def check_session_in_db(token: str, user_id: int, session_id: str) -> Optional[Dict[str, Any]]:
    """Проверка сессии в БД"""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT 
                    s.session_id,
                    s.user_id,
                    s.expires_at,
                    s.last_activity,
                    s.is_valid,
                    u.email,
                    u.display_name,
                    u.role,
                    u.is_active
                FROM {SCHEMA}.active_sessions s
                JOIN {SCHEMA}.users u ON s.user_id = u.id
                WHERE s.session_id = {escape_sql(session_id)}
                    AND s.user_id = {user_id}
                    AND s.token_hash = {escape_sql(token_hash)}
                    AND s.is_valid = TRUE
                    AND s.expires_at > CURRENT_TIMESTAMP
            """)
            session = cur.fetchone()
            
            if not session:
                print(f"[VALIDATE] Session not found or invalid: session_id={session_id}")
                return None
            
            if not session['is_active']:
                print(f"[VALIDATE] User is inactive: user_id={user_id}")
                return None
            
            cur.execute(f"""
                UPDATE {SCHEMA}.active_sessions
                SET last_activity = CURRENT_TIMESTAMP
                WHERE session_id = {escape_sql(session_id)}
            """)
            conn.commit()
            
            return dict(session)
    finally:
        conn.close()


def invalidate_session(session_id: str) -> None:
    """Инвалидация сессии"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE {SCHEMA}.active_sessions
                SET is_valid = FALSE
                WHERE session_id = {escape_sql(session_id)}
            """)
        conn.commit()
    finally:
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик валидации сессий"""
    method = event.get('httpMethod', 'GET')
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-User-Id',
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
    
    headers = event.get('headers', {})
    query_params = event.get('queryStringParameters', {}) or {}
    
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token') or query_params.get('token')
    action = query_params.get('action', 'validate')
    
    if not token:
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'valid': False,
                'error': 'Token not provided'
            }),
            'isBase64Encoded': False
        }
    
    try:
        if action == 'invalidate':
            token_data = validate_jwt_token(token)
            if token_data:
                invalidate_session(token_data['session_id'])
                return {
                    'statusCode': 200,
                    'headers': cors_headers,
                    'body': json.dumps({
                        'success': True,
                        'message': 'Session invalidated'
                    }),
                    'isBase64Encoded': False
                }
            
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'Invalid token'
                }),
                'isBase64Encoded': False
            }
        
        token_data = validate_jwt_token(token)
        if not token_data:
            return {
                'statusCode': 401,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'valid': False,
                    'error': 'Invalid or expired token'
                }),
                'isBase64Encoded': False
            }
        
        session_data = check_session_in_db(token, token_data['user_id'], token_data['session_id'])
        if not session_data:
            return {
                'statusCode': 401,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'valid': False,
                    'error': 'Session not found or expired'
                }),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'success': True,
                'valid': True,
                'user': {
                    'user_id': session_data['user_id'],
                    'email': session_data['email'],
                    'display_name': session_data['display_name'],
                    'role': session_data['role']
                },
                'session': {
                    'session_id': session_data['session_id'],
                    'expires_at': session_data['expires_at'].isoformat(),
                    'last_activity': session_data['last_activity'].isoformat()
                }
            }),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[VALIDATE] ERROR: {str(e)}")
        print(f"[VALIDATE] TRACEBACK: {error_trace}")
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'valid': False,
                'error': f'Validation error: {str(e)}'
            }),
            'isBase64Encoded': False
        }
