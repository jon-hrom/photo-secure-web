"""
Cron-задача для отправки автоматических напоминаний о съёмках.
За 24 часа, 5 часов и 1 час. Каналы: WhatsApp (MAX), Telegram, Email.
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import requests
import boto3
from botocore.exceptions import ClientError

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'


def escape_sql(value):
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def get_max_credentials():
    return {
        'instance_id': os.environ.get('MAX_INSTANCE_ID', ''),
        'token': os.environ.get('MAX_TOKEN', '')
    }


def send_via_green_api(instance_id: str, token: str, phone: str, message: str) -> dict:
    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"
    clean_phone = ''.join(filter(str.isdigit, phone))
    if not clean_phone.startswith('7'):
        clean_phone = '7' + clean_phone.lstrip('8')
    payload = {"chatId": f"{clean_phone}@c.us", "message": message}
    response = requests.post(url, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def send_via_telegram(telegram_id: str, message: str) -> dict:
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not bot_token:
        return {'error': 'Telegram bot token not configured'}
    try:
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        payload = {'chat_id': telegram_id, 'text': message, 'parse_mode': 'HTML', 'disable_web_page_preview': True}
        response = requests.post(url, json=payload, timeout=10)
        result = response.json()
        if result.get('ok'):
            return {'success': True, 'message_id': result.get('result', {}).get('message_id')}
        else:
            return {'error': result.get('description', 'Unknown error')}
    except Exception as e:
        return {'error': str(e)}


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


def format_time(time_obj) -> str:
    if not time_obj:
        return "не указано"
    time_str = str(time_obj)
    if ':' in time_str:
        parts = time_str.split(':')
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    return time_str


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


def send_reminder(reminder_type: str, project: dict, client: dict, photographer: dict, creds: dict) -> dict:
    time_str = format_time(project['shooting_time'])
    address = project['shooting_address'] or 'не указано'
    photographer_name = photographer.get('display_name') or photographer.get('email', 'Фотограф')
    photographer_phone = photographer.get('phone', 'не указан')
    client_name = client['name']
    client_phone = client['phone'] or 'не указан'

    labels = {
        '24h': ('Напоминание о завтрашней съёмке', 'завтра', 'Подготовьтесь заранее! До встречи завтра!', 'Проверьте оборудование заранее!'),
        '5h': ('Съёмка через 5 часов', 'через 5 часов', 'Выезжайте заранее с учётом пробок!', 'Проверьте флешки, аккумуляторы, объективы. Выезжайте с запасом!'),
        '1h': ('Съёмка через 1 час', 'через 1 час', 'Ждём вас! Будет красиво!', 'В путь! Удачной съёмки!')
    }
    title, time_text, client_tip, photographer_tip = labels[reminder_type]

    client_msg = f"""⏰ {title}!

📸 Ваша фотосессия {time_text}!

🕐 Время: {time_str}
📍 Место: {address}

👤 Фотограф: {photographer_name}
📞 Телефон: {photographer_phone}

✨ {client_tip} 📷"""

    photographer_msg = f"""⏰ {title}!

📸 У вас съёмка {time_text}!

🕐 Время: {time_str}
📍 Место: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

🎯 {photographer_tip}"""

    client_email_subject = f"⏰ {title} — {time_str}"
    client_email_html = build_email_html(f"📸 {title}", [
        f"Ваша фотосессия <b>{time_text}</b>!",
        f"🕐 <b>Время:</b> {time_str}",
        f"📍 <b>Место:</b> {address}",
        f"👤 <b>Фотограф:</b> {photographer_name}",
        f"📞 <b>Телефон:</b> {photographer_phone}",
        f"✨ {client_tip}"
    ])
    photographer_email_subject = f"⏰ {title} — {time_str}"
    photographer_email_html = build_email_html(f"📸 {title}", [
        f"У вас съёмка <b>{time_text}</b>!",
        f"🕐 <b>Время:</b> {time_str}",
        f"📍 <b>Место:</b> {address}",
        f"👤 <b>Клиент:</b> {client_name}",
        f"📞 <b>Телефон:</b> {client_phone}",
        f"🎯 {photographer_tip}"
    ])

    results = {'client': {}, 'photographer': {}}

    if client.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], client['phone'], client_msg)
            results['client']['whatsapp'] = True
        except Exception as e:
            results['client']['whatsapp_error'] = str(e)

    if client.get('telegram_id'):
        result = send_via_telegram(client['telegram_id'], client_msg)
        results['client']['telegram'] = result.get('success', False)

    if client.get('email'):
        results['client']['email'] = send_via_email(client['email'], client_email_subject, client_email_html)

    if photographer.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], photographer['phone'], photographer_msg)
            results['photographer']['whatsapp'] = True
        except Exception as e:
            results['photographer']['whatsapp_error'] = str(e)

    if photographer.get('telegram_id'):
        result = send_via_telegram(photographer['telegram_id'], photographer_msg)
        results['photographer']['telegram'] = result.get('success', False)

    if photographer.get('email'):
        results['photographer']['email'] = send_via_email(photographer['email'], photographer_email_subject, photographer_email_html)

    return results


def log_reminder(conn, project_id, reminder_type, sent_to='both', success=True, error_message=None):
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.shooting_reminders_log 
                (project_id, reminder_type, sent_to, channel, success, error_message)
                VALUES ({escape_sql(project_id)}, {escape_sql(reminder_type)}, {escape_sql(sent_to)}, 'both', {escape_sql(success)}, {escape_sql(error_message)})
            """)
            conn.commit()
    except Exception as e:
        print(f"[LOG_ERROR] {e}")
        conn.rollback()


