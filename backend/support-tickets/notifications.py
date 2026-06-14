"""
Модуль рассылки уведомлений о тикетах поддержки.
Каналы: Web Push, Email (Yandex Postbox SESv2), Telegram, MAX (green-api).
Все функции максимально устойчивы к ошибкам — сбой одного канала не ломает остальные.
"""
import os
import json
import re
import urllib.request

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')
SITE_URL = os.environ.get('SITE_URL', 'https://foto-mix.ru').rstrip('/')


def _normalize_phone(phone):
    digits = re.sub(r'\D+', '', phone or '')
    if len(digits) == 11 and digits[0] in ('8', '7'):
        digits = '7' + digits[1:]
    elif len(digits) == 10:
        digits = '7' + digits
    return digits


# ---------------- EMAIL ----------------
def send_email(to_email, subject, html_body):
    try:
        import boto3
        ak = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        sk = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        if not ak or not sk or not to_email:
            return False
        client = boto3.client(
            'sesv2', region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=ak, aws_secret_access_key=sk,
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
        print(f'[notify][email] {e}')
        return False


# ---------------- TELEGRAM ----------------
def send_telegram(chat_id, text):
    try:
        token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not token or not chat_id:
            return False
        url = f'https://api.telegram.org/bot{token}/sendMessage'
        data = json.dumps({'chat_id': str(chat_id), 'text': text, 'parse_mode': 'HTML'}).encode()
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        print(f'[notify][telegram] {e}')
        return False


# ---------------- MAX (green-api) ----------------
def send_max(phone, text):
    try:
        instance = os.environ.get('MAX_INSTANCE_ID') or os.environ.get('GREEN_API_INSTANCE')
        token = os.environ.get('MAX_TOKEN') or os.environ.get('GREEN_API_TOKEN')
        if not instance or not token or not phone:
            return False
        digits = _normalize_phone(phone)
        if not digits:
            return False
        url = f'https://api.green-api.com/waInstance{instance}/sendMessage/{token}'
        data = json.dumps({'chatId': f'{digits}@c.us', 'message': text}).encode()
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10)
        return True
    except Exception as e:
        print(f'[notify][max] {e}')
        return False


