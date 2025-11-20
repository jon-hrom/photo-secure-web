"""
Business: Email verification with Yandex Cloud Postbox (SESv2)
Args: event - dict with httpMethod, body, headers (X-User-Id)
Returns: HTTP response dict with verification code sending/checking results
"""

import json
import os
import hashlib
import random
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.config import Config
import urllib.request
import urllib.parse

POSTBOX_ENDPOINT = 'https://postbox.cloud.yandex.net'
POSTBOX_REGION = 'ru-central1'
EMAIL_FROM = 'info@foto-mix.ru'
TTL_MIN = 10
RESEND_COOLDOWN_SEC = 60
MAX_SENDS_PER_HOUR = 5
MAX_VERIFY_PER_HOUR = 10
LOCK_AFTER_FAILS = 5
LOCK_MIN = 15

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
        region_name=POSTBOX_REGION,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        endpoint_url=POSTBOX_ENDPOINT,
        config=Config(signature_version='v4')
    )

def gen_code() -> str:
    return f'{random.randint(100000, 999999)}'

def send_sms_code(phone: str, code: str) -> bool:
    api_key = os.environ.get('SMSRU_API_KEY')
    if not api_key:
        raise Exception('SMSRU_API_KEY not configured')
    
    message = f'Ваш код подтверждения для foto-mix.ru: {code}. Действителен {TTL_MIN} минут.'
    
    params = urllib.parse.urlencode({
        'api_id': api_key,
        'to': phone,
        'msg': message,
        'json': 1
    })
    
    url = f'https://sms.ru/sms/send?{params}'
    
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result.get('status') == 'OK'
    except Exception as e:
        raise Exception(f'SMS sending failed: {str(e)}')

def hash_code(code: str, email: str) -> str:
    salt = os.environ.get('EMAIL_CODE_SALT', 'default-salt-change-me')
    return hashlib.sha256(f'{code}:{email}:{salt}'.encode()).hexdigest()

def send_email_code(to: str, code: str):
    subject = 'Подтвердите почту для foto-mix.ru'
    text = f'Ваш код подтверждения: {code}\nСрок действия: {TTL_MIN} минут.'
    html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Подтверждение email</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f7">
        <tr>
            <td align="center" style="padding:40px 20px">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
                    
                    <!-- Header with gradient -->
                    <tr>
                        <td style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:40px 30px;text-align:center">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center">
                                        <div style="background-color:#ffffff;width:80px;height:80px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 8px 16px rgba(0,0,0,0.1)">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" fill="#667eea"/>
                                                <circle cx="12" cy="13" r="4" fill="#ffffff"/>
                                            </svg>
                                        </div>
                                        <h1 style="margin:0;color:#ffffff;font-size:32px;font-weight:700;letter-spacing:-0.5px">foto-mix.ru</h1>
                                        <p style="margin:10px 0 0 0;color:#e0e7ff;font-size:16px">Фотоуслуги профессионального качества</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding:50px 40px">
                            <h2 style="margin:0 0 20px 0;color:#1a1a1a;font-size:28px;font-weight:700;line-height:1.3">Подтвердите ваш email</h2>
                            <p style="margin:0 0 30px 0;color:#666666;font-size:16px;line-height:1.6">
                                Спасибо за регистрацию! Для завершения настройки аккаунта введите код подтверждения:
                            </p>
                            
                            <!-- Code Block -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding:20px 0">
                                        <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);padding:30px;border-radius:16px;box-shadow:0 8px 24px rgba(102,126,234,0.25)">
                                            <div style="font-size:48px;font-weight:800;letter-spacing:12px;color:#ffffff;font-family:'Courier New',monospace">{code}</div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Timer info -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px">
                                <tr>
                                    <td style="padding:20px;background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="padding-right:15px;vertical-align:top">
                                                    <div style="width:24px;height:24px;background-color:#f59e0b;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">
                                                        <span style="color:#ffffff;font-size:16px;font-weight:700">⏱</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <p style="margin:0;color:#92400e;font-size:14px;line-height:1.5">
                                                        <strong>Код действителен {TTL_MIN} минут</strong><br>
                                                        После истечения времени запросите новый код
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding:30px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td>
                                        <p style="margin:0 0 15px 0;color:#6b7280;font-size:14px;line-height:1.6">
                                            Если вы не регистрировались на <strong>foto-mix.ru</strong>, просто проигнорируйте это письмо.
                                        </p>
                                        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
                                        <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5">
                                            © 2025 foto-mix.ru — Профессиональные фотоуслуги<br>
                                            Фотокниги, печать фотографий, хранилище снимков
                                        </p>
                                    </td>
                                </tr>
                            </table>
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
        FromEmailAddress=EMAIL_FROM,
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

