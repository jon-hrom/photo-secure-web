import json
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import requests

def handler(event: dict, context):
    '''Автоматическая проверка дней рождения и отправка уведомлений (запускается ежедневно)'''
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Database not configured'}),
            'isBase64Encoded': False
        }
    
    schema = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')
    birthday_checker_url = 'https://functions.poehali.dev/e8f71ffe-1b27-4576-b601-7f01793bd5e2'
    
    conn = psycopg2.connect(dsn)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Получаем всех пользователей с включенными уведомлениями о днях рождения
        cur.execute(f'''
            SELECT DISTINCT u.id, u.email
            FROM {schema}.users u
            INNER JOIN {schema}.birthday_notification_settings bns ON bns.user_id = u.id::text
            WHERE bns.enabled = TRUE
        ''')
        
        users = cur.fetchall()
        
        total_checked = 0
        total_sent = 0
        results = []
        
        for user in users:
            user_id = str(user['id'])
            
            try:
                # Проверяем дни рождения для этого пользователя
                check_response = requests.get(
                    birthday_checker_url,
                    params={'action': 'check'},
                    headers={'X-User-Id': user_id},
                    timeout=30
                )
                
                if check_response.status_code == 200:
                    data = check_response.json()
                    upcoming_birthdays = data.get('upcoming_birthdays', [])
                    total_checked += 1
                    
                    # Отправляем уведомления для каждого клиента
                    for birthday in upcoming_birthdays:
                        try:
                            send_response = requests.post(
                                birthday_checker_url,
                                json={
                                    'action': 'send_notifications',
                                    **birthday
                                },
                                headers={'X-User-Id': user_id},
                                timeout=30
                            )
                            
                            if send_response.status_code == 200:
                                total_sent += 1
                                results.append({
                                    'user_id': user_id,
                                    'client': birthday['name'],
                                    'status': 'sent'
                                })
                        except Exception as e:
                            results.append({
                                'user_id': user_id,
                                'client': birthday['name'],
                                'status': 'failed',
                                'error': str(e)
                            })
            
            except Exception as e:
                results.append({
                    'user_id': user_id,
                    'status': 'check_failed',
                    'error': str(e)
                })
        
        summary = {
            'timestamp': datetime.now().isoformat(),
            'users_checked': total_checked,
            'notifications_sent': total_sent,
            'results': results
        }
        
        print(f'Birthday cron completed: {json.dumps(summary)}')
        
        return {
            'statusCode': 200,
            'body': json.dumps(summary),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()
