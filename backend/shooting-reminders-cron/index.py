"""
Крон-задача для отправки напоминаний о съёмках за 24 часа и за 1 час
Запускается каждый час автоматически
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import requests
import urllib.request

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'
CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d'


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
    
    response = requests.post(url, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def format_date_ru(date_str: str) -> str:
    """Форматировать дату в русский формат"""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', ''))
        months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except:
        return date_str


def send_photographer_reminder(photographer_phone: str, photographer_name: str, project_data: dict, client_data: dict, hours_before: int) -> bool:
    """Отправить напоминание фотографу"""
    creds = get_max_credentials()
    
    if not creds.get('instance_id') or not creds.get('token'):
        print('[REMINDER] MAX credentials not configured')
        return False
    
    if not photographer_phone:
        print('[REMINDER] Photographer phone not found')
        return False
    
    client_name = client_data.get('name', 'Клиент')
    client_phone = client_data.get('phone', 'не указан')
    
    date_str = format_date_ru(project_data.get('startDate', ''))
    time_str = project_data.get('shooting_time', '10:00')
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    
    if hours_before == 24:
        emoji = '📅'
        time_text = 'завтра'
    else:
        emoji = '⏰'
        time_text = 'через час'
    
    message = f"""{emoji} Напоминание о съёмке {time_text}!

🎬 Проект: {project_name}
📅 Дата: {date_str}
🕐 Время: {time_str}
📍 Адрес: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

{"Не забудьте проверить оборудование! 📷" if hours_before == 24 else "Выезжайте заранее! 🚗"}"""
    
    try:
        send_via_green_api(
            creds['instance_id'],
            creds['token'],
            photographer_phone,
            message
        )
        print(f'[REMINDER] Sent {hours_before}h reminder to photographer for project {project_data.get("id")}')
        return True
    except Exception as e:
        print(f'[REMINDER] Error sending to photographer: {str(e)}')
        return False


def send_client_reminder(client_phone: str, photographer_name: str, project_data: dict, hours_before: int) -> bool:
    """Отправить напоминание клиенту о съёмке"""
    creds = get_max_credentials()
    
    if not creds.get('instance_id') or not creds.get('token'):
        print('[REMINDER] MAX credentials not configured')
        return False
    
    if not client_phone:
        print('[REMINDER] Client phone not found')
        return False
    
    date_str = format_date_ru(project_data.get('startDate', ''))
    time_str = project_data.get('shooting_time', '10:00')
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    
    if hours_before == 24:
        message = f"""📅 Напоминание о фотосессии завтра!

🎬 Проект: {project_name}
📅 Дата: {date_str}
🕐 Время: {time_str}
📍 Адрес: {address}

👤 Фотограф: {photographer_name}

✨ Не забудьте подготовиться заранее:
• Подберите наряды и аксессуары
• Выспитесь и отдохните
• Подготовьте реквизит (если нужен)
• Продумайте образы

До встречи! 📷"""
    else:  # 2 hours
        message = f"""⏰ Время близко! Фотосессия через 2 часа!

🎬 Проект: {project_name}
📅 Дата: {date_str}
🕐 Время: {time_str}
📍 Адрес: {address}

👤 Фотограф: {photographer_name}

✅ Всё ли подготовили?
• Наряды и аксессуары ✨
• Хорошее настроение 😊
• Заряженный телефон 📱
• Выехали вовремя 🚗

А самое главное — хорошее настроение не забудьте взять!!! 🌟💫

Увидимся скоро! 📸"""
    
    try:
        send_via_green_api(
            creds['instance_id'],
            creds['token'],
            client_phone,
            message
        )
        print(f'[REMINDER] Sent {hours_before}h reminder to client for project {project_data.get("id")}')
        return True
    except Exception as e:
        print(f'[REMINDER] Error sending to client: {str(e)}')
        return False


def check_and_send_reminders():
    """Проверить все съёмки и отправить напоминания"""
    conn = get_db_connection()
    results = {
        'checked': 0,
        'sent_24h_photographer': 0,
        'sent_1h_photographer': 0,
        'sent_24h_client': 0,
        'sent_2h_client': 0,
        'errors': 0
    }
    
    try:
        # Получаем всех пользователей (фотографов)
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT id, phone, email, display_name, phone_verified
                FROM {SCHEMA}.users
            """)
            photographers = cur.fetchall()
        
        now = datetime.now()
        
        for photographer in photographers:
            photographer_id = photographer['id']
            photographer_phone = photographer.get('phone')
            photographer_name = photographer.get('display_name') or photographer.get('email', 'Фотограф')
            photographer_phone_verified = photographer.get('phone_verified', False)
            
            # Получаем все проекты фотографа
            try:
                req = urllib.request.Request(
                    f'{CLIENTS_API}?userId={photographer_id}',
                    headers={'X-User-Id': str(photographer_id)}
                )
                
                with urllib.request.urlopen(req) as response:
                    clients_data = json.loads(response.read().decode())
                
                # Проверяем все проекты всех клиентов
                for client in clients_data:
                    client_phone = client.get('phone')
                    
                    for project in client.get('projects', []):
                        results['checked'] += 1
                        
                        start_date = project.get('startDate')
                        shooting_time = project.get('shooting_time', '10:00')
                        
                        if not start_date or not shooting_time:
                            continue
                        
                        # Парсим дату и время съёмки
                        try:
                            date_part = start_date.split('T')[0]
                            shooting_datetime = datetime.fromisoformat(f"{date_part}T{shooting_time}:00")
                        except:
                            continue
                        
                        time_until = shooting_datetime - now
                        hours_until = time_until.total_seconds() / 3600
                        
                        # Отправляем напоминания за 24 часа (с окном ±1 час)
                        if 23 <= hours_until <= 25:
                            # Фотографу (если телефон подтверждён)
                            if photographer_phone and photographer_phone_verified:
                                if send_photographer_reminder(photographer_phone, photographer_name, project, client, 24):
                                    results['sent_24h_photographer'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Клиенту (если телефон указан)
                            if client_phone:
                                if send_client_reminder(client_phone, photographer_name, project, 24):
                                    results['sent_24h_client'] += 1
                                else:
                                    results['errors'] += 1
                        
                        # Отправляем напоминание фотографу за 1 час (с окном ±15 минут)
                        elif 0.75 <= hours_until <= 1.25:
                            if photographer_phone and photographer_phone_verified:
                                if send_photographer_reminder(photographer_phone, photographer_name, project, client, 1):
                                    results['sent_1h_photographer'] += 1
                                else:
                                    results['errors'] += 1
                        
                        # Отправляем напоминание клиенту за 2 часа (с окном ±15 минут)
                        elif 1.75 <= hours_until <= 2.25:
                            if client_phone:
                                if send_client_reminder(client_phone, photographer_name, project, 2):
                                    results['sent_2h_client'] += 1
                                else:
                                    results['errors'] += 1
                
            except Exception as e:
                print(f'[REMINDER] Error processing photographer {photographer_id}: {str(e)}')
                results['errors'] += 1
                continue
        
        return results
        
    finally:
        conn.close()


def handler(event: dict, context) -> dict:
    """
    Крон-задача для отправки напоминаний о съёмках
    Запускается автоматически каждый час
    """
    method = event.get('httpMethod', 'GET')
    
    # CORS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        print('[REMINDER_CRON] Starting reminder check...')
        results = check_and_send_reminders()
        print(f'[REMINDER_CRON] Results: {results}')
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'timestamp': datetime.now().isoformat(),
                'results': results
            })
        }
        
    except Exception as e:
        print(f'[REMINDER_CRON] Error: {str(e)}')
        import traceback
        print(traceback.format_exc())
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }