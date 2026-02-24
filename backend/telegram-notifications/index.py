"""
Отправка уведомлений клиентам и фотографам о съёмках.
Каналы: Telegram + Email (Yandex Cloud Postbox).
"""

import json
import os
import psycopg2
from typing import Dict, Any
from datetime import datetime
import requests
import boto3
from botocore.exceptions import ClientError

SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn)

def get_telegram_bot_token():
    return os.environ.get('TELEGRAM_BOT_TOKEN')

def send_telegram_message(chat_id: str, message: str) -> bool:
    bot_token = get_telegram_bot_token()
    if not bot_token:
        print("Error: TELEGRAM_BOT_TOKEN not set")
        return False
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {'chat_id': chat_id, 'text': message, 'parse_mode': 'HTML'}
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


def send_via_email(to_email: str, subject: str, html_body: str) -> bool:
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
        from_email = 'FotoMix <info@foto-mix.ru>'
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


def build_email_html(title: str, body_lines: list) -> str:
    body_html = ''.join(f'<p style="margin:8px 0;font-size:15px;color:#333;">{line}</p>' for line in body_lines)
    return f'''<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
<div style="max-width:500px;margin:20px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:20px;">{title}</h1>
</div>
<div style="padding:24px;">{body_html}</div>
<div style="padding:16px 24px;background:#f9fafb;text-align:center;color:#9ca3af;font-size:12px;">
FotoMix — foto-mix.ru
</div>
</div></body></html>'''


def format_date(shooting_date) -> str:
    if not shooting_date:
        return "не указана"
    try:
        dt = datetime.fromisoformat(str(shooting_date))
        return dt.strftime('%d.%m.%Y')
    except:
        return str(shooting_date)


def format_time(shooting_time) -> str:
    if not shooting_time:
        return "не указано"
    try:
        return str(shooting_time)[:5]
    except:
        return str(shooting_time)


def format_project_notification_for_client(project_data: Dict, photographer_data: Dict, payment_data: Dict = None) -> str:
    date_str = format_date(project_data.get('start_date'))
    time_str = format_time(project_data.get('shooting_time'))
    message = f"""📸 <b>Новая съёмка запланирована!</b>

📅 <b>Дата:</b> {date_str}
🕐 <b>Время:</b> {time_str}
📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}

👤 <b>Ваш фотограф:</b> {photographer_data.get('name') or 'Фотограф'}
📞 <b>Телефон:</b> {photographer_data.get('phone') or 'не указан'}
"""
    if payment_data:
        budget = float(payment_data.get('budget', 0))
        prepaid = float(payment_data.get('prepaid', 0))
        remaining = budget - prepaid
        message += f"\n💰 <b>Стоимость съёмки:</b> {budget:,.0f} ₽"
        if prepaid > 0:
            message += f"\n✅ <b>Предоплата:</b> {prepaid:,.0f} ₽\n💳 <b>Остаток к оплате:</b> {remaining:,.0f} ₽"
    message += "\n\n✨ Ждём вас! Будет красиво! 📷"
    return message


def format_project_notification_for_photographer(project_data: Dict, client_data: Dict, payment_data: Dict = None) -> str:
    date_str = format_date(project_data.get('start_date'))
    time_str = format_time(project_data.get('shooting_time'))
    duration_minutes = project_data.get('shooting_duration') or 120
    duration_hours = int(duration_minutes) // 60 or 1
    message = f"""📸 <b>Новый заказ!</b>

📅 <b>Дата съёмки:</b> {date_str}
🕐 <b>Время:</b> {time_str}
⏱ <b>Длительность:</b> {duration_hours} ч
📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}

👤 <b>Клиент:</b> {client_data.get('name') or 'Клиент'}
📞 <b>Телефон:</b> {client_data.get('phone') or 'не указан'}"""
    if client_data.get('email'):
        message += f"\n📧 <b>Email:</b> {client_data['email']}"
    if payment_data:
        budget = float(payment_data.get('budget', 0))
        prepaid = float(payment_data.get('prepaid', 0))
        remaining = budget - prepaid
        message += f"\n\n💰 <b>Стоимость съёмки:</b> {budget:,.0f} ₽"
        if prepaid > 0:
            message += f"\n✅ <b>Предоплата:</b> {prepaid:,.0f} ₽\n💳 <b>Остаток к получению:</b> {remaining:,.0f} ₽"
        else:
            message += f"\n💳 <b>К оплате:</b> {budget:,.0f} ₽"
    description = project_data.get('description', '')
    if description:
        message += f"\n\n📝 <b>Пожелания:</b> {description}"
    message += "\n\n🎯 Удачной съёмки!"
    return message


def format_reminder_for_client(project_data: Dict, photographer_data: Dict, hours_left: int) -> str:
    time_text = {24: "завтра", 5: "через 5 часов", 1: "через 1 час"}.get(hours_left, f"через {hours_left} часов")
    time_str = format_time(project_data.get('shooting_time'))
    return f"""⏰ <b>Напоминание о съёмке!</b>

📸 Ваша съёмка {time_text}!

🕐 <b>Время:</b> {time_str}
📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}
👤 <b>Фотограф:</b> {photographer_data.get('name') or 'Фотограф'}
📞 <b>Телефон:</b> {photographer_data.get('phone') or 'не указан'}

✨ Подготовьтесь заранее, всё будет отлично! 📷
"""


def format_reminder_for_photographer(project_data: Dict, client_data: Dict, hours_left: int) -> str:
    time_text = {24: "завтра", 5: "через 5 часов", 1: "через 1 час"}.get(hours_left, f"через {hours_left} часов")
    time_str = format_time(project_data.get('shooting_time'))
    return f"""⏰ <b>Напоминание о съёмке!</b>

📸 Съёмка {time_text}!

🕐 <b>Время:</b> {time_str}
📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}
👤 <b>Клиент:</b> {client_data.get('name') or 'Клиент'}
📞 <b>Телефон:</b> {client_data.get('phone') or 'не указан'}

🎯 Проверьте оборудование! Ничего не забудьте!
"""


