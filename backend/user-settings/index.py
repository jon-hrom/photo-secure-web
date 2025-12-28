"""
Business: Управление настройками пользователя (получение и обновление профиля)
Args: event с httpMethod (GET/POST), headers с X-User-Id, body с настройками для обновления
Returns: HTTP response с данными пользователя или статусом обновления
"""

import json
import os
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


def get_user_emails(user_id: int) -> list[Dict[str, Any]]:
    """Получение всех email-адресов пользователя"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT id, user_id, email, provider, is_primary, is_verified, 
                       verified_at, added_at, last_used_at
                FROM {SCHEMA}.user_emails 
                WHERE user_id = {escape_sql(user_id)}
                ORDER BY is_primary DESC, added_at DESC
            """)
            emails = cur.fetchall()
            return [dict(email) for email in emails]
    finally:
        conn.close()


def set_primary_email(user_id: int, email_id: int) -> bool:
    """Установка основного email"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Проверяем, что email принадлежит пользователю и верифицирован
            cur.execute(f"""
                SELECT is_verified FROM {SCHEMA}.user_emails 
                WHERE id = {escape_sql(email_id)} AND user_id = {escape_sql(user_id)}
            """)
            email = cur.fetchone()
            
            if not email:
                return False
            
            if not email['is_verified']:
                raise Exception('Можно установить только верифицированный email')
            
            # Снимаем флаг primary со всех email пользователя
            cur.execute(f"""
                UPDATE {SCHEMA}.user_emails 
                SET is_primary = FALSE
                WHERE user_id = {escape_sql(user_id)}
            """)
            
            # Устанавливаем новый primary
            cur.execute(f"""
                UPDATE {SCHEMA}.user_emails 
                SET is_primary = TRUE
                WHERE id = {escape_sql(email_id)} AND user_id = {escape_sql(user_id)}
            """)
            
            # Обновляем email в users (для совместимости)
            cur.execute(f"""
                UPDATE {SCHEMA}.users 
                SET email = (SELECT email FROM {SCHEMA}.user_emails WHERE id = {escape_sql(email_id)}),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {escape_sql(user_id)}
            """)
            
            conn.commit()
            return True
    except Exception as e:
        print(f"[USER_SETTINGS] Set primary email error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def get_user_settings(user_id: int) -> Optional[Dict[str, Any]]:
    """Получение настроек пользователя"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Получаем данные из users
            cur.execute(f"""
                SELECT 
                    id, email, phone, display_name,
                    two_factor_sms, two_factor_email,
                    email_verified_at, phone_verified_at,
                    created_at, last_login, source,
                    country, region, city,
                    CASE WHEN password_hash IS NOT NULL AND password_hash != '' THEN 'true' ELSE 'false' END as has_password
                FROM {SCHEMA}.users 
                WHERE id = {escape_sql(user_id)}
            """)
            user = cur.fetchone()
            
            if not user:
                return None
            
            # Проверяем is_verified у primary email из user_emails
            cur.execute(f"""
                SELECT is_verified, verified_at 
                FROM {SCHEMA}.user_emails 
                WHERE user_id = {escape_sql(user_id)} AND is_primary = TRUE
                LIMIT 1
            """)
            primary_email = cur.fetchone()
            
            # Получаем профиль
            cur.execute(f"""
                SELECT full_name, bio, location, avatar_url, interests
                FROM {SCHEMA}.user_profiles 
                WHERE user_id = {escape_sql(user_id)}
            """)
            profile = cur.fetchone()
            
            # Объединяем данные
            result = dict(user)
            
            # Обновляем email_verified_at из user_emails (приоритет новой системы)
            if primary_email and primary_email['is_verified']:
                result['email_verified_at'] = primary_email['verified_at']
            elif not primary_email or not primary_email['is_verified']:
                result['email_verified_at'] = None
            
            if profile:
                result.update(dict(profile))
            
            return result
    finally:
        conn.close()


