"""
Business: Аутентификация пользователей с защитой от брутфорса и двухфакторной аутентификацией
Args: event - dict с httpMethod, body, queryStringParameters
      context - object с request_id, function_name и другими атрибутами
Returns: HTTP response dict с statusCode, headers, body
"""

import json
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL not configured')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def check_ip_blocked(conn, ip_address: str) -> tuple[bool, int]:
    cursor = conn.cursor()
    cursor.execute(
        "SELECT blocked_until FROM login_attempts WHERE ip_address = %s AND blocked_until > NOW() ORDER BY blocked_until DESC LIMIT 1",
        (ip_address,)
    )
    result = cursor.fetchone()
    
    if result and result['blocked_until']:
        remaining = int((result['blocked_until'] - datetime.now()).total_seconds())
        return True, remaining
    return False, 0

def count_recent_attempts(conn, ip_address: str, email: str) -> int:
    cursor = conn.cursor()
    cursor.execute(
        "SELECT COUNT(*) as count FROM login_attempts WHERE ip_address = %s AND email = %s AND attempt_time > NOW() - INTERVAL '10 minutes' AND is_successful = false",
        (ip_address, email)
    )
    result = cursor.fetchone()
    return result['count'] if result else 0

def record_login_attempt(conn, ip_address: str, email: str, is_successful: bool, block: bool = False):
    cursor = conn.cursor()
    blocked_until = datetime.now() + timedelta(minutes=10) if block else None
    cursor.execute(
        "INSERT INTO login_attempts (ip_address, email, is_successful, blocked_until) VALUES (%s, %s, %s, %s)",
        (ip_address, email, is_successful, blocked_until)
    )
    conn.commit()

def generate_2fa_code(code_type: str) -> str:
    if code_type == 'sms':
        return ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    else:
        return ''.join([str(secrets.randbelow(10)) for _ in range(5)])

def send_2fa_code(conn, user_id: int, code: str, code_type: str):
    cursor = conn.cursor()
    expires_at = datetime.now() + timedelta(minutes=10)
    cursor.execute(
        "INSERT INTO two_factor_codes (user_id, code, code_type, expires_at) VALUES (%s, %s, %s, %s)",
        (user_id, code, code_type, expires_at)
    )
    conn.commit()

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    body_str = event.get('body', '{}')
    params = event.get('queryStringParameters', {}) or {}
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        conn = get_db_connection()
        ip_address = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
        
        if method == 'POST':
            body = json.loads(body_str)
            action = body.get('action')
            
            if action == 'register':
                email = body.get('email')
                password = body.get('password')
                phone = body.get('phone', '')
                
                if not email or not password or not phone:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Email, пароль и телефон обязательны'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
                if cursor.fetchone():
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Пользователь с таким email уже существует'}),
                        'isBase64Encoded': False
                    }
                
                password_hash = hash_password(password)
                user_agent = event.get('headers', {}).get('User-Agent', '')
                
                cursor.execute(
                    "INSERT INTO users (email, password_hash, phone, ip_address, user_agent, last_login) VALUES (%s, %s, %s, %s, %s, NOW()) RETURNING id",
                    (email, password_hash, phone, ip_address, user_agent)
                )
                user_id = cursor.fetchone()['id']
                
                cursor.execute(
                    "INSERT INTO user_profiles (user_id) VALUES (%s)",
                    (user_id,)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True, 'userId': user_id}),
                    'isBase64Encoded': False
                }
            
            elif action == 'login':
                email = body.get('email')
                password = body.get('password')
                
                if not email or not password:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Email и пароль обязательны'}),
                        'isBase64Encoded': False
                    }
                
                is_blocked, remaining = check_ip_blocked(conn, ip_address)
                if is_blocked:
                    return {
                        'statusCode': 429,
                        'headers': headers,
                        'body': json.dumps({'error': 'Слишком много попыток', 'remainingSeconds': remaining}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id, password_hash, two_factor_sms, two_factor_email, is_blocked FROM users WHERE email = %s",
                    (email,)
                )
                user = cursor.fetchone()
                
                if not user or user['password_hash'] != hash_password(password):
                    attempts = count_recent_attempts(conn, ip_address, email)
                    block = attempts >= 4
                    record_login_attempt(conn, ip_address, email, False, block)
                    
                    return {
                        'statusCode': 401,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неверные учетные данные'}),
                        'isBase64Encoded': False
                    }
                
                if user['is_blocked']:
                    return {
                        'statusCode': 403,
                        'headers': headers,
                        'body': json.dumps({'error': 'Доступ заблокирован администратором'}),
                        'isBase64Encoded': False
                    }
                
                user_agent = event.get('headers', {}).get('User-Agent', '')
                cursor.execute(
                    "UPDATE users SET last_login = NOW(), ip_address = %s, user_agent = %s, is_active = true WHERE id = %s",
                    (ip_address, user_agent, user['id'])
                )
                conn.commit()
                
                record_login_attempt(conn, ip_address, email, True)
                
                if user['two_factor_sms'] or user['two_factor_email']:
                    code_type = 'sms' if user['two_factor_sms'] else 'email'
                    code = generate_2fa_code(code_type)
                    send_2fa_code(conn, user['id'], code, code_type)
                    
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({
                            'requires2FA': True,
                            'userId': user['id'],
                            'twoFactorType': code_type
                        }),
                        'isBase64Encoded': False
                    }
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True, 'userId': user['id']}),
                    'isBase64Encoded': False
                }
            
            elif action == 'verify-2fa':
                user_id = body.get('userId')
                code = body.get('code')
                
                if not user_id or not code:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'UserId и код обязательны'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT id FROM two_factor_codes WHERE user_id = %s AND code = %s AND expires_at > NOW() AND is_used = false ORDER BY created_at DESC LIMIT 1",
                    (user_id, code)
                )
                code_record = cursor.fetchone()
                
                if not code_record:
                    return {
                        'statusCode': 401,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неверный или истекший код'}),
                        'isBase64Encoded': False
                    }
                
                cursor.execute(
                    "UPDATE two_factor_codes SET is_used = true WHERE id = %s",
                    (code_record['id'],)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'toggle-2fa':
                user_id = body.get('userId')
                factor_type = body.get('type')
                enabled = body.get('enabled')
                
                if not user_id or not factor_type:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Все поля обязательны'}),
                        'isBase64Encoded': False
                    }
                
                field = f'two_factor_{factor_type}'
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE users SET {field} = %s WHERE id = %s",
                    (enabled, user_id)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'update-contact':
                user_id = body.get('userId')
                field = body.get('field')
                value = body.get('value')
                
                if not user_id or not field or field not in ['email', 'phone']:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Некорректные данные'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE users SET {field} = %s WHERE id = %s",
                    (value, user_id)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'update-activity':
                email = body.get('email')
                
                if not email:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Email обязателен'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                user_agent = event.get('headers', {}).get('User-Agent', '')
                cursor.execute(
                    "UPDATE users SET last_login = NOW(), ip_address = %s, user_agent = %s WHERE email = %s",
                    (ip_address, user_agent, email)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
        
        elif method == 'GET':
            user_id = params.get('userId')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'UserId обязателен'}),
                    'isBase64Encoded': False
                }
            
            cursor = conn.cursor()
            cursor.execute(
                "SELECT email, phone, two_factor_sms, two_factor_email, email_verified_at FROM users WHERE id = %s",
                (user_id,)
            )
            user = cursor.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': headers,
                    'body': json.dumps({'error': 'Пользователь не найден'}),
                    'isBase64Encoded': False
                }
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(dict(user)),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Not found'}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }