"""
Business: Отправка уведомлений в Telegram клиентам и фотографам о съёмках
Args: event с action, project_id, client_id, notification_type
Returns: HTTP response с результатом отправки
"""

import json
import os
import psycopg2
from typing import Dict, Any
from datetime import datetime
import requests

SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn)

def get_telegram_bot_token():
    return os.environ.get('TELEGRAM_BOT_TOKEN')

def send_telegram_message(chat_id: str, message: str) -> bool:
    """Отправить сообщение в Telegram"""
    bot_token = get_telegram_bot_token()
    if not bot_token:
        print("Error: TELEGRAM_BOT_TOKEN not set")
        return False
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': 'HTML'
    }
    
    try:
        response = requests.post(url, json=payload, timeout=10)
        result = response.json()
        
        if result.get('ok'):
            print(f"Telegram message sent to {chat_id}")
            return True
        else:
            print(f"Telegram API error: {result.get('description')}")
            return False
    except Exception as e:
        print(f"Telegram send error: {str(e)}")
        return False

def format_project_notification_for_client(project_data: Dict, photographer_data: Dict, payment_data: Dict = None) -> str:
    """Форматирование уведомления для клиента о новой съёмке"""
    
    # Форматирование даты и времени
    shooting_date = project_data.get('start_date')
    shooting_time = project_data.get('shooting_time')
    
    date_str = "не указана"
    time_str = "не указано"
    
    if shooting_date:
        try:
            dt = datetime.fromisoformat(str(shooting_date))
            date_str = dt.strftime('%d.%m.%Y')
        except:
            date_str = str(shooting_date)
    
    if shooting_time:
        try:
            time_str = str(shooting_time)[:5]  # HH:MM
        except:
            time_str = str(shooting_time)
    
    # Базовая информация
    message = f"""📸 <b>Новая съёмка запланирована!</b>

📅 <b>Дата:</b> {date_str}
🕐 <b>Время:</b> {time_str}
📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}

👤 <b>Ваш фотограф:</b> {photographer_data.get('name') or 'Фотограф'}
📞 <b>Телефон:</b> {photographer_data.get('phone') or 'не указан'}
"""
    
    # Добавляем информацию о платеже если есть
    if payment_data:
        budget = float(payment_data.get('budget', 0))
        prepaid = float(payment_data.get('prepaid', 0))
        remaining = budget - prepaid
        
        message += f"""
💰 <b>Стоимость съёмки:</b> {budget:,.0f} ₽"""
        
        if prepaid > 0:
            message += f"""
✅ <b>Предоплата:</b> {prepaid:,.0f} ₽
💳 <b>Остаток к оплате:</b> {remaining:,.0f} ₽"""
    
    message += "\n\n✨ Ждём вас! Будет красиво! 📷"
    
    return message

def format_project_notification_for_photographer(project_data: Dict, client_data: Dict, payment_data: Dict = None) -> str:
    """Форматирование уведомления для фотографа о новом заказе"""
    
    # Форматирование даты и времени
    shooting_date = project_data.get('start_date')
    shooting_time = project_data.get('shooting_time')
    
    date_str = "не указана"
    time_str = "не указано"
    
    if shooting_date:
        try:
            dt = datetime.fromisoformat(str(shooting_date))
            date_str = dt.strftime('%d.%m.%Y')
        except:
            date_str = str(shooting_date)
    
    if shooting_time:
        try:
            time_str = str(shooting_time)[:5]
        except:
            time_str = str(shooting_time)
    
    # Базовая информация
    message = f"""📸 <b>Новый заказ!</b>

📅 <b>Дата съёмки:</b> {date_str}
🕐 <b>Время:</b> {time_str}
📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}

👤 <b>Клиент:</b> {client_data.get('name') or 'Клиент'}
📞 <b>Телефон:</b> {client_data.get('phone') or 'не указан'}
"""
    
    # Добавляем информацию о платеже если есть
    if payment_data:
        budget = float(payment_data.get('budget', 0))
        prepaid = float(payment_data.get('prepaid', 0))
        remaining = budget - prepaid
        
        message += f"""
💰 <b>Стоимость:</b> {budget:,.0f} ₽"""
        
        if prepaid > 0:
            message += f"""
✅ <b>Получена предоплата:</b> {prepaid:,.0f} ₽
💳 <b>Осталось получить:</b> {remaining:,.0f} ₽"""
    
    message += "\n\n🎯 Удачной съёмки!"
    
    return message

def format_reminder_for_client(project_data: Dict, photographer_data: Dict, hours_left: int) -> str:
    """Форматирование напоминания для клиента"""
    
    time_text = {
        24: "завтра",
        5: "через 5 часов",
        1: "через 1 час"
    }.get(hours_left, f"через {hours_left} часов")
    
    shooting_time = project_data.get('shooting_time')
    time_str = str(shooting_time)[:5] if shooting_time else "не указано"
    
    message = f"""⏰ <b>Напоминание о съёмке!</b>

📸 Ваша съёмка {time_text}!

🕐 <b>Время:</b> {time_str}
📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}
👤 <b>Фотограф:</b> {photographer_data.get('name') or 'Фотограф'}
📞 <b>Телефон:</b> {photographer_data.get('phone') or 'не указан'}

✨ Подготовьтесь заранее, всё будет отлично! 📷
"""
    
    return message

def format_reminder_for_photographer(project_data: Dict, client_data: Dict, hours_left: int) -> str:
    """Форматирование напоминания для фотографа"""
    
    time_text = {
        24: "завтра",
        5: "через 5 часов",
        1: "через 1 час"
    }.get(hours_left, f"через {hours_left} часов")
    
    shooting_time = project_data.get('shooting_time')
    time_str = str(shooting_time)[:5] if shooting_time else "не указано"
    
    message = f"""⏰ <b>Напоминание о съёмке!</b>

📸 Съёмка {time_text}!

🕐 <b>Время:</b> {time_str}
📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}
👤 <b>Клиент:</b> {client_data.get('name') or 'Клиент'}
📞 <b>Телефон:</b> {client_data.get('phone') or 'не указан'}

🎯 Проверьте оборудование! Ничего не забудьте!
"""
    
    return message

def send_project_notifications(project_id: int) -> Dict[str, Any]:
    """Отправить уведомления о создании проекта клиенту и фотографу"""
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Получаем данные проекта, клиента и фотографа
        cur.execute(f"""
            SELECT 
                cp.id,
                cp.name,
                cp.budget,
                cp.start_date,
                cp.shooting_time,
                cp.shooting_address,
                c.id as client_id,
                c.name as client_name,
                c.phone as client_phone,
                c.photographer_id,
                COALESCE(u.display_name, u.name, u.email) as photographer_name,
                COALESCE(u.phone_number, u.phone) as photographer_phone,
                u.telegram_chat_id as photographer_telegram,
                c.telegram_chat_id as client_telegram_direct
            FROM {SCHEMA}.client_projects cp
            JOIN {SCHEMA}.clients c ON cp.client_id = c.id
            LEFT JOIN {SCHEMA}.users u ON c.photographer_id = u.id
            WHERE cp.id = %s
        """, (project_id,))
        
        row = cur.fetchone()
        
        if not row:
            return {'success': False, 'error': 'Project not found'}
        
        project_data = {
            'id': row[0],
            'name': row[1],
            'budget': row[2],
            'start_date': row[3],
            'shooting_time': row[4],
            'shooting_address': row[5]
        }
        
        client_data = {
            'id': row[6],
            'name': row[7],
            'phone': row[8],
            'telegram_chat_id': row[13]
        }
        
        photographer_data = {
            'id': row[9],
            'name': row[10],
            'phone': row[11],
            'telegram_chat_id': row[12]
        }
        
        cur.execute(f"""
            SELECT SUM(amount) as total_paid
            FROM {SCHEMA}.client_payments
            WHERE project_id = %s AND status = 'completed'
        """, (project_id,))
        
        payment_row = cur.fetchone()
        prepaid = float(payment_row[0]) if payment_row and payment_row[0] else 0
        
        payment_data = {
            'budget': project_data.get('budget', 0),
            'prepaid': prepaid
        } if project_data.get('budget') else None
        
        client_telegram_chat_id = client_data.get('telegram_chat_id')
        
        results = {
            'client_sent': False,
            'photographer_sent': False
        }
        
        print(f"[TELEGRAM_NOTIF] Client {client_data['id']} telegram: {client_telegram_chat_id}, Photographer {photographer_data['id']} telegram: {photographer_data.get('telegram_chat_id')}")
        
        # Отправка клиенту
        if client_telegram_chat_id:
            message = format_project_notification_for_client(project_data, photographer_data, payment_data)
            results['client_sent'] = send_telegram_message(client_telegram_chat_id, message)
        else:
            print(f"Client {client_data['id']} has no telegram_chat_id in clients table")
        
        # Отправка фотографу
        if photographer_data.get('telegram_chat_id'):
            message = format_project_notification_for_photographer(project_data, client_data, payment_data)
            results['photographer_sent'] = send_telegram_message(photographer_data['telegram_chat_id'], message)
        else:
            print(f"Photographer {photographer_data['id']} has no telegram_chat_id")
        
        cur.close()
        conn.close()
        
        return {
            'success': True,
            'results': results
        }
        
    except Exception as e:
        cur.close()
        conn.close()
        print(f"Error sending project notifications: {str(e)}")
        return {'success': False, 'error': str(e)}