def log_event(conn, user_id: int, event: str, ip: Optional[str], user_agent: Optional[str]):
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO email_verification_logs (user_id, event, ip, user_agent) VALUES (%s, %s, %s, %s)',
        (user_id, event, ip, user_agent)
    )
    conn.commit()

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    }
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': '',
            'isBase64Encoded': False
        }
    
    req_headers = event.get('headers', {})
    user_id = req_headers.get('X-User-Id') or req_headers.get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'User not authenticated'}),
            'isBase64Encoded': False
        }
    
    try:
        conn = get_db_connection()
        ip_address = event.get('requestContext', {}).get('identity', {}).get('sourceIp')
        user_agent = req_headers.get('User-Agent')
        
        cursor = conn.cursor()
        cursor.execute('SELECT id, email, email_verified_at, email_verification_hash, email_verification_expires_at, email_verification_sends, email_verification_attempts, email_verification_locked_until, email_verification_last_sent_at, email_verification_window_start_at FROM users WHERE id = %s', (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({'error': 'User not found'}),
                'isBase64Encoded': False
            }
        
        if not user['email'] or not user['email'].strip():
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Email не указан. Добавьте email в настройках.'}),
                'isBase64Encoded': False
            }
        
        if method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'send_code':
                if user['email_verified_at']:
                    return {
                        'statusCode': 409,
                        'headers': headers,
                        'body': json.dumps({'error': 'Email уже подтверждён'}),
                        'isBase64Encoded': False
                    }
                
                if user['email_verification_last_sent_at']:
                    sec_since_last = (datetime.now() - user['email_verification_last_sent_at']).total_seconds()
                    if sec_since_last < RESEND_COOLDOWN_SEC:
                        retry_in = int(RESEND_COOLDOWN_SEC - sec_since_last)
                        return {
                            'statusCode': 429,
                            'headers': headers,
                            'body': json.dumps({'error': 'Слишком часто', 'retryInSec': retry_in}),
                            'isBase64Encoded': False
                        }
                
                now = datetime.now()
                hour_start = now.replace(minute=0, second=0, microsecond=0)
                
                if user['email_verification_window_start_at'] and user['email_verification_window_start_at'] < hour_start:
                    cursor.execute('UPDATE users SET email_verification_sends = 0, email_verification_attempts = 0, email_verification_window_start_at = %s WHERE id = %s', (hour_start, user['id']))
                    conn.commit()
                    user['email_verification_sends'] = 0
                    user['email_verification_window_start_at'] = hour_start
                elif not user['email_verification_window_start_at']:
                    cursor.execute('UPDATE users SET email_verification_window_start_at = %s WHERE id = %s', (hour_start, user['id']))
                    conn.commit()
                    user['email_verification_window_start_at'] = hour_start
                
                if user['email_verification_sends'] >= MAX_SENDS_PER_HOUR:
                    return {
                        'statusCode': 429,
                        'headers': headers,
                        'body': json.dumps({'error': 'Превышен лимит отправок на час'}),
                        'isBase64Encoded': False
                    }
                
                code = gen_code()
                code_hash = hash_code(code, user['email'])
                expires_at = now + timedelta(minutes=TTL_MIN)
                
                cursor.execute(
                    'UPDATE users SET email_verification_hash = %s, email_verification_expires_at = %s, email_verification_sends = %s, email_verification_last_sent_at = %s WHERE id = %s',
                    (code_hash, expires_at, user['email_verification_sends'] + 1, now, user['id'])
                )
                conn.commit()
                
                send_email_code(user['email'], code)
                log_event(conn, user['id'], 'sent', ip_address, user_agent)
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'ok': True, 'ttlMin': TTL_MIN}),
                    'isBase64Encoded': False
                }
            
            elif action == 'send_sms_code':
                cursor.execute('SELECT phone FROM users WHERE id = %s', (user_id,))
                user_phone = cursor.fetchone()
                
                if not user_phone or not user_phone['phone']:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Номер телефона не указан. Добавьте телефон в настройках.'}),
                        'isBase64Encoded': False
                    }
                
                if user['email_verified_at']:
                    return {
                        'statusCode': 409,
                        'headers': headers,
                        'body': json.dumps({'error': 'Email уже подтверждён'}),
                        'isBase64Encoded': False
                    }
                
                if user['email_verification_last_sent_at']:
                    sec_since_last = (datetime.now() - user['email_verification_last_sent_at']).total_seconds()
                    if sec_since_last < RESEND_COOLDOWN_SEC:
                        retry_in = int(RESEND_COOLDOWN_SEC - sec_since_last)
                        return {
                            'statusCode': 429,
                            'headers': headers,
                            'body': json.dumps({'error': 'Слишком часто', 'retryInSec': retry_in}),
                            'isBase64Encoded': False
                        }
                
                now = datetime.now()
                hour_start = now.replace(minute=0, second=0, microsecond=0)
                
                if user['email_verification_window_start_at'] and user['email_verification_window_start_at'] < hour_start:
                    cursor.execute('UPDATE users SET email_verification_sends = 0, email_verification_attempts = 0, email_verification_window_start_at = %s WHERE id = %s', (hour_start, user['id']))
                    conn.commit()
                    user['email_verification_sends'] = 0
                    user['email_verification_window_start_at'] = hour_start
                elif not user['email_verification_window_start_at']:
                    cursor.execute('UPDATE users SET email_verification_window_start_at = %s WHERE id = %s', (hour_start, user['id']))
                    conn.commit()
                    user['email_verification_window_start_at'] = hour_start
                
                if user['email_verification_sends'] >= MAX_SENDS_PER_HOUR:
                    return {
                        'statusCode': 429,
                        'headers': headers,
                        'body': json.dumps({'error': 'Превышен лимит отправок на час'}),
                        'isBase64Encoded': False
                    }
                
                code = gen_code()
                code_hash = hash_code(code, user['email'])
                expires_at = now + timedelta(minutes=TTL_MIN)
                
                cursor.execute(
                    'UPDATE users SET email_verification_hash = %s, email_verification_expires_at = %s, email_verification_sends = %s, email_verification_last_sent_at = %s WHERE id = %s',
                    (code_hash, expires_at, user['email_verification_sends'] + 1, now, user['id'])
                )
                conn.commit()
                
                try:
                    send_sms_code(user_phone['phone'], code)
                    log_event(conn, user['id'], 'sent_sms', ip_address, user_agent)
                    
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({'ok': True, 'ttlMin': TTL_MIN, 'method': 'sms'}),
                        'isBase64Encoded': False
                    }
                except Exception as e:
                    return {
                        'statusCode': 500,
                        'headers': headers,
                        'body': json.dumps({'error': f'Ошибка отправки SMS: {str(e)}'}),
                        'isBase64Encoded': False
                    }
            
            elif action == 'verify_code':
                code = body.get('code', '')
                if not code or len(code) != 6 or not code.isdigit():
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неверный формат кода'}),
                        'isBase64Encoded': False
                    }
                
                if user['email_verification_locked_until'] and datetime.now() < user['email_verification_locked_until']:
                    remaining_sec = int((user['email_verification_locked_until'] - datetime.now()).total_seconds())
                    log_event(conn, user['id'], 'locked', ip_address, user_agent)
                    return {
                        'statusCode': 423,
                        'headers': headers,
                        'body': json.dumps({'error': 'Слишком много попыток. Повторите позже.', 'retryInSec': remaining_sec}),
                        'isBase64Encoded': False
                    }
                
                if not user['email_verification_expires_at'] or datetime.now() > user['email_verification_expires_at']:
                    log_event(conn, user['id'], 'expired', ip_address, user_agent)
                    return {
                        'statusCode': 410,
                        'headers': headers,
                        'body': json.dumps({'error': 'Код истёк. Запросите новый.'}),
                        'isBase64Encoded': False
                    }
                
                expected_hash = hash_code(code, user['email'])
                if user['email_verification_hash'] != expected_hash:
                    attempts = user['email_verification_attempts'] + 1
                    locked_until = None
                    if attempts >= LOCK_AFTER_FAILS:
                        locked_until = datetime.now() + timedelta(minutes=LOCK_MIN)
                    
                    cursor.execute(
                        'UPDATE users SET email_verification_attempts = %s, email_verification_locked_until = %s WHERE id = %s',
                        (attempts, locked_until, user['id'])
                    )
                    conn.commit()
                    log_event(conn, user['id'], 'failed', ip_address, user_agent)
                    
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неверный код'}),
                        'isBase64Encoded': False
                    }
                
                cursor.execute(
                    'UPDATE users SET email_verified_at = NOW(), email_verification_hash = NULL, email_verification_expires_at = NULL, email_verification_attempts = 0, email_verification_sends = 0, email_verification_locked_until = NULL WHERE id = %s',
                    (user['id'],)
                )
                conn.commit()
                log_event(conn, user['id'], 'verified', ip_address, user_agent)
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'ok': True}),
                    'isBase64Encoded': False
                }
        
        return {
            'statusCode': 405,
            'headers': headers,
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'[ERROR] {e}')
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        if 'conn' in locals():
            conn.close()