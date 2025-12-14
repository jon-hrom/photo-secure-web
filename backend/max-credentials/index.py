import json
import os
import psycopg2
from typing import Dict, Any
import requests

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Управление GREEN-API credentials для MAX мессенджера
    Фотограф подключает свой личный MAX аккаунт через GREEN-API
    Админ может видеть список подключённых фотографов
    '''
    method = event.get('httpMethod', 'GET')
    
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
    
    headers = event.get('headers', {})
    user_id = headers.get('x-user-id') or headers.get('X-User-Id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Требуется авторизация'}),
            'isBase64Encoded': False
        }
    
    try:
        conn = get_db_connection()
        
        if method == 'GET':
            # Получить свои credentials или список всех (для админа)
            result = get_credentials(conn, user_id)
        
        elif method == 'POST':
            # Подключить MAX (сохранить credentials)
            body = json.loads(event.get('body', '{}'))
            result = connect_max(conn, user_id, body)
        
        elif method == 'PUT':
            # Обновить credentials
            body = json.loads(event.get('body', '{}'))
            result = update_credentials(conn, user_id, body)
        
        elif method == 'DELETE':
            # Отключить MAX
            result = disconnect_max(conn, user_id)
        
        else:
            conn.close()
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Метод не поддерживается'}),
                'isBase64Encoded': False
            }
        
        conn.close()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(result, default=str),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        print(f"[MAX Credentials] Error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL не настроен')
    return psycopg2.connect(database_url)

def dict_from_row(cursor, row):
    if not row:
        return None
    return dict(zip([desc[0] for desc in cursor.description], row))

def get_credentials(conn, user_id: str) -> Dict[str, Any]:
    """Получить credentials текущего пользователя или всех (для админа)"""
    with conn.cursor() as cur:
        # Проверяем роль пользователя
        cur.execute(f"SELECT role FROM users WHERE id = {user_id}")
        row = cur.fetchone()
        user = dict_from_row(cur, row) if row else None
        is_admin = user and user.get('role') == 'admin'
        
        if is_admin:
            # Админ видит всех подключённых пользователей
            cur.execute("""
                SELECT 
                    id,
                    full_name,
                    phone,
                    max_phone,
                    max_connected,
                    max_connected_at,
                    green_api_instance_id
                FROM users
                WHERE max_connected = TRUE
                ORDER BY max_connected_at DESC
            """)
            rows = cur.fetchall()
            users = [dict_from_row(cur, row) for row in rows]
            return {
                'is_admin': True,
                'connected_users': users,
                'total': len(users)
            }
        else:
            # Обычный пользователь видит только свои данные
            cur.execute(f"""
                SELECT 
                    id,
                    green_api_instance_id,
                    green_api_token,
                    max_phone,
                    max_connected,
                    max_connected_at
                FROM users
                WHERE id = {user_id}
            """)
            row = cur.fetchone()
            user_data = dict_from_row(cur, row) if row else {}
            
            # Не отдаём полный токен в ответе (безопасность)
            if user_data.get('green_api_token'):
                token = user_data['green_api_token']
                user_data['green_api_token_masked'] = token[:10] + '...' + token[-4:] if len(token) > 14 else '***'
                del user_data['green_api_token']
            
            return {
                'is_admin': False,
                'user': user_data
            }

def connect_max(conn, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Подключить MAX через GREEN-API"""
    print(f"[MAX Credentials] connect_max called for user_id={user_id}, body={body}")
    
    instance_id = body.get('instance_id', '').strip()
    token = body.get('token', '').strip()
    
    print(f"[MAX Credentials] Extracted: instance_id={instance_id[:5]}..., token_len={len(token)}")
    
    if not instance_id or not token:
        print(f"[MAX Credentials] Missing credentials")
        return {'error': 'Требуется instance_id и token'}
    
    # Проверяем credentials через GREEN-API
    try:
        print(f"[MAX Credentials] Verifying credentials via GREEN-API...")
        validation = verify_green_api_credentials(instance_id, token)
        print(f"[MAX Credentials] Validation result: {validation}")
        
        if not validation['valid']:
            print(f"[MAX Credentials] Validation failed: {validation.get('error')}")
            return {
                'error': 'Не удалось подключиться к GREEN-API',
                'details': validation.get('error', 'Неверные credentials')
            }
        
        max_phone = validation.get('phone', '')
        print(f"[MAX Credentials] Validation success! phone={max_phone}")
        
    except Exception as e:
        print(f"[MAX Credentials] Exception during verification: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'error': 'Ошибка проверки GREEN-API',
            'details': str(e)
        }
    
    # Сохраняем в БД
    with conn.cursor() as cur:
        print(f"[MAX Credentials] Saving to DB...")
        cur.execute(f"""
            UPDATE users 
            SET 
                green_api_instance_id = '{instance_id}',
                green_api_token = '{token}',
                max_phone = '{max_phone}',
                max_connected = TRUE,
                max_connected_at = NOW()
            WHERE id = {user_id}
            RETURNING id, full_name, max_phone, max_connected_at
        """)
        
        row = cur.fetchone()
        result = dict_from_row(cur, row) if row else None
        print(f"[MAX Credentials] DB update result: {result}")
        
        conn.commit()
        print(f"[MAX Credentials] Committed successfully!")
        
        return {
            'success': True,
            'message': 'MAX успешно подключён',
            'user': result
        }

def update_credentials(conn, user_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """Обновить credentials"""
    instance_id = body.get('instance_id', '').strip()
    token = body.get('token', '').strip()
    
    if not instance_id or not token:
        return {'error': 'Требуется instance_id и token'}
    
    # Проверяем новые credentials
    try:
        validation = verify_green_api_credentials(instance_id, token)
        if not validation['valid']:
            return {
                'error': 'Не удалось подключиться к GREEN-API',
                'details': validation.get('error', 'Неверные credentials')
            }
        
        max_phone = validation.get('phone', '')
        
    except Exception as e:
        return {
            'error': 'Ошибка проверки GREEN-API',
            'details': str(e)
        }
    
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE users 
            SET 
                green_api_instance_id = '{instance_id}',
                green_api_token = '{token}',
                max_phone = '{max_phone}',
                max_connected = TRUE,
                max_connected_at = NOW()
            WHERE id = {user_id}
            RETURNING id, full_name, max_phone
        """)
        
        row = cur.fetchone()
        result = dict_from_row(cur, row) if row else None
        conn.commit()
        
        return {
            'success': True,
            'message': 'Credentials обновлены',
            'user': result
        }

def disconnect_max(conn, user_id: str) -> Dict[str, Any]:
    """Отключить MAX"""
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE users 
            SET 
                green_api_instance_id = NULL,
                green_api_token = NULL,
                max_phone = NULL,
                max_connected = FALSE,
                max_connected_at = NULL
            WHERE id = {user_id}
            RETURNING id, full_name
        """)
        
        row = cur.fetchone()
        result = dict_from_row(cur, row) if row else None
        conn.commit()
        
        return {
            'success': True,
            'message': 'MAX отключён',
            'user': result
        }

def verify_green_api_credentials(instance_id: str, token: str) -> Dict[str, Any]:
    """Проверка credentials через GREEN-API getSettings"""
    try:
        url = f"https://api.green-api.com/waInstance{instance_id}/getSettings/{token}"
        print(f"[MAX Credentials] Calling GREEN-API: {url[:80]}...")
        
        response = requests.get(url, timeout=10)
        print(f"[MAX Credentials] GREEN-API response: status={response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"[MAX Credentials] GREEN-API data: {data}")
            # Успешный ответ - credentials валидны
            phone_number = data.get('wid', '').replace('@c.us', '')
            return {
                'valid': True,
                'phone': phone_number,
                'state': data.get('stateInstance', 'unknown')
            }
        elif response.status_code == 401:
            print(f"[MAX Credentials] GREEN-API 401: Unauthorized")
            return {
                'valid': False,
                'error': 'Неверный instance_id или token'
            }
        else:
            error_text = response.text[:200]
            print(f"[MAX Credentials] GREEN-API error: {response.status_code}, body={error_text}")
            return {
                'valid': False,
                'error': f'Ошибка GREEN-API: {response.status_code} - {error_text}'
            }
    
    except requests.exceptions.Timeout:
        print(f"[MAX Credentials] GREEN-API timeout")
        return {
            'valid': False,
            'error': 'Превышено время ожидания ответа от GREEN-API'
        }
    except Exception as e:
        print(f"[MAX Credentials] GREEN-API exception: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return {
            'valid': False,
            'error': f'Ошибка проверки: {str(e)}'
        }