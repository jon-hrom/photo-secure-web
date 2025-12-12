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
from typing import Dict, Any
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
    if isinstance(value, datetime):
        return "'" + value.isoformat() + "'"
    # Escape single quotes by doubling them
    return "'" + str(value).replace("'", "''") + "'"

def generate_code() -> str:
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

def send_reset_email(to: str, code: str):
    subject = 'Восстановление пароля — foto-mix.ru'
    text = f'Ваш код для восстановления пароля: {code}\nСрок действия: 10 минут.'
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
    
    ses = get_ses_client()
    ses.send_email(
        FromEmailAddress='noreply@foto-mix.ru',
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
        
        if action == 'check_email':
            email = body.get('email')
            if not email:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Email обязателен'}),
                    'isBase64Encoded': False
                }
            
            query = f"SELECT user_id, phone FROM t_p28211681_photo_secure_web.users WHERE email = {escape_sql(email)}"
            cursor.execute(query)
            user = cursor.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Пользователь не найден'}),
                    'isBase64Encoded': False
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'hasSmsEnabled': bool(user['phone'])
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'send_code':
            email = body.get('email')
            method_type = body.get('method', 'email')
            
            if not email:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Email обязателен'}),
                    'isBase64Encoded': False
                }
            
            query = f"SELECT user_id FROM t_p28211681_photo_secure_web.users WHERE email = {escape_sql(email)}"
            cursor.execute(query)
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
            
            query = f"""
                INSERT INTO t_p28211681_photo_secure_web.password_reset_codes (user_id, code, session_token, expires_at, method_type)
                VALUES ({escape_sql(user['user_id'])}, {escape_sql(code)}, {escape_sql(session_token)}, {escape_sql(expires_at)}, {escape_sql(method_type)})
                ON CONFLICT (user_id) DO UPDATE 
                SET code = EXCLUDED.code, 
                    session_token = EXCLUDED.session_token,
                    expires_at = EXCLUDED.expires_at,
                    method_type = EXCLUDED.method_type,
                    used = FALSE
            """
            cursor.execute(query)
            conn.commit()
            
            if method_type == 'email':
                send_reset_email(email, code)
            
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
            email = body.get('email')
            code = body.get('code')
            session_token = body.get('session_token')
            
            if not all([email, code, session_token]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Все поля обязательны'}),
                    'isBase64Encoded': False
                }
            
            query = f"""
                SELECT prc.* FROM t_p28211681_photo_secure_web.password_reset_codes prc
                JOIN t_p28211681_photo_secure_web.users u ON u.user_id = prc.user_id
                WHERE u.email = {escape_sql(email)}
                AND prc.code = {escape_sql(code)}
                AND prc.session_token = {escape_sql(session_token)}
                AND prc.expires_at > NOW()
                AND prc.used = FALSE
            """
            cursor.execute(query)
            
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
            email = body.get('email')
            new_password = body.get('new_password')
            session_token = body.get('session_token')
            
            if not all([email, new_password, session_token]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Все поля обязательны'}),
                    'isBase64Encoded': False
                }
            
            query = f"""
                SELECT prc.user_id FROM t_p28211681_photo_secure_web.password_reset_codes prc
                JOIN t_p28211681_photo_secure_web.users u ON u.user_id = prc.user_id
                WHERE u.email = {escape_sql(email)}
                AND prc.session_token = {escape_sql(session_token)}
                AND prc.expires_at > NOW()
                AND prc.used = FALSE
            """
            cursor.execute(query)
            
            reset_code = cursor.fetchone()
            
            if not reset_code:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Сессия истекла или недействительна'}),
                    'isBase64Encoded': False
                }
            
            hashed = hash_password(new_password)
            
            query = f"UPDATE t_p28211681_photo_secure_web.users SET password = {escape_sql(hashed)} WHERE email = {escape_sql(email)}"
            cursor.execute(query)
            
            query = f"UPDATE t_p28211681_photo_secure_web.password_reset_codes SET used = TRUE WHERE user_id = {escape_sql(reset_code['user_id'])}"
            cursor.execute(query)
            
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