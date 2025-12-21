"""
Business: Смена пароля пользователя с подтверждением по email (инициация и подтверждение)
Args: event с httpMethod, headers с X-User-Id, body с old_password/new_password или verification_code
Returns: HTTP response с результатом операции
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
from botocore.exceptions import ClientError

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


def send_email(to_email: str, subject: str, html_body: str, from_name: str = 'FotoMix') -> bool:
    """Отправить email через Yandex Cloud Postbox"""
    try:
        access_key_id = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        secret_access_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        
        if not access_key_id or not secret_access_key:
            print("[CHANGE_PASSWORD] Error: POSTBOX credentials not set")
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
                    'Body': {
                        'Html': {'Data': html_body, 'Charset': 'UTF-8'}
                    }
                }
            }
        )
        
        print(f"[CHANGE_PASSWORD] Email sent successfully to {to_email}: {response['MessageId']}")
        return True
    except ClientError as e:
        print(f"[CHANGE_PASSWORD] Email send failed: {str(e)}")
        return False
    except Exception as e:
        print(f"[CHANGE_PASSWORD] Unexpected error: {str(e)}")
        return False


def hash_password(password: str) -> str:
    """Хэширование пароля"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_old_password(user_id: int, old_password: str) -> bool:
    """Проверка старого пароля"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT password_hash 
                FROM {SCHEMA}.users 
                WHERE id = {escape_sql(user_id)}
            """)
            user = cur.fetchone()
            
            if not user or not user['password_hash']:
                return False
            
            return user['password_hash'] == hash_password(old_password)
    finally:
        conn.close()


def generate_verification_code() -> str:
    """Генерация 6-значного кода"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])


def save_verification_code(user_id: int, code: str, email: str) -> bool:
    """Сохранение кода подтверждения"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            expires_at = datetime.now() + timedelta(minutes=10)
            
            # Удаляем старые коды
            cur.execute(f"""
                DELETE FROM {SCHEMA}.password_reset_codes 
                WHERE user_id = {escape_sql(user_id)}
            """)
            
            # Создаём новый код
            cur.execute(f"""
                INSERT INTO {SCHEMA}.password_reset_codes 
                (user_id, code, email, expires_at, created_at, is_used)
                VALUES ({escape_sql(user_id)}, {escape_sql(code)}, {escape_sql(email)}, 
                        {escape_sql(expires_at.isoformat())}, CURRENT_TIMESTAMP, FALSE)
            """)
            
            conn.commit()
            return True
    except Exception as e:
        print(f"[CHANGE_PASSWORD] Save code error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def verify_code(user_id: int, code: str) -> bool:
    """Проверка кода подтверждения"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT id, is_used, expires_at 
                FROM {SCHEMA}.password_reset_codes 
                WHERE user_id = {escape_sql(user_id)} 
                  AND code = {escape_sql(code)}
                  AND is_used = FALSE
                ORDER BY created_at DESC
                LIMIT 1
            """)
            record = cur.fetchone()
            
            if not record:
                return False
            
            # Проверяем истечение
            if record['expires_at'] < datetime.now():
                return False
            
            # Помечаем как использованный
            cur.execute(f"""
                UPDATE {SCHEMA}.password_reset_codes 
                SET is_used = TRUE 
                WHERE id = {escape_sql(record['id'])}
            """)
            conn.commit()
            
            return True
    finally:
        conn.close()


def update_password(user_id: int, new_password: str) -> bool:
    """Обновление пароля"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            new_hash = hash_password(new_password)
            cur.execute(f"""
                UPDATE {SCHEMA}.users 
                SET password_hash = {escape_sql(new_hash)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {escape_sql(user_id)}
            """)
            conn.commit()
            return True
    except Exception as e:
        print(f"[CHANGE_PASSWORD] Update password error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def get_user_email(user_id: int) -> Optional[str]:
    """Получение email пользователя"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT email FROM {SCHEMA}.users 
                WHERE id = {escape_sql(user_id)}
            """)
            user = cur.fetchone()
            return user['email'] if user else None
    finally:
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик смены пароля"""
    method = event.get('httpMethod', 'POST')
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Session-Id',
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
    
    # Получаем user_id
    headers = event.get('headers', {})
    user_id_str = headers.get('x-user-id') or headers.get('X-User-Id')
    
    if not user_id_str:
        return {
            'statusCode': 401,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Требуется авторизация'}),
            'isBase64Encoded': False
        }
    
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Некорректный user_id'}),
            'isBase64Encoded': False
        }
    
    try:
        body_data = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Некорректный JSON'}),
            'isBase64Encoded': False
        }
    
    action = body_data.get('action')
    
    # Шаг 1: Инициация смены пароля
    if action == 'initiate':
        old_password = body_data.get('old_password')
        
        if not old_password:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Требуется старый пароль'}),
                'isBase64Encoded': False
            }
        
        # Проверяем старый пароль
        if not verify_old_password(user_id, old_password):
            return {
                'statusCode': 403,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Неверный текущий пароль'}),
                'isBase64Encoded': False
            }
        
        # Получаем email
        email = get_user_email(user_id)
        if not email:
            return {
                'statusCode': 404,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Email не найден'}),
                'isBase64Encoded': False
            }
        
        # Генерируем и сохраняем код
        code = generate_verification_code()
        if not save_verification_code(user_id, code, email):
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Ошибка создания кода'}),
                'isBase64Encoded': False
            }
        
        # Отправляем email
        subject = 'Подтверждение смены пароля — FotoMix'
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">Смена пароля</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px; color: #333;">Здравствуйте!</p>
                <p style="font-size: 16px; color: #333;">Вы запросили смену пароля в сервисе FotoMix.</p>
                <p style="font-size: 16px; color: #333;">Ваш код подтверждения:</p>
                <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
                    <h2 style="color: #667eea; font-size: 32px; letter-spacing: 8px; margin: 0;">{code}</h2>
                </div>
                <p style="font-size: 14px; color: #666;">Код действителен в течение 10 минут.</p>
                <p style="font-size: 14px; color: #666;">Если вы не запрашивали смену пароля, проигнорируйте это письмо.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
                <p style="font-size: 12px; color: #999; text-align: center;">FotoMix — Профессиональная обработка фотографий</p>
            </div>
        </body>
        </html>
        """
        
        if not send_email(email, subject, html_body):
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Ошибка отправки email'}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'success': True,
                'message': f'Код отправлен на {email[:3]}***@{email.split("@")[1]}'
            }),
            'isBase64Encoded': False
        }
    
    # Шаг 2: Подтверждение и смена пароля
    elif action == 'confirm':
        code = body_data.get('code')
        new_password = body_data.get('new_password')
        
        if not code or not new_password:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Требуется код и новый пароль'}),
                'isBase64Encoded': False
            }
        
        if len(new_password) < 6:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Пароль должен быть минимум 6 символов'}),
                'isBase64Encoded': False
            }
        
        # Проверяем код
        if not verify_code(user_id, code):
            return {
                'statusCode': 403,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Неверный или истекший код'}),
                'isBase64Encoded': False
            }
        
        # Обновляем пароль
        if not update_password(user_id, new_password):
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Ошибка обновления пароля'}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'success': True,
                'message': 'Пароль успешно изменён'
            }),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 400,
        'headers': cors_headers,
        'body': json.dumps({'success': False, 'error': 'Неизвестное действие'}),
        'isBase64Encoded': False
    }
