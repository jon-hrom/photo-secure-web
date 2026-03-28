"""
Business: Send security notifications to photographers via MAX (GreenAPI) and Email
Args: event - dict with httpMethod, body; context - object with request_id
Returns: HTTP response dict with statusCode, headers, body
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from typing import Dict, Any, Optional
import requests
import boto3
from botocore.exceptions import ClientError
from zoneinfo import ZoneInfo

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

LOGIN_METHOD_LABELS = {
    "biometric": "Биометрия",
    "password": "Пароль",
    "sms": "SMS-код",
    "google": "Google",
    "vk": "ВКонтакте",
}

import re as _re

def parse_user_agent(ua: str) -> str:
    if not ua:
        return "Неизвестное устройство"
    device = ""
    if "iPhone" in ua:
        m = _re.search(r'iPhone OS (\d+[_\.]\d+)', ua)
        ver = m.group(1).replace('_', '.') if m else ''
        device = f"iPhone (iOS {ver})" if ver else "iPhone"
    elif "iPad" in ua:
        device = "iPad"
    elif "Android" in ua:
        m = _re.search(r'Android (\d+[\.\d]*)', ua)
        ver = m.group(1) if m else ''
        model = _re.search(r';\s*([^;)]+)\s*Build', ua)
        model_name = model.group(1).strip() if model else ''
        if model_name:
            device = f"{model_name} (Android {ver})" if ver else model_name
        else:
            device = f"Android {ver}" if ver else "Android"
    elif "Macintosh" in ua:
        device = "Mac"
    elif "Windows" in ua:
        device = "Windows ПК"
    elif "Linux" in ua:
        device = "Linux ПК"
    else:
        device = "Устройство"
    browser = ""
    if "YaBrowser" in ua:
        browser = "Яндекс Браузер"
    elif "Edg/" in ua:
        browser = "Edge"
    elif "OPR/" in ua or "Opera" in ua:
        browser = "Opera"
    elif "Chrome/" in ua and "Safari/" in ua:
        browser = "Chrome"
    elif "Safari/" in ua and "Chrome" not in ua:
        browser = "Safari"
    elif "Firefox/" in ua:
        browser = "Firefox"
    if browser:
        return f"{device}, {browser}"
    return device


def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL not configured')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)


def get_local_time(region: Optional[str]) -> str:
    tz_name = REGION_TIMEZONE.get(region, "Europe/Moscow") if region else "Europe/Moscow"
    tz = ZoneInfo(tz_name)
    now = datetime.now(tz)
    return now.strftime("%d.%m.%Y %H:%M")


def send_via_green_api(instance_id: str, token: str, phone: str, message: str) -> bool:
    clean_phone = ''.join(filter(str.isdigit, phone))
    if not clean_phone.startswith('7'):
        clean_phone = '7' + clean_phone.lstrip('8')

    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    green_url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"

    payload = {"chatId": f"{clean_phone}@c.us", "message": message}
    print(f"[SECURITY-NOTIFY] Sending MAX to {clean_phone}@c.us via instance {instance_id}")

    response = requests.post(green_url, json=payload, timeout=15)
    print(f"[SECURITY-NOTIFY] MAX response: {response.status_code} {response.text}")
    response.raise_for_status()
    return True


def send_max_to_photographer(conn, user: dict, message: str) -> bool:
    phone = user.get('phone')
    if not phone:
        print("[SECURITY-NOTIFY] No phone for user, skipping MAX")
        return False

    if user.get('green_api_instance_id') and user.get('green_api_token'):
        try:
            return send_via_green_api(user['green_api_instance_id'], user['green_api_token'], phone, message)
        except Exception as e:
            print(f"[SECURITY-NOTIFY] User credentials failed: {e}, trying system fallback")

    sys_instance = os.environ.get('MAX_INSTANCE_ID', '')
    sys_token = os.environ.get('MAX_TOKEN', '')
    if sys_instance and sys_token:
        try:
            return send_via_green_api(sys_instance, sys_token, phone, message)
        except Exception as e:
            print(f"[SECURITY-NOTIFY] System credentials failed: {e}")
            return False

    print("[SECURITY-NOTIFY] No MAX credentials available")
    return False


def send_email_to_photographer(email: str, subject: str, html_body: str) -> bool:
    try:
        access_key_id = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        secret_access_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        if not access_key_id or not secret_access_key:
            print("[SECURITY-NOTIFY] POSTBOX credentials not set")
            return False

        client = boto3.client(
            'sesv2',
            region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key
        )

        client.send_email(
            FromEmailAddress='FotoMix <info@foto-mix.ru>',
            Destination={'ToAddresses': [email]},
            Content={
                'Simple': {
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}}
                }
            }
        )
        print(f"[SECURITY-NOTIFY] Email sent to {email}")
        return True
    except ClientError as e:
        print(f"[SECURITY-NOTIFY] Email ClientError: {e.response['Error']['Code']} - {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"[SECURITY-NOTIFY] Email error: {e}")
        return False


def get_user_by_id(conn, user_id: int) -> Optional[dict]:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id, email, phone, display_name, region, "
            f"green_api_instance_id, green_api_token, max_phone, max_connected "
            f"FROM {SCHEMA}.users WHERE id = %s",
            (user_id,)
        )
        return cur.fetchone()


def build_login_alert_html(device_info: str, ip_address: str, login_method_label: str, local_time: str, display_name: str) -> str:
    return f'''<!DOCTYPE html>
<html lang="ru">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0; font-size: 24px;">&#128274; Вход с нового устройства</h1>
    </div>
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
        <p style="font-size: 16px;">Здравствуйте, {display_name}!</p>
        <p style="font-size: 15px;">Зафиксирован вход в ваш аккаунт с нового устройства:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">&#128241; Устройство</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">{device_info}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">&#127760; IP-адрес</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">{ip_address}</td></tr>
            <tr><td style="padding: 10px; border-bottom: 1px solid #eee; color: #666;">&#128273; Способ входа</td><td style="padding: 10px; border-bottom: 1px solid #eee; font-weight: bold;">{login_method_label}</td></tr>
            <tr><td style="padding: 10px; color: #666;">&#9200; Время</td><td style="padding: 10px; font-weight: bold;">{local_time}</td></tr>
        </table>
        <p style="font-size: 15px;">Если это были вы — всё в порядке.</p>
        <div style="background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <strong>Если это были не вы</strong> — срочно смените пароль в Настройках!
        </div>
    </div>
    <p style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">FotoMix — foto-mix.ru</p>
</body>
</html>'''


def is_known_device(conn, user_id, raw_user_agent: str) -> bool:
    current_fingerprint = parse_user_agent(raw_user_agent)
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT user_agent FROM {SCHEMA}.active_sessions
                WHERE user_id = %s AND is_valid = TRUE
                ORDER BY last_activity DESC LIMIT 50
            """, (user_id,))
            rows = cur.fetchall()
            for row in rows:
                prev_fingerprint = parse_user_agent(row.get('user_agent') or '')
                if prev_fingerprint == current_fingerprint:
                    return True
    except Exception as e:
        print(f"[SECURITY-NOTIFY] Error checking known devices: {e}")
    return False


