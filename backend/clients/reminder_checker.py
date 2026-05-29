"""
Модуль для автоматической проверки и отправки напоминаний о съёмках
Вызывается при каждом обращении к API клиентов
"""

import os
import requests
from datetime import datetime, timedelta
from typing import Dict, List
from psycopg2.extras import RealDictCursor


def escape_sql(value):
    """Безопасное экранирование для Simple Query Protocol"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def send_via_green_api(instance_id: str, token: str, phone: str, message: str) -> bool:
    """Отправить сообщение через GREEN-API"""
    try:
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
        return response.status_code == 200
    except Exception as e:
        print(f'[REMINDER] WhatsApp error: {e}')
        return False


def send_via_telegram(telegram_id: str, message: str) -> bool:
    """Отправить сообщение через Telegram"""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not bot_token or not telegram_id:
        return False
    
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
        return result.get('ok', False)
    except Exception as e:
        print(f'[REMINDER] Telegram error: {e}')
        return False


def format_time(time_obj) -> str:
    """Форматировать время в HH:MM"""
    if not time_obj:
        return "не указано"
    time_str = str(time_obj)
    if ':' in time_str:
        parts = time_str.split(':')
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    return time_str


def get_reminder_messages(reminder_type: str, project: dict, client: dict, photographer: dict) -> tuple:
    """Получить сообщения для клиента и фотографа"""
    time_str = format_time(project.get('shooting_time'))
    address = project.get('shooting_address', 'не указано')
    photographer_name = photographer.get('display_name') or photographer.get('email', 'Фотограф')
    photographer_phone = photographer.get('phone', 'не указан')
    client_name = client.get('name', 'Клиент')
    client_phone = client.get('phone', 'не указан')
    
    if reminder_type == '24h':
        client_msg = f"""⏰ Напоминание о завтрашней съёмке!

📸 Ваша фотосессия завтра!

🕐 Время: {time_str}
📍 Место: {address}

👤 Фотограф: {photographer_name}
📞 Телефон: {photographer_phone}

✨ Подготовьтесь заранее! До встречи завтра! 📷"""

        photographer_msg = f"""⏰ Напоминание о завтрашней съёмке!

📸 У вас съёмка завтра!

🕐 Время: {time_str}
📍 Место: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

🎯 Проверьте оборудование заранее!"""

    elif reminder_type == 'today':
        client_msg = f"""⏰ Напоминание о сегодняшней съёмке!

📸 Ваша фотосессия сегодня!

🕐 Время: {time_str}
📍 Место: {address}

👤 Фотограф: {photographer_name}
📞 Телефон: {photographer_phone}

✨ Подготовьтесь заранее! До встречи сегодня! 📷"""

        photographer_msg = f"""⏰ Напоминание о сегодняшней съёмке!

📸 У вас съёмка сегодня!

🕐 Время: {time_str}
📍 Место: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

🎯 Проверьте оборудование заранее!"""

    elif reminder_type == '5h':
        client_msg = f"""⏰ Съёмка через 5 часов!

📸 Скоро начнётся ваша фотосессия!

🕐 Время: {time_str}
📍 Место: {address}

👤 Фотограф: {photographer_name}
📞 Телефон: {photographer_phone}

💡 Совет: выезжайте заранее с учётом пробок!
✨ Всё будет отлично! 📷"""

        photographer_msg = f"""⏰ Съёмка через 5 часов!

📸 Съёмка скоро начнётся!

🕐 Время: {time_str}
📍 Место: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

📦 Проверьте:
✅ Флешки
✅ Аккумуляторы
✅ Объективы
✅ Освещение

🚗 Выезжайте с запасом времени!"""

    else:  # 1h
        client_msg = f"""⏰ Съёмка через 1 час!

📸 Ваша фотосессия начнётся совсем скоро!

🕐 Время: {time_str}
📍 Место: {address}

👤 Фотограф: {photographer_name}
📞 Телефон: {photographer_phone}

🎉 Ждём вас! Будет красиво! 📷"""

        photographer_msg = f"""⏰ Съёмка через 1 час!

📸 Съёмка начнётся через час!

🕐 Время: {time_str}
📍 Место: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

🚀 В путь! Удачной съёмки!"""

    return client_msg, photographer_msg


def log_reminder(conn, project_id: int, reminder_type: str, schema: str):
    """Записать отправку напоминания в лог"""
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {schema}.shooting_reminders_log 
                (project_id, reminder_type, sent_to, success, channel)
                VALUES ({escape_sql(project_id)}, {escape_sql(reminder_type)}, 
                        'both', TRUE, 'both')
                ON CONFLICT (project_id, reminder_type, sent_to) DO NOTHING
            """)
            conn.commit()
    except Exception as e:
        print(f"[REMINDER_LOG] Error: {e}")


