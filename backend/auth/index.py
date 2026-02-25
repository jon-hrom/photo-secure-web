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
import hmac
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import urllib.request
import urllib.parse
import urllib.error
import re
import boto3
from botocore.exceptions import ClientError

JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret-change-me')
SCHEMA = 't_p28211681_photo_secure_web'

def get_ip_geolocation(ip: str) -> str:
    """Получение геолокации по IP через 2ip.io API"""
    if not ip or ip == 'unknown':
        return ip
    
    api_key = os.environ.get('TWOIP_API_KEY', '')
    if not api_key:
        print("[GEOLOCATION] TWOIP_API_KEY not configured, returning plain IP")
        return ip
    
    try:
        # 2ip.io API: https://api.2ip.io/{IP}?token={TOKEN}&lang=ru
        url = f"https://api.2ip.io/{ip}?token={api_key}&lang=ru"
        print(f"[GEOLOCATION] Requesting geo for IP {ip} via 2ip.io")
        
        req = urllib.request.Request(url, headers={'User-Agent': 'foto-mix.ru/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            raw_data = response.read().decode('utf-8')
            print(f"[GEOLOCATION] Raw response: {raw_data[:200]}")
            data = json.loads(raw_data)
            
            # API возвращает: ip, city, country, code, emoji, lat, lon, timezone, asn
            city = data.get('city', '')
            country = data.get('country', '')
            country_code = data.get('code', '')
            
            print(f"[GEOLOCATION] Success: {country} ({country_code}), {city}")
            
            # Преобразуем в формат совместимый с форматтером фронтенда
            geo_data = {
                'city': city,
                'country': country,
                'country_code': country_code,
                'emoji': data.get('emoji', ''),
                'lat': data.get('lat', ''),
                'lon': data.get('lon', ''),
                'timezone': data.get('timezone', ''),
                'asn': data.get('asn', {})
            }
            
            return json.dumps(geo_data, ensure_ascii=False)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else 'No error details'
        print(f"[GEOLOCATION] HTTP Error {e.code} for {ip}: {error_body}")
        return ip
    except Exception as e:
        print(f"[GEOLOCATION] Error fetching geo for {ip}: {type(e).__name__} - {e}")
        return ip

def generate_access_token(user_id: int, ip_address: str, user_agent: str, gps_location: str = None) -> tuple[str, str]:
    """Генерация Access Token и создание сессии
    
    Args:
        user_id: ID пользователя
        ip_address: IP адрес клиента
        user_agent: User-Agent браузера
        gps_location: JSON строка с GPS координатами от фронтенда (опционально)
    """
    session_id = str(uuid.uuid4())
    issued_at = datetime.now()
    expires_at = issued_at + timedelta(minutes=30)
    
    payload = f"{user_id}:{session_id}:{int(issued_at.timestamp())}:{int(expires_at.timestamp())}"
    signature = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token = f"{payload}:{signature}"
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Приоритет GPS геолокации над IP
    if gps_location:
        print(f"[GEOLOCATION] Using GPS location from client: {gps_location[:100]}")
        ip_with_geo = gps_location
    else:
        print(f"[GEOLOCATION] No GPS data, using IP geolocation")
        ip_with_geo = get_ip_geolocation(ip_address)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.active_sessions 
                (session_id, user_id, token_hash, created_at, expires_at, last_activity, ip_address, user_agent)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (session_id, user_id, token_hash, issued_at, expires_at, issued_at, ip_with_geo, user_agent))
        conn.commit()
    finally:
        conn.close()
    
    return token, session_id

def send_email(to_email: str, subject: str, html_body: str, from_name: str = 'FotoMix') -> bool:
    """Отправить email через Yandex Cloud Postbox"""
    try:
        access_key_id = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        secret_access_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        
        if not access_key_id or not secret_access_key:
            print("Error: POSTBOX credentials not set")
            return False
        
        client = boto3.client(
            'sesv2',
            region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key
        )
        
        from_email = f'{from_name} <info@foto-mix.ru>'
        
        response = client.send_email(
            FromEmailAddress=from_email,
            Destination={'ToAddresses': [to_email]},
            Content={
                'Simple': {
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}}
                }
            }
        )
        
        print(f"Email sent to {to_email}. MessageId: {response.get('MessageId')}")
        return True
    except ClientError as e:
        print(f"ClientError: {e.response['Error']['Code']} - {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"Email error: {str(e)}")
        return False

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL not configured')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

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

def normalize_phone(phone: str) -> str:
    """Normalize phone to 7XXXXXXXXXX format"""
    digits = re.sub(r'\D+', '', phone or '')
    if len(digits) == 11 and digits[0] in ('8', '7'):
        digits = '7' + digits[1:]
    elif len(digits) == 10:
        digits = '7' + digits
    return digits

def generate_2fa_code(code_type: str) -> str:
    if code_type == 'sms':
        return ''.join([str(secrets.randbelow(10)) for _ in range(6)])
    else:
        return ''.join([str(secrets.randbelow(10)) for _ in range(5)])

def send_2fa_sms(phone: str, code: str) -> bool:
    """Send SMS via SMS.SU service"""
    api_key_raw = os.environ.get('API_KEY', '').strip()
    
    if api_key_raw.startswith('API_KEY='):
        api_key = api_key_raw[8:]
    else:
        api_key = api_key_raw
    
    if not api_key:
        raise Exception('API_KEY not configured')
    
    phone = normalize_phone(phone)
    
    if not re.match(r'^7\d{10}$', phone):
        raise Exception('Неверный формат телефона')
    
    message = f'Код подтверждения: {code}'
    
    payload = {
        'method': 'push_msg',
        'key': api_key,
        'text': message,
        'phone': phone,
        'sender_name': 'foto-mix',
        'priority': 2,
        'format': 'json',
    }
    
    url = f"https://ssl.bs00.ru/?{urllib.parse.urlencode(payload)}"
    
    try:
        print(f'[SMS_SU] Sending SMS to {phone}')
        req = urllib.request.Request(url, headers={'User-Agent': 'foto-mix.ru/1.0'})
        with urllib.request.urlopen(req, timeout=20) as response:
            raw_response = response.read().decode('utf-8')
            result = json.loads(raw_response)
            
            if 'response' in result and isinstance(result['response'], dict):
                msg = result['response'].get('msg', {})
                err_code = msg.get('err_code', '999')
                if err_code == '0':
                    print(f'[SMS_SU] SMS sent successfully')
                    return True
                else:
                    error_msg = msg.get('text', 'Unknown error')
                    print(f'[SMS_SU] Error: {error_msg} (code: {err_code})')
                    raise Exception(f"SMS.SU error: {error_msg}")
            else:
                print(f'[SMS_SU] Unexpected response format')
                raise Exception(f"SMS.SU unexpected response format")
    except Exception as e:
        print(f'[SMS_SU] Error: {str(e)}')
        raise

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
    
    return send_email(to, subject, html, 'FotoMix')

def send_2fa_code(conn, user_id: int, code: str, code_type: str):
    cursor = conn.cursor()
    expires_at = datetime.now() + timedelta(minutes=10)
    cursor.execute(
        "INSERT INTO two_factor_codes (user_id, code, code_type, expires_at) VALUES (%s, %s, %s, %s)",
        (user_id, code, code_type, expires_at)
    )
    conn.commit()
    
    cursor.execute("SELECT email, phone FROM users WHERE id = %s", (user_id,))
    user = cursor.fetchone()
    
    if code_type == 'email' and user and user['email']:
        send_2fa_email(user['email'], code)
    elif code_type == 'sms' and user and user['phone']:
        send_2fa_sms(user['phone'], code)

def get_real_ip(event: Dict[str, Any]) -> str:
    """Получение реального IP клиента (не Cloud Function)"""
    headers = event.get('headers', {})
    
    # Пробуем получить реальный IP из заголовков (в порядке приоритета)
    forwarded_for = headers.get('X-Forwarded-For') or headers.get('x-forwarded-for')
    if forwarded_for:
        # X-Forwarded-For может содержать список IP: "client, proxy1, proxy2"
        # Берем первый (реальный IP клиента)
        real_ip = forwarded_for.split(',')[0].strip()
        print(f"[IP] Real client IP from X-Forwarded-For: {real_ip}")
        return real_ip
    
    # Fallback на стандартный sourceIp (IP Cloud Function)
    fallback_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
    print(f"[IP] Fallback to sourceIp: {fallback_ip}")
    return fallback_ip

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
        ip_address = get_real_ip(event)
        
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
                
                # Извлекаем имя из email если не передано отдельно
                display_name = body.get('name', email.split('@')[0])
                
                cursor.execute(
                    "INSERT INTO users (email, password_hash, phone, display_name, ip_address, user_agent, last_login, source, role, is_active, registered_at, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s, NOW(), 'email', 'user', TRUE, NOW(), NOW(), NOW()) RETURNING id",
                    (email, password_hash, phone, display_name, ip_address, user_agent)
                )
                user_id = cursor.fetchone()['id']
                
                cursor.execute(
                    "INSERT INTO user_profiles (user_id) VALUES (%s)",
                    (user_id,)
                )
                
                cursor.execute(
                    "INSERT INTO user_emails (user_id, email, provider, is_primary, is_verified, added_at, last_used_at) VALUES (%s, %s, 'email', TRUE, FALSE, NOW(), NOW()) ON CONFLICT DO NOTHING",
                    (user_id, email)
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
                gps_location = body.get('gps_location')  # GPS координаты от фронтенда
                
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
                
                # Check if user is main admin
                is_main_admin = email == 'jonhrom2012@gmail.com'
                
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
                
                # Don't check blocking for main admin
                if not is_main_admin and user['is_blocked']:
                    return {
                        'statusCode': 403,
                        'headers': headers,
                        'body': json.dumps({
                            'error': 'Доступ заблокирован администратором', 
                            'blocked': True,
                            'message': 'Ваш аккаунт был заблокирован. Обратитесь к администратору через форму обратной связи.',
                            'user_id': user['id'],
                            'user_email': email
                        }),
                        'isBase64Encoded': False
                    }
                
                user_agent = event.get('headers', {}).get('User-Agent', '')
                cursor.execute(
                    "UPDATE users SET last_login = NOW(), ip_address = %s, user_agent = %s, is_active = true WHERE id = %s",
                    (ip_address, user_agent, user['id'])
                )
                conn.commit()
                
                record_login_attempt(conn, ip_address, email, True)
                
                # Skip 2FA for main admin
                if not is_main_admin and (user['two_factor_sms'] or user['two_factor_email']):
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
                
                token, session_id = generate_access_token(user['id'], ip_address, user_agent, gps_location)
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'success': True, 
                        'userId': user['id'],
                        'token': token,
                        'session_id': session_id
                    }),
                    'isBase64Encoded': False
                }
            
            elif action == 'verify-2fa':
                user_id = body.get('userId')
                code = body.get('code')
                gps_location = body.get('gps_location')  # GPS координаты от фронтенда
                
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
                
                user_agent = event.get('headers', {}).get('User-Agent', '')
                token, session_id = generate_access_token(user_id, ip_address, user_agent, gps_location)
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'success': True,
                        'token': token,
                        'session_id': session_id
                    }),
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
            
            elif action == 'submit_appeal':
                print('[APPEAL] Received submit_appeal request')
                user_identifier = body.get('user_identifier')
                user_email = body.get('user_email')
                user_phone = body.get('user_phone')
                auth_method = body.get('auth_method')
                message = body.get('message')
                print(f'[APPEAL] Data: user={user_identifier}, email={user_email}, auth={auth_method}')
                
                if not user_identifier or not message:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'user_identifier и message обязательны'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                
                block_reason = None
                is_blocked = False
                if user_email:
                    cursor.execute(
                        "SELECT is_blocked, blocked_reason FROM users WHERE email = %s",
                        (user_email,)
                    )
                    user_data = cursor.fetchone()
                    if user_data:
                        is_blocked = user_data['is_blocked']
                        block_reason = user_data.get('blocked_reason')
                
                cursor.execute(
                    """INSERT INTO t_p28211681_photo_secure_web.blocked_user_appeals 
                    (user_identifier, user_email, user_phone, auth_method, message, block_reason, is_blocked)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id""",
                    (user_identifier, user_email, user_phone, auth_method, message, block_reason, is_blocked)
                )
                
                appeal_id = cursor.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': headers,
                    'body': json.dumps({'success': True, 'appeal_id': appeal_id}),
                    'isBase64Encoded': False
                }
            
            elif action == 'get_appeals':
                print(f'[GET_APPEALS] Starting...')
                admin_user_id = body.get('admin_user_id')
                print(f'[GET_APPEALS] admin_user_id: {admin_user_id}')
                
                if not admin_user_id:
                    return {
                        'statusCode': 401,
                        'headers': headers,
                        'body': json.dumps({'error': 'Требуется авторизация администратора'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                print(f'[GET_APPEALS] Fetching user email...')
                cursor.execute("SELECT email FROM users WHERE id = %s", (admin_user_id,))
                user = cursor.fetchone()
                print(f'[GET_APPEALS] User: {user}')
                
                # Check if user is admin by email or user_id
                is_admin = False
                if user and user.get('email') == 'jonhrom2012@gmail.com':
                    is_admin = True
                    print(f'[GET_APPEALS] Admin by email')
                elif admin_user_id == 16:
                    # Direct check for VK admin user_id
                    is_admin = True
                    print(f'[GET_APPEALS] Admin by user_id=16')
                
                print(f'[GET_APPEALS] is_admin: {is_admin}')
                
                if not is_admin:
                    return {
                        'statusCode': 403,
                        'headers': headers,
                        'body': json.dumps({'error': 'Доступ запрещён'}),
                        'isBase64Encoded': False
                    }
                
                print(f'[GET_APPEALS] Fetching appeals from DB...')
                cursor.execute("""
                    SELECT id, user_identifier, user_email, user_phone, auth_method, 
                           message, block_reason, is_blocked, is_read, is_archived,
                           created_at, read_at, admin_response, responded_at,
                           COALESCE(is_support, false) as is_support,
                           user_name
                    FROM t_p28211681_photo_secure_web.blocked_user_appeals
                    ORDER BY is_archived ASC, is_read ASC, created_at DESC
                    LIMIT 200
                """)
                
                print(f'[GET_APPEALS] Fetching results...')
                appeals = cursor.fetchall()
                print(f'[GET_APPEALS] Found {len(appeals)} appeals')
                appeals_list = []
                
                for appeal in appeals:
                    appeal_dict = dict(appeal)
                    if appeal_dict['created_at']:
                        appeal_dict['created_at'] = appeal_dict['created_at'].isoformat()
                    if appeal_dict.get('read_at'):
                        appeal_dict['read_at'] = appeal_dict['read_at'].isoformat()
                    if appeal_dict.get('responded_at'):
                        appeal_dict['responded_at'] = appeal_dict['responded_at'].isoformat()
                    appeals_list.append(appeal_dict)
                
                print(f'[GET_APPEALS] Returning {len(appeals_list)} appeals')
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'appeals': appeals_list}),
                    'isBase64Encoded': False
                }
            
            elif action == 'mark_appeal_read':
                appeal_id = body.get('appeal_id')
                admin_user_id = body.get('admin_user_id')
                
                if not admin_user_id:
                    return {
                        'statusCode': 401,
                        'headers': headers,
                        'body': json.dumps({'error': 'Требуется авторизация администратора'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute("SELECT email FROM users WHERE id = %s", (admin_user_id,))
                user = cursor.fetchone()
                
                # Check if user is admin by email or user_id
                is_admin = False
                if user and user.get('email') == 'jonhrom2012@gmail.com':
                    is_admin = True
                elif admin_user_id == 16:
                    # Direct check for VK admin user_id
                    is_admin = True
                
                if not is_admin:
                    return {
                        'statusCode': 403,
                        'headers': headers,
                        'body': json.dumps({'error': 'Доступ запрещён'}),
                        'isBase64Encoded': False
                    }
                
                cursor.execute(
                    "UPDATE t_p28211681_photo_secure_web.blocked_user_appeals SET is_read = true, read_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (appeal_id,)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'archive_appeal':
                appeal_id = body.get('appeal_id')
                admin_user_id = body.get('admin_user_id')
                
                if not admin_user_id or not appeal_id:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Все поля обязательны'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute("SELECT email FROM users WHERE id = %s", (admin_user_id,))
                admin = cursor.fetchone()
                
                is_admin = False
                if admin and admin.get('email') == 'jonhrom2012@gmail.com':
                    is_admin = True
                elif admin_user_id == 16:
                    is_admin = True
                
                if not is_admin:
                    return {
                        'statusCode': 403,
                        'headers': headers,
                        'body': json.dumps({'error': 'Доступ запрещён'}),
                        'isBase64Encoded': False
                    }
                
                cursor.execute(
                    """UPDATE t_p28211681_photo_secure_web.blocked_user_appeals 
                       SET is_archived = true 
                       WHERE id = %s""",
                    (appeal_id,)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'delete_appeal':
                appeal_id = body.get('appeal_id')
                admin_user_id = body.get('admin_user_id')
                
                if not admin_user_id or not appeal_id:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Все поля обязательны'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute("SELECT email FROM users WHERE id = %s", (admin_user_id,))
                admin = cursor.fetchone()
                
                is_admin = False
                if admin and admin.get('email') == 'jonhrom2012@gmail.com':
                    is_admin = True
                elif admin_user_id == 16:
                    is_admin = True
                
                if not is_admin:
                    return {
                        'statusCode': 403,
                        'headers': headers,
                        'body': json.dumps({'error': 'Доступ запрещён'}),
                        'isBase64Encoded': False
                    }
                
                cursor.execute(
                    """DELETE FROM t_p28211681_photo_secure_web.blocked_user_appeals 
                       WHERE id = %s""",
                    (appeal_id,)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'respond_to_appeal':
                appeal_id = body.get('appeal_id')
                admin_user_id = body.get('admin_user_id')
                admin_response = body.get('admin_response')
                skip_email = body.get('skip_email', False)
                
                if not admin_user_id or not appeal_id or not admin_response:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Все поля обязательны'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute("SELECT email FROM users WHERE id = %s", (admin_user_id,))
                admin = cursor.fetchone()
                
                # Check if user is admin by email or user_id
                is_admin = False
                if admin and admin.get('email') == 'jonhrom2012@gmail.com':
                    is_admin = True
                elif admin_user_id == 16:
                    # Direct check for VK admin user_id
                    is_admin = True
                
                if not is_admin:
                    return {
                        'statusCode': 403,
                        'headers': headers,
                        'body': json.dumps({'error': 'Доступ запрещён'}),
                        'isBase64Encoded': False
                    }
                
                cursor.execute(
                    """SELECT user_email, user_identifier, message 
                       FROM t_p28211681_photo_secure_web.blocked_user_appeals 
                       WHERE id = %s""",
                    (appeal_id,)
                )
                appeal = cursor.fetchone()
                
                if not appeal:
                    return {
                        'statusCode': 404,
                        'headers': headers,
                        'body': json.dumps({'error': 'Обращение не найдено'}),
                        'isBase64Enabled': False
                    }
                
                if not skip_email and not appeal['user_email']:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'У пользователя нет email для ответа'}),
                        'isBase64Encoded': False
                    }
                
                cursor.execute(
                    """UPDATE t_p28211681_photo_secure_web.blocked_user_appeals 
                       SET admin_response = %s, responded_at = CURRENT_TIMESTAMP, is_read = true, read_at = CURRENT_TIMESTAMP,
                           user_read_at = NULL
                       WHERE id = %s""",
                    (admin_response, appeal_id)
                )
                conn.commit()
                
                if skip_email:
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({'success': True, 'message': 'Ответ сохранён в чат пользователя'}),
                        'isBase64Encoded': False
                    }
                
                try:
                    ses_client = get_ses_client()
                    
                    email_subject = 'Ответ администратора foto-mix.ru'
                    email_text = f'''Здравствуйте!

Вы получили ответ на ваше обращение к администратору foto-mix.ru.

Ваше сообщение:
{appeal['message']}

Ответ администратора:
{admin_response}

---
С уважением,
Команда foto-mix.ru'''
                    
                    email_html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ответ администратора</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f7">
        <tr>
            <td align="center" style="padding:40px 20px">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
                    
                    <tr>
                        <td style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);padding:40px 30px;text-align:center">
                            <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700">Ответ администратора</h1>
                            <p style="margin:10px 0 0 0;color:#d1fae5;font-size:16px">foto-mix.ru</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding:40px 30px">
                            <p style="margin:0 0 20px 0;color:#666666;font-size:16px;line-height:1.6">
                                Здравствуйте! Вы получили ответ на ваше обращение.
                            </p>
                            
                            <div style="background-color:#f8f9fa;padding:20px;border-radius:12px;margin-bottom:20px">
                                <p style="margin:0 0 10px 0;color:#999999;font-size:13px;font-weight:600">Ваше сообщение:</p>
                                <p style="margin:0;color:#333333;font-size:15px;line-height:1.6">{appeal['message']}</p>
                            </div>
                            
                            <div style="background:linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);padding:25px;border-radius:12px;border-left:4px solid #3b82f6">
                                <p style="margin:0 0 10px 0;color:#1e40af;font-size:13px;font-weight:600">Ответ администратора:</p>
                                <p style="margin:0;color:#1e3a8a;font-size:15px;line-height:1.6;font-weight:500">{admin_response}</p>
                            </div>
                            
                            <div style="margin-top:30px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center">
                                <p style="margin:0;color:#999999;font-size:13px">
                                    С уважением,<br>
                                    <strong style="color:#333333">Команда foto-mix.ru</strong>
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
</body>
</html>'''
                    
                    ses_client.send_email(
                        FromEmailAddress='noreply@foto-mix.ru',
                        Destination={'ToAddresses': [appeal['user_email']]},
                        Content={
                            'Simple': {
                                'Subject': {'Data': email_subject, 'Charset': 'UTF-8'},
                                'Body': {
                                    'Text': {'Data': email_text, 'Charset': 'UTF-8'},
                                    'Html': {'Data': email_html, 'Charset': 'UTF-8'}
                                }
                            }
                        }
                    )
                    
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({'success': True, 'message': 'Ответ отправлен на email пользователя'}),
                        'isBase64Encoded': False
                    }
                    
                except Exception as email_error:
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({
                            'success': True, 
                            'message': 'Ответ сохранён, но email не отправлен',
                            'email_error': str(email_error)
                        }),
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
            
            # Добавляем success и token для совместимости с фронтендом
            response_data = {
                'success': True,
                'token': 'verified',  # Для VK пользователей токен уже проверен
                'userData': user_data
            }
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(response_data),
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