def send_project_notifications(project_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(f"""
            SELECT 
                cp.id, cp.name, cp.budget, cp.start_date, cp.shooting_time, cp.shooting_address,
                c.id as client_id, c.name as client_name, c.phone as client_phone,
                c.photographer_id, c.email as client_email,
                COALESCE(u.display_name, u.name, u.email) as photographer_name,
                COALESCE(u.phone_number, u.phone) as photographer_phone,
                u.telegram_chat_id as photographer_telegram,
                c.telegram_chat_id as client_telegram_direct,
                u.email as photographer_email,
                cp.shooting_duration, cp.description
            FROM {SCHEMA}.client_projects cp
            JOIN {SCHEMA}.clients c ON cp.client_id = c.id
            LEFT JOIN {SCHEMA}.users u ON c.photographer_id = u.id
            WHERE cp.id = %s
        """, (project_id,))
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return {'success': False, 'error': 'Project not found'}

        project_data = {'id': row[0], 'name': row[1], 'budget': row[2], 'start_date': row[3], 'shooting_time': row[4], 'shooting_address': row[5], 'shooting_duration': row[16], 'description': row[17]}
        client_data = {'id': row[6], 'name': row[7], 'phone': row[8], 'telegram_chat_id': row[14], 'email': row[10]}
        photographer_data = {'id': row[9], 'name': row[11], 'phone': row[12], 'telegram_chat_id': row[13], 'email': row[15]}

        cur.execute(f"""
            SELECT SUM(amount) as total_paid FROM {SCHEMA}.client_payments
            WHERE project_id = %s AND status = 'completed'
        """, (project_id,))
        payment_row = cur.fetchone()
        prepaid = float(payment_row[0]) if payment_row and payment_row[0] else 0
        payment_data = {'budget': project_data.get('budget', 0), 'prepaid': prepaid} if project_data.get('budget') else None

        results = {'client_telegram': False, 'client_email': False, 'photographer_telegram': False, 'photographer_email': False}

        # Telegram клиенту
        if client_data.get('telegram_chat_id'):
            message = format_project_notification_for_client(project_data, photographer_data, payment_data)
            results['client_telegram'] = send_telegram_message(client_data['telegram_chat_id'], message)

        # Email клиенту
        if client_data.get('email'):
            date_str = format_date(project_data.get('start_date'))
            time_str = format_time(project_data.get('shooting_time'))
            lines = [
                f"📅 <b>Дата:</b> {date_str}",
                f"🕐 <b>Время:</b> {time_str}",
                f"📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}",
                f"👤 <b>Фотограф:</b> {photographer_data.get('name') or 'Фотограф'}",
                f"📞 <b>Телефон:</b> {photographer_data.get('phone') or 'не указан'}",
            ]
            if payment_data:
                budget = float(payment_data.get('budget', 0))
                lines.append(f"💰 <b>Стоимость:</b> {budget:,.0f} ₽")
            lines.append("✨ Ждём вас! Будет красиво!")
            html = build_email_html("📸 Новая съёмка запланирована!", lines)
            results['client_email'] = send_via_email(client_data['email'], f"📸 Съёмка {date_str} в {time_str}", html)

        # Telegram фотографу
        if photographer_data.get('telegram_chat_id'):
            message = format_project_notification_for_photographer(project_data, client_data, payment_data)
            results['photographer_telegram'] = send_telegram_message(photographer_data['telegram_chat_id'], message)

        # Email фотографу
        if photographer_data.get('email'):
            date_str = format_date(project_data.get('start_date'))
            time_str = format_time(project_data.get('shooting_time'))
            duration_minutes = project_data.get('shooting_duration') or 120
            duration_hours = int(duration_minutes) // 60 or 1
            lines = [
                f"📅 <b>Дата съёмки:</b> {date_str}",
                f"🕐 <b>Время:</b> {time_str}",
                f"⏱ <b>Длительность:</b> {duration_hours} ч",
                f"📍 <b>Место:</b> {project_data.get('shooting_address') or 'не указано'}",
                "",
                f"👤 <b>Клиент:</b> {client_data.get('name') or 'Клиент'}",
                f"📞 <b>Телефон:</b> {client_data.get('phone') or 'не указан'}",
            ]
            if client_data.get('email'):
                lines.append(f"📧 <b>Email:</b> {client_data['email']}")
            if payment_data:
                budget = float(payment_data.get('budget', 0))
                prepaid = float(payment_data.get('prepaid', 0))
                remaining = budget - prepaid
                lines.append("")
                lines.append(f"💰 <b>Стоимость съёмки:</b> {budget:,.0f} ₽".replace(',', ' '))
                if prepaid > 0:
                    lines.append(f"✅ <b>Предоплата:</b> {prepaid:,.0f} ₽".replace(',', ' '))
                    lines.append(f"💳 <b>Остаток к получению:</b> {remaining:,.0f} ₽".replace(',', ' '))
                else:
                    lines.append(f"💳 <b>К оплате:</b> {budget:,.0f} ₽".replace(',', ' '))
            description = project_data.get('description', '')
            if description:
                lines.append("")
                lines.append(f"📝 <b>Пожелания:</b> {description}")
            lines.append("")
            lines.append("🎯 Удачной съёмки!")
            html = build_email_html("📸 Новый заказ!", lines)
            results['photographer_email'] = send_via_email(photographer_data['email'], f"📸 Новый заказ — {date_str} в {time_str}", html)

        cur.close()
        conn.close()
        return {'success': True, 'results': results}

    except Exception as e:
        cur.close()
        conn.close()
        print(f"Error sending project notifications: {str(e)}")
        return {'success': False, 'error': str(e)}


def send_shooting_reminders(hours_before: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(f"""
            SELECT 
                cp.id, cp.name, cp.start_date, cp.shooting_time, cp.shooting_address,
                c.id as client_id, c.name as client_name, c.phone as client_phone,
                c.photographer_id, c.telegram_chat_id as client_telegram,
                c.email as client_email,
                u.name as photographer_name, u.phone_number as photographer_phone,
                u.telegram_chat_id as photographer_telegram, u.email as photographer_email
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

        time_text = {24: "завтра", 5: "через 5 часов", 1: "через 1 час"}.get(hours_before, f"через {hours_before} часов")

        for row in projects:
            project_data = {'id': row[0], 'name': row[1], 'start_date': row[2], 'shooting_time': row[3], 'shooting_address': row[4]}
            client_data = {'id': row[5], 'name': row[6], 'phone': row[7], 'telegram_chat_id': row[9], 'email': row[10]}
            photographer_data = {'id': row[8], 'name': row[11], 'phone': row[12], 'telegram_chat_id': row[13], 'email': row[14]}

            time_str = format_time(project_data.get('shooting_time'))
            address = project_data.get('shooting_address') or 'не указано'

            # Telegram клиенту
            if client_data.get('telegram_chat_id'):
                message = format_reminder_for_client(project_data, photographer_data, hours_before)
                if send_telegram_message(client_data['telegram_chat_id'], message):
                    sent_count += 1

            # Email клиенту
            if client_data.get('email'):
                html = build_email_html(f"⏰ Съёмка {time_text}!", [
                    f"Ваша фотосессия <b>{time_text}</b>!",
                    f"🕐 <b>Время:</b> {time_str}",
                    f"📍 <b>Место:</b> {address}",
                    f"👤 <b>Фотограф:</b> {photographer_data.get('name') or 'Фотограф'}",
                    f"📞 <b>Телефон:</b> {photographer_data.get('phone') or 'не указан'}",
                    "✨ Подготовьтесь заранее, всё будет отлично!"
                ])
                if send_via_email(client_data['email'], f"⏰ Напоминание о съёмке — {time_text}", html):
                    sent_count += 1

            # Telegram фотографу
            if photographer_data.get('telegram_chat_id'):
                message = format_reminder_for_photographer(project_data, client_data, hours_before)
                if send_telegram_message(photographer_data['telegram_chat_id'], message):
                    sent_count += 1

            # Email фотографу
            if photographer_data.get('email'):
                html = build_email_html(f"⏰ Съёмка {time_text}!", [
                    f"У вас съёмка <b>{time_text}</b>!",
                    f"🕐 <b>Время:</b> {time_str}",
                    f"📍 <b>Место:</b> {address}",
                    f"👤 <b>Клиент:</b> {client_data.get('name') or 'Клиент'}",
                    f"📞 <b>Телефон:</b> {client_data.get('phone') or 'не указан'}",
                    "🎯 Проверьте оборудование! Ничего не забудьте!"
                ])
                if send_via_email(photographer_data['email'], f"⏰ Напоминание о съёмке — {time_text}", html):
                    sent_count += 1

        cur.close()
        conn.close()
        return {'success': True, 'sent_count': sent_count, 'projects_count': len(projects)}

    except Exception as e:
        cur.close()
        conn.close()
        print(f"Error sending reminders: {str(e)}")
        return {'success': False, 'error': str(e)}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Отправка уведомлений о съёмках через Telegram и Email"""
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'},
            'body': '', 'isBase64Encoded': False
        }

    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')

        if action == 'send_project_notification':
            project_id = body.get('project_id')
            if not project_id:
                return {'statusCode': 400, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'project_id is required'}), 'isBase64Encoded': False}
            result = send_project_notifications(project_id)
            return {'statusCode': 200 if result.get('success') else 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps(result), 'isBase64Encoded': False}

        elif action == 'send_reminders':
            hours_before = body.get('hours_before', 24)
            result = send_shooting_reminders(hours_before)
            return {'statusCode': 200 if result.get('success') else 500, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps(result), 'isBase64Encoded': False}

        else:
            return {'statusCode': 400, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Invalid action'}), 'isBase64Encoded': False}

    return {'statusCode': 405, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'Method not allowed'}), 'isBase64Encoded': False}