'''
Красивые уведомления фотографу о пополнении энергии и смене тарифа.
Шлёт во все каналы: Telegram, WhatsApp (Green-API), Email (Yandex Postbox SESv2).
Args: event с httpMethod, body (event_type, user_id, ...); context
Returns: HTTP ответ с результатами отправки по каналам
'''
import json
import os
import psycopg2
import requests

SCHEMA = 't_p28211681_photo_secure_web'
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
MAX_INSTANCE_ID = os.environ.get('MAX_INSTANCE_ID', '')
MAX_TOKEN = os.environ.get('MAX_TOKEN', '')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def send_telegram(chat_id, text):
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return False
    try:
        r = requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
            json={'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML', 'disable_web_page_preview': True},
            timeout=10,
        )
        return r.status_code == 200
    except Exception as e:
        print(f"[TG] error: {e}")
        return False


def send_whatsapp(instance_id, token, phone, text):
    if not instance_id or not token or not phone:
        return False
    try:
        digits = ''.join(c for c in phone if c.isdigit())
        if not digits:
            return False
        media = instance_id[:4] if len(instance_id) >= 4 else '7103'
        url = f"https://{media}.api.green-api.com/waInstance{instance_id}/sendMessage/{token}"
        r = requests.post(url, json={'chatId': f"{digits}@c.us", 'message': text}, timeout=10)
        return r.status_code == 200
    except Exception as e:
        print(f"[WA] error: {e}")
        return False


def send_email(to_email, subject, html_body):
    if not to_email:
        return False
    access_key = os.environ.get('POSTBOX_ACCESS_KEY_ID')
    secret_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
    if not access_key or not secret_key:
        return False
    try:
        import boto3
        client = boto3.client(
            'sesv2', region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access_key, aws_secret_access_key=secret_key,
        )
        client.send_email(
            FromEmailAddress='FotoMix <info@foto-mix.ru>',
            Destination={'ToAddresses': [to_email]},
            Content={'Simple': {
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}},
            }},
        )
        return True
    except Exception as e:
        print(f"[EMAIL] error: {e}")
        return False


def build_messages(event_type, name, data):
    """Возвращает (заголовок, plain-текст для мессенджеров, html для email)."""
    greeting = f"Здравствуйте, {name}!" if name else "Здравствуйте!"
    warm = "Приятного использования и красивых кадров! 📸✨\nСпасибо, что вы с нами."

    if event_type == 'energy_topup':
        added = data.get('energy_added', 0)
        balance = data.get('energy_balance', 0)
        subject = "⚡ Баланс энергии пополнен!"
        text = (
            f"{greeting}\n\n"
            f"⚡ <b>Баланс энергии пополнен!</b>\n"
            f"Зачислено: <b>+{added}</b> энергии\n"
            f"Текущий баланс: <b>{balance}</b> энергии\n\n"
            f"{warm}"
        )
        body_lines = (
            f"<p style='font-size:16px;margin:0 0 8px'>⚡ <b>Баланс энергии пополнен!</b></p>"
            f"<p style='margin:0 0 4px'>Зачислено: <b>+{added}</b> энергии</p>"
            f"<p style='margin:0 0 4px'>Текущий баланс: <b>{balance}</b> энергии</p>"
        )
    elif event_type == 'tariff_changed':
        plan = data.get('plan_name', 'новый')
        months = data.get('duration_months', 1)
        subject = "🎉 Тариф активирован!"
        text = (
            f"{greeting}\n\n"
            f"🎉 <b>Ваш тариф активирован!</b>\n"
            f"Тариф: <b>{plan}</b>\n"
            f"Срок: <b>{months} мес.</b>\n\n"
            f"{warm}"
        )
        body_lines = (
            f"<p style='font-size:16px;margin:0 0 8px'>🎉 <b>Ваш тариф активирован!</b></p>"
            f"<p style='margin:0 0 4px'>Тариф: <b>{plan}</b></p>"
            f"<p style='margin:0 0 4px'>Срок: <b>{months} мес.</b></p>"
        )
    else:
        return None, None, None

    html = (
        "<div style='font-family:Arial,sans-serif;max-width:480px;margin:0 auto;"
        "border-radius:16px;overflow:hidden;border:1px solid #eee'>"
        "<div style='background:linear-gradient(135deg,#7c3aed,#a855f7);padding:24px;text-align:center'>"
        "<span style='font-size:28px'>📷 FotoMix</span></div>"
        "<div style='padding:24px;color:#222'>"
        f"<p style='margin:0 0 16px'>{greeting}</p>"
        f"{body_lines}"
        "<div style='background:#f6f3ff;border-radius:12px;padding:16px;margin-top:16px;text-align:center;color:#6d28d9'>"
        "Приятного использования и красивых кадров! 📸✨<br>Спасибо, что вы с нами.</div>"
        "</div></div>"
    )
    return subject, text, html


def handler(event, context):
    method = event.get('httpMethod', 'POST').upper()
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': '', 'isBase64Encoded': False}

    body = json.loads(event.get('body') or '{}')
    event_type = body.get('event_type')
    user_id = body.get('user_id')
    if not event_type or not user_id:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'event_type and user_id required'}), 'isBase64Encoded': False}

    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT name, display_name, email, telegram_chat_id, telegram_verified,
                       phone, phone_number, max_phone, green_api_instance_id, green_api_token, energy_balance
                FROM {SCHEMA}.users WHERE id = %s
            """, (int(user_id),))
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'user not found'}), 'isBase64Encoded': False}

    (name, display_name, email, tg_chat, tg_verified, phone, phone_number, max_phone,
     gi, gt, energy_balance) = row

    data = dict(body)
    if event_type == 'energy_topup' and 'energy_balance' not in data:
        data['energy_balance'] = energy_balance or 0

    display = display_name or name or ''
    subject, text, html = build_messages(event_type, display, data)
    if not subject:
        return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'unknown event_type'}), 'isBase64Encoded': False}

    results = {}
    if tg_verified and tg_chat:
        results['telegram'] = send_telegram(tg_chat, text)

    wa_phone = max_phone or phone_number or phone
    inst = gi or MAX_INSTANCE_ID
    tok = gt or MAX_TOKEN
    plain = text.replace('<b>', '').replace('</b>', '')
    results['whatsapp'] = send_whatsapp(inst, tok, wa_phone, plain)

    if email:
        results['email'] = send_email(email, subject, html)

    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'success': True, 'results': results}), 'isBase64Encoded': False}