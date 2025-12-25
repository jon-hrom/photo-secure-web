"""
Синхронизация съёмок клиента с Google Calendar через API
"""

import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

DATABASE_URL = os.environ.get('DATABASE_URL', '')

import psycopg2
from psycopg2.extras import RealDictCursor
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


def get_google_access_token(user_id: str) -> Optional[str]:
    """Получение access_token пользователя из БД"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT access_token, refresh_token, token_expires_at
                FROM {SCHEMA}.google_users
                WHERE user_id = {escape_sql(user_id)}
            """)
            result = cur.fetchone()
            if not result:
                return None
            
            # Проверяем, не истёк ли токен
            if result['token_expires_at'] and datetime.fromisoformat(result['token_expires_at']) < datetime.now():
                # Токен истёк, нужно обновить через refresh_token
                # TODO: реализовать обновление токена
                return None
            
            return result['access_token']
    finally:
        conn.close()


def create_calendar_event(access_token: str, client_data: Dict[str, Any]) -> Optional[str]:
    """Создание события в Google Calendar"""
    # Формируем дату и время начала
    shooting_datetime = f"{client_data['shooting_date']}T{client_data.get('shooting_time', '10:00:00')}"
    
    # Рассчитываем время окончания (дата + длительность)
    start_dt = datetime.fromisoformat(shooting_datetime)
    duration_hours = client_data.get('shooting_duration', 2)
    end_dt = start_dt + timedelta(hours=duration_hours)
    
    event = {
        'summary': f"📸 Съёмка: {client_data['name']}",
        'description': f"""Клиент: {client_data['name']}
Телефон: {client_data['phone']}
Email: {client_data.get('email', 'Не указан')}
Стоимость: {client_data.get('project_price', 0):,.0f} ₽

{client_data.get('project_comments', '')}
""",
        'location': client_data.get('shooting_address', ''),
        'start': {
            'dateTime': start_dt.isoformat(),
            'timeZone': 'Europe/Moscow',
        },
        'end': {
            'dateTime': end_dt.isoformat(),
            'timeZone': 'Europe/Moscow',
        },
        'reminders': {
            'useDefault': False,
            'overrides': [
                {'method': 'popup', 'minutes': 24 * 60},  # За день
                {'method': 'popup', 'minutes': 60},       # За час
            ],
        },
        'colorId': '10',  # Зелёный цвет
    }
    
    # Отправляем запрос в Google Calendar API
    url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
    }
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(event).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result.get('id')
    except urllib.error.HTTPError as e:
        print(f"[ERROR] Google Calendar API error: {e.code} {e.reason}")
        print(f"[ERROR] Response: {e.read().decode('utf-8')}")
        return None


def update_calendar_event(access_token: str, event_id: str, client_data: Dict[str, Any]) -> bool:
    """Обновление существующего события в Google Calendar"""
    shooting_datetime = f"{client_data['shooting_date']}T{client_data.get('shooting_time', '10:00:00')}"
    start_dt = datetime.fromisoformat(shooting_datetime)
    duration_hours = client_data.get('shooting_duration', 2)
    end_dt = start_dt + timedelta(hours=duration_hours)
    
    # Сначала получаем текущее событие
    url = f'https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}'
    headers = {
        'Authorization': f'Bearer {access_token}',
    }
    
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as response:
            event = json.loads(response.read().decode('utf-8'))
        
        # Обновляем поля
        event['summary'] = f"📸 Съёмка: {client_data['name']}"
        event['description'] = f"""Клиент: {client_data['name']}
Телефон: {client_data['phone']}
Email: {client_data.get('email', 'Не указан')}
Стоимость: {client_data.get('project_price', 0):,.0f} ₽

{client_data.get('project_comments', '')}
"""
        event['location'] = client_data.get('shooting_address', '')
        event['start'] = {
            'dateTime': start_dt.isoformat(),
            'timeZone': 'Europe/Moscow',
        }
        event['end'] = {
            'dateTime': end_dt.isoformat(),
            'timeZone': 'Europe/Moscow',
        }
        
        # Отправляем обновление
        req = urllib.request.Request(
            url,
            data=json.dumps(event).encode('utf-8'),
            headers={**headers, 'Content-Type': 'application/json'},
            method='PUT'
        )
        
        with urllib.request.urlopen(req) as response:
            return response.status == 200
    except urllib.error.HTTPError as e:
        print(f"[ERROR] Update event error: {e.code} {e.reason}")
        return False


def delete_calendar_event(access_token: str, event_id: str) -> bool:
    """Удаление события из Google Calendar"""
    url = f'https://www.googleapis.com/calendar/v3/calendars/primary/events/{event_id}'
    headers = {
        'Authorization': f'Bearer {access_token}',
    }
    
    try:
        req = urllib.request.Request(url, headers=headers, method='DELETE')
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        print(f"[ERROR] Delete event error: {e.code} {e.reason}")
        return False


def update_client_sync_status(client_id: int, google_event_id: Optional[str]) -> None:
    """Обновление статуса синхронизации в БД"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE {SCHEMA}.clients
                SET google_event_id = {escape_sql(google_event_id)},
                    synced_at = CURRENT_TIMESTAMP
                WHERE id = {client_id}
            """)
        conn.commit()
    finally:
        conn.close()


def handler(event, context):
    """
    Обработчик запросов синхронизации с Google Calendar
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
            'body': ''
        }
    
    user_id = event.get('headers', {}).get('X-User-Id')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing X-User-Id header'})
        }
    
    # Получаем access_token
    access_token = get_google_access_token(user_id)
    if not access_token:
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Google Calendar not connected'})
        }
    
    if method == 'POST':
        # Создание события
        body = json.loads(event.get('body', '{}'))
        client_id = body.get('client_id')
        client_data = body.get('client_data')
        
        if not client_id or not client_data:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing client_id or client_data'})
            }
        
        # Создаём событие
        google_event_id = create_calendar_event(access_token, client_data)
        
        if google_event_id:
            # Обновляем статус в БД
            update_client_sync_status(client_id, google_event_id)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'google_event_id': google_event_id,
                    'message': 'Event created successfully'
                })
            }
        else:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Failed to create event'})
            }
    
    elif method == 'PUT':
        # Обновление события
        body = json.loads(event.get('body', '{}'))
        client_id = body.get('client_id')
        google_event_id = body.get('google_event_id')
        client_data = body.get('client_data')
        
        if not all([client_id, google_event_id, client_data]):
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing required fields'})
            }
        
        success = update_calendar_event(access_token, google_event_id, client_data)
        
        if success:
            update_client_sync_status(client_id, google_event_id)
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'message': 'Event updated successfully'})
            }
        else:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Failed to update event'})
            }
    
    elif method == 'DELETE':
        # Удаление события
        query_params = event.get('queryStringParameters', {})
        google_event_id = query_params.get('event_id')
        client_id = query_params.get('client_id')
        
        if not google_event_id or not client_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing event_id or client_id'})
            }
        
        success = delete_calendar_event(access_token, google_event_id)
        
        if success:
            update_client_sync_status(int(client_id), None)
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'message': 'Event deleted successfully'})
            }
        else:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Failed to delete event'})
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }