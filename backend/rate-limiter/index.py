"""
Business: Rate Limiting и защита от DDoS атак
Args: event с X-Rate-Limit-Check header и action (check/record)
Returns: HTTP response с данными о лимитах или блокировке
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


def log_security_event(event_type: str, severity: str, ip_address: str, 
                       user_id: Optional[int] = None, endpoint: Optional[str] = None,
                       details: Optional[Dict] = None) -> None:
    """Логирование события безопасности"""
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                details_json = json.dumps(details) if details else 'NULL'
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.security_logs 
                    (event_type, severity, user_id, ip_address, endpoint, details)
                    VALUES ({escape_sql(event_type)}, {escape_sql(severity)}, 
                            {escape_sql(user_id) if user_id else 'NULL'}, 
                            {escape_sql(ip_address)}, {escape_sql(endpoint)}, 
                            {details_json if details else 'NULL'})
                """)
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        print(f"[SECURITY_LOG] Error: {e}")


def check_ip_blacklist(ip_address: str) -> Optional[Dict[str, Any]]:
    """Проверка IP в чёрном списке"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT ip_address, reason, blocked_until, is_permanent
                FROM {SCHEMA}.ip_blacklist
                WHERE ip_address = {escape_sql(ip_address)}
                    AND (is_permanent = TRUE OR blocked_until > CURRENT_TIMESTAMP)
            """)
            result = cur.fetchone()
            
            if result:
                return {
                    'blocked': True,
                    'reason': result['reason'],
                    'permanent': result['is_permanent'],
                    'blocked_until': result['blocked_until'].isoformat() if result['blocked_until'] else None
                }
            return None
    finally:
        conn.close()


def add_to_blacklist(ip_address: str, reason: str, duration_hours: int = 24) -> None:
    """Добавление IP в чёрный список"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            blocked_until = datetime.now() + timedelta(hours=duration_hours)
            cur.execute(f"""
                INSERT INTO {SCHEMA}.ip_blacklist 
                (ip_address, reason, blocked_until, failed_attempts, last_attempt)
                VALUES ({escape_sql(ip_address)}, {escape_sql(reason)}, 
                        {escape_sql(blocked_until.isoformat())}, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (ip_address) DO UPDATE SET
                    failed_attempts = {SCHEMA}.ip_blacklist.failed_attempts + 1,
                    last_attempt = CURRENT_TIMESTAMP,
                    blocked_until = {escape_sql(blocked_until.isoformat())}
            """)
        conn.commit()
        
        log_security_event('ip_blocked', 'high', ip_address, details={
            'reason': reason,
            'duration_hours': duration_hours
        })
    finally:
        conn.close()


def check_rate_limit(ip_address: str, endpoint: str) -> Dict[str, Any]:
    """Проверка Rate Limit"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT setting_value 
                FROM {SCHEMA}.app_settings 
                WHERE setting_key IN ('rate_limit_requests', 'rate_limit_window_seconds', 
                                     'ip_block_threshold', 'ip_block_duration_hours')
            """)
            settings_rows = cur.fetchall()
            settings = {row['setting_key']: int(row['setting_value']) for row in settings_rows} if settings_rows else {}
            
            max_requests = settings.get('rate_limit_requests', 100)
            window_seconds = settings.get('rate_limit_window_seconds', 60)
            block_threshold = settings.get('ip_block_threshold', 50)
            block_duration = settings.get('ip_block_duration_hours', 24)
            
            window_start = datetime.now() - timedelta(seconds=window_seconds)
            
            cur.execute(f"""
                SELECT SUM(request_count) as total_requests
                FROM {SCHEMA}.rate_limits
                WHERE ip_address = {escape_sql(ip_address)}
                    AND endpoint = {escape_sql(endpoint)}
                    AND window_start > {escape_sql(window_start.isoformat())}
            """)
            result = cur.fetchone()
            
            current_requests = int(result['total_requests']) if result and result['total_requests'] else 0
            
            if current_requests >= max_requests:
                if current_requests >= block_threshold:
                    add_to_blacklist(ip_address, f'Rate limit exceeded: {current_requests} requests', block_duration)
                
                log_security_event('rate_limit_exceeded', 'medium', ip_address, 
                                 endpoint=endpoint, details={'requests': current_requests})
                
                return {
                    'allowed': False,
                    'limit': max_requests,
                    'current': current_requests,
                    'reset_in': window_seconds,
                    'message': 'Слишком много запросов. Повторите позже.'
                }
            
            return {
                'allowed': True,
                'limit': max_requests,
                'current': current_requests,
                'remaining': max_requests - current_requests,
                'reset_in': window_seconds
            }
    finally:
        conn.close()


def record_request(ip_address: str, endpoint: str) -> None:
    """Запись запроса в Rate Limit"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            window_start = datetime.now().replace(second=0, microsecond=0)
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.rate_limits 
                (ip_address, endpoint, request_count, window_start, last_request)
                VALUES ({escape_sql(ip_address)}, {escape_sql(endpoint)}, 1, 
                        {escape_sql(window_start.isoformat())}, CURRENT_TIMESTAMP)
                ON CONFLICT (ip_address, endpoint, window_start) DO UPDATE SET
                    request_count = {SCHEMA}.rate_limits.request_count + 1,
                    last_request = CURRENT_TIMESTAMP
            """)
        conn.commit()
    finally:
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик Rate Limiting"""
    method = event.get('httpMethod', 'GET')
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Endpoint',
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
    
    request_context = event.get('requestContext', {})
    identity = request_context.get('identity', {})
    ip_address = identity.get('sourceIp', 'unknown')
    
    headers = event.get('headers', {})
    query_params = event.get('queryStringParameters', {}) or {}
    
    endpoint = headers.get('X-Endpoint') or headers.get('x-endpoint') or query_params.get('endpoint', 'unknown')
    action = query_params.get('action', 'check')
    
    try:
        blacklist_check = check_ip_blacklist(ip_address)
        if blacklist_check:
            return {
                'statusCode': 403,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'blocked': True,
                    **blacklist_check
                }),
                'isBase64Encoded': False
            }
        
        if action == 'check':
            rate_limit = check_rate_limit(ip_address, endpoint)
            
            if not rate_limit['allowed']:
                return {
                    'statusCode': 429,
                    'headers': {
                        **cors_headers,
                        'X-RateLimit-Limit': str(rate_limit['limit']),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': str(rate_limit['reset_in'])
                    },
                    'body': json.dumps({
                        'success': False,
                        **rate_limit
                    }),
                    'isBase64Encoded': False
                }
            
            return {
                'statusCode': 200,
                'headers': {
                    **cors_headers,
                    'X-RateLimit-Limit': str(rate_limit['limit']),
                    'X-RateLimit-Remaining': str(rate_limit['remaining']),
                    'X-RateLimit-Reset': str(rate_limit['reset_in'])
                },
                'body': json.dumps({
                    'success': True,
                    **rate_limit
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'record':
            record_request(ip_address, endpoint)
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Request recorded'
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
        print(f"[RATE_LIMITER] ERROR: {str(e)}")
        print(f"[RATE_LIMITER] TRACEBACK: {error_trace}")
        
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': f'Server error: {str(e)}'
            }),
            'isBase64Encoded': False
        }