def check_and_send_reminders(conn, schema: str, user_id: int):
    """
    Проверить предстоящие съёмки и отправить напоминания
    Вызывается при каждом запросе к API клиентов
    """
    try:
        instance_id = os.environ.get('MAX_INSTANCE_ID', '')
        token = os.environ.get('MAX_TOKEN', '')
        
        if not instance_id or not token:
            return  # Молча пропускаем, если нет credentials
        
        now = datetime.now()
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Находим проекты требующие напоминаний
            cur.execute(f"""
                SELECT 
                    cp.id as project_id,
                    cp.start_date,
                    cp.shooting_time,
                    cp.shooting_address,
                    c.id as client_id,
                    c.name as client_name,
                    c.phone as client_phone,
                    c.telegram_chat_id as client_telegram_id,
                    u.id as photographer_id,
                    u.display_name as photographer_name,
                    u.email as photographer_email,
                    u.phone as photographer_phone,
                    u.telegram_chat_id as photographer_telegram_id
                FROM {schema}.client_projects cp
                JOIN {schema}.clients c ON cp.client_id = c.id
                JOIN {schema}.users u ON c.photographer_id = u.id
                WHERE c.photographer_id = {escape_sql(user_id)}
                  AND cp.start_date IS NOT NULL
                  AND cp.shooting_time IS NOT NULL
                  AND cp.status IN ('new', 'in_progress', 'scheduled')
                  AND cp.start_date >= CURRENT_DATE
                  AND cp.start_date <= CURRENT_DATE + INTERVAL '2 days'
            """)
            
            projects = cur.fetchall()
            
            for proj in projects:
                shooting_date = proj['start_date']
                shooting_time = proj['shooting_time']
                shooting_datetime = datetime.combine(shooting_date, shooting_time)
                
                time_diff = shooting_datetime - now
                hours_until = time_diff.total_seconds() / 3600
                
                reminder_type = None
                is_today = shooting_date == now.date()
                
                current_quarter = now.replace(minute=(now.minute // 15) * 15, second=0, microsecond=0)
                
                def quarter_send_time(hrs_before):
                    ideal = shooting_datetime - timedelta(hours=hrs_before)
                    aligned = (ideal.minute // 15) * 15
                    return ideal.replace(minute=aligned, second=0, microsecond=0)
                
                if 0 < hours_until <= 1.5 and current_quarter >= quarter_send_time(1):
                    reminder_type = '1h'
                elif 1.5 < hours_until <= 5.5 and current_quarter >= quarter_send_time(5):
                    reminder_type = '5h'
                elif is_today and hours_until > 5.5 and current_quarter >= quarter_send_time(hours_until):
                    reminder_type = 'today'
                elif 5.5 < hours_until <= 25 and not is_today and current_quarter >= quarter_send_time(24):
                    reminder_type = '24h'
                
                if not reminder_type:
                    continue
                
                # Проверяем, не отправляли ли уже
                cur.execute(f"""
                    SELECT COUNT(*) as cnt FROM {schema}.shooting_reminders_log
                    WHERE project_id = {escape_sql(proj['project_id'])}
                      AND reminder_type = {escape_sql(reminder_type)}
                """)
                result = cur.fetchone()
                
                if result and result['cnt'] > 0:
                    continue  # Уже отправляли
                
                # Формируем данные
                project_data = dict(proj)
                client_data = {
                    'name': proj['client_name'],
                    'phone': proj['client_phone'],
                    'telegram_id': proj['client_telegram_id']
                }
                photographer_data = {
                    'display_name': proj['photographer_name'],
                    'email': proj['photographer_email'],
                    'phone': proj['photographer_phone'],
                    'telegram_id': proj['photographer_telegram_id']
                }
                
                # Получаем сообщения
                client_msg, photographer_msg = get_reminder_messages(
                    reminder_type, project_data, client_data, photographer_data
                )
                
                # Отправляем клиенту
                sent_any = False
                if client_data.get('phone'):
                    if send_via_green_api(instance_id, token, client_data['phone'], client_msg):
                        sent_any = True
                
                if client_data.get('telegram_id'):
                    if send_via_telegram(client_data['telegram_id'], client_msg):
                        sent_any = True
                
                # Отправляем фотографу
                if photographer_data.get('phone'):
                    if send_via_green_api(instance_id, token, photographer_data['phone'], photographer_msg):
                        sent_any = True
                
                if photographer_data.get('telegram_id'):
                    if send_via_telegram(photographer_data['telegram_id'], photographer_msg):
                        sent_any = True
                
                # Логируем если хоть что-то отправили
                if sent_any:
                    log_reminder(conn, proj['project_id'], reminder_type, schema)
                    print(f"[REMINDER] Sent {reminder_type} for project {proj['project_id']}")
    
    except Exception as e:
        print(f"[REMINDER_CHECK] Error: {e}")
        # Молча игнорируем ошибки, чтобы не сломать основной запрос