def handler(event, context):
    """Крон напоминаний о съёмках: 24ч, 5ч, 1ч. WhatsApp + Telegram + Email."""

    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'},
            'body': '', 'isBase64Encoded': False
        }

    conn = get_db_connection()
    creds = get_max_credentials()

    if not creds['instance_id'] or not creds['token']:
        print("[WARN] MAX credentials not configured, will skip WhatsApp")

    # Немедленная отправка для конкретного проекта (< 24ч до съёмки)
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except:
            pass
    immediate_project_id = body.get('immediate_project_id')

    if immediate_project_id:
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT 
                        cp.id as project_id, cp.name as project_name,
                        cp.start_date, cp.shooting_time, cp.shooting_address,
                        c.id as client_id, c.name as client_name,
                        c.phone as client_phone, c.telegram_chat_id as client_telegram_id,
                        c.email as client_email,
                        u.id as photographer_id, u.display_name as photographer_name,
                        u.email as photographer_email, u.phone as photographer_phone,
                        u.telegram_chat_id as photographer_telegram_id
                    FROM {SCHEMA}.client_projects cp
                    JOIN {SCHEMA}.clients c ON cp.client_id = c.id
                    JOIN {SCHEMA}.users u ON c.photographer_id = u.id
                    WHERE cp.id = {escape_sql(immediate_project_id)}
                """)
                proj = cur.fetchone()

            if proj and proj['start_date'] and proj['shooting_time']:
                shooting_datetime = datetime.combine(proj['start_date'], proj['shooting_time'])
                hours_until = (shooting_datetime - datetime.now()).total_seconds() / 3600

                if 0 < hours_until < 24:
                    client_data = {
                        'id': proj['client_id'], 'name': proj['client_name'],
                        'phone': proj['client_phone'], 'telegram_id': proj['client_telegram_id'],
                        'email': proj['client_email']
                    }
                    photographer_data = {
                        'id': proj['photographer_id'], 'display_name': proj['photographer_name'],
                        'email': proj['photographer_email'], 'phone': proj['photographer_phone'],
                        'telegram_id': proj['photographer_telegram_id']
                    }

                    if hours_until < 1.5:
                        rtype = '1h'
                    elif hours_until < 5.5:
                        rtype = '5h'
                    else:
                        rtype = '24h'

                    result = send_reminder(rtype, dict(proj), client_data, photographer_data, creds)
                    log_reminder(conn, proj['project_id'], rtype, 'both', True)
                    print(f"[IMMEDIATE] Sent {rtype} reminder for project {proj['project_id']}, {hours_until:.1f}h until shooting")

                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'success': True, 'immediate': True, 'project_id': immediate_project_id, 'reminder_type': rtype, 'hours_until': round(hours_until, 1), 'result': result}),
                        'isBase64Encoded': False
                    }

            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'immediate': True, 'skipped': True, 'reason': 'Project not found or shooting > 24h away'}),
                'isBase64Encoded': False
            }
        except Exception as e:
            print(f"[IMMEDIATE_ERROR] {e}")
            conn.close()
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': str(e)}),
                'isBase64Encoded': False
            }

    try:
        now = datetime.now()
        results = {'24h_reminders': [], '5h_reminders': [], '1h_reminders': []}

        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT 
                    cp.id as project_id, cp.name as project_name,
                    cp.start_date, cp.shooting_time, cp.shooting_address,
                    c.id as client_id, c.name as client_name,
                    c.phone as client_phone, c.telegram_chat_id as client_telegram_id,
                    c.email as client_email,
                    u.id as photographer_id, u.display_name as photographer_name,
                    u.email as photographer_email, u.phone as photographer_phone,
                    u.telegram_chat_id as photographer_telegram_id
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
                shooting_datetime = datetime.combine(proj['start_date'], proj['shooting_time'])
                time_diff = shooting_datetime - now
                hours_until = time_diff.total_seconds() / 3600

                project_data = dict(proj)
                client_data = {
                    'id': proj['client_id'], 'name': proj['client_name'],
                    'phone': proj['client_phone'], 'telegram_id': proj['client_telegram_id'],
                    'email': proj['client_email']
                }
                photographer_data = {
                    'id': proj['photographer_id'], 'display_name': proj['photographer_name'],
                    'email': proj['photographer_email'], 'phone': proj['photographer_phone'],
                    'telegram_id': proj['photographer_telegram_id']
                }

                reminder_type = None
                if 23 <= hours_until < 25:
                    reminder_type = '24h'
                elif 4.5 <= hours_until < 5.5:
                    reminder_type = '5h'
                elif 0.5 <= hours_until < 1.5:
                    reminder_type = '1h'

                if reminder_type:
                    cur.execute(f"""
                        SELECT 1 FROM {SCHEMA}.shooting_reminders_log
                        WHERE project_id = {escape_sql(proj['project_id'])}
                          AND reminder_type = {escape_sql(reminder_type)}
                          AND success = TRUE
                    """)
                    if not cur.fetchone():
                        try:
                            result = send_reminder(reminder_type, project_data, client_data, photographer_data, creds)
                            log_reminder(conn, proj['project_id'], reminder_type, 'both', True)
                            results[f'{reminder_type}_reminders'].append({
                                'project_id': proj['project_id'],
                                'project_name': proj['project_name'],
                                'result': result
                            })
                            print(f"[{reminder_type.upper()}] Sent for project {proj['project_id']}")
                        except Exception as e:
                            log_reminder(conn, proj['project_id'], reminder_type, 'both', False, str(e))
                            print(f"[{reminder_type.upper()}_ERROR] {proj['project_id']}: {e}")

        conn.close()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True, 'timestamp': now.isoformat(), 'reminders_sent': results}),
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