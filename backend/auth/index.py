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
import boto3
from botocore.config import Config

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL not configured')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def get_ses_client():
    access_key = os.environ.get('POSTBOX_ACCESS_KEY_ID')
    secret_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
    if not access_key or not secret_key:
        raise Exception('Postbox credentials not configured')
    
    return boto3.client(
        'sesv2',
        region_name='ru-central1',
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        endpoint_url='https://postbox.cloud.yandex.net',
        config=Config(signature_version='v4')
    )

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def escape_sql(value):
    """Escape values for Simple Query Protocol (no parameterized queries)"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    # Escape single quotes by doubling them
    return "'" + str(value).replace("'", "''") + "'"

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

def send_2fa_email(to: str, code: str):
    subject = 'Код двухфакторной аутентификации — foto-mix.ru'
    text = f'Ваш код для входа: {code}\nСрок действия: 10 минут.'
    html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Код 2FA</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f7">
        <tr>
            <td align="center" style="padding:40px 20px">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
                    
                    <tr>
                        <td style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);padding:40px 30px;text-align:center">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center">
                                        <div style="background-color:#ffffff;width:80px;height:80px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 8px 16px rgba(0,0,0,0.1)">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <rect x="3" y="11" width="18" height="11" rx="2" fill="#10b981"/>
                                                <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
                                                <circle cx="12" cy="16" r="1.5" fill="#ffffff"/>
                                            </svg>
                                        </div>
                                        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px">Безопасный вход</h1>
                                        <p style="margin:10px 0 0 0;color:#d1fae5;font-size:16px">foto-mix.ru</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding:50px 40px">
                            <h2 style="margin:0 0 15px 0;color:#1a1a1a;font-size:24px;font-weight:700">Код для входа в аккаунт</h2>
                            <p style="margin:0 0 30px 0;color:#666666;font-size:16px;line-height:1.6">
                                Используйте этот код для завершения входа в систему:
                            </p>
                            
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding:20px 0">
                                        <div style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);padding:25px 40px;border-radius:16px;box-shadow:0 8px 24px rgba(16,185,129,0.25)">
                                            <div style="font-size:44px;font-weight:800;letter-spacing:14px;color:#ffffff;font-family:'Courier New',monospace">{code}</div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px">
                                <tr>
                                    <td style="padding:20px;background-color:#dbeafe;border-left:4px solid #3b82f6;border-radius:8px">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="padding-right:15px;vertical-align:top">
                                                    <div style="width:24px;height:24px;background-color:#3b82f6;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">
                                                        <span style="color:#ffffff;font-size:16px;font-weight:700">🛡</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <p style="margin:0;color:#1e40af;font-size:14px;line-height:1.5">
                                                        <strong>Никому не сообщайте этот код</strong><br>
                                                        Сотрудники foto-mix.ru никогда не попросят у вас код
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding:30px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb">
                            <p style="margin:0 0 10px 0;color:#6b7280;font-size:14px">
                                Если это были не вы, <strong>немедленно измените пароль</strong> в настройках аккаунта.
                            </p>
                            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
                            <p style="margin:0;color:#9ca3af;font-size:12px">
                                © 2025 foto-mix.ru — Защита вашего аккаунта
                            </p>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'''
    
    ses = get_ses_client()
    ses.send_email(
        FromEmailAddress='info@foto-mix.ru',
        Destination={'ToAddresses': [to]},
        Content={
            'Simple': {
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Text': {'Data': text, 'Charset': 'UTF-8'},
                    'Html': {'Data': html, 'Charset': 'UTF-8'}
                }
            }
        }
    )

def send_2fa_code(conn, user_id: int, code: str, code_type: str):
    cursor = conn.cursor()
    expires_at = datetime.now() + timedelta(minutes=10)
    cursor.execute(
        "INSERT INTO two_factor_codes (user_id, code, code_type, expires_at) VALUES (%s, %s, %s, %s)",
        (user_id, code, code_type, expires_at)
    )
    conn.commit()
    
    if code_type == 'email':
        cursor.execute("SELECT email FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        if user and user['email']:
            send_2fa_email(user['email'], code)

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
                
                if not user:
                    return {
                        'statusCode': 404,
                        'headers': headers,
                        'body': json.dumps({'error': 'Такой пользователь не зарегистрирован!'}),
                        'isBase64Encoded': False
                    }
                
                if user['password_hash'] != hash_password(password):
                    attempts = count_recent_attempts(conn, ip_address, email)
                    block = attempts >= 4
                    record_login_attempt(conn, ip_address, email, False, block)
                    
                    return {
                        'statusCode': 401,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неверный пароль'}),
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
                try:
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
                    
                    # Check if email/phone already exists for another user
                    if field == 'email':
                        cursor.execute(
                            f"SELECT id FROM users WHERE email = {escape_sql(value)} AND id != {escape_sql(user_id)}"
                        )
                        existing_user = cursor.fetchone()
                        if existing_user:
                            return {
                                'statusCode': 400,
                                'headers': headers,
                                'body': json.dumps({'error': 'Этот email уже используется другим пользователем'}),
                                'isBase64Encoded': False
                            }
                    elif field == 'phone':
                        cursor.execute(
                            f"SELECT id FROM users WHERE phone = {escape_sql(value)} AND id != {escape_sql(user_id)}"
                        )
                        existing_user = cursor.fetchone()
                        if existing_user:
                            return {
                                'statusCode': 400,
                                'headers': headers,
                                'body': json.dumps({'error': 'Этот номер телефона уже используется другим пользователем'}),
                                'isBase64Encoded': False
                            }
                    
                    cursor.execute(f"SELECT source FROM users WHERE id = {escape_sql(user_id)}")
                    user_source_row = cursor.fetchone()
                    user_source = user_source_row['source'] if user_source_row else 'email'
                    
                    if field == 'email':
                        cursor.execute(
                            f"UPDATE users SET email = {escape_sql(value)}, email_verified_at = NULL WHERE id = {escape_sql(user_id)}"
                        )
                        if user_source == 'vk':
                            cursor.execute(
                                f"UPDATE vk_users SET email = {escape_sql(value)} WHERE user_id = {escape_sql(user_id)}"
                            )
                    else:
                        cursor.execute(
                            f"UPDATE users SET {field} = {escape_sql(value)} WHERE id = {escape_sql(user_id)}"
                        )
                        if user_source == 'vk':
                            cursor.execute(
                                f"UPDATE vk_users SET phone_number = {escape_sql(value)} WHERE user_id = {escape_sql(user_id)}"
                            )
                    
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({'success': True}),
                        'isBase64Encoded': False
                    }
                except Exception as e:
                    error_msg = str(e)
                    if 'unique constraint' in error_msg.lower() or 'duplicate' in error_msg.lower():
                        return {
                            'statusCode': 400,
                            'headers': headers,
                            'body': json.dumps({'error': f'Эти {field} уже используются другим пользователем'}),
                            'isBase64Encoded': False
                        }
                    return {
                        'statusCode': 500,
                        'headers': headers,
                        'body': json.dumps({'error': f'Ошибка сервера: {error_msg}'}),
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
                "SELECT email, phone, two_factor_sms, two_factor_email, email_verified_at, COALESCE(source, 'email') as source FROM users WHERE id = %s",
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
            
            if user.get('source') and user['source'] != 'email':
                cursor.execute(
                    "SELECT email, phone_number FROM vk_users WHERE user_id = %s",
                    (user_id,)
                )
                vk_data = cursor.fetchone()
                if vk_data:
                    if vk_data.get('email') and not user.get('email'):
                        user['email'] = vk_data['email']
                    if vk_data.get('phone_number') and not user.get('phone'):
                        user['phone'] = vk_data['phone_number']
            
            user_data = dict(user)
            if user_data.get('email_verified_at'):
                user_data['email_verified_at'] = user_data['email_verified_at'].isoformat()
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(user_data),
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