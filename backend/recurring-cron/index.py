"""
Business: Cron автопродления подписок — уведомление за 3 дня и рекуррентное списание через API Робокассы с чеком НПД
Args: event - dict с httpMethod, queryStringParameters (action, token), body
      context - object с request_id
Returns: HTTP response dict с итогами обработки
"""

import json
import os
import random
import hashlib
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from typing import Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
import requests

SCHEMA = 't_p28211681_photo_secure_web'
ROBOKASSA_RECURRING_URL = 'https://auth.robokassa.ru/Merchant/Recurring'
REMINDER_DAYS = 3
RECEIPT_TAX = 'none'
RECEIPT_SNO = 'usn_income'
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
MAX_INSTANCE_ID = os.environ.get('MAX_INSTANCE_ID', '')
MAX_TOKEN = os.environ.get('MAX_TOKEN', '')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def resp(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {'statusCode': status, 'headers': CORS_HEADERS, 'body': json.dumps(body, default=str), 'isBase64Encoded': False}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], cursor_factory=RealDictCursor)


def md5_sig(*args) -> str:
    # Алгоритм подписи Robokassa = SHA256 (совпадает с ЛК → Технические настройки)
    return hashlib.sha256(':'.join(str(a) for a in args).encode()).hexdigest()


def build_receipt(item_name: str, amount: float) -> str:
    receipt = {
        'sno': RECEIPT_SNO,
        'items': [{
            'name': item_name[:128],
            'quantity': 1,
            'sum': round(float(amount), 2),
            'payment_method': 'full_payment',
            'payment_object': 'service',
            'tax': RECEIPT_TAX,
        }],
    }
    # Компактный JSON без пробелов — иначе подпись с Receipt не совпадёт (ошибка 29)
    return urllib.parse.quote(json.dumps(receipt, ensure_ascii=False, separators=(',', ':')))


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    try:
        access = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        secret = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        if not access or not secret:
            print('Postbox creds not set')
            return False
        client = boto3.client(
            'sesv2', region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access, aws_secret_access_key=secret,
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
        print(f'Email error: {e}')
        return False


def reminder_html(plan_name: str, amount: float, charge_date: str) -> str:
    return f'''<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height:1.6; color:#333; max-width:600px; margin:0 auto; padding:20px;">
  <div style="background:linear-gradient(135deg,#667eea,#764ba2); padding:28px; border-radius:10px; text-align:center;">
    <h1 style="color:#fff; margin:0; font-size:22px;">Предстоящее автопродление</h1>
  </div>
  <div style="background:#f8f9fa; padding:28px; border-radius:10px; margin-top:16px;">
    <p>Здравствуйте!</p>
    <p>Напоминаем, что через {REMINDER_DAYS} дня состоится автоматическое продление вашей подписки на foto-mix.ru.</p>
    <div style="background:#fff; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin:16px 0;">
      <p style="margin:4px 0;"><b>Тариф:</b> {plan_name}</p>
      <p style="margin:4px 0;"><b>Сумма списания:</b> {amount:.2f} ₽</p>
      <p style="margin:4px 0;"><b>Дата списания:</b> {charge_date}</p>
    </div>
    <p>После оплаты автоматически будет сформирован чек НПД.</p>
    <p style="font-size:13px; color:#777;">Вы можете отключить автопродление в любой момент в личном кабинете → Настройки → Подписка. Отключение сохранит доступ до конца уже оплаченного периода.</p>
  </div>
</body></html>'''


def send_telegram(chat_id: str, text: str) -> bool:
    """Отправка напоминания в Telegram."""
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


def send_whatsapp(instance_id: str, token: str, phone: str, text: str) -> bool:
    """Отправка напоминания в MAX (Green-API)."""
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


def reminder_text(plan_name: str, amount: float, charge_date: str) -> str:
    """Текст напоминания для мессенджеров (Telegram/MAX)."""
    return (
        f"🔔 <b>Предстоящее автопродление подписки</b>\n\n"
        f"Через {REMINDER_DAYS} дня состоится автоматическое продление на foto-mix.ru.\n\n"
        f"Тариф: <b>{plan_name}</b>\n"
        f"Сумма списания: <b>{amount:.2f} ₽</b>\n"
        f"Дата списания: <b>{charge_date}</b>\n\n"
        f"После оплаты придёт чек НПД.\n"
        f"Отключить автопродление можно в Настройки → Управление подпиской."
    )


def process_reminders(cur, conn) -> int:
    """Напоминания за REMINDER_DAYS дней до списания: Email + Telegram + MAX."""
    threshold = datetime.now() + timedelta(days=REMINDER_DAYS)
    cur.execute(f"""
        SELECT rs.id, rs.user_id, rs.plan_id, rs.locked_price_rub, rs.user_email,
               rs.next_charge_at, sp.name AS plan_name,
               u.telegram_chat_id, u.telegram_verified,
               u.max_phone, u.phone_number, u.phone,
               u.green_api_instance_id, u.green_api_token
        FROM {SCHEMA}.recurring_subscriptions rs
        LEFT JOIN {SCHEMA}.storage_plans sp ON sp.id = rs.plan_id
        LEFT JOIN {SCHEMA}.users u ON u.id = rs.user_id
        WHERE rs.status = 'active'
          AND rs.next_charge_at <= %s
          AND rs.next_charge_at > NOW()
          AND (rs.reminder_sent_for IS NULL OR rs.reminder_sent_for <> rs.next_charge_at)
    """, (threshold,))
    rows = cur.fetchall()
    sent = 0
    for r in rows:
        plan_name = r.get('plan_name') or 'Подписка'
        amount = float(r['locked_price_rub'])
        charge_date = r['next_charge_at'].strftime('%d.%m.%Y')
        msg = reminder_text(plan_name, amount, charge_date)

        delivered = False

        # Email
        if r['user_email']:
            if send_email(
                r['user_email'],
                'Предстоящее списание за подписку — foto-mix.ru',
                reminder_html(plan_name, amount, charge_date),
            ):
                delivered = True

        # Telegram
        if r.get('telegram_verified') and r.get('telegram_chat_id'):
            if send_telegram(r['telegram_chat_id'], msg):
                delivered = True

        # MAX (Green-API): личный аккаунт фотографа или системный
        wa_phone = r.get('max_phone') or r.get('phone_number') or r.get('phone')
        inst = r.get('green_api_instance_id') or MAX_INSTANCE_ID
        tok = r.get('green_api_token') or MAX_TOKEN
        plain = msg.replace('<b>', '').replace('</b>', '')
        if send_whatsapp(inst, tok, wa_phone, plain):
            delivered = True

        if delivered:
            cur.execute(f"""
                UPDATE {SCHEMA}.recurring_subscriptions
                SET reminder_sent_for = next_charge_at, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (r['id'],))
            conn.commit()
            sent += 1
    return sent


def gen_inv_id(cur) -> int:
    inv = random.randint(100000, 2147483647)
    for _ in range(10):
        cur.execute(f"SELECT 1 FROM {SCHEMA}.payment_orders WHERE robokassa_inv_id = %s", (inv,))
        if not cur.fetchone():
            return inv
        inv = random.randint(100000, 2147483647)
    return inv


def charge_recurring(cur, conn, sub, merchant_login, password_1) -> bool:
    """Списание через API Робокассы: POST /Merchant/Recurring."""
    user_id = sub['user_id']
    plan_id = sub['plan_id']
    duration_months = int(sub['duration_months'] or 1)
    amount = float(sub['locked_price_rub'])
    previous_inv_id = int(sub['first_inv_id'])
    amount_str = f"{amount:.2f}"

    cur.execute(f"SELECT name FROM {SCHEMA}.storage_plans WHERE id = %s", (plan_id,))
    prow = cur.fetchone()
    plan_name = prow['name'] if prow else 'Подписка'
    description = f'Автопродление тарифа "{plan_name}" на {duration_months} мес.'

    new_inv_id = gen_inv_id(cur)
    order_number = f"FM-{datetime.now().strftime('%Y%m%d')}-{new_inv_id}"

    cur.execute(f"""
        INSERT INTO {SCHEMA}.payment_orders
        (order_number, user_id, plan_id, duration_months, user_email, amount, robokassa_inv_id,
         status, order_type, auto_renew, is_recurring_charge, parent_subscription_id)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', 'tariff', TRUE, TRUE, %s)
    """, (order_number, user_id, plan_id, duration_months, sub['user_email'], amount, new_inv_id, sub['id']))
    conn.commit()

    receipt = build_receipt(description, amount)
    # Подпись для рекуррентного платежа: MerchantLogin:OutSum:InvoiceID:Receipt:Password1
    signature = md5_sig(merchant_login, amount_str, new_inv_id, receipt, password_1)

    form = {
        'MerchantLogin': merchant_login,
        'InvoiceID': str(new_inv_id),
        'PreviousInvoiceID': str(previous_inv_id),
        'Description': description,
        'OutSum': amount_str,
        'Receipt': receipt,
        'SignatureValue': signature,
    }
    data = urllib.parse.urlencode(form).encode()
    try:
        req = urllib.request.Request(ROBOKASSA_RECURRING_URL, data=data, method='POST')
        with urllib.request.urlopen(req, timeout=20) as r:
            resp_text = r.read().decode('utf-8', errors='ignore')
        print(f"[recurring] inv={new_inv_id} response={resp_text[:300]}")
        # Робокасса возвращает OK<InvId> при успешном приёме рекуррентного запроса.
        success = resp_text.strip().upper().startswith('OK')
    except Exception as e:
        print(f"[recurring] charge error: {e}")
        success = False

    if not success:
        return False

    # Сдвигаем дату следующего списания. Фактическая активация периода — через ResultURL webhook.
    next_charge = sub['next_charge_at'] + timedelta(days=30 * duration_months)
    if next_charge < datetime.now():
        next_charge = datetime.now() + timedelta(days=30 * duration_months)
    cur.execute(f"""
        UPDATE {SCHEMA}.recurring_subscriptions
        SET next_charge_at = %s, last_charged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (next_charge, sub['id']))
    conn.commit()
    return True


def process_charges(cur, conn) -> Dict[str, int]:
    merchant_login = os.environ.get('ROBOKASSA_MERCHANT_LOGIN')
    password_1 = os.environ.get('ROBOKASSA_PASSWORD_1')
    if not merchant_login or not password_1:
        return {'charged': 0, 'failed': 0, 'error': 'no_credentials'}

    cur.execute(f"""
        SELECT id, user_id, plan_id, duration_months, locked_price_rub, user_email,
               first_inv_id, next_charge_at
        FROM {SCHEMA}.recurring_subscriptions
        WHERE status = 'active' AND next_charge_at <= NOW()
        ORDER BY next_charge_at ASC
        LIMIT 100
    """)
    subs = cur.fetchall()
    charged = 0
    failed = 0
    for sub in subs:
        ok = charge_recurring(cur, conn, sub, merchant_login, password_1)
        if ok:
            charged += 1
        else:
            failed += 1
    return {'charged': charged, 'failed': failed}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    token = params.get('token', '')
    cron_token = os.environ.get('CRON_TOKEN', '')
    if cron_token and token != cron_token:
        return resp(403, {'error': 'Forbidden'})

    action = params.get('action', 'all')

    conn = get_conn()
    cur = conn.cursor()
    try:
        result: Dict[str, Any] = {'success': True}
        if action in ('reminders', 'all'):
            result['reminders_sent'] = process_reminders(cur, conn)
        if action in ('charges', 'all'):
            result['charges'] = process_charges(cur, conn)
        return resp(200, result)
    finally:
        cur.close()
        conn.close()