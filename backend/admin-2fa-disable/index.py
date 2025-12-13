"""
Business: Admin requests 2FA disable, sends verification code to user email
Args: event - dict with httpMethod, body, headers (X-Admin-Id)
Returns: HTTP response dict with request status and verification results
"""

import json
import os
import secrets
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.exceptions import ClientError

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

def gen_code() -> str:
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

def send_2fa_disable_email(to: str, code: str, disable_type: str):
    type_text = {
        'sms': 'SMS-аутентификации',
        'email': 'Email-аутентификации',
        'both': 'всей двухфакторной аутентификации'
    }.get(disable_type, 'двухфакторной аутентификации')
    
    subject = f'Запрос на отключение 2FA — foto-mix.ru'
    text = f'Администратор запросил отключение {type_text}.\nВаш код подтверждения: {code}\nКод действителен бессрочно.'
    html = f'''<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Отключение 2FA</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f4f7">
        <tr>
            <td align="center" style="padding:40px 20px">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
                    
                    <tr>
                        <td style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);padding:40px 30px;text-align:center">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center">
                                        <div style="background-color:#ffffff;width:80px;height:80px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;box-shadow:0 8px 16px rgba(0,0,0,0.1)">
                                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#ef4444"/>
                                                <path d="M9 12l2 2 4-4" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                        </div>
                                        <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px">Запрос на изменение</h1>
                                        <p style="margin:10px 0 0 0;color:#fecaca;font-size:16px">foto-mix.ru</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding:50px 40px">
                            <h2 style="margin:0 0 15px 0;color:#1a1a1a;font-size:24px;font-weight:700">Отключение {type_text}</h2>
                            <p style="margin:0 0 20px 0;color:#666666;font-size:16px;line-height:1.6">
                                Администратор foto-mix.ru запросил отключение <strong>{type_text}</strong> для вашего аккаунта.
                            </p>
                            <p style="margin:0 0 30px 0;color:#666666;font-size:16px;line-height:1.6">
                                Для подтверждения действия введите этот код:
                            </p>
                            
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                                <tr>
                                    <td align="center" style="padding:20px 0">
                                        <div style="background:linear-gradient(135deg, #ef4444 0%, #dc2626 100%);padding:25px 40px;border-radius:16px;box-shadow:0 8px 24px rgba(239,68,68,0.25)">
                                            <div style="font-size:44px;font-weight:800;letter-spacing:14px;color:#ffffff;font-family:'Courier New',monospace">{code}</div>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                            
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:30px">
                                <tr>
                                    <td style="padding:20px;background-color:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td style="padding-right:15px;vertical-align:top">
                                                    <div style="width:24px;height:24px;background-color:#f59e0b;border-radius:50%;display:inline-flex;align-items:center;justify-content:center">
                                                        <span style="color:#ffffff;font-size:16px;font-weight:700">⚠</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <p style="margin:0;color:#92400e;font-size:14px;line-height:1.5">
                                                        <strong>Код действителен бессрочно</strong><br>
                                                        Храните его в безопасности до момента использования
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px">
                                <tr>
                                    <td style="padding:20px;background-color:#fee2e2;border-left:4px solid #ef4444;border-radius:8px">
                                        <p style="margin:0;color:#991b1b;font-size:14px;line-height:1.5">
                                            <strong>⚠️ Важно!</strong> Если вы не запрашивали отключение 2FA, немедленно свяжитесь с администратором или измените пароль.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding:30px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb">
                            <p style="margin:0 0 10px 0;color:#6b7280;font-size:14px">
                                После ввода кода двухфакторная аутентификация будет <strong>отключена</strong>.
                            </p>
                            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
                            <p style="margin:0;color:#9ca3af;font-size:12px">
                                © 2025 foto-mix.ru — Безопасность вашего аккаунта
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

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Id',
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
        
        if method == 'POST':
            req_headers = event.get('headers', {})
            admin_id = req_headers.get('X-Admin-Id') or req_headers.get('x-admin-id')
            
            if not admin_id:
                return {
                    'statusCode': 401,
                    'headers': headers,
                    'body': json.dumps({'error': 'Admin not authenticated'}),
                    'isBase64Encoded': False
                }
            
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'request_disable':
                user_id = body.get('userId')
                disable_type = body.get('disableType', 'both')
                
                if not user_id:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'userId обязателен'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute('SELECT email FROM users WHERE id = %s', (user_id,))
                user = cursor.fetchone()
                
                if not user or not user['email']:
                    return {
                        'statusCode': 404,
                        'headers': headers,
                        'body': json.dumps({'error': 'Пользователь не найден или нет email'}),
                        'isBase64Encoded': False
                    }
                
                cursor.execute(
                    'SELECT id FROM two_factor_disable_requests WHERE user_id = %s AND is_verified = false AND is_cancelled = false',
                    (user_id,)
                )
                existing = cursor.fetchone()
                
                if existing:
                    return {
                        'statusCode': 409,
                        'headers': headers,
                        'body': json.dumps({'error': 'Запрос уже существует, пользователь должен ввести код или админ отменить запрос'}),
                        'isBase64Encoded': False
                    }
                
                code = gen_code()
                cursor.execute(
                    'INSERT INTO two_factor_disable_requests (user_id, requested_by_admin_id, disable_type, verification_code) VALUES (%s, %s, %s, %s) RETURNING id',
                    (user_id, admin_id, disable_type, code)
                )
                request_id = cursor.fetchone()['id']
                conn.commit()
                
                send_2fa_disable_email(user['email'], code, disable_type)
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'ok': True, 'requestId': request_id, 'message': f'Код отправлен на {user["email"]}'}),
                    'isBase64Encoded': False
                }
            
            elif action == 'verify_code':
                user_id = body.get('userId')
                code = body.get('code')
                
                if not user_id or not code:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'userId и code обязательны'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute(
                    'SELECT id, disable_type FROM two_factor_disable_requests WHERE user_id = %s AND verification_code = %s AND is_verified = false AND is_cancelled = false',
                    (user_id, code)
                )
                request = cursor.fetchone()
                
                if not request:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неверный код или запрос не найден'}),
                        'isBase64Encoded': False
                    }
                
                disable_type = request['disable_type']
                
                if disable_type == 'both':
                    cursor.execute(
                        'UPDATE users SET two_factor_sms = false, two_factor_email = false WHERE id = %s',
                        (user_id,)
                    )
                elif disable_type == 'sms':
                    cursor.execute(
                        'UPDATE users SET two_factor_sms = false WHERE id = %s',
                        (user_id,)
                    )
                elif disable_type == 'email':
                    cursor.execute(
                        'UPDATE users SET two_factor_email = false WHERE id = %s',
                        (user_id,)
                    )
                
                cursor.execute(
                    'UPDATE two_factor_disable_requests SET is_verified = true, verified_at = NOW() WHERE id = %s',
                    (request['id'],)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'ok': True, 'message': 'Двухфакторная аутентификация отключена'}),
                    'isBase64Encoded': False
                }
            
            elif action == 'cancel_request':
                request_id = body.get('requestId')
                
                if not request_id:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'requestId обязателен'}),
                        'isBase64Encoded': False
                    }
                
                cursor = conn.cursor()
                cursor.execute(
                    'UPDATE two_factor_disable_requests SET is_cancelled = true WHERE id = %s AND is_verified = false',
                    (request_id,)
                )
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'ok': True}),
                    'isBase64Encoded': False
                }
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            user_id = params.get('userId')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'userId обязателен'}),
                    'isBase64Encoded': False
                }
            
            cursor = conn.cursor()
            cursor.execute(
                'SELECT id, disable_type, is_verified, is_cancelled, created_at, verified_at FROM two_factor_disable_requests WHERE user_id = %s ORDER BY created_at DESC LIMIT 1',
                (user_id,)
            )
            request = cursor.fetchone()
            
            if not request:
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'hasRequest': False}),
                    'isBase64Encoded': False
                }
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'hasRequest': True,
                    'request': dict(request)
                }),
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