# ---------------- WEB PUSH ----------------
def send_push_to_user(cur, user_identifier, title, body, url_path='/'):
    try:
        from pywebpush import webpush, WebPushException
    except Exception as e:
        print(f'[notify][push] pywebpush not available: {e}')
        return False

    priv = os.environ.get('VAPID_PRIVATE_KEY')
    if not priv:
        return False

    try:
        cur.execute(
            f"SELECT endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions WHERE user_identifier = %s",
            (str(user_identifier),),
        )
        rows = cur.fetchall()
    except Exception as e:
        print(f'[notify][push] db error: {e}')
        return False

    payload = json.dumps({
        'title': title,
        'body': body,
        'url': f'{SITE_URL}{url_path}',
        'tag': 'support-ticket',
    })
    vapid_claims = {'sub': 'mailto:info@foto-mix.ru'}
    sent = 0
    dead = []
    for row in rows:
        endpoint = row['endpoint'] if isinstance(row, dict) else row[0]
        p256dh = row['p256dh'] if isinstance(row, dict) else row[1]
        auth = row['auth'] if isinstance(row, dict) else row[2]
        try:
            webpush(
                subscription_info={'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth}},
                data=payload,
                vapid_private_key=priv,
                vapid_claims=dict(vapid_claims),
            )
            sent += 1
        except WebPushException as e:
            status = getattr(getattr(e, 'response', None), 'status_code', None)
            if status in (404, 410):
                dead.append(endpoint)
            print(f'[notify][push] {e}')
        except Exception as e:
            print(f'[notify][push] {e}')
    if dead:
        try:
            cur.execute(
                f"DELETE FROM {SCHEMA}.push_subscriptions WHERE endpoint = ANY(%s)",
                (dead,),
            )
        except Exception:
            pass
    return sent > 0


# ---------------- АДРЕСАТЫ ----------------
def get_admins_contacts(cur):
    """Контакты всех админов."""
    try:
        cur.execute(
            f"SELECT id, email, phone_number, telegram_chat_id, telegram_verified, "
            f"max_phone, max_connected FROM {SCHEMA}.users WHERE role = 'admin'"
        )
        return cur.fetchall()
    except Exception as e:
        print(f'[notify] get_admins error: {e}')
        return []


def get_user_contacts(cur, user_identifier):
    """Контакты конкретного пользователя по id."""
    try:
        uid = int(str(user_identifier))
    except Exception:
        return None
    try:
        cur.execute(
            f"SELECT id, email, phone_number, telegram_chat_id, telegram_verified, "
            f"max_phone, max_connected FROM {SCHEMA}.users WHERE id = %s",
            (uid,),
        )
        return cur.fetchone()
    except Exception as e:
        print(f'[notify] get_user error: {e}')
        return None


def _field(row, key, idx):
    if isinstance(row, dict):
        return row.get(key)
    try:
        return row[idx]
    except Exception:
        return None


def notify_contact(cur, contact, user_identifier, title, body, url_path, email_html):
    """Разослать одному получателю по всем доступным каналам."""
    if not contact:
        return
    email = _field(contact, 'email', 1)
    phone = _field(contact, 'phone_number', 2)
    tg_chat = _field(contact, 'telegram_chat_id', 3)
    tg_verified = _field(contact, 'telegram_verified', 4)
    max_phone = _field(contact, 'max_phone', 5)
    max_connected = _field(contact, 'max_connected', 6)

    # Push
    if user_identifier is not None:
        send_push_to_user(cur, user_identifier, title, body, url_path)
    # Telegram
    if tg_chat and tg_verified:
        send_telegram(tg_chat, f'<b>{title}</b>\n{body}')
    # MAX
    if max_phone and max_connected:
        send_max(max_phone, f'{title}\n{body}')
    elif phone:
        send_max(phone, f'{title}\n{body}')
    # Email
    if email:
        send_email(email, title, email_html)


def _email_template(title, body, url_path):
    link = f'{SITE_URL}{url_path}'
    return (
        f'<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">'
        f'<h2 style="color:#7c3aed">{title}</h2>'
        f'<p style="font-size:15px;color:#333;white-space:pre-wrap">{body}</p>'
        f'<a href="{link}" style="display:inline-block;margin-top:12px;padding:10px 20px;'
        f'background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none">Открыть</a>'
        f'</div>'
    )


# ---------------- ВЫСОКОУРОВНЕВЫЕ СОБЫТИЯ ----------------
def notify_new_ticket(cur, ticket_number, subject, user_name):
    """Новый тикет -> уведомить всех админов."""
    title = f'Новое обращение {ticket_number}'
    body = f'{user_name or "Пользователь"}: {subject}'
    html = _email_template(title, body, '/')
    for admin in get_admins_contacts(cur):
        admin_id = _field(admin, 'id', 0)
        notify_contact(cur, admin, admin_id, title, body, '/', html)


def notify_user_reply(cur, user_identifier, ticket_number, subject):
    """Пользователь ответил -> уведомить админов."""
    title = f'Новый ответ в {ticket_number}'
    body = f'Тема: {subject}'
    html = _email_template(title, body, '/')
    for admin in get_admins_contacts(cur):
        admin_id = _field(admin, 'id', 0)
        notify_contact(cur, admin, admin_id, title, body, '/', html)


def notify_admin_reply(cur, user_identifier, ticket_number, subject, preview):
    """Поддержка ответила -> уведомить пользователя."""
    title = f'Поддержка ответила по {ticket_number}'
    body = f'{subject}\n\n{preview or ""}'.strip()
    html = _email_template(title, body, '/')
    contact = get_user_contacts(cur, user_identifier)
    notify_contact(cur, contact, user_identifier, title, body, '/', html)
