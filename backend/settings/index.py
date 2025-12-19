"""
Business: Manage global application settings (registration, maintenance mode, guest access) and send SMS via SMS.SU
Args: event with httpMethod, body, queryStringParameters; context with request_id
Returns: HTTP response with settings data or update confirmation
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import re
import urllib.request
import urllib.parse
import urllib.error
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import boto3
from botocore.exceptions import ClientError

SMS_SU_ENDPOINT = 'https://ssl.bs00.ru/'
SMS_SENDER_NAME = 'foto-mix'
DEFAULT_PRIORITY = 2
LOW_BALANCE_THRESHOLD = 50.0
ADMIN_EMAIL = 'jon-hrom2012@gmail.com'
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

def normalize_phone(phone: str) -> str:
    digits = re.sub(r'\D+', '', phone or '')
    if len(digits) == 11 and digits[0] in ('8', '7'):
        digits = '7' + digits[1:]
    elif len(digits) == 10:
        digits = '7' + digits
    return digits

def send_low_balance_email(balance: float) -> bool:
    """Отправить email о низком балансе SMS"""
    subject = f'⚠️ Низкий баланс SMS: {balance:.2f} ₽'
    try:
        
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }}
                .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .alert {{ background: #fee; border-left: 4px solid #e11; padding: 15px; margin: 20px 0; border-radius: 4px; }}
                .balance {{ font-size: 32px; font-weight: bold; color: #e11; text-align: center; margin: 20px 0; }}
                .button {{ display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="color: #e11; margin: 0;">⚠️ Низкий баланс SMS</h1>
                </div>
                
                <div class="alert">
                    <strong>Внимание!</strong> Баланс SMS.SU упал ниже критического уровня.
                </div>
                
                <div class="balance">
                    {balance:.2f} ₽
                </div>
                
                <p>На балансе SMS.SU осталось менее 50 рублей. Пользователи не смогут получать SMS-уведомления (коды подтверждения, восстановление пароля).</p>
                
                <p><strong>Что нужно сделать:</strong></p>
                <ol>
                    <li>Перейти на <a href="https://sms.su">sms.su</a></li>
                    <li>Войти в личный кабинет</li>
                    <li>Пополнить баланс минимум на 100 рублей</li>
                </ol>
                
                <div style="text-align: center;">
                    <a href="https://sms.su" class="button">Пополнить баланс →</a>
                </div>
                
                <div class="footer">
                    <p>Это автоматическое уведомление от foto-mix.ru</p>
                    <p>Дата: {datetime.now().strftime('%d.%m.%Y %H:%M')}</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_body = f"""
        НИЗКИЙ БАЛАНС SMS
        
        Баланс SMS.SU: {balance:.2f} ₽
        
        На балансе SMS.SU осталось менее 50 рублей. Пользователи не смогут получать SMS-уведомления.
        
        Пополните баланс на https://sms.su
        
        —
        Автоматическое уведомление от foto-mix.ru
        {datetime.now().strftime('%d.%m.%Y %H:%M')}
        """
        
        subject = f'⚠️ Низкий баланс SMS: {balance:.2f} ₽'
        success = send_email(ADMIN_EMAIL, subject, html_body, 'FotoMix SMS Alert')
        if success:
            print(f'[LOW_BALANCE] Email sent to {ADMIN_EMAIL}')
        return success
    except Exception as e:
        print(f'[LOW_BALANCE] Failed to send email: {str(e)}')
        return False

def send_admin_notification(conn, balance: float):
    """Отправить уведомление в админ-панель"""
    try:
        cursor = conn.cursor()
        message = f"⚠️ Низкий баланс SMS.SU: {balance:.2f} ₽. Пополните баланс на https://sms.su"
        
        cursor.execute("""
            INSERT INTO t_p28211681_photo_secure_web.admin_messages 
            (message_type, message_text, priority, created_at)
            VALUES (%s, %s, %s, %s)
        """, ('warning', message, 'high', datetime.now()))
        conn.commit()
        print(f'[LOW_BALANCE] Admin notification created')
        return True
    except Exception as e:
        print(f'[LOW_BALANCE] Failed to create admin notification: {str(e)}')
        return False

def check_and_notify_low_balance(conn, balance: float):
    """Проверить баланс и отправить уведомления если нужно"""
    if balance >= LOW_BALANCE_THRESHOLD:
        return
    
    try:
        cursor = conn.cursor()
        # Проверить когда последний раз отправлялось уведомление
        cursor.execute("""
            SELECT last_notification_at 
            FROM t_p28211681_photo_secure_web.sms_balance_alerts 
            WHERE id = 1
        """)
        row = cursor.fetchone()
        
        should_notify = True
        if row and row[0]:
            last_notification = row[0]
            # Отправлять уведомление не чаще чем раз в 24 часа
            if datetime.now() - last_notification < timedelta(hours=24):
                should_notify = False
                print(f'[LOW_BALANCE] Already notified within 24h, skipping')
        
        if should_notify:
            print(f'[LOW_BALANCE] Balance {balance:.2f} is below threshold {LOW_BALANCE_THRESHOLD}, sending notifications')
            
            # Отправить email
            send_low_balance_email(balance)
            
            # Отправить уведомление в админку
            send_admin_notification(conn, balance)
            
            # Обновить время последнего уведомления
            cursor.execute("""
                INSERT INTO t_p28211681_photo_secure_web.sms_balance_alerts (id, last_notification_at, balance)
                VALUES (1, %s, %s)
                ON CONFLICT (id) 
                DO UPDATE SET last_notification_at = %s, balance = %s
            """, (datetime.now(), balance, datetime.now(), balance))
            conn.commit()
    except Exception as e:
        print(f'[LOW_BALANCE] Error in check_and_notify_low_balance: {str(e)}')

def get_balance() -> Dict[str, Any]:
    api_key_raw = os.environ.get('API_KEY', '').strip()
    
    if api_key_raw.startswith('API_KEY='):
        api_key = api_key_raw[8:]
    else:
        api_key = api_key_raw
    
    if not api_key:
        return {'ok': False, 'error': 'API_KEY не настроен', 'err_code': 699}
    
    payload = {
        'method': 'get_profile',
        'key': api_key,
        'format': 'json',
    }
    
    try:
        url = f"{SMS_SU_ENDPOINT}?{urllib.parse.urlencode(payload)}"
        print(f'[SMS_SU] Getting balance from SMS.SU')
        
        req = urllib.request.Request(url, headers={'User-Agent': 'foto-mix.ru/1.0'})
        
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode('utf-8')
            print(f'[SMS_SU] Balance response: {raw}')
            result = json.loads(raw)
            
            if not isinstance(result, dict) or 'response' not in result:
                return {'ok': False, 'error': 'Неверный формат ответа SMS.SU'}
            
            msg = result['response'].get('msg', {})
            data_resp = result['response'].get('data')
            err_code = int(msg.get('err_code', 99))
            
            if err_code != 0:
                error_text = msg.get('text', 'Ошибка получения баланса')
                return {'ok': False, 'error': error_text, 'err_code': err_code}
            
            if data_resp and 'credits' in data_resp:
                balance = float(data_resp['credits'])
                print(f'[SMS_SU] Balance: {balance} руб.')
                return {'ok': True, 'balance': balance}
            
            return {'ok': False, 'error': 'Баланс не найден в ответе'}
    except Exception as e:
        print(f'[SMS_SU] Balance check error: {str(e)}')
        return {'ok': False, 'error': f'Ошибка связи: {str(e)}', 'err_code': 699}

def send_sms(phone: str, text: str, priority: int = DEFAULT_PRIORITY) -> Dict[str, Any]:
    api_key_raw = os.environ.get('API_KEY', '').strip()
    
    # Извлекаем значение после API_KEY= если оно есть
    if api_key_raw.startswith('API_KEY='):
        api_key = api_key_raw[8:]  # Убираем префикс API_KEY=
    else:
        api_key = api_key_raw
    
    print(f'[SMS_SU] API key length: {len(api_key)}, first 4 chars: {api_key[:4] if api_key else "empty"}')
    if not api_key:
        return {'ok': False, 'error': 'API_KEY не настроен. Добавьте ключ в настройках проекта', 'err_code': 699}
    
    phone = normalize_phone(phone)
    
    if not re.match(r'^7\d{10}$', phone):
        return {'ok': False, 'error': 'Неверный формат номера. Ожидается 7XXXXXXXXXX (РФ).', 'err_code': 617}
    
    payload = {
        'method': 'push_msg',
        'key': api_key,
        'text': text,
        'phone': phone,
        'sender_name': SMS_SENDER_NAME,
        'priority': priority,
        'format': 'json',
    }
    
    data = urllib.parse.urlencode(payload).encode('utf-8')
    
    try:
        # Используем GET запрос согласно документации SMS.SU
        url = f"{SMS_SU_ENDPOINT}?{urllib.parse.urlencode(payload)}"
        
        print(f'[SMS_SU] Request URL: {url.replace(api_key, "***KEY***")}')
        
        req = urllib.request.Request(url, headers={'User-Agent': 'foto-mix.ru/1.0'})
        
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode('utf-8')
            print(f'[SMS_SU] Response: {raw}')
            result = json.loads(raw)
            
            if not isinstance(result, dict) or 'response' not in result:
                return {'ok': False, 'error': 'Неверный формат ответа SMS.SU', 'raw': raw}
            
            msg = result['response'].get('msg', {})
            data_resp = result['response'].get('data')
            err_code = int(msg.get('err_code', 99))
            
            if err_code != 0:
                error_text = msg.get('text', 'Ошибка отправки SMS')
                print(f'[SMS_SU] Error {err_code}: {error_text}')
                return {
                    'ok': False,
                    'error': error_text,
                    'err_code': err_code,
                    'raw': raw
                }
            
            print(f'[SMS_SU] Success: id={data_resp.get("id") if data_resp else None}')
            return {
                'ok': True,
                'id': data_resp.get('id') if data_resp else None,
                'credits': data_resp.get('credits') if data_resp else None,
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if hasattr(e, 'read') else str(e)
        print(f'[SMS_SU] HTTP Error: {e.code} - {error_body}')
        return {'ok': False, 'error': f'HTTP {e.code}: {error_body}', 'err_code': 699}
    except Exception as e:
        print(f'[SMS_SU] Exception: {str(e)}')
        return {'ok': False, 'error': f'Ошибка связи: {str(e)}', 'err_code': 699}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    print(f"[SETTINGS] Handler called: method={method}")
    
    # Handle CORS OPTIONS request
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    # Get database connection
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Database configuration missing'}),
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(dsn)
    cursor = conn.cursor()
    
    if method == 'GET':
        # Check if user settings are requested
        query_params = event.get('queryStringParameters') or {}
        action = query_params.get('action')
        user_id = query_params.get('userId')
        
        # Get admin messages
        if action == 'get-admin-messages':
            try:
                cursor.execute("""
                    SELECT id, message_type, message_text, priority, is_read, created_at
                    FROM t_p28211681_photo_secure_web.admin_messages
                    ORDER BY created_at DESC
                    LIMIT 50
                """)
                rows = cursor.fetchall()
                
                messages = []
                for row in rows:
                    messages.append({
                        'id': row[0],
                        'message_type': row[1],
                        'message_text': row[2],
                        'priority': row[3],
                        'is_read': row[4],
                        'created_at': row[5].isoformat() if row[5] else None
                    })
                
                cursor.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': True, 'messages': messages}),
                    'isBase64Encoded': False
                }
            except Exception as e:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': str(e)}),
                    'isBase64Encoded': False
                }
        
        if user_id:
            # Get user settings - check both users and vk_users tables
            try:
                print(f"[SETTINGS] Loading settings for userId={user_id}")
                
                # First check users table
                cursor.execute("""
                    SELECT email, phone, two_factor_email, email_verified_at, source, phone_verified_at, display_name
                    FROM t_p28211681_photo_secure_web.users
                    WHERE id = %s
                """, (int(user_id),))
                row = cursor.fetchone()
                
                if row:
                    print(f"[SETTINGS] Found in users table: email={row[0]}, source={row[4]}, phone_verified={row[5]}")
                    user_settings = {
                        'email': row[0] or '',
                        'phone': row[1] or '',
                        'two_factor_email': row[2] or False,
                        'email_verified_at': row[3].isoformat() if row[3] else None,
                        'source': row[4] or 'email',
                        'phone_verified_at': row[5].isoformat() if row[5] else None,
                        'display_name': row[6] or ''
                    }
                else:
                    # Check vk_users table
                    cursor.execute("""
                        SELECT email, phone_number, full_name
                        FROM t_p28211681_photo_secure_web.vk_users
                        WHERE user_id = %s
                    """, (int(user_id),))
                    vk_row = cursor.fetchone()
                    
                    if not vk_row:
                        print(f"[SETTINGS] User not found in both tables")
                        cursor.close()
                        conn.close()
                        return {
                            'statusCode': 404,
                            'headers': {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            'body': json.dumps({'error': 'User not found'}),
                            'isBase64Encoded': False
                        }
                    
                    print(f"[SETTINGS] Found in vk_users table: email={vk_row[0]}")
                    
                    # Get 2FA settings from users table for VK user
                    cursor.execute("""
                        SELECT two_factor_email
                        FROM t_p28211681_photo_secure_web.users
                        WHERE id = %s
                    """, (int(user_id),))
                    fa_row = cursor.fetchone()
                    
                    user_settings = {
                        'email': vk_row[0] or '',
                        'phone': vk_row[1] or '',
                        'two_factor_email': fa_row[0] if fa_row else False,
                        'email_verified_at': None,
                        'source': 'vk',
                        'phone_verified_at': None
                    }
                
                cursor.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps(user_settings),
                    'isBase64Encoded': False
                }
            except Exception as e:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': f'Error loading user settings: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        # Check if specific key is requested
        requested_key = query_params.get('key')
        
        if requested_key:
            # Get specific setting
            cursor.execute("SELECT setting_value FROM app_settings WHERE setting_key = %s", (requested_key,))
            row = cursor.fetchone()
            
            if row:
                value = row[0]
                # Try to parse as JSON first
                try:
                    parsed_value = json.loads(value)
                    result = {'value': parsed_value}
                except (json.JSONDecodeError, ValueError):
                    # If not JSON, check if it's a boolean
                    if value.lower() in ('true', 'false'):
                        result = {'value': value.lower() == 'true'}
                    else:
                        result = {'value': value}
            else:
                result = {'value': None}
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        # Get all settings
        cursor.execute("SELECT setting_key, setting_value FROM app_settings")
        rows = cursor.fetchall()
        
        settings = {}
        for row in rows:
            key, value = row
            # Try to parse as JSON first
            try:
                settings[key] = json.loads(value)
            except (json.JSONDecodeError, ValueError):
                # If not JSON, check if it's a boolean
                if value.lower() in ('true', 'false'):
                    settings[key] = value.lower() == 'true'
                else:
                    settings[key] = value
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(settings),
            'isBase64Encoded': False
        }
    
    if method == 'POST':
        # Update a setting or user settings
        body_data = json.loads(event.get('body', '{}'))
        action = body_data.get('action')
        
        # Check SMS balance via get_profile method
        if action == 'check-sms-balance':
            print('[SMS_BALANCE] Checking SMS.SU balance via get_profile...')
            
            result = get_balance()
            
            # Проверить и отправить уведомления если баланс низкий
            if result.get('ok') and 'balance' in result:
                check_and_notify_low_balance(conn, result['balance'])
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200 if result['ok'] else 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        # Mark admin message as read
        if action == 'mark-message-read':
            message_id = body_data.get('messageId')
            
            if not message_id:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Missing messageId'}),
                    'isBase64Encoded': False
                }
            
            try:
                cursor.execute("""
                    UPDATE t_p28211681_photo_secure_web.admin_messages
                    SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (message_id,))
                conn.commit()
                
                cursor.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': True}),
                    'isBase64Encoded': False
                }
            except Exception as e:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': str(e)}),
                    'isBase64Encoded': False
                }
        
        # Get API key preview (first 8 chars for verification)
        if action == 'get-api-key-preview':
            api_key_raw = os.environ.get('API_KEY', '').strip()
            
            if api_key_raw.startswith('API_KEY='):
                api_key = api_key_raw[8:]
            else:
                api_key = api_key_raw
            
            if not api_key:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'API_KEY не настроен'}),
                    'isBase64Encoded': False
                }
            
            # Return first 8 chars and total length
            preview = api_key[:8] + '...' if len(api_key) > 8 else api_key
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'ok': True, 
                    'preview': preview,
                    'length': len(api_key)
                }),
                'isBase64Encoded': False
            }
        
        # Send test SMS (from admin panel)
        if action == 'send-sms':
            print('[SEND_SMS] Sending test SMS...')
            phone = body_data.get('phone', '')
            text = body_data.get('text', '')
            priority = body_data.get('priority', DEFAULT_PRIORITY)
            
            if not phone or not text:
                print(f'[SEND_SMS] Error: Missing phone or text (phone={phone}, text={text})')
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Укажите phone и text'}),
                    'isBase64Encoded': False
                }
            
            result = send_sms(phone, text, priority)
            print(f'[SEND_SMS] Result: {result}')
            
            # Проверить баланс после отправки и отправить уведомления если нужно
            if result.get('ok') and result.get('credits') is not None:
                check_and_notify_low_balance(conn, result['credits'])
            
            cursor.close()
            conn.close()
            
            status_code = 200 if result.get('ok') else 400
            return {
                'statusCode': status_code,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result, ensure_ascii=False),
                'isBase64Encoded': False
            }
        
        # Handle SMS code generation and sending
        if action == 'send-verification-code':
            phone = body_data.get('phone', '')
            
            if not phone:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Укажите phone'}),
                    'isBase64Encoded': False
                }
            
            # Generate 6-digit code
            import random
            verification_code = str(random.randint(100000, 999999))
            
            # Save code to database with expiration (10 minutes)
            from datetime import datetime, timedelta
            expires_at = datetime.utcnow() + timedelta(minutes=10)
            
            cursor.execute('''
                INSERT INTO phone_verification_codes (phone, code, expires_at, created_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (phone) DO UPDATE SET
                    code = EXCLUDED.code,
                    expires_at = EXCLUDED.expires_at,
                    created_at = EXCLUDED.created_at,
                    verified = false
            ''', (normalize_phone(phone), verification_code, expires_at, datetime.utcnow()))
            conn.commit()
            
            # Send SMS
            text = f'Код подтверждения телефона foto-mix.ru: {verification_code}. Действителен 10 минут.'
            result = send_sms(phone, text, 2)
            
            cursor.close()
            conn.close()
            
            status_code = 200 if result.get('ok') else 400
            return {
                'statusCode': status_code,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result, ensure_ascii=False),
                'isBase64Encoded': False
            }
        
        # Handle SMS code verification
        if action == 'verify-phone-code':
            phone = body_data.get('phone', '')
            code = body_data.get('code', '')
            
            if not phone or not code:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Укажите phone и code'}),
                    'isBase64Encoded': False
                }
            
            # Check code
            from datetime import datetime
            cursor.execute('''
                SELECT code, expires_at, verified
                FROM phone_verification_codes
                WHERE phone = %s
            ''', (normalize_phone(phone),))
            row = cursor.fetchone()
            
            if not row:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Код не найден. Запросите новый код.'}),
                    'isBase64Encoded': False
                }
            
            saved_code, expires_at, verified = row
            
            if verified:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Код уже использован'}),
                    'isBase64Encoded': False
                }
            
            if datetime.utcnow() > expires_at:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Код истек. Запросите новый код.'}),
                    'isBase64Encoded': False
                }
            
            if code != saved_code:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Неверный код'}),
                    'isBase64Encoded': False
                }
            
            # Mark as verified
            cursor.execute('''
                UPDATE phone_verification_codes
                SET verified = true
                WHERE phone = %s
            ''', (normalize_phone(phone),))
            conn.commit()
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'ok': True}),
                'isBase64Encoded': False
            }
        
        # Handle SMS sending (legacy)
        if action == 'send-sms':
            phone = body_data.get('phone', '')
            text = body_data.get('text', '')
            priority = body_data.get('priority', DEFAULT_PRIORITY)
            
            if not phone or not text:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'ok': False, 'error': 'Укажите phone и text'}),
                    'isBase64Encoded': False
                }
            
            result = send_sms(phone, text, priority)
            cursor.close()
            conn.close()
            
            status_code = 200 if result.get('ok') else 400
            return {
                'statusCode': status_code,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result, ensure_ascii=False),
                'isBase64Encoded': False
            }
        
        # Handle user settings actions
        if action == 'update-contact':
            user_id = body_data.get('userId')
            field = body_data.get('field')
            value = body_data.get('value')
            
            print(f"[SETTINGS] update-contact: userId={user_id}, field={field}, value={value}")
            
            if not user_id or not field or field not in ('email', 'phone', 'display_name'):
                print(f"[SETTINGS] Validation error: userId={user_id}, field={field}")
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'userId, field, and value are required'}),
                    'isBase64Encoded': False
                }
            
            try:
                print(f"[SETTINGS] Updating {field} for user {user_id}")
                
                # Update both users and vk_users tables
                cursor.execute(f"""
                    UPDATE t_p28211681_photo_secure_web.users
                    SET {field} = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (value, int(user_id)))
                
                # Also update vk_users if exists
                vk_field = 'phone_number' if field == 'phone' else field
                cursor.execute(f"""
                    UPDATE t_p28211681_photo_secure_web.vk_users
                    SET {vk_field} = %s
                    WHERE user_id = %s
                """, (value, int(user_id)))
                
                print(f"[SETTINGS] Updated {cursor.rowcount} rows in vk_users")
                
                conn.commit()
                cursor.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'success': True, 'field': field, 'value': value}),
                    'isBase64Encoded': False
                }
            except Exception as e:
                conn.rollback()
                cursor.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': f'Failed to update contact: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        if action == 'toggle-2fa':
            user_id = body_data.get('userId')
            fa_type = body_data.get('type')
            enabled = body_data.get('enabled', False)
            
            print(f"[SETTINGS] toggle-2fa: userId={user_id}, type={fa_type}, enabled={enabled}")
            
            if not user_id or not fa_type:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'userId and type are required'}),
                    'isBase64Encoded': False
                }
            
            try:
                # Check if user has email when enabling 2FA
                if enabled and fa_type == 'email':
                    cursor.execute("""
                        SELECT email FROM t_p28211681_photo_secure_web.users WHERE id = %s
                    """, (int(user_id),))
                    user_row = cursor.fetchone()
                    
                    if not user_row or not user_row[0] or not user_row[0].strip():
                        # Check vk_users table
                        cursor.execute("""
                            SELECT email FROM t_p28211681_photo_secure_web.vk_users WHERE user_id = %s
                        """, (int(user_id),))
                        vk_row = cursor.fetchone()
                        
                        if not vk_row or not vk_row[0] or not vk_row[0].strip():
                            print(f"[SETTINGS] Cannot enable 2FA - no email for userId={user_id}")
                            cursor.close()
                            conn.close()
                            return {
                                'statusCode': 400,
                                'headers': {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                },
                                'body': json.dumps({'error': 'Невозможно включить 2FA: сначала добавьте email в контактную информацию'}),
                                'isBase64Encoded': False
                            }
                
                cursor.execute(f"""
                    UPDATE t_p28211681_photo_secure_web.users
                    SET two_factor_{fa_type} = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (enabled, int(user_id)))
                
                conn.commit()
                cursor.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            except Exception as e:
                conn.rollback()
                cursor.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': f'Failed to toggle 2FA: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        # Update a global setting
        setting_key = body_data.get('key')
        setting_value_raw = body_data.get('value')
        
        if not setting_key:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Setting key is required'}),
                'isBase64Encoded': False
            }
        
        # Convert value to string for storage
        # If it's a dict or list, store as JSON string
        if isinstance(setting_value_raw, (dict, list)):
            setting_value = json.dumps(setting_value_raw)
        elif isinstance(setting_value_raw, bool):
            setting_value = str(setting_value_raw).lower()
        else:
            setting_value = str(setting_value_raw)
        
        # Update or insert setting
        cursor.execute("""
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
        """, (setting_key, setting_value))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'success': True, 'key': setting_key, 'value': setting_value_raw}),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 405,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }