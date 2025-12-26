"""
Business: Управление активными сессиями пользователей (просмотр, завершение)
Args: event с user_id и action (list/revoke/revoke_all/revoke_other)
Returns: HTTP response с данными о сессиях пользователя
"""

import json
import os
import hashlib
from datetime import datetime
from typing import Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL', '')
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


def get_user_sessions(user_id: int) -> List[Dict[str, Any]]:
    """Получение всех активных сессий пользователя"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT 
                    session_id,
                    created_at,
                    expires_at,
                    last_activity,
                    ip_address,
                    user_agent,
                    is_valid
                FROM {SCHEMA}.active_sessions
                WHERE user_id = {user_id}
                    AND is_valid = TRUE
                    AND expires_at > CURRENT_TIMESTAMP
                ORDER BY last_activity DESC
            """)
            sessions = cur.fetchall()
            
            return [
                {
                    'session_id': s['session_id'],
                    'created_at': s['created_at'].isoformat() if s['created_at'] else None,
                    'expires_at': s['expires_at'].isoformat() if s['expires_at'] else None,
                    'last_activity': s['last_activity'].isoformat() if s['last_activity'] else None,
                    'ip_address': s['ip_address'],
                    'user_agent': s['user_agent'],
                    'is_current': False
                }
                for s in sessions
            ]
    finally:
        conn.close()


def revoke_session(session_id: str, user_id: int) -> bool:
    """Отзыв конкретной сессии"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE {SCHEMA}.active_sessions
                SET is_valid = FALSE
                WHERE session_id = {escape_sql(session_id)}
                    AND user_id = {user_id}
            """)
            revoked = cur.rowcount > 0
            conn.commit()
            return revoked
    finally:
        conn.close()


def revoke_all_sessions(user_id: int, except_session_id: str = None) -> int:
    """Отзыв всех сессий пользователя (кроме текущей, если указана)"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if except_session_id:
                cur.execute(f"""
                    UPDATE {SCHEMA}.active_sessions
                    SET is_valid = FALSE
                    WHERE user_id = {user_id}
                        AND session_id != {escape_sql(except_session_id)}
                        AND is_valid = TRUE
                """)
            else:
                cur.execute(f"""
                    UPDATE {SCHEMA}.active_sessions
                    SET is_valid = FALSE
                    WHERE user_id = {user_id}
                        AND is_valid = TRUE
                """)
            
            revoked_count = cur.rowcount
            conn.commit()
            return revoked_count
    finally:
        conn.close()


def get_current_session_id(token: str) -> str:
    """Извлечение session_id из токена"""
    try:
        parts = token.split(':')
        if len(parts) >= 5:
            return parts[1]
    except Exception:
        pass
    return None


def log_security_event(user_id: int, event_type: str, details: Dict[str, Any], ip_address: str) -> None:
    """Логирование событий безопасности"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.login_attempts 
                (email, ip_address, user_agent, attempted_at, attempt_type)
                VALUES (
                    (SELECT email FROM {SCHEMA}.users WHERE id = {user_id}),
                    {escape_sql(ip_address)},
                    {escape_sql(event_type)},
                    CURRENT_TIMESTAMP,
                    {escape_sql(json.dumps(details))}
                )
            """)
        conn.commit()
    except Exception as e:
        print(f"[SESSION_MGMT] Failed to log security event: {e}")
    finally:
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик управления сессиями"""
    method = event.get('httpMethod', 'GET')
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
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
    
    user_id_header = headers.get('X-User-Id') or headers.get('x-user-id')
    user_id = query_params.get('user_id') or user_id_header
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': 'User ID is required'
            }),
            'isBase64Encoded': False
        }
    
    try:
        user_id = int(user_id)
    except ValueError:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': 'Invalid user ID'
            }),
            'isBase64Encoded': False
        }
    
    action = query_params.get('action', 'list')
    
    request_context = event.get('requestContext', {})
    identity = request_context.get('identity', {})
    ip_address = identity.get('sourceIp', 'unknown')
    
    try:
        if action == 'list':
            sessions = get_user_sessions(user_id)
            
            auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
            if auth_token:
                current_session_id = get_current_session_id(auth_token)
                if current_session_id:
                    for session in sessions:
                        if session['session_id'] == current_session_id:
                            session['is_current'] = True
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'user_id': user_id,
                    'sessions': sessions,
                    'total': len(sessions)
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'revoke':
            session_id = query_params.get('session_id')
            if not session_id:
                return {
                    'statusCode': 400,
                    'headers': cors_headers,
                    'body': json.dumps({
                        'success': False,
                        'error': 'Session ID is required'
                    }),
                    'isBase64Encoded': False
                }
            
            revoked = revoke_session(session_id, user_id)
            
            if revoked:
                log_security_event(user_id, 'session_revoked', {'session_id': session_id}, ip_address)
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'revoked': revoked,
                    'message': 'Session revoked' if revoked else 'Session not found'
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'revoke_all':
            revoked_count = revoke_all_sessions(user_id)
            
            log_security_event(user_id, 'all_sessions_revoked', {'count': revoked_count}, ip_address)
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'revoked_count': revoked_count,
                    'message': f'Revoked {revoked_count} sessions'
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'revoke_other':
            auth_token = headers.get('X-Auth-Token') or headers.get('x-auth-token')
            current_session_id = get_current_session_id(auth_token) if auth_token else None
            
            revoked_count = revoke_all_sessions(user_id, except_session_id=current_session_id)
            
            log_security_event(user_id, 'other_sessions_revoked', {'count': revoked_count}, ip_address)
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'revoked_count': revoked_count,
                    'message': f'Revoked {revoked_count} other sessions'
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'cleanup':
            from datetime import timedelta
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute(f"""
                        UPDATE {SCHEMA}.active_sessions
                        SET is_valid = FALSE
                        WHERE expires_at < CURRENT_TIMESTAMP AND is_valid = TRUE
                    """)
                    invalidated = cur.rowcount
                    conn.commit()
                return {
                    'statusCode': 200,
                    'headers': cors_headers,
                    'body': json.dumps({
                        'success': True,
                        'invalidated': invalidated
                    }),
                    'isBase64Encoded': False
                }
            finally:
                conn.close()
        
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
        print(f"[SESSION_MGMT] ERROR: {str(e)}")
        print(f"[SESSION_MGMT] TRACEBACK: {error_trace}")
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': f'Server error: {str(e)}'
            }),
            'isBase64Encoded': False
        }