def handle_login_alert(conn, body: dict) -> Dict[str, Any]:
    user_id = body.get('user_id')
    raw_device = body.get('device_info', '')
    device_info = parse_user_agent(raw_device)
    ip_address = body.get('ip_address', 'Неизвестен')
    login_method = body.get('login_method', 'password')

    if not user_id:
        return {'error': 'user_id is required'}, 400

    if is_known_device(conn, user_id, raw_device):
        print(f"[SECURITY-NOTIFY] Known device for user {user_id}: {device_info}, skipping notification")
        return {'success': True, 'skipped': True, 'reason': 'known_device'}, 200

    user = get_user_by_id(conn, user_id)
    if not user:
        return {'error': 'User not found'}, 404

    login_method_label = LOGIN_METHOD_LABELS.get(login_method, login_method)
    local_time = get_local_time(user.get('region'))
    display_name = user.get('display_name') or 'Пользователь'

    max_message = (
        f"\U0001f510 Вход с нового устройства\n\n"
        f"\U0001f4f1 Устройство: {device_info}\n"
        f"\U0001f310 IP: {ip_address}\n"
        f"\U0001f511 Способ: {login_method_label}\n"
        f"\u23f0 Время: {local_time}\n\n"
        f"Если это были вы — всё в порядке.\n"
        f"Если нет — срочно смените пароль в Настройках!"
    )

    max_sent = send_max_to_photographer(conn, user, max_message)

    email_sent = False
    if user.get('email'):
        html = build_login_alert_html(device_info, ip_address, login_method_label, local_time, display_name)
        email_sent = send_email_to_photographer(user['email'], '\U0001f510 Вход с нового устройства — FotoMix', html)

    print(f"[SECURITY-NOTIFY] New device alert for user {user_id}: {device_info}")
    return {'success': True, 'max_sent': max_sent, 'email_sent': email_sent, 'new_device': True}, 200