def update_user_settings(user_id: int, settings: Dict[str, Any]) -> bool:
    """Обновление настроек пользователя"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Обновляем users если есть соответствующие поля
            user_fields = []
            if 'display_name' in settings:
                user_fields.append(f"display_name = {escape_sql(settings['display_name'])}")
            if 'phone' in settings:
                user_fields.append(f"phone = {escape_sql(settings['phone'])}")
            if 'two_factor_sms' in settings:
                user_fields.append(f"two_factor_sms = {escape_sql(settings['two_factor_sms'])}")
            if 'two_factor_email' in settings:
                user_fields.append(f"two_factor_email = {escape_sql(settings['two_factor_email'])}")
            if 'country' in settings:
                user_fields.append(f"country = {escape_sql(settings['country'])}")
            if 'region' in settings:
                user_fields.append(f"region = {escape_sql(settings['region'])}")
            if 'city' in settings:
                user_fields.append(f"city = {escape_sql(settings['city'])}")
            
            if user_fields:
                user_fields.append("updated_at = CURRENT_TIMESTAMP")
                cur.execute(f"""
                    UPDATE {SCHEMA}.users 
                    SET {', '.join(user_fields)}
                    WHERE id = {escape_sql(user_id)}
                """)
            
            # Обновляем или создаём profile
            profile_fields = {}
            if 'full_name' in settings:
                profile_fields['full_name'] = settings['full_name']
            if 'bio' in settings:
                profile_fields['bio'] = settings['bio']
            if 'location' in settings:
                profile_fields['location'] = settings['location']
            if 'interests' in settings:
                profile_fields['interests'] = settings['interests']
            
            if profile_fields:
                # Проверяем существование профиля
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.user_profiles 
                    WHERE user_id = {escape_sql(user_id)}
                """)
                profile_exists = cur.fetchone()
                
                if profile_exists:
                    # Обновляем
                    updates = [f"{k} = {escape_sql(v)}" for k, v in profile_fields.items()]
                    updates.append("updated_at = CURRENT_TIMESTAMP")
                    cur.execute(f"""
                        UPDATE {SCHEMA}.user_profiles 
                        SET {', '.join(updates)}
                        WHERE user_id = {escape_sql(user_id)}
                    """)
                else:
                    # Создаём
                    fields = list(profile_fields.keys()) + ['user_id', 'created_at', 'updated_at']
                    values = [escape_sql(v) for v in profile_fields.values()] + [
                        escape_sql(user_id), 
                        'CURRENT_TIMESTAMP', 
                        'CURRENT_TIMESTAMP'
                    ]
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.user_profiles ({', '.join(fields)})
                        VALUES ({', '.join(values)})
                    """)
            
            conn.commit()
            return True
    except Exception as e:
        print(f"[USER_SETTINGS] Update error: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик настроек пользователя"""
    method = event.get('httpMethod', 'GET')
    
    # CORS для всех запросов
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    
    # Получаем user_id из headers
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
    
    # GET - получение настроек
    if method == 'GET':
        query_params = event.get('queryStringParameters', {}) or {}
        action = query_params.get('action', 'get-settings')
        
        # Получение списка email-адресов
        if action == 'get-emails':
            emails = get_user_emails(user_id)
            
            # Преобразуем datetime в строки для JSON
            for email in emails:
                for key, value in email.items():
                    if hasattr(value, 'isoformat'):
                        email[key] = value.isoformat()
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'emails': emails
                }),
                'isBase64Encoded': False
            }
        
        # Получение настроек пользователя (default)
        settings = get_user_settings(user_id)
        
        if not settings:
            return {
                'statusCode': 404,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Пользователь не найден'}),
                'isBase64Encoded': False
            }
        
        # Преобразуем datetime в строки для JSON
        for key, value in settings.items():
            if hasattr(value, 'isoformat'):
                settings[key] = value.isoformat()
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'success': True,
                'settings': settings
            }),
            'isBase64Encoded': False
        }
    
    # POST - обновление настроек
    if method == 'POST':
        try:
            body_data = json.loads(event.get('body', '{}'))
        except json.JSONDecodeError:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Некорректный JSON'}),
                'isBase64Encoded': False
            }
        
        # Установка основного email
        action = body_data.get('action')
        if action == 'set-primary-email':
            email_id = body_data.get('email_id')
            if not email_id:
                return {
                    'statusCode': 400,
                    'headers': cors_headers,
                    'body': json.dumps({'success': False, 'error': 'Требуется email_id'}),
                    'isBase64Encoded': False
                }
            
            try:
                success = set_primary_email(user_id, email_id)
                
                if success:
                    return {
                        'statusCode': 200,
                        'headers': cors_headers,
                        'body': json.dumps({
                            'success': True,
                            'message': 'Основной email обновлён'
                        }),
                        'isBase64Encoded': False
                    }
                else:
                    return {
                        'statusCode': 400,
                        'headers': cors_headers,
                        'body': json.dumps({'success': False, 'error': 'Не удалось установить основной email'}),
                        'isBase64Encoded': False
                    }
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': cors_headers,
                    'body': json.dumps({'success': False, 'error': str(e)}),
                    'isBase64Encoded': False
                }
        
        # Обновление настроек пользователя (default action)
        success = update_user_settings(user_id, body_data)
        
        if success:
            # Получаем обновлённые настройки
            updated_settings = get_user_settings(user_id)
            for key, value in updated_settings.items():
                if hasattr(value, 'isoformat'):
                    updated_settings[key] = value.isoformat()
            
            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Настройки обновлены',
                    'settings': updated_settings
                }),
                'isBase64Encoded': False
            }
        else:
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps({'success': False, 'error': 'Ошибка обновления'}),
                'isBase64Encoded': False
            }
    
    return {
        'statusCode': 405,
        'headers': cors_headers,
        'body': json.dumps({'success': False, 'error': 'Метод не поддерживается'}),
        'isBase64Encoded': False
    }