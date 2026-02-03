"""
Cron-задача для отправки автоматических напоминаний о съёмках
Проверяет предстоящие съёмки и отправляет напоминания:
- За 24 часа до съёмки
- За 5 часов до съёмки  
- За 1 час до съёмки
Запускается каждый час
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
    """Получить GREEN-API credentials"""
    return {
        'instance_id': os.environ.get('MAX_INSTANCE_ID', ''),
        'token': os.environ.get('MAX_TOKEN', '')
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
    
    response = requests.post(url, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def send_via_telegram(telegram_id: str, message: str) -> dict:
    """Отправить сообщение через Telegram"""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not bot_token:
        return {'error': 'Telegram bot token not configured'}
    
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {
            'chat_id': telegram_id,
            'text': message,
            'parse_mode': 'HTML',
            'disable_web_page_preview': True
        }
        response = requests.post(url, json=payload, timeout=10)
        result = response.json()
        
        if result.get('ok'):
            return {'success': True, 'message_id': result.get('result', {}).get('message_id')}
        else:
            return {'error': result.get('description', 'Unknown error')}
    except Exception as e:
        return {'error': str(e)}


def format_time(time_obj) -> str:
    """Форматировать время в HH:MM"""
    if not time_obj:
        return "не указано"
    time_str = str(time_obj)
    if ':' in time_str:
        parts = time_str.split(':')
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    return time_str


def send_reminder_24h(project: dict, client: dict, photographer: dict, creds: dict) -> dict:
    """Отправить напоминание за 24 часа"""
    time_str = format_time(project['shooting_time'])
    
    # Сообщение клиенту
    client_message = f"""⏰ Напоминание о завтрашней съёмке!

📸 Ваша фотосессия завтра!

🕐 Время: {time_str}
📍 Место: {project['shooting_address'] or 'не указано'}

👤 Фотограф: {photographer.get('display_name') or photographer.get('email', 'Фотограф')}
📞 Телефон: {photographer.get('phone', 'не указан')}

✨ Подготовьтесь заранее! До встречи завтра! 📷"""

    # Сообщение фотографу
    photographer_message = f"""⏰ Напоминание о завтрашней съёмке!

📸 У вас съёмка завтра!

🕐 Время: {time_str}
📍 Место: {project['shooting_address'] or 'не указано'}

👤 Клиент: {client['name']}
📞 Телефон: {client['phone'] or 'не указан'}

🎯 Проверьте оборудование заранее!"""

    results = {'client': {}, 'photographer': {}}
    
    # Отправляем клиенту
    if client.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], client['phone'], client_message)
            results['client']['whatsapp'] = True
        except Exception as e:
            results['client']['whatsapp_error'] = str(e)
    
    if client.get('telegram_id'):
        result = send_via_telegram(client['telegram_id'], client_message)
        results['client']['telegram'] = result.get('success', False)
    
    # Отправляем фотографу
    if photographer.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], photographer['phone'], photographer_message)
            results['photographer']['whatsapp'] = True
        except Exception as e:
            results['photographer']['whatsapp_error'] = str(e)
    
    if photographer.get('telegram_id'):
        result = send_via_telegram(photographer['telegram_id'], photographer_message)
        results['photographer']['telegram'] = result.get('success', False)
    
    return results


def send_reminder_5h(project: dict, client: dict, photographer: dict, creds: dict) -> dict:
    """Отправить напоминание за 5 часов"""
    time_str = format_time(project['shooting_time'])
    
    # Сообщение клиенту
    client_message = f"""⏰ Съёмка через 5 часов!

📸 Скоро начнётся ваша фотосессия!

🕐 Время: {time_str}
📍 Место: {project['shooting_address'] or 'не указано'}

👤 Фотограф: {photographer.get('display_name') or photographer.get('email', 'Фотограф')}
📞 Телефон: {photographer.get('phone', 'не указан')}

💡 Совет: выезжайте заранее с учётом пробок!
✨ Всё будет отлично! 📷"""

    # Сообщение фотографу
    photographer_message = f"""⏰ Съёмка через 5 часов!

📸 Съёмка скоро начнётся!

🕐 Время: {time_str}
📍 Место: {project['shooting_address'] or 'не указано'}

👤 Клиент: {client['name']}
📞 Телефон: {client['phone'] or 'не указан'}

📦 Проверьте:
✅ Флешки
✅ Аккумуляторы
✅ Объективы
✅ Освещение

🚗 Выезжайте с запасом времени!"""

    results = {'client': {}, 'photographer': {}}
    
    # Отправляем клиенту
    if client.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], client['phone'], client_message)
            results['client']['whatsapp'] = True
        except Exception as e:
            results['client']['whatsapp_error'] = str(e)
    
    if client.get('telegram_id'):
        result = send_via_telegram(client['telegram_id'], client_message)
        results['client']['telegram'] = result.get('success', False)
    
    # Отправляем фотографу
    if photographer.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], photographer['phone'], photographer_message)
            results['photographer']['whatsapp'] = True
        except Exception as e:
            results['photographer']['whatsapp_error'] = str(e)
    
    if photographer.get('telegram_id'):
        result = send_via_telegram(photographer['telegram_id'], photographer_message)
        results['photographer']['telegram'] = result.get('success', False)
    
    return results


def send_reminder_1h(project: dict, client: dict, photographer: dict, creds: dict) -> dict:
    """Отправить напоминание за 1 час"""
    time_str = format_time(project['shooting_time'])
    
    # Сообщение клиенту
    client_message = f"""⏰ Съёмка через 1 час!

📸 Ваша фотосессия начнётся совсем скоро!

🕐 Время: {time_str}
📍 Место: {project['shooting_address'] or 'не указано'}

👤 Фотограф: {photographer.get('display_name') or photographer.get('email', 'Фотограф')}
📞 Телефон: {photographer.get('phone', 'не указан')}

🎉 Ждём вас! Будет красиво! 📷"""

    # Сообщение фотографу
    photographer_message = f"""⏰ Съёмка через 1 час!

📸 Съёмка начнётся через час!

🕐 Время: {time_str}
📍 Место: {project['shooting_address'] or 'не указано'}

👤 Клиент: {client['name']}
📞 Телефон: {client['phone'] or 'не указан'}

🚀 В путь! Удачной съёмки!"""

    results = {'client': {}, 'photographer': {}}
    
    # Отправляем клиенту
    if client.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], client['phone'], client_message)
            results['client']['whatsapp'] = True
        except Exception as e:
            results['client']['whatsapp_error'] = str(e)
    
    if client.get('telegram_id'):
        result = send_via_telegram(client['telegram_id'], client_message)
        results['client']['telegram'] = result.get('success', False)
    
    # Отправляем фотографу
    if photographer.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], photographer['phone'], photographer_message)
            results['photographer']['whatsapp'] = True
        except Exception as e:
            results['photographer']['whatsapp_error'] = str(e)
    
    if photographer.get('telegram_id'):
        result = send_via_telegram(photographer['telegram_id'], photographer_message)
        results['photographer']['telegram'] = result.get('success', False)
    
    return results


def log_reminder(conn, project_id: int, reminder_type: str, sent_to: str, success: bool, error: str = None):
    """Записать отправку напоминания в лог"""
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.shooting_reminders_log 
                (project_id, reminder_type, sent_to, success, error_message, channel)
                VALUES ({escape_sql(project_id)}, {escape_sql(reminder_type)}, 
                        {escape_sql(sent_to)}, {escape_sql(success)}, 
                        {escape_sql(error)}, 'both')
                ON CONFLICT (project_id, reminder_type, sent_to) DO NOTHING
            """)
            conn.commit()
    except Exception as e:
        print(f"[LOG_ERROR] Failed to log reminder: {e}")


def handler(event: dict, context) -> dict:
    """
    Проверяет предстоящие съёмки и отправляет напоминания
    Запускается каждый час автоматически
    """
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    creds = get_max_credentials()
    
    if not creds['instance_id'] or not creds['token']:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'MAX credentials not configured'}),
            'isBase64Encoded': False
        }
    
    try:
        now = datetime.now()
        results = {
            '24h_reminders': [],
            '5h_reminders': [],
            '1h_reminders': []
        }
        
        with conn.cursor() as cur:
            # Находим все активные проекты с датой съёмки
            cur.execute(f"""
                SELECT 
                    cp.id as project_id,
                    cp.name as project_name,
                    cp.start_date,
                    cp.shooting_time,
                    cp.shooting_address,
                    c.id as client_id,
                    c.name as client_name,
                    c.phone as client_phone,
                    c.telegram_id as client_telegram_id,
                    u.id as photographer_id,
                    u.display_name as photographer_name,
                    u.email as photographer_email,
                    u.phone as photographer_phone,
                    u.telegram_id as photographer_telegram_id
                FROM {SCHEMA}.client_projects cp
                JOIN {SCHEMA}.clients c ON cp.client_id = c.id
                JOIN {SCHEMA}.users u ON c.photographer_id = u.id
                WHERE cp.start_date IS NOT NULL
                  AND cp.shooting_time IS NOT NULL
                  AND cp.status IN ('new', 'in_progress', 'scheduled')
                  AND cp.start_date >= CURRENT_DATE
                  AND cp.start_date <= CURRENT_DATE + INTERVAL '2 days'
            """)
            
            projects = cur.fetchall()
            
            for proj in projects:
                # Комбинируем дату и время съёмки
                shooting_date = proj['start_date']
                shooting_time = proj['shooting_time']
                
                # Создаём datetime объект
                shooting_datetime = datetime.combine(shooting_date, shooting_time)
                
                # Разница во времени
                time_diff = shooting_datetime - now
                hours_until = time_diff.total_seconds() / 3600
                
                project_data = dict(proj)
                client_data = {
                    'id': proj['client_id'],
                    'name': proj['client_name'],
                    'phone': proj['client_phone'],
                    'telegram_id': proj['client_telegram_id']
                }
                photographer_data = {
                    'id': proj['photographer_id'],
                    'display_name': proj['photographer_name'],
                    'email': proj['photographer_email'],
                    'phone': proj['photographer_phone'],
                    'telegram_id': proj['photographer_telegram_id']
                }
                
                # Проверяем, нужно ли отправить напоминание за 24 часа
                if 23 <= hours_until < 25:
                    # Проверяем, не отправляли ли уже
                    cur.execute(f"""
                        SELECT 1 FROM {SCHEMA}.shooting_reminders_log
                        WHERE project_id = {escape_sql(proj['project_id'])}
                          AND reminder_type = '24h'
                    """)
                    if not cur.fetchone():
                        try:
                            result = send_reminder_24h(project_data, client_data, photographer_data, creds)
                            log_reminder(conn, proj['project_id'], '24h', 'both', True)
                            results['24h_reminders'].append({
                                'project_id': proj['project_id'],
                                'project_name': proj['project_name'],
                                'result': result
                            })
                            print(f"[24H] Sent reminder for project {proj['project_id']}")
                        except Exception as e:
                            log_reminder(conn, proj['project_id'], '24h', 'both', False, str(e))
                            print(f"[24H_ERROR] {proj['project_id']}: {e}")
                
                # Проверяем напоминание за 5 часов
                elif 4.5 <= hours_until < 5.5:
                    cur.execute(f"""
                        SELECT 1 FROM {SCHEMA}.shooting_reminders_log
                        WHERE project_id = {escape_sql(proj['project_id'])}
                          AND reminder_type = '5h'
                    """)
                    if not cur.fetchone():
                        try:
                            result = send_reminder_5h(project_data, client_data, photographer_data, creds)
                            log_reminder(conn, proj['project_id'], '5h', 'both', True)
                            results['5h_reminders'].append({
                                'project_id': proj['project_id'],
                                'project_name': proj['project_name'],
                                'result': result
                            })
                            print(f"[5H] Sent reminder for project {proj['project_id']}")
                        except Exception as e:
                            log_reminder(conn, proj['project_id'], '5h', 'both', False, str(e))
                            print(f"[5H_ERROR] {proj['project_id']}: {e}")
                
                # Проверяем напоминание за 1 час
                elif 0.5 <= hours_until < 1.5:
                    cur.execute(f"""
                        SELECT 1 FROM {SCHEMA}.shooting_reminders_log
                        WHERE project_id = {escape_sql(proj['project_id'])}
                          AND reminder_type = '1h'
                    """)
                    if not cur.fetchone():
                        try:
                            result = send_reminder_1h(project_data, client_data, photographer_data, creds)
                            log_reminder(conn, proj['project_id'], '1h', 'both', True)
                            results['1h_reminders'].append({
                                'project_id': proj['project_id'],
                                'project_name': proj['project_name'],
                                'result': result
                            })
                            print(f"[1H] Sent reminder for project {proj['project_id']}")
                        except Exception as e:
                            log_reminder(conn, proj['project_id'], '1h', 'both', False, str(e))
                            print(f"[1H_ERROR] {proj['project_id']}: {e}")
        
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'timestamp': now.isoformat(),
                'reminders_sent': results
            }),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        print(f"[CRON_ERROR] {str(e)}")
        import traceback
        print(traceback.format_exc())
        
        if conn:
            conn.close()
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }