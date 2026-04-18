import json
import os
from datetime import datetime, timedelta, timezone as dt_timezone
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import re
import boto3
from botocore.exceptions import ClientError

REGION_TIMEZONE_OFFSET = {
    "Калининградская область": 2,
    "Москва": 3, "Московская область": 3,
    "Санкт-Петербург": 3, "Ленинградская область": 3,
    "Адыгея": 3, "Республика Адыгея": 3,
    "Архангельская область": 3, "Белгородская область": 3,
    "Брянская область": 3, "Владимирская область": 3,
    "Вологодская область": 3, "Воронежская область": 3,
    "Ивановская область": 3, "Калужская область": 3,
    "Карелия": 3, "Республика Карелия": 3,
    "Коми": 3, "Республика Коми": 3,
    "Костромская область": 3, "Краснодарский край": 3,
    "Курская область": 3, "Липецкая область": 3,
    "Марий Эл": 3, "Республика Марий Эл": 3,
    "Мордовия": 3, "Республика Мордовия": 3,
    "Мурманская область": 3, "Ненецкий автономный округ": 3,
    "Нижегородская область": 3, "Новгородская область": 3,
    "Орловская область": 3, "Пензенская область": 3,
    "Псковская область": 3, "Ростовская область": 3,
    "Рязанская область": 3, "Смоленская область": 3,
    "Тамбовская область": 3, "Тверская область": 3,
    "Тульская область": 3, "Ярославская область": 3,
    "Кабардино-Балкария": 3, "Кабардино-Балкарская Республика": 3,
    "Карачаево-Черкесия": 3, "Карачаево-Черкесская Республика": 3,
    "Северная Осетия": 3, "Республика Северная Осетия — Алания": 3,
    "Чечня": 3, "Чеченская Республика": 3,
    "Ингушетия": 3, "Республика Ингушетия": 3,
    "Дагестан": 3, "Республика Дагестан": 3,
    "Ставропольский край": 3,
    "Крым": 3, "Республика Крым": 3, "Севастополь": 3,
    "Волгоградская область": 3, "Кировская область": 3,
    "Татарстан": 3, "Республика Татарстан": 3,
    "Чувашия": 3, "Чувашская Республика": 3,
    "Астраханская область": 4, "Самарская область": 4,
    "Саратовская область": 4,
    "Удмуртия": 4, "Удмуртская Республика": 4,
    "Ульяновская область": 4,
    "Башкортостан": 5, "Республика Башкортостан": 5,
    "Курганская область": 5, "Оренбургская область": 5,
    "Пермский край": 5, "Свердловская область": 5,
    "Тюменская область": 5, "Челябинская область": 5,
    "Ханты-Мансийский автономный округ": 5,
    "Ямало-Ненецкий автономный округ": 5,
    "Алтайский край": 7, "Республика Алтай": 7,
    "Кемеровская область": 7, "Новосибирская область": 7,
    "Омская область": 6, "Томская область": 7,
    "Красноярский край": 7,
    "Тыва": 7, "Республика Тыва": 7,
    "Хакасия": 7, "Республика Хакасия": 7,
    "Иркутская область": 8,
    "Бурятия": 8, "Республика Бурятия": 8,
    "Забайкальский край": 9,
    "Амурская область": 9,
    "Саха (Якутия)": 9, "Республика Саха (Якутия)": 9,
    "Еврейская автономная область": 10,
    "Приморский край": 10, "Хабаровский край": 10,
    "Магаданская область": 11, "Сахалинская область": 11,
    "Камчатский край": 12, "Чукотский автономный округ": 12,
}


def get_today_for_region(region: str):
    offset = REGION_TIMEZONE_OFFSET.get(region, 3)
    tz = dt_timezone(timedelta(hours=offset))
    return datetime.now(tz).date()

def extract_vk_id(vk_profile: str) -> str:
    '''Извлекает VK ID или username из ссылки или @username'''
    if not vk_profile:
        return None
    
    vk_profile = vk_profile.strip()
    
    # Если начинается с @, убираем @
    if vk_profile.startswith('@'):
        return vk_profile[1:]
    
    # Если это ссылка vk.com/...
    match = re.search(r'vk\.com/([a-zA-Z0-9_]+)', vk_profile)
    if match:
        return match.group(1)
    
    # Иначе возвращаем как есть
    return vk_profile

def send_email_postbox(to_email: str, subject: str, html_body: str, from_name: str = 'FotoMix') -> bool:
    '''Отправить email через Yandex Cloud Postbox'''
    try:
        access_key_id = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        secret_access_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        
        if not access_key_id or not secret_access_key:
            print('Error: POSTBOX credentials not set')
            return False
        
        client = boto3.client(
            'sesv2',
            region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key
        )
        
        from_email = f'{from_name} <info@foto-mix.ru>'
        
        response = client.send_email(
            FromEmailAddress=from_email,
            Destination={'ToAddresses': [to_email]},
            Content={
                'Simple': {
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}}
                }
            }
        )
        
        print(f'Email sent to {to_email}. MessageId: {response.get("MessageId")}')
        return True
    except ClientError as e:
        print(f'ClientError: {e.response["Error"]["Code"]} - {e.response["Error"]["Message"]}')
        return False
    except Exception as e:
        print(f'Email error: {str(e)}')
        return False

def _run_cron_pass(conn, schema: str):
    '''Запуск daily-проверки всех пользователей (бывший birthday-cron).
    Итерируется по фотографам с включёнными уведомлениями, для каждого
    делает проверку ДР клиентов и отправляет уведомления без HTTP.'''
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(f'''
        SELECT DISTINCT u.id, u.email, u.region
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
            # Эмулируем GET ?action=check
            check_event = {
                'httpMethod': 'GET',
                'queryStringParameters': {'action': 'check'},
                'headers': {'X-User-Id': user_id},
            }
            check_response = handler(check_event, None)
            if check_response.get('statusCode') != 200:
                results.append({'user_id': user_id, 'status': 'check_failed',
                                'error': check_response.get('body', '')[:200]})
                continue

            data = json.loads(check_response.get('body', '{}'))
            upcoming = data.get('upcoming_birthdays', [])
            total_checked += 1

            for birthday in upcoming:
                try:
                    send_event = {
                        'httpMethod': 'POST',
                        'body': json.dumps({'action': 'send_notifications', **birthday}),
                        'headers': {'X-User-Id': user_id},
                    }
                    send_response = handler(send_event, None)
                    if send_response.get('statusCode') == 200:
                        total_sent += 1
                        results.append({'user_id': user_id,
                                        'client': birthday.get('name'),
                                        'status': 'sent'})
                    else:
                        results.append({'user_id': user_id,
                                        'client': birthday.get('name'),
                                        'status': 'failed',
                                        'error': send_response.get('body', '')[:200]})
                except Exception as e:
                    results.append({'user_id': user_id,
                                    'client': birthday.get('name'),
                                    'status': 'failed', 'error': str(e)})
        except Exception as e:
            results.append({'user_id': user_id, 'status': 'check_failed', 'error': str(e)})

    cur.close()
    return {
        'timestamp': datetime.now(dt_timezone.utc).isoformat(),
        'users_checked': total_checked,
        'notifications_sent': total_sent,
        'results': results,
    }


def handler(event: dict, context):
    '''Проверяет дни рождения клиентов и отправляет уведомления за N дней до даты.
    Поддерживает action=cron_run для ежедневной автоматической проверки всех пользователей
    (раньше был отдельной функцией birthday-cron, теперь объединено сюда).'''

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Cron-Token'
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

    # Обработка cron_run — без user_id, защита через CRON_TOKEN
    if method == 'POST':
        try:
            body_early = json.loads(event.get('body', '{}') or '{}')
        except Exception:
            body_early = {}
        if body_early.get('action') == 'cron_run':
            cron_token = os.environ.get('CRON_TOKEN', '')
            headers_in = event.get('headers', {}) or {}
            provided = headers_in.get('X-Cron-Token') or headers_in.get('x-cron-token') or ''
            if cron_token and provided != cron_token:
                return {
                    'statusCode': 401,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Unauthorized cron call'}),
                    'isBase64Encoded': False,
                }
            conn_cron = psycopg2.connect(dsn)
            try:
                summary = _run_cron_pass(conn_cron, schema)
                print(f'Birthday cron completed: {json.dumps(summary)[:500]}')
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(summary),
                    'isBase64Encoded': False,
                }
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': str(e)}),
                    'isBase64Encoded': False,
                }
            finally:
                conn_cron.close()

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
                
                cur.execute(f"SELECT region FROM {schema}.users WHERE id = %s", (user_id,))
                user_row = cur.fetchone()
                user_region = (user_row or {}).get('region', '') or ''
                today = get_today_for_region(user_region)
                upcoming_birthdays = []
                
                cur.execute(f'''
                    SELECT c.id, c.name, c.email, c.phone, c.birthdate, c.vk_profile,
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
                                'vk_profile': client['vk_profile'],
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
                vk_profile = body.get('vk_profile')
                message = body.get('greeting_message', '').replace('{name}', name)
                send_to_max = body.get('send_to_max', True)
                send_to_email = body.get('send_to_email', True)
                send_to_vk = body.get('send_to_vk', True)
                
                results = {'max': None, 'email': None, 'vk': None}
                
                # Отправка через MAX (WhatsApp)
                if send_to_max and phone:
                    try:
                        cur.execute(f'''
                            SELECT max_instance_id, max_token 
                            FROM {schema}.user_settings 
                            WHERE user_id = %s
                        ''', (user_id,))
                        max_settings = cur.fetchone()
                        
                        if max_settings and max_settings['max_instance_id'] and max_settings['max_token']:
                            response = requests.post(
                                f'https://api.green-api.com/waInstance{max_settings["max_instance_id"]}/sendMessage/{max_settings["max_token"]}',
                                json={
                                    'chatId': f'{phone.replace("+", "").replace(" ", "").replace("(", "").replace(")", "").replace("-", "")}@c.us',
                                    'message': message
                                },
                                timeout=10
                            )
                            results['max'] = response.status_code == 200
                    except Exception as e:
                        results['max'] = False
                
                # Отправка через Email (Postbox)
                if send_to_email and email:
                    try:
                        html_body = f'''
                        <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                                <h2 style="color: #4F46E5;">🎉 Поздравление с Днём Рождения!</h2>
                                <p style="font-size: 16px;">{message}</p>
                                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                                <p style="font-size: 14px; color: #6b7280;">
                                    С наилучшими пожеланиями,<br>
                                    Ваш фотограф
                                </p>
                            </div>
                        </body>
                        </html>
                        '''
                        results['email'] = send_email_postbox(email, '🎂 Поздравление с Днём Рождения!', html_body)
                    except Exception as e:
                        results['email'] = False
                
                # Отправка через VK
                if send_to_vk and vk_profile:
                    try:
                        vk_id = extract_vk_id(vk_profile)
                        
                        cur.execute(f'''
                            SELECT vk_user_token, vk_group_token, vk_group_id
                            FROM {schema}.vk_settings
                            WHERE user_id = %s
                        ''', (user_id,))
                        vk_settings = cur.fetchone()
                        
                        if vk_settings and (vk_settings['vk_user_token'] or vk_settings['vk_group_token']):
                            token = vk_settings['vk_user_token'] or vk_settings['vk_group_token']
                            
                            # Получаем user_id по screen_name
                            user_response = requests.get(
                                'https://api.vk.com/method/users.get',
                                params={
                                    'user_ids': vk_id,
                                    'access_token': token,
                                    'v': '5.131'
                                },
                                timeout=10
                            )
                            user_data = user_response.json()
                            
                            if 'response' in user_data and len(user_data['response']) > 0:
                                vk_user_id = user_data['response'][0]['id']
                                
                                # Отправляем сообщение
                                send_response = requests.post(
                                    'https://api.vk.com/method/messages.send',
                                    data={
                                        'user_id': vk_user_id,
                                        'message': message,
                                        'random_id': 0,
                                        'access_token': token,
                                        'v': '5.131'
                                    },
                                    timeout=10
                                )
                                send_data = send_response.json()
                                results['vk'] = 'response' in send_data
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
                    ON CONFLICT (user_id)
                    DO UPDATE SET
                        notification_days_before = EXCLUDED.notification_days_before,
                        greeting_message = EXCLUDED.greeting_message,
                        send_to_max = EXCLUDED.send_to_max,
                        send_to_email = EXCLUDED.send_to_email,
                        send_to_vk = EXCLUDED.send_to_vk,
                        enabled = EXCLUDED.enabled
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
                
                if settings:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps(dict(settings)),
                        'isBase64Encoded': False
                    }
                else:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({
                            'notification_days_before': 10,
                            'greeting_message': 'Дорогой {name}, поздравляю тебя с Днём Рождения! Желаю здоровья, счастья и ярких моментов! С уважением, твой фотограф.',
                            'send_to_max': True,
                            'send_to_email': True,
                            'send_to_vk': True,
                            'enabled': True
                        }),
                        'isBase64Encoded': False
                    }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
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