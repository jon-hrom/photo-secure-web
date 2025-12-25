import json
import os
import psycopg2
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta


def handler(event: dict, context) -> dict:
    """Синхронизация проектов с Google Calendar фотографа"""
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
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
        body_str = event.get('body', '{}')
        if not body_str or body_str.strip() == '':
            body_str = '{}'
        body = json.loads(body_str)
        project_id = body.get('project_id')
        user_id = event.get('headers', {}).get('x-user-id')
        
        if not project_id or not user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'project_id and user_id required'}),
                'isBase64Encoded': False
            }
        
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        # Получаем данные проекта
        cur.execute("""
            SELECT cp.name, cp.description, cp.start_date, cp.shooting_time, 
                   cp.shooting_duration, cp.shooting_address, cp.add_to_calendar,
                   c.name as client_name, c.phone as client_phone
            FROM client_projects cp
            JOIN clients c ON cp.client_id = c.id
            WHERE cp.id = %s AND cp.photographer_id = %s
        """, (project_id, user_id))
        
        project = cur.fetchone()
        
        if not project:
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Project not found'}),
                'isBase64Encoded': False
            }
        
        name, desc, start_date, shoot_time, duration, address, add_cal, client_name, client_phone = project
        
        if not add_cal:
            cur.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Calendar sync not requested'}),
                'isBase64Encoded': False
            }
        
        # Получаем Google tokens фотографа
        cur.execute("""
            SELECT google_access_token, google_refresh_token 
            FROM users 
            WHERE id = %s AND email LIKE '%@gmail.com'
        """, (user_id,))
        
        user_tokens = cur.fetchone()
        
        if not user_tokens or not user_tokens[0]:
            cur.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'User not authenticated with Google'}),
                'isBase64Encoded': False
            }
        
        access_token, refresh_token = user_tokens
        
        # Создаём credentials
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=os.environ.get('GOOGLE_CLIENT_ID'),
            client_secret=os.environ.get('GOOGLE_CLIENT_SECRET')
        )
        
        # Формируем datetime события
        if shoot_time:
            start_datetime = datetime.strptime(f"{start_date} {shoot_time}", "%Y-%m-%d %H:%M")
        else:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            start_datetime = start_datetime.replace(hour=10, minute=0)
        
        end_datetime = start_datetime + timedelta(hours=duration or 2)
        
        # Создаём событие в календаре
        service = build('calendar', 'v3', credentials=credentials)
        
        event_body = {
            'summary': f'📸 {name} - {client_name}',
            'location': address or '',
            'description': f"""
Клиент: {client_name}
Телефон: {client_phone or 'не указан'}
Описание: {desc or 'не указано'}
""".strip(),
            'start': {
                'dateTime': start_datetime.isoformat(),
                'timeZone': 'Europe/Moscow',
            },
            'end': {
                'dateTime': end_datetime.isoformat(),
                'timeZone': 'Europe/Moscow',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': 60},
                    {'method': 'popup', 'minutes': 1440},
                ],
            },
        }
        
        created_event = service.events().insert(calendarId='primary', body=event_body).execute()
        
        # Сохраняем event_id в БД
        cur.execute("""
            UPDATE client_projects 
            SET google_event_id = %s, synced_at = NOW()
            WHERE id = %s
        """, (created_event['id'], project_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'event_id': created_event['id'],
                'event_link': created_event.get('htmlLink')
            }),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }