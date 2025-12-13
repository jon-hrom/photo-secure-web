"""
Business: Восстановление пароля пользователя через email или SMS
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
import urllib.request
import urllib.parse
import urllib.error
import re
import boto3
from botocore.exceptions import ClientError

SCHEMA = 't_p28211681_photo_secure_web'

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
        
        from_email = f'{from_name} <jon-hrom2012@gmail.com>'
        
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
    if isinstance(value, datetime):
        return "'" + value.isoformat() + "'"
    # Escape single quotes by doubling them
    return "'" + str(value).replace("'", "''") + "'"

def generate_code() -> str:
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

def normalize_phone(phone: str) -> str:
    """Normalize phone to 7XXXXXXXXXX format"""
    digits = re.sub(r'\D+', '', phone or '')
    if len(digits) == 11 and digits[0] in ('8', '7'):
        digits = '7' + digits[1:]
    elif len(digits) == 10:
        digits = '7' + digits
    return digits

def is_phone(value: str) -> bool:
    """Check if value looks like a phone number"""
    digits = re.sub(r'\D+', '', value or '')
    return len(digits) >= 10 and digits.isdigit()

def is_email(value: str) -> bool:
    """Check if value looks like an email"""
    return '@' in value and '.' in value.split('@')[-1]

def send_sms_code(phone: str, code: str) -> bool:
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
        print(f'[SMS_SU] URL (masked): {url.replace(api_key, "***KEY***")}')
        req = urllib.request.Request(url, headers={'User-Agent': 'foto-mix.ru/1.0'})
        with urllib.request.urlopen(req, timeout=20) as response:
            raw_response = response.read().decode('utf-8')
            print(f'[SMS_SU] Raw response: {raw_response}')
            result = json.loads(raw_response)
            print(f'[SMS_SU] Parsed response: {result}')
            
            # Check if SMS.SU returned success
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
    except json.JSONDecodeError as e:
        print(f'[SMS_SU] JSON decode error: {str(e)}')
        raise Exception(f'SMS.SU invalid response format')
    except urllib.error.URLError as e:
        print(f'[SMS_SU] Network error: {str(e)}')
        raise Exception(f'SMS.SU connection failed: {str(e)}')
    except Exception as e:
        print(f'[SMS_SU] Unexpected error: {str(e)}')
        raise Exception(f'SMS sending failed: {str(e)}')

def send_reset_email(to: str, code: str) -> bool:
    subject = 'Восстановление пароля — foto-mix.ru'
    html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Восстановление пароля</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Восстановление пароля</h1>
    </div>
    
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
        <p style="font-size: 16px; margin-bottom: 20px;">Вы запросили восстановление пароля для вашего аккаунта на <strong>foto-mix.ru</strong></p>
        
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 2px dashed #667eea;">
            <p style="color: #666; margin-bottom: 10px; font-size: 14px;">Ваш код подтверждения:</p>
            <p style="font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 10px 0;">{code}</p>
        </div>
        
        <p style="color: #dc3545; margin-top: 20px; font-size: 14px;">⏰ Код действителен <strong>10 минут</strong></p>
        <p style="color: #666; font-size: 14px; margin-top: 15px;">Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.</p>
    </div>
    
    <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
        <p>© 2024 Foto-Mix. Все права защищены.</p>
        <p>Это автоматическое сообщение, не отвечайте на него.</p>
    </div>
</body>
</html>'''
    
    return send_email(to, subject, html, 'FotoMix')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if action == 'check_contact':
            contact = body.get('contact')
            if not contact:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Email или телефон обязателен'}),
                    'isBase64Encoded': False
                }
            
            # Determine if it's email or phone
            if is_email(contact):
                cursor.execute(
                    "SELECT id as user_id, email, phone FROM users WHERE email = %s",
                    (contact,)
                )
                user = cursor.fetchone()
                contact_type = 'email'
            elif is_phone(contact):
                normalized_phone = normalize_phone(contact)
                cursor.execute(
                    "SELECT id as user_id, email, phone FROM users WHERE phone = %s",
                    (normalized_phone,)
                )
                user = cursor.fetchone()
                contact_type = 'phone'
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Неверный формат email или телефона'}),
                    'isBase64Encoded': False
                }
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Пользователь не найден'}),
                    'isBase64Encoded': False
                }
            
            # If user entered phone but has no phone in DB, or entered email but has no email
            can_use_email = bool(user.get('email'))
            can_use_sms = bool(user.get('phone'))
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'contactType': contact_type,
                    'email': user.get('email'),
                    'phone': user.get('phone'),
                    'canUseEmail': can_use_email,
                    'canUseSms': can_use_sms,
                    'hasBothMethods': can_use_email and can_use_sms
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'send_code':
            contact = body.get('contact')
            method_type = body.get('method', 'email')
            
            if not contact:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Email или телефон обязателен'}),
                    'isBase64Encoded': False
                }
            
            # Find user by email or phone
            if is_email(contact):
                cursor.execute(
                    "SELECT id as user_id, email, phone FROM users WHERE email = %s",
                    (contact,)
                )
            else:
                normalized_phone = normalize_phone(contact)
                cursor.execute(
                    "SELECT id as user_id, email, phone FROM users WHERE phone = %s",
                    (normalized_phone,)
                )
            
            user = cursor.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Пользователь не найден'}),
                    'isBase64Encoded': False
                }
            
            code = generate_code()
            session_token = secrets.token_urlsafe(32)
            expires_at = datetime.now() + timedelta(minutes=10)
            
            cursor.execute(
                """
                INSERT INTO password_reset_codes (user_id, code, session_token, expires_at, method_type)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE 
                SET code = EXCLUDED.code, 
                    session_token = EXCLUDED.session_token,
                    expires_at = EXCLUDED.expires_at,
                    method_type = EXCLUDED.method_type,
                    used = FALSE
                """,
                (user['user_id'], code, session_token, expires_at, method_type)
            )
            conn.commit()
            
            if method_type == 'email':
                if not user.get('email'):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Email не найден у пользователя'}),
                        'isBase64Encoded': False
                    }
                if not send_reset_email(user['email'], code):
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Не удалось отправить email. Попробуйте позже'}),
                        'isBase64Encoded': False
                    }
            elif method_type == 'sms':
                if not user.get('phone'):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Телефон не найден у пользователя'}),
                        'isBase64Encoded': False
                    }
                send_sms_code(user['phone'], code)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'session_token': session_token
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'verify_code':
            contact = body.get('contact')
            code = body.get('code')
            session_token = body.get('session_token')
            
            if not all([contact, code, session_token]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Все поля обязательны'}),
                    'isBase64Encoded': False
                }
            
            # Find user by email or phone
            if is_email(contact):
                where_clause = "u.email = %s"
                contact_value = contact
            else:
                where_clause = "u.phone = %s"
                contact_value = normalize_phone(contact)
            
            cursor.execute(
                f"""
                SELECT prc.* FROM password_reset_codes prc
                JOIN users u ON u.id = prc.user_id
                WHERE {where_clause}
                AND prc.code = %s
                AND prc.session_token = %s
                AND prc.expires_at > NOW()
                AND prc.used = FALSE
                """,
                (contact_value, code, session_token)
            )
            
            reset_code = cursor.fetchone()
            
            if not reset_code:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Неверный или истекший код'}),
                    'isBase64Encoded': False
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        elif action == 'reset_password':
            contact = body.get('contact')
            new_password = body.get('new_password')
            session_token = body.get('session_token')
            
            if not all([contact, new_password, session_token]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Все поля обязательны'}),
                    'isBase64Encoded': False
                }
            
            # Find user by email or phone
            if is_email(contact):
                where_clause = "u.email = %s"
                contact_value = contact
            else:
                where_clause = "u.phone = %s"
                contact_value = normalize_phone(contact)
            
            cursor.execute(
                f"""
                SELECT prc.user_id, u.email FROM password_reset_codes prc
                JOIN users u ON u.id = prc.user_id
                WHERE {where_clause}
                AND prc.session_token = %s
                AND prc.expires_at > NOW()
                AND prc.used = FALSE
                """,
                (contact_value, session_token)
            )
            
            reset_code = cursor.fetchone()
            
            if not reset_code:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Сессия истекла или недействительна'}),
                    'isBase64Encoded': False
                }
            
            hashed = hash_password(new_password)
            user_email = reset_code.get('email')
            
            cursor.execute(
                "UPDATE users SET password_hash = %s WHERE id = %s",
                (hashed, reset_code['user_id'])
            )
            
            cursor.execute(
                "UPDATE password_reset_codes SET used = TRUE WHERE user_id = %s",
                (reset_code['user_id'],)
            )
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Неизвестное действие'}),
                'isBase64Encoded': False
            }
    
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f'Error: {str(e)}')
        print(f'Traceback: {error_trace}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Внутренняя ошибка сервера', 'details': str(e)}),
            'isBase64Encoded': False
        }