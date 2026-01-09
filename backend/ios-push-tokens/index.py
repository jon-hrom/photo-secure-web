"""
API для управления iOS push-токенами устройств
Регистрация, обновление и получение токенов для отправки уведомлений
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'


def escape_sql(value):
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


def handler(event: dict, context) -> dict:
    """
    Управление iOS push-токенами для уведомлений
    """
    method = event.get('httpMethod', 'GET')
    
    # CORS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    # Get user_id from headers
    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'User ID required'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # GET - получить токены пользователя
        if method == 'GET':
            query = f"""
                SELECT 
                    id, user_id, device_token, device_name, device_model,
                    os_version, app_version, is_active, last_used_at,
                    created_at, updated_at
                FROM {SCHEMA}.ios_push_tokens
                WHERE user_id = {escape_sql(int(user_id))}
                ORDER BY last_used_at DESC
            """
            cur.execute(query)
            tokens = cur.fetchall()
            
            result = []
            for token in tokens:
                result.append({
                    'id': token['id'],
                    'userId': token['user_id'],
                    'deviceToken': token['device_token'],
                    'deviceName': token['device_name'],
                    'deviceModel': token['device_model'],
                    'osVersion': token['os_version'],
                    'appVersion': token['app_version'],
                    'isActive': token['is_active'],
                    'lastUsedAt': token['last_used_at'].isoformat() if token['last_used_at'] else None,
                    'createdAt': token['created_at'].isoformat() if token['created_at'] else None,
                    'updatedAt': token['updated_at'].isoformat() if token['updated_at'] else None
                })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'tokens': result}),
                'isBase64Encoded': False
            }
        
        # POST - зарегистрировать новый токен
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            device_token = body.get('deviceToken')
            device_name = body.get('deviceName', '')
            device_model = body.get('deviceModel', '')
            os_version = body.get('osVersion', '')
            app_version = body.get('appVersion', '')
            
            if not device_token:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Device token required'}),
                    'isBase64Encoded': False
                }
            
            # Проверяем, существует ли уже такой токен
            check_query = f"""
                SELECT id, user_id FROM {SCHEMA}.ios_push_tokens
                WHERE device_token = {escape_sql(device_token)}
            """
            cur.execute(check_query)
            existing = cur.fetchone()
            
            if existing:
                # Обновляем существующий токен
                update_query = f"""
                    UPDATE {SCHEMA}.ios_push_tokens
                    SET user_id = {escape_sql(int(user_id))},
                        device_name = {escape_sql(device_name)},
                        device_model = {escape_sql(device_model)},
                        os_version = {escape_sql(os_version)},
                        app_version = {escape_sql(app_version)},
                        is_active = TRUE,
                        last_used_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE device_token = {escape_sql(device_token)}
                    RETURNING id
                """
                cur.execute(update_query)
                token_id = cur.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': True,
                        'tokenId': token_id,
                        'message': 'Token updated'
                    }),
                    'isBase64Encoded': False
                }
            else:
                # Создаём новый токен
                insert_query = f"""
                    INSERT INTO {SCHEMA}.ios_push_tokens 
                    (user_id, device_token, device_name, device_model, os_version, app_version)
                    VALUES (
                        {escape_sql(int(user_id))},
                        {escape_sql(device_token)},
                        {escape_sql(device_name)},
                        {escape_sql(device_model)},
                        {escape_sql(os_version)},
                        {escape_sql(app_version)}
                    )
                    RETURNING id
                """
                cur.execute(insert_query)
                token_id = cur.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': True,
                        'tokenId': token_id,
                        'message': 'Token registered'
                    }),
                    'isBase64Encoded': False
                }
        
        # PUT - обновить статус токена (активировать/деактивировать)
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            token_id = body.get('tokenId')
            is_active = body.get('isActive', True)
            
            if not token_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Token ID required'}),
                    'isBase64Encoded': False
                }
            
            update_query = f"""
                UPDATE {SCHEMA}.ios_push_tokens
                SET is_active = {escape_sql(is_active)},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {escape_sql(int(token_id))}
                  AND user_id = {escape_sql(int(user_id))}
                RETURNING id
            """
            cur.execute(update_query)
            result = cur.fetchone()
            
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Token not found'}),
                    'isBase64Encoded': False
                }
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'message': 'Token status updated'
                }),
                'isBase64Encoded': False
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Method not allowed'}),
                'isBase64Encoded': False
            }
    
    except Exception as e:
        print(f'[IOS_PUSH_TOKENS] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()