def send_shooting_reminders(hours_before: int) -> Dict[str, Any]:
    """Отправить напоминания о съёмках за N часов"""
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Находим съёмки которые будут через N часов
        cur.execute(f"""
            SELECT 
                cp.id,
                cp.name,
                cp.start_date,
                cp.shooting_time,
                cp.shooting_address,
                c.id as client_id,
                c.name as client_name,
                c.phone as client_phone,
                c.photographer_id,
                c.telegram_chat_id as client_telegram,
                u.name as photographer_name,
                u.phone_number as photographer_phone,
                u.telegram_chat_id as photographer_telegram
            FROM {SCHEMA}.client_projects cp
            JOIN {SCHEMA}.clients c ON cp.client_id = c.id
            LEFT JOIN {SCHEMA}.users u ON c.photographer_id = u.id
            WHERE cp.start_date IS NOT NULL 
            AND cp.shooting_time IS NOT NULL
            AND (cp.start_date + cp.shooting_time::time) BETWEEN 
                NOW() + INTERVAL '{hours_before} hours' - INTERVAL '5 minutes'
                AND NOW() + INTERVAL '{hours_before} hours' + INTERVAL '5 minutes'
        """)
        
        projects = cur.fetchall()
        sent_count = 0
        
        for row in projects:
            project_data = {
                'id': row[0],
                'name': row[1],
                'start_date': row[2],
                'shooting_time': row[3],
                'shooting_address': row[4]
            }
            
            client_data = {
                'id': row[5],
                'name': row[6],
                'phone': row[7],
                'telegram_chat_id': row[9]
            }
            
            photographer_data = {
                'id': row[8],
                'name': row[10],
                'phone': row[11],
                'telegram_chat_id': row[12]
            }
            
            # Отправка клиенту
            if client_data.get('telegram_chat_id'):
                message = format_reminder_for_client(project_data, photographer_data, hours_before)
                if send_telegram_message(client_data['telegram_chat_id'], message):
                    sent_count += 1
            
            # Отправка фотографу
            if photographer_data.get('telegram_chat_id'):
                message = format_reminder_for_photographer(project_data, client_data, hours_before)
                if send_telegram_message(photographer_data['telegram_chat_id'], message):
                    sent_count += 1
        
        cur.close()
        conn.close()
        
        return {
            'success': True,
            'sent_count': sent_count,
            'projects_count': len(projects)
        }
        
    except Exception as e:
        cur.close()
        conn.close()
        print(f"Error sending reminders: {str(e)}")
        return {'success': False, 'error': str(e)}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Обработка запросов на отправку уведомлений"""
    
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
    
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')
        
        if action == 'send_project_notification':
            project_id = body.get('project_id')
            if not project_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'project_id is required'}),
                    'isBase64Encoded': False
                }
            
            result = send_project_notifications(project_id)
            
            return {
                'statusCode': 200 if result.get('success') else 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        elif action == 'send_reminders':
            hours_before = body.get('hours_before', 24)
            
            result = send_shooting_reminders(hours_before)
            
            return {
                'statusCode': 200 if result.get('success') else 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid action'}),
                'isBase64Encoded': False
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }