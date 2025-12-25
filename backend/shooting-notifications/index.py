"""
API для отправки уведомлений о съёмках через MAX
Отправляет уведомления клиенту и фотографу при создании/изменении проекта
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import requests

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


def get_max_credentials():
    """Получить GREEN-API credentials из переменных окружения"""
    instance_id = os.environ.get('MAX_INSTANCE_ID', '')
    token = os.environ.get('MAX_TOKEN', '')
    return {
        'instance_id': instance_id,
        'token': token
    }


def send_via_green_api(instance_id: str, token: str, phone: str, message: str) -> dict:
    """Отправить сообщение через GREEN-API"""
    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"
    
    clean_phone = ''.join(filter(str.isdigit, phone))
    if not clean_phone.startswith('7'):
        clean_phone = '7' + clean_phone.lstrip('8')
    
    payload = {
        "chatId": f"{clean_phone}@c.us",
        "message": message
    }
    
    print(f'[SHOOTING_NOTIF] Sending to {clean_phone}@c.us')
    
    response = requests.post(url, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def format_date_ru(date_str: str) -> str:
    """Форматировать дату в русский формат (15 января 2025)"""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', ''))
        months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except:
        return date_str


def send_client_notification(project_data: dict, client_data: dict, photographer_data: dict) -> dict:
    """Отправить уведомление клиенту о съёмке"""
    creds = get_max_credentials()
    
    if not creds.get('instance_id') or not creds.get('token'):
        return {'error': 'MAX credentials not configured'}
    
    if not client_data.get('phone'):
        return {'error': 'Client phone not found'}
    
    # Формируем сообщение для клиента
    photographer_name = photographer_data.get('display_name') or photographer_data.get('email', 'Фотограф')
    photographer_phone = photographer_data.get('phone', 'не указан')
    
    date_str = format_date_ru(project_data.get('startDate', ''))
    time_str = project_data.get('shooting_time', '10:00')
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    
    message = f"""📸 Подтверждение съёмки

🎬 Проект: {project_name}
📅 Дата: {date_str}
🕐 Время: {time_str}
📍 Адрес: {address}

👤 Фотограф: {photographer_name}
📞 Телефон: {photographer_phone}

Если у вас есть вопросы или нужно перенести съёмку, свяжитесь с фотографом.

До встречи! 🎥"""
    
    try:
        result = send_via_green_api(
            creds['instance_id'],
            creds['token'],
            client_data['phone'],
            message
        )
        return {'success': True, 'message_id': result.get('idMessage')}
    except Exception as e:
        print(f'[SHOOTING_NOTIF] Error sending to client: {str(e)}')
        return {'error': str(e)}


def send_photographer_notification(project_data: dict, client_data: dict, photographer_data: dict) -> dict:
    """Отправить уведомление фотографу о съёмке"""
    creds = get_max_credentials()
    
    if not creds.get('instance_id') or not creds.get('token'):
        return {'error': 'MAX credentials not configured'}
    
    if not photographer_data.get('phone'):
        return {'error': 'Photographer phone not found'}
    
    # Формируем сообщение для фотографа
    client_name = client_data.get('name', 'Клиент')
    client_phone = client_data.get('phone', 'не указан')
    client_email = client_data.get('email', 'не указан')
    
    date_str = format_date_ru(project_data.get('startDate', ''))
    time_str = project_data.get('shooting_time', '10:00')
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    duration = project_data.get('shooting_duration', 2)
    
    message = f"""📸 Напоминание о съёмке

🎬 Проект: {project_name}
📅 Дата: {date_str}
🕐 Время: {time_str}
⏱ Длительность: {duration} ч
📍 Адрес: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}
📧 Email: {client_email}

Не забудьте проверить оборудование перед выездом! 📷"""
    
    try:
        result = send_via_green_api(
            creds['instance_id'],
            creds['token'],
            photographer_data['phone'],
            message
        )
        return {'success': True, 'message_id': result.get('idMessage')}
    except Exception as e:
        print(f'[SHOOTING_NOTIF] Error sending to photographer: {str(e)}')
        return {'error': str(e)}


def handler(event: dict, context) -> dict:
    """
    Отправка уведомлений о съёмках через MAX мессенджер
    """
    method = event.get('httpMethod', 'POST')
    
    # CORS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing X-User-Id header'})
        }
    
    try:
        body_str = event.get('body', '{}')
        if not body_str or body_str.strip() == '':
            body_str = '{}'
        body = json.loads(body_str)
        project_id = body.get('project_id')
        client_id = body.get('client_id')
        notify_client = body.get('notify_client', True)
        notify_photographer = body.get('notify_photographer', True)
        
        if not project_id or not client_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'project_id and client_id required'})
            }
        
        conn = get_db_connection()
        
        try:
            # Получаем данные проекта из clients API
            CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d'
            import urllib.request
            
            req = urllib.request.Request(
                f'{CLIENTS_API}?userId={user_id}',
                headers={'X-User-Id': user_id}
            )
            
            with urllib.request.urlopen(req) as response:
                clients_data = json.loads(response.read().decode())
            
            # Находим проект и клиента
            project_data = None
            client_data = None
            
            for client in clients_data:
                if client.get('id') == client_id:
                    client_data = client
                    for proj in client.get('projects', []):
                        if proj.get('id') == project_id:
                            project_data = proj
                            break
                    break
            
            if not project_data or not client_data:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Project or client not found'})
                }
            
            # Получаем данные фотографа
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT id, email, phone, display_name
                    FROM {SCHEMA}.users
                    WHERE id = {escape_sql(user_id)}
                """)
                photographer_row = cur.fetchone()
                
                if not photographer_row:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Photographer not found'})
                    }
                
                photographer_data = dict(photographer_row)
            
            results = {}
            
            # Отправляем уведомление клиенту
            if notify_client:
                client_result = send_client_notification(project_data, client_data, photographer_data)
                results['client_notification'] = client_result
            
            # Отправляем уведомление фотографу
            if notify_photographer:
                photographer_result = send_photographer_notification(project_data, client_data, photographer_data)
                results['photographer_notification'] = photographer_result
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'results': results
                })
            }
            
        finally:
            conn.close()
            
    except Exception as e:
        print(f'[SHOOTING_NOTIF] Error: {str(e)}')
        import traceback
        print(traceback.format_exc())
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }