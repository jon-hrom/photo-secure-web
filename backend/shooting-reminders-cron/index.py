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
import boto3
from botocore.exceptions import ClientError

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


def send_email(to_email: str, subject: str, html_body: str, from_name: str = 'FotoMix') -> bool:
    """Отправить email через Yandex Cloud Postbox"""
    try:
        access_key_id = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        secret_access_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        
        if not access_key_id or not secret_access_key:
            print("[EMAIL] POSTBOX credentials not set")
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
        
        print(f"[EMAIL] Sent to {to_email}. MessageId: {response.get('MessageId')}")
        return True
    except ClientError as e:
        print(f"[EMAIL] ClientError: {e.response['Error']['Code']} - {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"[EMAIL] Error: {str(e)}")
        return False


def format_date_ru(date_str: str) -> str:
    """Форматировать дату в русский формат"""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', ''))
        months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except:
        return date_str


def send_photographer_email_reminder(photographer_email: str, photographer_name: str, project_data: dict, client_data: dict, hours_before: int) -> bool:
    """Отправить email-напоминание фотографу"""
    if not photographer_email:
        print('[EMAIL_REMINDER] Photographer email not found')
        return False
    
    client_name = client_data.get('name', 'Клиент')
    client_phone = client_data.get('phone', 'не указан')
    client_email = client_data.get('email', 'не указан')
    
    date_str = format_date_ru(project_data.get('startDate', ''))
    time_str = project_data.get('shooting_time', '10:00')
    if time_str and ':' in time_str:
        time_parts = time_str.split(':')
        time_str = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}"
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    
    if hours_before == 24:
        subject = f'📅 Напоминание: съёмка завтра — {project_name}'
        time_text = 'завтра'
        tip = 'Не забудьте проверить оборудование! 📷'
    else:
        subject = f'⏰ Напоминание: съёмка сегодня — {project_name}'
        time_text = 'сегодня'
        tip = 'Выезжайте заранее! 🚗'
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .info-block {{ background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }}
            .info-row {{ margin: 10px 0; }}
            .label {{ font-weight: bold; color: #667eea; }}
            .tip {{ background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #ffc107; }}
            .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">📸 Напоминание о съёмке</h1>
                <p style="margin: 10px 0 0 0; font-size: 18px;">Съёмка {time_text}!</p>
            </div>
            <div class="content">
                <div class="info-block">
                    <div class="info-row">
                        <span class="label">🎬 Проект:</span> {project_name}
                    </div>
                    <div class="info-row">
                        <span class="label">📅 Дата:</span> {date_str}
                    </div>
                    <div class="info-row">
                        <span class="label">🕐 Время:</span> {time_str}
                    </div>
                    <div class="info-row">
                        <span class="label">📍 Адрес:</span> {address}
                    </div>
                </div>
                
                <div class="info-block">
                    <h3 style="margin-top: 0; color: #667eea;">Информация о клиенте</h3>
                    <div class="info-row">
                        <span class="label">👤 Имя:</span> {client_name}
                    </div>
                    <div class="info-row">
                        <span class="label">📞 Телефон:</span> {client_phone}
                    </div>
                    <div class="info-row">
                        <span class="label">📧 Email:</span> {client_email}
                    </div>
                </div>
                
                <div class="tip">
                    <strong>💡 Напоминание:</strong><br>
                    {tip}
                </div>
            </div>
            <div class="footer">
                <p>С уважением, команда FotoMix</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(photographer_email, subject, html_body)


def send_client_email_reminder(client_email: str, photographer_name: str, project_data: dict, hours_before: int) -> bool:
    """Отправить email-напоминание клиенту"""
    if not client_email:
        print('[EMAIL_REMINDER] Client email not found')
        return False
    
    date_str = format_date_ru(project_data.get('startDate', ''))
    time_str = project_data.get('shooting_time', '10:00')
    if time_str and ':' in time_str:
        time_parts = time_str.split(':')
        time_str = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}"
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    
    if hours_before == 24:
        subject = f'📅 Напоминание: фотосессия завтра — {project_name}'
        time_text = 'завтра'
        checklist = """
            <li>Подберите наряды и аксессуары ✨</li>
            <li>Выспитесь и отдохните 😴</li>
            <li>Подготовьте реквизит (если нужен) 🎭</li>
            <li>Продумайте образы 💅</li>
        """
    elif hours_before == 5:
        subject = f'⏰ Скоро съёмка! Осталось {hours_before} часов — {project_name}'
        time_text = 'сегодня'
        checklist = """
            <li>Проверьте наряды ✨</li>
            <li>Соберите аксессуары 💄</li>
            <li>Проверьте адрес 📍</li>
            <li>Рассчитайте время в пути 🚗</li>
        """
    elif hours_before == 3:
        subject = f'🚀 Время собираться! Осталось {hours_before} часа — {project_name}'
        time_text = 'сегодня'
        checklist = """
            <li>Оденьтесь и подготовьтесь ✨</li>
            <li>Возьмите все необходимое 💼</li>
            <li>Выезжайте с запасом времени 🚗</li>
            <li>Зарядите телефон 📱</li>
        """
    else:  # 1 hour
        subject = f'⏰ Выезжайте! Съёмка через час — {project_name}'
        time_text = 'сегодня'
        checklist = """
            <li>Проверьте наряды ✨</li>
            <li>Соберите аксессуары 💄</li>
            <li>Проверьте адрес 📍</li>
            <li>Хорошее настроение 😊</li>
            <li>Зарядите телефон 📱</li>
        """
    
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .info-block {{ background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #f5576c; }}
            .info-row {{ margin: 10px 0; }}
            .label {{ font-weight: bold; color: #f5576c; }}
            .checklist {{ background: #e7f3ff; padding: 20px; border-radius: 8px; margin-top: 20px; }}
            .checklist ul {{ margin: 10px 0; padding-left: 20px; }}
            .checklist li {{ margin: 8px 0; }}
            .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0;">📸 Напоминание о фотосессии</h1>
                <p style="margin: 10px 0 0 0; font-size: 18px;">Съёмка {time_text}!</p>
            </div>
            <div class="content">
                <div class="info-block">
                    <div class="info-row">
                        <span class="label">🎬 Услуга:</span> {project_name}
                    </div>
                    <div class="info-row">
                        <span class="label">📅 Дата:</span> {date_str}
                    </div>
                    <div class="info-row">
                        <span class="label">🕐 Время:</span> {time_str}
                    </div>
                    <div class="info-row">
                        <span class="label">📍 Место встречи:</span> {address}
                    </div>
                    <div class="info-row">
                        <span class="label">👤 Фотограф:</span> {photographer_name}
                    </div>
                </div>
                
                <div class="checklist">
                    <h3 style="margin-top: 0; color: #f5576c;">✅ Подготовьтесь к съёмке:</h3>
                    <ul>
                        {checklist}
                    </ul>
                </div>
                
                <p style="text-align: center; margin-top: 30px; font-size: 18px;">
                    До встречи на съёмке! 🌟📷
                </p>
            </div>
            <div class="footer">
                <p>С уважением, команда FotoMix</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    return send_email(client_email, subject, html_body)


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
    # Ensure time is in HH:MM format (handle HH:MM:SS format)
    if time_str and ':' in time_str:
        time_parts = time_str.split(':')
        hours_part = time_parts[0]
        minutes_part = time_parts[1] if len(time_parts) > 1 else '00'
        time_str = f"{hours_part.zfill(2)}:{minutes_part.zfill(2)}"
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    
    if hours_before == 24:
        emoji = '📅'
        time_text = f'завтра (через {int(hours_before)} часов)'
        tip = 'Не забудьте проверить оборудование! 📷'
    elif hours_before == 5:
        emoji = '⏰'
        time_text = f'через {int(hours_before)} часов'
        tip = 'Проверьте заряд батарей и карты памяти! 🔋'
    else:
        emoji = '⏰'
        time_text = f'через {int(hours_before)} час'
        tip = 'Выезжайте заранее! 🚗'
    
    message = f"""{emoji} Напоминание о съёмке {time_text}!

🎬 Проект: {project_name}
📅 Дата: {date_str}
🕐 Время: {time_str}
📍 Адрес: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

{tip}"""
    
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
    # Ensure time is in HH:MM format (handle HH:MM:SS format)
    if time_str and ':' in time_str:
        time_parts = time_str.split(':')
        hours_part = time_parts[0]
        minutes_part = time_parts[1] if len(time_parts) > 1 else '00'
        time_str = f"{hours_part.zfill(2)}:{minutes_part.zfill(2)}"
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    
    if hours_before == 24:
        message = f"""📅 Напоминание о фотосессии завтра через {int(hours_before)} часов!

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
    elif hours_before == 5:
        message = f"""⏰ Скоро съёмка! Осталось {int(hours_before)} часов

🎬 Проект: {project_name}
📅 Дата: {date_str}
🕐 Время: {time_str}
📍 Адрес: {address}

👤 Фотограф: {photographer_name}

⏱ Подготовьтесь к выходу:
• Проверьте наряды ✨
• Соберите аксессуары 💄
• Проверьте адрес 📍
• Рассчитайте время в пути 🚗

Скоро встретимся! 📸"""
    elif hours_before == 3:
        message = f"""⏰ Осталось всего {int(hours_before)} часа до съёмки!

🎬 Проект: {project_name}
📅 Дата: {date_str}
🕐 Время: {time_str}
📍 Адрес: {address}

👤 Фотограф: {photographer_name}

🚀 Время собираться:
• Оденьтесь и подготовьтесь ✨
• Возьмите все необходимое 💼
• Выезжайте с запасом времени 🚗
• Телефон заряжен 📱

Скоро увидимся! 📸"""
    else:  # 1 hour
        message = f"""⏰ Время близко! Фотосессия через {int(hours_before)} час!

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
        'sent_5h_photographer': 0,
        'sent_3h_photographer': 0,
        'sent_1h_photographer': 0,
        'sent_24h_client': 0,
        'sent_5h_client': 0,
        'sent_3h_client': 0,
        'sent_1h_client': 0,
        'errors': 0
    }
    
    try:
        # Получаем всех пользователей (фотографов) с профилями
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT u.id, u.phone, u.email, up.full_name as display_name
                FROM "{SCHEMA}"."users" u
                LEFT JOIN "{SCHEMA}"."user_profiles" up ON u.id = up.user_id
                WHERE u.is_active = true AND u.is_blocked = false
            """)
            photographers = cur.fetchall()
        
        now = datetime.now()
        
        for photographer in photographers:
            photographer_id = photographer['id']
            photographer_phone = photographer.get('phone')
            photographer_email = photographer.get('email')
            photographer_name = photographer.get('display_name') or photographer.get('email', 'Фотограф')
            
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
                    client_email = client.get('email')
                    
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
                            # Фотографу по MAX (если есть телефон)
                            if photographer_phone:
                                if send_photographer_reminder(photographer_phone, photographer_name, project, client, 24):
                                    results['sent_24h_photographer'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Фотографу по email
                            if photographer_email:
                                if send_photographer_email_reminder(photographer_email, photographer_name, project, client, 24):
                                    results['sent_24h_photographer'] += 1
                            
                            # Клиенту по MAX
                            if client_phone:
                                if send_client_reminder(client_phone, photographer_name, project, 24):
                                    results['sent_24h_client'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Клиенту по email
                            if client_email:
                                if send_client_email_reminder(client_email, photographer_name, project, 24):
                                    results['sent_24h_client'] += 1
                        
                        # Отправляем напоминание за 5 часов (с окном ±30 минут)
                        elif 4.5 <= hours_until <= 5.5:
                            # Фотографу по MAX
                            if photographer_phone:
                                if send_photographer_reminder(photographer_phone, photographer_name, project, client, 5):
                                    results['sent_5h_photographer'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Клиенту по MAX
                            if client_phone:
                                if send_client_reminder(client_phone, photographer_name, project, 5):
                                    results['sent_5h_client'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Клиенту по email
                            if client_email:
                                if send_client_email_reminder(client_email, photographer_name, project, 5):
                                    results['sent_5h_client'] += 1
                        
                        # Отправляем напоминание за 3 часа (с окном ±30 минут)
                        elif 2.5 <= hours_until <= 3.5:
                            # Фотографу по MAX
                            if photographer_phone:
                                if send_photographer_reminder(photographer_phone, photographer_name, project, client, 3):
                                    results['sent_3h_photographer'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Клиенту по MAX
                            if client_phone:
                                if send_client_reminder(client_phone, photographer_name, project, 3):
                                    results['sent_3h_client'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Клиенту по email
                            if client_email:
                                if send_client_email_reminder(client_email, photographer_name, project, 3):
                                    results['sent_3h_client'] += 1
                        
                        # Отправляем напоминание за 1 час (с окном ±15 минут)
                        elif 0.75 <= hours_until <= 1.25:
                            # Фотографу по MAX
                            if photographer_phone:
                                if send_photographer_reminder(photographer_phone, photographer_name, project, client, 1):
                                    results['sent_1h_photographer'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Клиенту по MAX
                            if client_phone:
                                if send_client_reminder(client_phone, photographer_name, project, 1):
                                    results['sent_1h_client'] += 1
                                else:
                                    results['errors'] += 1
                            
                            # Клиенту по email
                            if client_email:
                                if send_client_email_reminder(client_email, photographer_name, project, 1):
                                    results['sent_1h_client'] += 1
                
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