import json
import os
import psycopg2
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta
import urllib.request


def delete_calendar_event(user_id: str, google_event_id: str) -> dict:
    """Удаление события из Google Calendar"""
    try:
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        # Получаем Google tokens фотографа
        cur.execute("""
            SELECT google_access_token, google_refresh_token 
            FROM users 
            WHERE id = %s AND email LIKE '%%@gmail.com'
        """, (user_id,))
        
        user_tokens = cur.fetchone()
        cur.close()
        conn.close()
        
        if not user_tokens or not user_tokens[0]:
            return {'success': False, 'error': 'User not authenticated with Google'}
        
        access_token, refresh_token = user_tokens
        
        credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=os.environ.get('GOOGLE_CLIENT_ID'),
            client_secret=os.environ.get('GOOGLE_CLIENT_SECRET')
        )
        
        service = build('calendar', 'v3', credentials=credentials)
        service.events().delete(calendarId='primary', eventId=google_event_id).execute()
        
        return {'success': True}
    except Exception as e:
        return {'success': False, 'error': str(e)}


def handler(event: dict, context) -> dict:
    """Синхронизация проектов с Google Calendar фотографа"""
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'DELETE':
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
            
            # Получаем google_event_id проекта
            cur.execute("""
                SELECT google_event_id FROM client_projects 
                WHERE id = %s AND photographer_id = %s AND google_event_id IS NOT NULL
            """, (project_id, user_id))
            
            result = cur.fetchone()
            
            if not result:
                cur.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Calendar event not found'}),
                    'isBase64Encoded': False
                }
            
            google_event_id = result[0]
            
            # Удаляем из Google Calendar
            delete_result = delete_calendar_event(user_id, google_event_id)
            
            if delete_result['success']:
                # Очищаем google_event_id в БД
                cur.execute("""
                    UPDATE client_projects 
                    SET google_event_id = NULL, synced_at = NULL
                    WHERE id = %s
                """, (project_id,))
                conn.commit()
                
                cur.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True, 'message': 'Event deleted from calendar'}),
                    'isBase64Encoded': False
                }
            else:
                cur.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': delete_result.get('error', 'Unknown error')}),
                    'isBase64Encoded': False
                }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': str(e)}),
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
        
        print(f'[CALENDAR-SYNC] Received project_id={project_id}, user_id={user_id}')
        
        if not project_id or not user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'project_id and user_id required'}),
                'isBase64Encoded': False
            }
        
        # Получаем данные из clients API
        CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d'
        req = urllib.request.Request(
            f'{CLIENTS_API}?userId={user_id}',
            headers={'X-User-Id': user_id}
        )
        with urllib.request.urlopen(req) as response:
            clients_data = json.loads(response.read().decode())
        
        print(f'[CALENDAR-SYNC] Loaded {len(clients_data)} clients')
        
        # Находим проект
        project_data = None
        client_data = None
        for client in clients_data:
            for proj in client.get('projects', []):
                if proj.get('id') == project_id:
                    project_data = proj
                    client_data = client
                    break
            if project_data:
                break
        
        if not project_data:
            print(f'[CALENDAR-SYNC] Project {project_id} not found')
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Project not found'}),
                'isBase64Encoded': False
            }
        
        print(f'[CALENDAR-SYNC] Found project: {project_data.get("name")}')
        
        name = project_data.get('name')
        desc = project_data.get('description', '')
        start_date = project_data.get('startDate')
        shoot_time = project_data.get('shooting_time', '10:00')
        duration = project_data.get('shooting_duration', 2)
        address = project_data.get('shooting_address', '')
        add_cal = project_data.get('add_to_calendar', False)
        
        client_name = client_data.get('name', '')
        client_phone = client_data.get('phone', '')
        client_email = client_data.get('email', '')
        
        if not add_cal:
            print('[CALENDAR-SYNC] add_to_calendar is False, skipping')
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'Calendar sync not requested'}),
                'isBase64Encoded': False
            }
        
        # Получаем Google tokens фотографа из БД
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT google_access_token, google_refresh_token 
            FROM users 
            WHERE id = %s AND email LIKE '%@gmail.com'
        """, (user_id,))
        
        user_tokens = cur.fetchone()
        
        if not user_tokens or not user_tokens[0]:
            print('[CALENDAR-SYNC] User not authenticated with Google')
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
Email: {client_email or 'не указан'}
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
        
        # Добавляем клиента как участника события
        if client_email and '@' in client_email:
            event_body['attendees'] = [
                {'email': client_email, 'responseStatus': 'needsAction'}
            ]
        
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