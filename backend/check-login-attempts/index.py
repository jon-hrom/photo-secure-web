"""
Business: Проверка и защита от брутфорса попыток входа
Args: event с email/ip в queryStringParameters и action (check/record/clear)
Returns: HTTP response с данными о блокировке или успешной записи
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
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


def get_security_settings() -> Dict[str, int]:
    """Получение настроек безопасности из БД"""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT setting_key, setting_value 
                    FROM {SCHEMA}.app_settings 
                    WHERE setting_key IN ('max_login_attempts', 'lockout_duration_minutes')
                """)
                rows = cur.fetchall()
                settings = {row['setting_key']: int(row['setting_value']) for row in rows}
                return {
                    'max_login_attempts': settings.get('max_login_attempts', 5),
                    'lockout_duration_minutes': settings.get('lockout_duration_minutes', 15)
                }
        finally:
            conn.close()
    except Exception as e:
        print(f"[BRUTEFORCE] Error loading settings: {e}, using defaults")
        return {'max_login_attempts': 5, 'lockout_duration_minutes': 15}


def check_login_attempts(email: str, ip_address: str) -> Dict[str, Any]:
    """Проверка попыток входа и блокировки"""
    settings = get_security_settings()
    max_attempts = settings['max_login_attempts']
    lockout_minutes = settings['lockout_duration_minutes']
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT 
                    COUNT(*) as attempt_count,
                    MAX(attempted_at) as last_attempt,
                    bool_or(is_blocked) as is_blocked,
                    MAX(blocked_until) as blocked_until
                FROM {SCHEMA}.login_attempts
                WHERE email = {escape_sql(email)}
                    AND attempted_at > CURRENT_TIMESTAMP - INTERVAL '{lockout_minutes} minutes'
            """)
            result = cur.fetchone()
            
            if not result or result['attempt_count'] == 0:
                return {
                    'blocked': False,
                    'attempts': 0,
                    'remaining': max_attempts,
                    'lockout_minutes': lockout_minutes
                }
            
            attempt_count = result['attempt_count']
            blocked_until = result['blocked_until']
            
            if blocked_until and datetime.now() < blocked_until:
                minutes_left = int((blocked_until - datetime.now()).total_seconds() / 60)
                return {
                    'blocked': True,
                    'attempts': attempt_count,
                    'remaining': 0,
                    'blocked_until': blocked_until.isoformat(),
                    'minutes_left': minutes_left,
                    'message': f'Слишком много неудачных попыток входа. Повторите через {minutes_left} минут.'
                }
            
            if attempt_count >= max_attempts:
                blocked_until = datetime.now() + timedelta(minutes=lockout_minutes)
                
                cur.execute(f"""
                    UPDATE {SCHEMA}.login_attempts
                    SET is_blocked = TRUE,
                        blocked_until = {escape_sql(blocked_until.isoformat())}
                    WHERE email = {escape_sql(email)}
                        AND attempted_at > CURRENT_TIMESTAMP - INTERVAL '{lockout_minutes} minutes'
                """)
                conn.commit()
                
                return {
                    'blocked': True,
                    'attempts': attempt_count,
                    'remaining': 0,
                    'blocked_until': blocked_until.isoformat(),
                    'minutes_left': lockout_minutes,
                    'message': f'Слишком много неудачных попыток входа. Повторите через {lockout_minutes} минут.'
                }
            
            return {
                'blocked': False,
                'attempts': attempt_count,
                'remaining': max_attempts - attempt_count,
                'lockout_minutes': lockout_minutes
            }
    finally:
        conn.close()


def record_login_attempt(email: str, ip_address: str, success: bool, attempt_type: str = 'password') -> None:
    """Запись попытки входа"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if success:
                cur.execute(f"""
                    UPDATE {SCHEMA}.login_attempts
                    SET is_blocked = FALSE,
                        blocked_until = NULL
                    WHERE email = {escape_sql(email)}
                """)
            else:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.login_attempts 
                    (email, ip_address, user_agent, attempted_at, attempt_type)
                    VALUES ({escape_sql(email)}, {escape_sql(ip_address)}, 'web', CURRENT_TIMESTAMP, {escape_sql(attempt_type)})
                """)
            conn.commit()
    finally:
        conn.close()


def clear_login_attempts(email: str) -> None:
    """Очистка попыток входа (при успешном входе)"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE {SCHEMA}.login_attempts
                SET is_blocked = FALSE,
                    blocked_until = NULL
                WHERE email = {escape_sql(email)}
            """)
            conn.commit()
    finally:
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик проверки попыток входа"""
    method = event.get('httpMethod', 'GET')
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    
    query_params = event.get('queryStringParameters', {}) or {}
    body_data = {}
    
    if method == 'POST':
        try:
            body = event.get('body', '{}')
            body_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            body_data = {}
    
    email = query_params.get('email') or body_data.get('email')
    action = query_params.get('action', 'check')
    
    request_context = event.get('requestContext', {})
    identity = request_context.get('identity', {})
    ip_address = identity.get('sourceIp', 'unknown')
    
    if not email:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': 'Email is required'
            }),
            'isBase64Encoded': False
        }
    
    try:
        if action == 'check':
            result = check_login_attempts(email, ip_address)
            return {
                'statusCode': 200 if not result['blocked'] else 429,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    **result
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'record':
            success = body_data.get('success', False)
            attempt_type = body_data.get('type', 'password')
            record_login_attempt(email, ip_address, success, attempt_type)
            
            if success:
                clear_login_attempts(email)
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Attempt recorded'
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'clear':
            clear_login_attempts(email)
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Attempts cleared'
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
        print(f"[BRUTEFORCE] ERROR: {str(e)}")
        print(f"[BRUTEFORCE] TRACEBACK: {error_trace}")
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': f'Server error: {str(e)}'
            }),
            'isBase64Encoded': False
        }