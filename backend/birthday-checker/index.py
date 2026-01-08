import json
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import requests

def handler(event: dict, context):
    '''Проверяет дни рождения клиентов и отправляет уведомления за N дней до даты'''
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database not configured'}),
            'isBase64Encoded': False
        }
    
    schema = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')
    
    conn = psycopg2.connect(dsn)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'check')
            user_id = event.get('headers', {}).get('X-User-Id')
            
            if action == 'check':
                if not user_id:
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'User ID required'}),
                        'isBase64Encoded': False
                    }
                
                today = datetime.now().date()
                upcoming_birthdays = []
                
                cur.execute(f'''
                    SELECT c.id, c.name, c.email, c.phone, c.birthdate, c.vk_username,
                           s.notification_days_before, s.greeting_message,
                           s.send_to_max, s.send_to_email, s.send_to_vk
                    FROM {schema}.clients c
                    LEFT JOIN {schema}.birthday_notification_settings s ON s.user_id = c.user_id
                    WHERE c.photographer_id = %s 
                      AND c.birthdate IS NOT NULL
                      AND (s.enabled IS NULL OR s.enabled = TRUE)
                ''', (user_id,))
                
                clients_with_birthdays = cur.fetchall()
                
                for client in clients_with_birthdays:
                    birthdate = client['birthdate']
                    if not birthdate:
                        continue
                    
                    days_before = client['notification_days_before'] or 10
                    
                    birthday_this_year = birthdate.replace(year=today.year)
                    
                    if birthday_this_year < today:
                        birthday_this_year = birthdate.replace(year=today.year + 1)
                    
                    days_until = (birthday_this_year - today).days
                    
                    if days_until == days_before:
                        cur.execute(f'''
                            SELECT id FROM {schema}.birthday_notifications_log
                            WHERE client_id = %s AND year = %s AND notification_type = 'birthday_reminder'
                        ''', (client['id'], today.year))
                        
                        if not cur.fetchone():
                            upcoming_birthdays.append({
                                'client_id': client['id'],
                                'name': client['name'],
                                'email': client['email'],
                                'phone': client['phone'],
                                'vk_username': client['vk_username'],
                                'birthdate': str(birthdate),
                                'days_until': days_until,
                                'greeting_message': client['greeting_message'] or 'Дорогой {name}, поздравляю тебя с Днём Рождения! Желаю здоровья, счастья и ярких моментов! С уважением, твой фотограф.',
                                'send_to_max': client['send_to_max'] if client['send_to_max'] is not None else True,
                                'send_to_email': client['send_to_email'] if client['send_to_email'] is not None else True,
                                'send_to_vk': client['send_to_vk'] if client['send_to_vk'] is not None else True
                            })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'upcoming_birthdays': upcoming_birthdays, 'count': len(upcoming_birthdays)}),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            user_id = event.get('headers', {}).get('X-User-Id')
            
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'User ID required'}),
                    'isBase64Encoded': False
                }
            
            if action == 'send_notifications':
                client_id = body.get('client_id')
                name = body.get('name')
                email = body.get('email')
                phone = body.get('phone')
                vk_username = body.get('vk_username')
                message = body.get('greeting_message', '').replace('{name}', name)
                send_to_max = body.get('send_to_max', True)
                send_to_email = body.get('send_to_email', True)
                send_to_vk = body.get('send_to_vk', True)
                
                results = {'max': None, 'email': None, 'vk': None}
                
                if send_to_max and phone:
                    try:
                        max_instance = os.environ.get('MAX_INSTANCE_ID')
                        max_token = os.environ.get('MAX_TOKEN')
                        
                        if max_instance and max_token:
                            response = requests.post(
                                f'https://api.green-api.com/waInstance{max_instance}/sendMessage/{max_token}',
                                json={
                                    'chatId': f'{phone.replace("+", "")}@c.us',
                                    'message': message
                                },
                                timeout=10
                            )
                            results['max'] = response.status_code == 200
                    except Exception as e:
                        results['max'] = False
                
                if send_to_email and email:
                    try:
                        postbox_key = os.environ.get('POSTBOX_ACCESS_KEY_ID')
                        postbox_secret = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
                        
                        if postbox_key and postbox_secret:
                            results['email'] = False
                    except Exception as e:
                        results['email'] = False
                
                if send_to_vk and vk_username:
                    try:
                        vk_token = os.environ.get('VK_SERVICE_TOKEN')
                        
                        if vk_token:
                            results['vk'] = False
                    except Exception as e:
                        results['vk'] = False
                
                cur.execute(f'''
                    INSERT INTO {schema}.birthday_notifications_log 
                    (client_id, notification_type, year, success)
                    VALUES (%s, %s, %s, %s)
                ''', (client_id, 'birthday_reminder', datetime.now().year, any(results.values())))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True, 'results': results}),
                    'isBase64Encoded': False
                }
            
            elif action == 'update_settings':
                notification_days_before = body.get('notification_days_before', 10)
                greeting_message = body.get('greeting_message', 'Дорогой {name}, поздравляю тебя с Днём Рождения! Желаю здоровья, счастья и ярких моментов! С уважением, твой фотограф.')
                send_to_max = body.get('send_to_max', True)
                send_to_email = body.get('send_to_email', True)
                send_to_vk = body.get('send_to_vk', True)
                enabled = body.get('enabled', True)
                
                cur.execute(f'''
                    INSERT INTO {schema}.birthday_notification_settings 
                    (user_id, notification_days_before, greeting_message, send_to_max, send_to_email, send_to_vk, enabled)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE SET
                        notification_days_before = EXCLUDED.notification_days_before,
                        greeting_message = EXCLUDED.greeting_message,
                        send_to_max = EXCLUDED.send_to_max,
                        send_to_email = EXCLUDED.send_to_email,
                        send_to_vk = EXCLUDED.send_to_vk,
                        enabled = EXCLUDED.enabled,
                        updated_at = CURRENT_TIMESTAMP
                ''', (user_id, notification_days_before, greeting_message, send_to_max, send_to_email, send_to_vk, enabled))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'get_settings':
                cur.execute(f'''
                    SELECT notification_days_before, greeting_message, send_to_max, send_to_email, send_to_vk, enabled
                    FROM {schema}.birthday_notification_settings
                    WHERE user_id = %s
                ''', (user_id,))
                
                settings = cur.fetchone()
                
                if not settings:
                    settings = {
                        'notification_days_before': 10,
                        'greeting_message': 'Дорогой {name}, поздравляю тебя с Днём Рождения! Желаю здоровья, счастья и ярких моментов! С уважением, твой фотограф.',
                        'send_to_max': True,
                        'send_to_email': True,
                        'send_to_vk': True,
                        'enabled': True
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(dict(settings)),
                    'isBase64Encoded': False
                }
        
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid action'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()
