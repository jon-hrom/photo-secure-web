"""
Cron-задача для отправки автоматических напоминаний о съёмках.
За 24 часа, 5 часов и 1 час. Каналы: WhatsApp (MAX), Telegram, Email.
Время рассчитывается по часовому поясу фотографа (из его региона).
Каскадная логика: при каждом вызове отправляет ВСЕ пропущенные напоминания.
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timezone, timedelta
import requests
import boto3
from botocore.exceptions import ClientError

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'

REGION_TIMEZONE = {
    "Калининградская область": "Europe/Kaliningrad",
    "Москва": "Europe/Moscow", "Московская область": "Europe/Moscow",
    "Санкт-Петербург": "Europe/Moscow", "Ленинградская область": "Europe/Moscow",
    "Адыгея": "Europe/Moscow", "Республика Адыгея": "Europe/Moscow",
    "Архангельская область": "Europe/Moscow",
    "Белгородская область": "Europe/Moscow",
    "Брянская область": "Europe/Moscow",
    "Владимирская область": "Europe/Moscow",
    "Вологодская область": "Europe/Moscow",
    "Воронежская область": "Europe/Moscow",
    "Ивановская область": "Europe/Moscow",
    "Калужская область": "Europe/Moscow",
    "Карелия": "Europe/Moscow", "Республика Карелия": "Europe/Moscow",
    "Коми": "Europe/Moscow", "Республика Коми": "Europe/Moscow",
    "Костромская область": "Europe/Moscow",
    "Краснодарский край": "Europe/Moscow",
    "Курская область": "Europe/Moscow",
    "Липецкая область": "Europe/Moscow",
    "Марий Эл": "Europe/Moscow", "Республика Марий Эл": "Europe/Moscow",
    "Мордовия": "Europe/Moscow", "Республика Мордовия": "Europe/Moscow",
    "Мурманская область": "Europe/Moscow",
    "Ненецкий автономный округ": "Europe/Moscow",
    "Нижегородская область": "Europe/Moscow",
    "Новгородская область": "Europe/Moscow",
    "Орловская область": "Europe/Moscow",
    "Пензенская область": "Europe/Moscow",
    "Псковская область": "Europe/Moscow",
    "Ростовская область": "Europe/Moscow",
    "Рязанская область": "Europe/Moscow",
    "Смоленская область": "Europe/Moscow",
    "Тамбовская область": "Europe/Moscow",
    "Тверская область": "Europe/Moscow",
    "Тульская область": "Europe/Moscow",
    "Ярославская область": "Europe/Moscow",
    "Кабардино-Балкария": "Europe/Moscow", "Кабардино-Балкарская Республика": "Europe/Moscow",
    "Карачаево-Черкесия": "Europe/Moscow", "Карачаево-Черкесская Республика": "Europe/Moscow",
    "Северная Осетия": "Europe/Moscow", "Республика Северная Осетия — Алания": "Europe/Moscow",
    "Чечня": "Europe/Moscow", "Чеченская Республика": "Europe/Moscow",
    "Ингушетия": "Europe/Moscow", "Республика Ингушетия": "Europe/Moscow",
    "Дагестан": "Europe/Moscow", "Республика Дагестан": "Europe/Moscow",
    "Ставропольский край": "Europe/Moscow",
    "Крым": "Europe/Moscow", "Республика Крым": "Europe/Moscow",
    "Севастополь": "Europe/Moscow",
    "Волгоградская область": "Europe/Moscow",
    "Кировская область": "Europe/Moscow",
    "Татарстан": "Europe/Moscow", "Республика Татарстан": "Europe/Moscow",
    "Чувашия": "Europe/Moscow", "Чувашская Республика": "Europe/Moscow",
    "Астраханская область": "Europe/Samara",
    "Самарская область": "Europe/Samara",
    "Саратовская область": "Europe/Samara",
    "Удмуртия": "Europe/Samara", "Удмуртская Республика": "Europe/Samara",
    "Ульяновская область": "Europe/Samara",
    "Башкортостан": "Asia/Yekaterinburg", "Республика Башкортостан": "Asia/Yekaterinburg",
    "Курганская область": "Asia/Yekaterinburg",
    "Оренбургская область": "Asia/Yekaterinburg",
    "Пермский край": "Asia/Yekaterinburg",
    "Свердловская область": "Asia/Yekaterinburg",
    "Тюменская область": "Asia/Yekaterinburg",
    "Челябинская область": "Asia/Yekaterinburg",
    "Ханты-Мансийский автономный округ": "Asia/Yekaterinburg",
    "Ямало-Ненецкий автономный округ": "Asia/Yekaterinburg",
    "Алтайский край": "Asia/Barnaul",
    "Республика Алтай": "Asia/Barnaul",
    "Кемеровская область": "Asia/Novokuznetsk",
    "Новосибирская область": "Asia/Novosibirsk",
    "Омская область": "Asia/Omsk",
    "Томская область": "Asia/Tomsk",
    "Красноярский край": "Asia/Krasnoyarsk",
    "Тыва": "Asia/Krasnoyarsk", "Республика Тыва": "Asia/Krasnoyarsk",
    "Хакасия": "Asia/Krasnoyarsk", "Республика Хакасия": "Asia/Krasnoyarsk",
    "Иркутская область": "Asia/Irkutsk",
    "Бурятия": "Asia/Irkutsk", "Республика Бурятия": "Asia/Irkutsk",
    "Забайкальский край": "Asia/Chita",
    "Амурская область": "Asia/Yakutsk",
    "Саха (Якутия)": "Asia/Yakutsk", "Республика Саха (Якутия)": "Asia/Yakutsk",
    "Еврейская автономная область": "Asia/Vladivostok",
    "Приморский край": "Asia/Vladivostok",
    "Хабаровский край": "Asia/Vladivostok",
    "Магаданская область": "Asia/Magadan",
    "Сахалинская область": "Asia/Sakhalin",
    "Камчатский край": "Asia/Kamchatka",
    "Чукотский автономный округ": "Asia/Kamchatka",
}

TZ_OFFSETS = {
    "Europe/Kaliningrad": 2,
    "Europe/Moscow": 3,
    "Europe/Samara": 4,
    "Asia/Yekaterinburg": 5,
    "Asia/Omsk": 6,
    "Asia/Barnaul": 7,
    "Asia/Novosibirsk": 7,
    "Asia/Novokuznetsk": 7,
    "Asia/Tomsk": 7,
    "Asia/Krasnoyarsk": 7,
    "Asia/Irkutsk": 8,
    "Asia/Chita": 9,
    "Asia/Yakutsk": 9,
    "Asia/Vladivostok": 10,
    "Asia/Magadan": 11,
    "Asia/Sakhalin": 11,
    "Asia/Kamchatka": 12,
}


def get_photographer_now(region: str) -> datetime:
    tz_name = REGION_TIMEZONE.get(region, "Europe/Moscow")
    offset_hours = TZ_OFFSETS.get(tz_name, 3)
    tz = timezone(timedelta(hours=offset_hours))
    return datetime.now(tz).replace(tzinfo=None)


def get_tz_label(region: str) -> str:
    tz_name = REGION_TIMEZONE.get(region, "Europe/Moscow")
    offset_hours = TZ_OFFSETS.get(tz_name, 3)
    return f"UTC+{offset_hours}"


def get_quarter_send_time(shooting_dt: datetime, hours_before: float) -> datetime:
    ideal = shooting_dt - timedelta(hours=hours_before)
    aligned_minute = (ideal.minute // 15) * 15
    return ideal.replace(minute=aligned_minute, second=0, microsecond=0)


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


def format_time_until(hours: float) -> str:
    """Форматировать время до съёмки в часы и минуты"""
    if hours <= 0:
        return "скоро"
    total_minutes = int(hours * 60)
    h = total_minutes // 60
    m = total_minutes % 60
    if h == 0:
        return f"через {m} мин"
    if m == 0:
        return f"через {h} ч"
    return f"через {h} ч {m} мин"


def send_reminder(reminder_type: str, project: dict, client: dict, photographer: dict, creds: dict, tz_label: str = '', hours_until: float = None) -> dict:
    time_str = format_time(project['shooting_time'])
    if tz_label:
        time_str = f"{time_str} ({tz_label})"
    address = project['shooting_address'] or 'не указано'
    photographer_name = photographer.get('display_name') or photographer.get('email', 'Фотограф')
    photographer_phone = photographer.get('phone', 'не указан')
    client_name = client['name']
    client_phone = client['phone'] or 'не указан'

    if hours_until is not None:
        real_time_text = format_time_until(hours_until)
    else:
        real_time_text = None

    labels = {
        '24h': ('Напоминание о завтрашней съёмке', 'завтра', 'Подготовьтесь заранее! До встречи завтра!', 'Проверьте оборудование заранее!'),
        'today': ('Напоминание о сегодняшней съёмке', 'сегодня', 'Подготовьтесь заранее! До встречи сегодня!', 'Проверьте оборудование заранее!'),
        '5h': ('Съёмка через 5 часов', real_time_text or 'через 5 часов', 'Выезжайте заранее с учётом пробок!', 'Проверьте флешки, аккумуляторы, объективы. Выезжайте с запасом!'),
        '1h': ('Съёмка через 1 час', real_time_text or 'через 1 час', 'Ждём вас! Будет красиво!', 'В путь! Удачной съёмки!')
    }
    title, time_text, client_tip, photographer_tip = labels[reminder_type]
    if real_time_text and reminder_type in ('5h', '1h'):
        title = f"Съёмка {real_time_text}"

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
            print(f"[WA] Client {client['name']} OK")
        except Exception as e:
            results['client']['whatsapp_error'] = str(e)
            print(f"[WA] Client {client['name']} FAIL: {e}")

    client_tg = client.get('telegram_chat_id') or client.get('telegram_id')
    if client_tg:
        result = send_via_telegram(client_tg, client_msg)
        results['client']['telegram'] = result.get('success', False)
        print(f"[TG] Client {client['name']}: {result}")

    if client.get('email'):
        results['client']['email'] = send_via_email(client['email'], client_email_subject, client_email_html)

    if photographer.get('phone'):
        try:
            send_via_green_api(creds['instance_id'], creds['token'], photographer['phone'], photographer_msg)
            results['photographer']['whatsapp'] = True
            print(f"[WA] Photographer {photographer['display_name']} OK")
        except Exception as e:
            results['photographer']['whatsapp_error'] = str(e)
            print(f"[WA] Photographer {photographer['display_name']} FAIL: {e}")

    photographer_tg = photographer.get('telegram_chat_id') or photographer.get('telegram_id')
    if photographer_tg:
        result = send_via_telegram(photographer_tg, photographer_msg)
        results['photographer']['telegram'] = result.get('success', False)
        print(f"[TG] Photographer {photographer['display_name']}: {result}")

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


def get_sent_reminders(cur, project_id):
    cur.execute(f"""
        SELECT reminder_type FROM {SCHEMA}.shooting_reminders_log
        WHERE project_id = {escape_sql(project_id)}
          AND success = TRUE
    """)
    return set(row['reminder_type'] for row in cur.fetchall())


def determine_pending_reminders(hours_until: float, already_sent: set, is_today: bool = False, now_local: datetime = None, shooting_dt: datetime = None) -> list:
    """
    Каскадная логика: определяет какие напоминания нужно отправить СЕЙЧАС.
    Каскад: сначала самое срочное (1h), потом 5h, потом 24h.
    Пропущенные напоминания тоже догоняются и отправляются.
    """
    if hours_until <= 0 or hours_until > 49:
        return []

    pending = []

    if '24h' not in already_sent and not is_today and hours_until <= 25:
        pending.append('24h')
    if '5h' not in already_sent and hours_until <= 5.5:
        pending.append('5h')
    if '1h' not in already_sent and hours_until <= 1.5:
        pending.append('1h')

    return pending


def handler(event, context):
    """Крон напоминаний о съёмках: 24ч, 5ч, 1ч. WhatsApp + Telegram + Email. Каскадная логика — догоняет пропущенные напоминания."""

    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'},
            'body': '', 'isBase64Encoded': False
        }

    print("[CRON] === Shooting reminders cron started ===")

    conn = get_db_connection()
    creds = get_max_credentials()

    if not creds['instance_id'] or not creds['token']:
        print("[WARN] MAX credentials not configured, will skip WhatsApp")

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
                        u.telegram_chat_id as photographer_telegram_id,
                        u.region as photographer_region
                    FROM {SCHEMA}.client_projects cp
                    JOIN {SCHEMA}.clients c ON cp.client_id = c.id
                    JOIN {SCHEMA}.users u ON c.photographer_id = u.id
                    WHERE cp.id = {escape_sql(immediate_project_id)}
                """)
                proj = cur.fetchone()

            if proj and proj['start_date'] and proj['shooting_time']:
                region = proj.get('photographer_region') or ''
                now_local = get_photographer_now(region)
                tz_label = get_tz_label(region)
                shooting_datetime = datetime.combine(proj['start_date'], proj['shooting_time'])
                hours_until = (shooting_datetime - now_local).total_seconds() / 3600

                print(f"[IMMEDIATE] Region: {region}, TZ: {tz_label}, now_local: {now_local}, shooting: {shooting_datetime}, hours_until: {hours_until:.1f}")

                start_date_only = proj['start_date'].date() if hasattr(proj['start_date'], 'date') else proj['start_date']
                is_today = start_date_only == now_local.date()

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
                    elif not is_today:
                        rtype = '24h'
                    else:
                        conn.close()
                        return {
                            'statusCode': 200,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'success': True, 'immediate': True, 'skipped': True, 'reason': 'Shooting is today, 24h reminder not applicable'}),
                            'isBase64Encoded': False
                        }

                    delay = int(body.get('delay_seconds', 0))
                    if delay > 0:
                        import time
                        print(f"[IMMEDIATE] Waiting {delay}s before sending reminder (let booking notification arrive first)")
                        time.sleep(delay)

                    result = send_reminder(rtype, dict(proj), client_data, photographer_data, creds, tz_label, hours_until)
                    log_reminder(conn, proj['project_id'], rtype, 'both', True)
                    print(f"[IMMEDIATE] Sent {rtype} reminder for project {proj['project_id']}, {hours_until:.1f}h until shooting")

                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'success': True, 'immediate': True, 'project_id': immediate_project_id, 'reminder_type': rtype, 'hours_until': round(hours_until, 1), 'timezone': tz_label, 'result': result}),
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
        results = {'reminders_sent': [], 'projects_checked': 0, 'skipped': []}

        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT 
                    cp.id as project_id, cp.name as project_name,
                    cp.start_date, cp.shooting_time, cp.shooting_address,
                    cp.status,
                    c.id as client_id, c.name as client_name,
                    c.phone as client_phone, c.telegram_chat_id as client_telegram_id,
                    c.email as client_email,
                    u.id as photographer_id, u.display_name as photographer_name,
                    u.email as photographer_email, u.phone as photographer_phone,
                    u.telegram_chat_id as photographer_telegram_id,
                    u.region as photographer_region
                FROM {SCHEMA}.client_projects cp
                JOIN {SCHEMA}.clients c ON cp.client_id = c.id
                JOIN {SCHEMA}.users u ON c.photographer_id = u.id
                WHERE cp.start_date IS NOT NULL
                  AND cp.shooting_time IS NOT NULL
                  AND cp.status IN ('new', 'in_progress', 'scheduled')
                  AND cp.start_date >= CURRENT_DATE - INTERVAL '1 day'
                  AND cp.start_date <= CURRENT_DATE + INTERVAL '2 days'
            """)
            projects = cur.fetchall()

            print(f"[CRON] Found {len(projects)} projects to check")

            for proj in projects:
                region = proj.get('photographer_region') or ''
                now_local = get_photographer_now(region)
                tz_label = get_tz_label(region)
                shooting_datetime = datetime.combine(proj['start_date'], proj['shooting_time'])
                hours_until = (shooting_datetime - now_local).total_seconds() / 3600

                results['projects_checked'] += 1
                print(f"[CRON] Project {proj['project_id']} '{proj['project_name']}': region={region}, tz={tz_label}, now_local={now_local.strftime('%Y-%m-%d %H:%M')}, shooting={shooting_datetime.strftime('%Y-%m-%d %H:%M')}, hours_until={hours_until:.1f}, status={proj['status']}")

                already_sent = get_sent_reminders(cur, proj['project_id'])
                if already_sent:
                    print(f"[CRON] Project {proj['project_id']}: already sent = {already_sent}")

                start_date_only = proj['start_date'].date() if hasattr(proj['start_date'], 'date') else proj['start_date']
                is_today = start_date_only == now_local.date()
                pending = determine_pending_reminders(hours_until, already_sent, is_today=is_today, now_local=now_local, shooting_dt=shooting_datetime)

                if not pending:
                    reason = 'already passed' if hours_until <= 0 else ('too far' if hours_until > 25 else 'all sent')
                    results['skipped'].append({
                        'project_id': proj['project_id'],
                        'project_name': proj['project_name'],
                        'hours_until': round(hours_until, 1),
                        'reason': reason,
                        'already_sent': list(already_sent)
                    })
                    continue

                print(f"[CRON] Project {proj['project_id']}: will send {pending}")

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

                for reminder_type in pending:
                    try:
                        result = send_reminder(reminder_type, project_data, client_data, photographer_data, creds, tz_label, hours_until)
                        log_reminder(conn, proj['project_id'], reminder_type, 'both', True)
                        results['reminders_sent'].append({
                            'project_id': proj['project_id'],
                            'project_name': proj['project_name'],
                            'reminder_type': reminder_type,
                            'timezone': tz_label,
                            'hours_until': round(hours_until, 1),
                            'result': result
                        })
                        print(f"[SENT] {reminder_type} for project {proj['project_id']} '{proj['project_name']}' ({tz_label}, {hours_until:.1f}h)")
                    except Exception as e:
                        log_reminder(conn, proj['project_id'], reminder_type, 'both', False, str(e))
                        print(f"[ERROR] {reminder_type} for project {proj['project_id']}: {e}")

        conn.close()
        now_utc = datetime.now(timezone.utc)
        summary = {
            'success': True,
            'timestamp_utc': now_utc.isoformat(),
            'projects_checked': results['projects_checked'],
            'reminders_sent_count': len(results['reminders_sent']),
            'reminders_sent': results['reminders_sent'],
            'skipped': results['skipped']
        }
        print(f"[CRON] === Done. Sent {len(results['reminders_sent'])} reminders, checked {results['projects_checked']} projects ===")
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(summary),
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