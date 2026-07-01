"""
API встреч с клиентами (client_meetings): создание, список, обновление, отмена.
Отправляет уведомления клиенту и фотографу (MAX/WhatsApp + Telegram).
Отдельная сущность параллельно съёмкам (проектам).
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import requests

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

MONTHS_RU = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
             'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']


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
        payload = {'chat_id': telegram_id, 'text': message, 'disable_web_page_preview': True}
        response = requests.post(url, json=payload, timeout=10)
        result = response.json()
        if result.get('ok'):
            return {'success': True, 'message_id': result.get('result', {}).get('message_id')}
        return {'error': result.get('description', 'Unknown error')}
    except Exception as e:
        return {'error': str(e)}


def format_duration(minutes) -> str:
    if not minutes:
        return "1 ч"
    minutes = int(minutes)
    if minutes < 60:
        return f"{minutes} мин"
    hours = minutes // 60
    remaining = minutes % 60
    if remaining == 0:
        return f"{hours} ч"
    return f"{hours} ч {remaining} мин"


def format_date_ru(date_value) -> str:
    try:
        if isinstance(date_value, str):
            dt = datetime.fromisoformat(date_value.replace('Z', '')[:19]) if 'T' in date_value else datetime.strptime(date_value[:10], '%Y-%m-%d')
        else:
            dt = date_value
        return f"{dt.day} {MONTHS_RU[dt.month - 1]} {dt.year}"
    except Exception:
        return str(date_value)


def format_time(time_value) -> str:
    s = str(time_value or '')
    if ':' in s:
        parts = s.split(':')
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
    return s or '—'


def build_client_message(meeting: dict, photographer: dict) -> str:
    photographer_name = photographer.get('display_name') or photographer.get('email') or 'Фотограф'
    photographer_phone = photographer.get('phone') or 'не указан'
    lines = [
        f"🤝 Встреча с фотографом {photographer_name}",
        "",
        f"📌 Тема: {meeting.get('name') or 'Встреча'}",
        f"📅 Дата: {format_date_ru(meeting.get('meeting_date'))}",
        f"🕐 Время: {format_time(meeting.get('meeting_time'))}",
        f"⏱ Длительность: {format_duration(meeting.get('duration'))}",
    ]
    if meeting.get('address'):
        lines.append(f"📍 Место встречи: {meeting.get('address')}")
    if meeting.get('description'):
        lines.append("")
        lines.append(f"📝 Детали: {meeting.get('description')}")
    lines.extend([
        "",
        f"👤 Фотограф: {photographer_name}",
        f"📞 Телефон: {photographer_phone}",
        "",
        "Если нужно перенести встречу — свяжитесь с фотографом.",
    ])
    return "\n".join(lines)


def build_client_cancel_message(meeting: dict, photographer: dict) -> str:
    photographer_name = photographer.get('display_name') or photographer.get('email') or 'Фотограф'
    lines = [
        f"❌ Встреча отменена",
        "",
        f"📌 Тема: {meeting.get('name') or 'Встреча'}",
        f"📅 Дата: {format_date_ru(meeting.get('meeting_date'))}",
        f"🕐 Время: {format_time(meeting.get('meeting_time'))}",
    ]
    if meeting.get('cancel_reason'):
        lines.append(f"ℹ️ Причина: {meeting.get('cancel_reason')}")
    lines.extend(["", f"Фотограф: {photographer_name}"])
    return "\n".join(lines)


def build_photographer_message(meeting: dict, client: dict) -> str:
    lines = [
        "🤝 Новая встреча с клиентом!",
        "",
        f"📌 Тема: {meeting.get('name') or 'Встреча'}",
        f"📅 Дата: {format_date_ru(meeting.get('meeting_date'))}",
        f"🕐 Время: {format_time(meeting.get('meeting_time'))}",
        f"⏱ Длительность: {format_duration(meeting.get('duration'))}",
    ]
    if meeting.get('address'):
        lines.append(f"📍 Место встречи: {meeting.get('address')}")
    if meeting.get('description'):
        lines.append(f"📝 Детали: {meeting.get('description')}")
    lines.append("")
    lines.append(f"👤 Клиент: {client.get('name') or 'Клиент'}")
    if client.get('phone'):
        lines.append(f"📞 Телефон: {client.get('phone')}")
    if client.get('email'):
        lines.append(f"📧 Email: {client.get('email')}")
    if client.get('address'):
        lines.append(f"🏠 Адрес клиента: {client.get('address')}")
    return "\n".join(lines)


def notify_channels(target_phone, target_telegram, photographer, message) -> dict:
    """Пытается отправить в MAX/WhatsApp и Telegram. Возвращает {'whatsapp':..,'telegram':..}."""
    res = {}
    instance_id = photographer.get('green_api_instance_id') or ''
    token = photographer.get('green_api_token') or ''
    if not instance_id or not token:
        creds = get_max_credentials()
        instance_id = creds['instance_id']
        token = creds['token']
    if target_phone and instance_id and token:
        try:
            send_via_green_api(instance_id, token, target_phone, message)
            res['whatsapp'] = {'success': True}
        except Exception as e:
            res['whatsapp'] = {'error': str(e)[:200]}
    if target_telegram:
        res['telegram'] = send_via_telegram(str(target_telegram), message)
    return res


def load_meeting(cur, meeting_id, photographer_id):
    cur.execute(f"""
        SELECT id, client_id, photographer_id, name, meeting_date, meeting_time,
               duration, address, description, custom_reminder_at, status, cancel_reason
        FROM {SCHEMA}.client_meetings
        WHERE id = {escape_sql(meeting_id)} AND photographer_id = {escape_sql(photographer_id)}
    """)
    row = cur.fetchone()
    return dict(row) if row else None


def load_client(cur, client_id, photographer_id):
    cur.execute(f"""
        SELECT id, name, phone, email, address, telegram_chat_id
        FROM {SCHEMA}.clients
        WHERE id = {escape_sql(client_id)} AND photographer_id = {escape_sql(photographer_id)}
    """)
    row = cur.fetchone()
    return dict(row) if row else None


def load_photographer(cur, photographer_id):
    cur.execute(f"""
        SELECT id, email, phone, display_name, green_api_instance_id, green_api_token,
               telegram_chat_id, telegram_id, region
        FROM {SCHEMA}.users
        WHERE id = {escape_sql(photographer_id)}
    """)
    row = cur.fetchone()
    return dict(row) if row else None


def serialize_meeting(m: dict) -> dict:
    md = m.get('meeting_date')
    mt = m.get('meeting_time')
    cr = m.get('custom_reminder_at')
    return {
        'id': m['id'],
        'client_id': m['client_id'],
        'name': m.get('name'),
        'meeting_date': md.isoformat() if hasattr(md, 'isoformat') else md,
        'meeting_time': (str(mt)[:5] if mt else None),
        'duration': m.get('duration'),
        'address': m.get('address'),
        'description': m.get('description'),
        'custom_reminder_at': cr.isoformat() if hasattr(cr, 'isoformat') else cr,
        'status': m.get('status'),
        'cancel_reason': m.get('cancel_reason'),
    }


def resp(status, body):
    return {'statusCode': status, 'headers': CORS_HEADERS, 'body': json.dumps(body, default=str)}


def handler(event: dict, context) -> dict:
    """Управление встречами с клиентами: создание, список, обновление, отмена + уведомления."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return resp(401, {'error': 'Missing X-User-Id header'})
    try:
        photographer_id = int(user_id)
    except (TypeError, ValueError):
        return resp(400, {'error': 'Invalid user id'})

    conn = get_db_connection()
    try:
        if method == 'GET':
            params = event.get('queryStringParameters') or {}
            client_id = params.get('client_id')
            with conn.cursor() as cur:
                if client_id:
                    cur.execute(f"""
                        SELECT id, client_id, photographer_id, name, meeting_date, meeting_time,
                               duration, address, description, custom_reminder_at, status, cancel_reason
                        FROM {SCHEMA}.client_meetings
                        WHERE photographer_id = {escape_sql(photographer_id)}
                          AND client_id = {escape_sql(client_id)}
                        ORDER BY meeting_date DESC, id DESC
                    """)
                else:
                    cur.execute(f"""
                        SELECT id, client_id, photographer_id, name, meeting_date, meeting_time,
                               duration, address, description, custom_reminder_at, status, cancel_reason
                        FROM {SCHEMA}.client_meetings
                        WHERE photographer_id = {escape_sql(photographer_id)}
                        ORDER BY meeting_date DESC, id DESC
                    """)
                rows = [serialize_meeting(dict(r)) for r in cur.fetchall()]
            return resp(200, {'meetings': rows})

        body = json.loads(event.get('body') or '{}')

        if method == 'POST':
            client_id = body.get('client_id')
            name = (body.get('name') or 'Встреча').strip() or 'Встреча'
            meeting_date = body.get('meeting_date')
            meeting_time = body.get('meeting_time')
            duration = body.get('duration')
            address = body.get('address')
            description = body.get('description')
            custom_reminder_at = body.get('custom_reminder_at')
            notify_client = body.get('notify_client', True)
            notify_photographer = body.get('notify_photographer', True)

            if not client_id or not meeting_date:
                return resp(400, {'error': 'client_id and meeting_date required'})

            with conn.cursor() as cur:
                client = load_client(cur, client_id, photographer_id)
                if not client:
                    return resp(404, {'error': 'Client not found'})

                cur.execute(f"""
                    INSERT INTO {SCHEMA}.client_meetings
                    (client_id, photographer_id, name, meeting_date, meeting_time,
                     duration, address, description, custom_reminder_at, status)
                    VALUES ({escape_sql(client_id)}, {escape_sql(photographer_id)},
                            {escape_sql(name)}, {escape_sql(meeting_date)},
                            {escape_sql(meeting_time)}, {escape_sql(duration)},
                            {escape_sql(address)}, {escape_sql(description)},
                            {escape_sql(custom_reminder_at)}, 'new')
                    RETURNING id
                """)
                new_id = cur.fetchone()['id']
                conn.commit()

                meeting = load_meeting(cur, new_id, photographer_id)
                photographer = load_photographer(cur, photographer_id)

            results = {}
            if notify_client and (client.get('phone') or client.get('telegram_chat_id')):
                msg = build_client_message(meeting, photographer)
                results['client_notification'] = notify_channels(
                    client.get('phone'), client.get('telegram_chat_id'), photographer, msg
                )
            if notify_photographer and (photographer.get('phone') or photographer.get('telegram_chat_id') or photographer.get('telegram_id')):
                msg = build_photographer_message(meeting, client)
                results['photographer_notification'] = notify_channels(
                    photographer.get('phone'),
                    photographer.get('telegram_chat_id') or photographer.get('telegram_id'),
                    photographer, msg
                )

            return resp(200, {'ok': True, 'meeting': serialize_meeting(meeting), 'results': results})

        if method == 'PUT':
            meeting_id = body.get('id') or body.get('meeting_id')
            if not meeting_id:
                return resp(400, {'error': 'meeting id required'})
            notification_type = body.get('notification_type')
            notify_client = body.get('notify_client', False)

            with conn.cursor() as cur:
                existing = load_meeting(cur, meeting_id, photographer_id)
                if not existing:
                    return resp(404, {'error': 'Meeting not found'})

                sets = []
                for field in ['name', 'meeting_date', 'meeting_time', 'duration',
                              'address', 'description', 'custom_reminder_at', 'status', 'cancel_reason']:
                    if field in body:
                        sets.append(f"{field} = {escape_sql(body[field])}")
                sets.append("updated_at = CURRENT_TIMESTAMP")
                cur.execute(f"""
                    UPDATE {SCHEMA}.client_meetings
                    SET {', '.join(sets)}
                    WHERE id = {escape_sql(meeting_id)} AND photographer_id = {escape_sql(photographer_id)}
                """)
                conn.commit()
                meeting = load_meeting(cur, meeting_id, photographer_id)
                client = load_client(cur, meeting['client_id'], photographer_id)
                photographer = load_photographer(cur, photographer_id)

            results = {}
            if notification_type == 'cancellation' and notify_client and client and (client.get('phone') or client.get('telegram_chat_id')):
                msg = build_client_cancel_message(meeting, photographer)
                results['client_notification'] = notify_channels(
                    client.get('phone'), client.get('telegram_chat_id'), photographer, msg
                )

            return resp(200, {'ok': True, 'meeting': serialize_meeting(meeting), 'results': results})

        return resp(405, {'error': 'Method not allowed'})
    except Exception as e:
        conn.rollback()
        return resp(500, {'error': str(e)[:300]})
    finally:
        conn.close()
