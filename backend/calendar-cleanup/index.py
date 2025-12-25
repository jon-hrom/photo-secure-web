import json
import os
import psycopg2
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from datetime import datetime, timedelta


def handler(event: dict, context) -> dict:
    """Автоматическая очистка прошедших событий из Google Calendar"""
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
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
        dsn = os.environ.get('DATABASE_URL')
        if not dsn:
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'No database configured', 'cleaned': 0}),
                'isBase64Encoded': False
            }
        
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        # Находим проекты с прошедшей датой и google_event_id
        # Используем простой запрос без FROM alias
        cur.execute("""
            SELECT id, google_event_id, photographer_id, start_date
            FROM client_projects
            WHERE google_event_id IS NOT NULL 
            AND start_date < CURRENT_DATE
            AND status NOT IN ('completed', 'cancelled')
        """)
        
        past_projects = cur.fetchall()
        
        if not past_projects:
            cur.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'message': 'No past events to clean', 'cleaned': 0}),
                'isBase64Encoded': False
            }
        
        cleaned_count = 0
        errors = []
        
        for project_id, google_event_id, user_id, start_date in past_projects:
            try:
                # Получаем Google tokens фотографа
                cur.execute("""
                    SELECT google_access_token, google_refresh_token 
                    FROM users 
                    WHERE id = %s AND email LIKE '%%@gmail.com'
                """, (user_id,))
                
                user_tokens = cur.fetchone()
                
                if not user_tokens or not user_tokens[0]:
                    errors.append(f"Project {project_id}: user not authenticated")
                    continue
                
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
                
                # Обновляем статус проекта на completed и очищаем google_event_id
                cur.execute("""
                    UPDATE client_projects 
                    SET status = 'completed', google_event_id = NULL, synced_at = NULL
                    WHERE id = %s
                """, (project_id,))
                
                cleaned_count += 1
                
            except Exception as e:
                errors.append(f"Project {project_id}: {str(e)}")
                continue
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'cleaned': cleaned_count,
                'total': len(past_projects),
                'errors': errors
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