def handle_gallery_viewed(conn, body: dict) -> Dict[str, Any]:
    short_code = body.get('short_code')
    client_info = body.get('client_info')

    if not short_code:
        return {'error': 'short_code is required'}, 400

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT short_code, folder_id, user_id, view_notified "
            f"FROM {SCHEMA}.folder_short_links WHERE short_code = %s",
            (short_code,)
        )
        link = cur.fetchone()

    if not link:
        return {'error': 'Short link not found'}, 404

    if link.get('view_notified'):
        return {'success': True, 'skipped': True, 'reason': 'Already notified'}, 200

    user = get_user_by_id(conn, link['user_id'])
    if not user:
        return {'error': 'Photographer not found'}, 404

    client_name = None

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id, folder_name, client_id FROM {SCHEMA}.photo_folders WHERE id = %s",
            (link['folder_id'],)
        )
        folder = cur.fetchone()

    if folder and folder.get('client_id'):
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, name FROM {SCHEMA}.clients WHERE id = %s",
                (folder['client_id'],)
            )
            client_row = cur.fetchone()
            if client_row and client_row.get('name'):
                client_name = client_row['name']

    if not client_name and client_info:
        client_name = client_info

    if not client_name and folder:
        client_name = folder.get('folder_name', 'Клиент')

    if not client_name:
        client_name = 'Клиент'

    max_message = (
        f"\U0001f4f8 Уведомляю!\n\n"
        f"Ваш клиент {client_name} получил сообщение с ссылкой с его фотографиями "
        f"и уже открыл ссылку для просмотра.\n\n"
        f"Для того, чтобы просмотреть какие фотографии были скачаны, вы можете отслеживать "
        f"через Фото банк в папке с фотографиями клиента — на фото отобразится зелёная стрелочка загрузки."
    )

    max_sent = send_max_to_photographer(conn, user, max_message)

    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE {SCHEMA}.folder_short_links SET view_notified = TRUE WHERE short_code = %s",
            (short_code,)
        )
        conn.commit()

    return {'success': True, 'max_sent': max_sent, 'client_name': client_name}, 200


def handler(event: dict, context) -> dict:
    """
    Security notifications for photographers via MAX (GreenAPI) and Email.
    POST with action login_alert or gallery_viewed.
    """
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    conn = None
    try:
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')

        if not action:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'action is required'}),
                'isBase64Encoded': False
            }

        if not body.get('ip_address'):
            request_context = event.get('requestContext', {})
            identity = request_context.get('identity', {})
            body['ip_address'] = identity.get('sourceIp', '')

        conn = get_db_connection()

        if action == 'login_alert':
            result, status = handle_login_alert(conn, body)
        elif action == 'gallery_viewed':
            result, status = handle_gallery_viewed(conn, body)
        else:
            result, status = {'error': f'Unknown action: {action}'}, 400

        return {
            'statusCode': status,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(result, default=str),
            'isBase64Encoded': False
        }

    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid JSON body'}),
            'isBase64Encoded': False
        }
    except Exception as e:
        print(f"[SECURITY-NOTIFY] Error: {e}")
        import traceback
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        if conn:
            conn.close()