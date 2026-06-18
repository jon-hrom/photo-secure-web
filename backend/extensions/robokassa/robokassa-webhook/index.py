import json
import os
import hashlib
import psycopg2
from urllib.parse import parse_qs
from datetime import datetime, timedelta

SCHEMA = 't_p28211681_photo_secure_web'
ACCOUNT_NOTIFY_URL = 'https://functions.poehali.dev/144eb550-4428-40c4-bc1a-acd169042a99'


def notify(event_type, user_id, extra):
    """Шлёт красивое уведомление фотографу (не критично при ошибке)."""
    try:
        import requests
        payload = {'event_type': event_type, 'user_id': int(user_id)}
        payload.update(extra)
        requests.post(ACCOUNT_NOTIFY_URL, json=payload, timeout=8)
    except Exception as e:
        print(f"[NOTIFY] error: {e}")


def calculate_signature(*args) -> str:
    """Создание MD5 подписи по документации Robokassa"""
    joined = ':'.join(str(arg) for arg in args)
    return hashlib.md5(joined.encode()).hexdigest().upper()


def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        raise ValueError('DATABASE_URL not configured')
    return psycopg2.connect(dsn)


HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'text/plain'
}


def activate_subscription(cur, order):
    """Применить тариф пользователю после успешной оплаты.
    order = (order_id, user_id, plan_id, duration_months, amount, auto_renew, inv_id, user_email)
    """
    order_id, user_id, plan_id, duration_months, amount, auto_renew, inv_id, user_email = order

    cur.execute(f"SELECT name, quota_gb FROM {SCHEMA}.storage_plans WHERE id = %s", (plan_id,))
    plan = cur.fetchone()
    if not plan:
        return
    quota_gb = float(plan[1])

    duration_months = int(duration_months or 1)
    expires_at = datetime.now() + timedelta(days=30 * duration_months)
    amount = float(amount)

    # Цена фиксируется на оплаченный период (п.5.6 оферты): locked_price_rub = фактически оплаченная сумма
    cur.execute(f"""
        INSERT INTO {SCHEMA}.user_subscriptions
        (user_id, plan_id, expires_at, price_paid_rub, locked_price_rub, duration_months,
         auto_renew, payment_status, status, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'completed', 'active', CURRENT_TIMESTAMP)
    """, (user_id, plan_id, expires_at, amount, amount, duration_months, bool(auto_renew)))

    cur.execute(f"""
        UPDATE {SCHEMA}.users
        SET plan_id = %s, custom_quota_gb = %s
        WHERE id = %s
    """, (plan_id, quota_gb, user_id))

    # Управление рекуррентной подпиской
    if auto_renew:
        next_charge_at = expires_at
        # Деактивируем прежние активные рекуррентные подписки пользователя
        cur.execute(f"""
            UPDATE {SCHEMA}.recurring_subscriptions
            SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s AND status = 'active'
        """, (user_id,))
        cur.execute(f"""
            INSERT INTO {SCHEMA}.recurring_subscriptions
            (user_id, plan_id, duration_months, locked_price_rub, user_email, first_inv_id,
             status, next_charge_at, last_charged_at, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'active', %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """, (user_id, plan_id, duration_months, amount, user_email, int(inv_id), next_charge_at))


def add_energy(cur, order):
    """Начислить энергию пользователю после успешной оплаты пополнения."""
    order_id, user_id, amount, energy_amount, promo_id = order
    energy_amount = int(energy_amount or 0)
    if energy_amount <= 0:
        return
    cur.execute(f"""
        UPDATE {SCHEMA}.users
        SET energy_balance = COALESCE(energy_balance, 0) + %s
        WHERE id = %s
    """, (energy_amount, user_id))
    cur.execute(f"""
        INSERT INTO {SCHEMA}.energy_transactions
        (user_id, amount, type, rub_amount, order_id, description)
        VALUES (%s, %s, 'topup', %s, %s, %s)
    """, (user_id, energy_amount, amount, order_id, f'Пополнение энергии: +{energy_amount} ед.'))
    if promo_id:
        cur.execute(f"UPDATE {SCHEMA}.energy_promo_codes SET used_count = used_count + 1 WHERE id = %s", (promo_id,))
        cur.execute(f"INSERT INTO {SCHEMA}.energy_promo_usages (promo_code_id, user_id) VALUES (%s, %s)", (promo_id, user_id))


def handler(event: dict, context) -> dict:
    '''
    Result URL вебхук от Robokassa. Подтверждает оплату и активирует тариф.
    Robokassa отправляет: OutSum, InvId, SignatureValue. Returns: OK{InvId}
    '''
    method = event.get('httpMethod', 'GET').upper()

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': '', 'isBase64Encoded': False}

    password_2 = os.environ.get('ROBOKASSA_PASSWORD_2')
    if not password_2:
        return {'statusCode': 500, 'headers': HEADERS, 'body': 'Configuration error', 'isBase64Encoded': False}

    params = {}
    body = event.get('body', '')
    if method == 'POST' and body:
        if event.get('isBase64Encoded', False):
            import base64
            body = base64.b64decode(body).decode('utf-8')
        parsed = parse_qs(body)
        params = {k: v[0] for k, v in parsed.items()}
    if not params:
        params = event.get('queryStringParameters') or {}

    out_sum = params.get('OutSum', params.get('out_summ', ''))
    inv_id = params.get('InvId', params.get('inv_id', ''))
    signature_value = params.get('SignatureValue', params.get('crc', '')).upper()

    if not out_sum or not inv_id or not signature_value:
        return {'statusCode': 400, 'headers': HEADERS, 'body': 'Missing required parameters', 'isBase64Encoded': False}

    expected_signature = calculate_signature(out_sum, inv_id, password_2)
    if signature_value != expected_signature:
        return {'statusCode': 400, 'headers': HEADERS, 'body': 'Invalid signature', 'isBase64Encoded': False}

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute(f"""
        UPDATE {SCHEMA}.payment_orders
        SET status = 'paid', paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE robokassa_inv_id = %s AND status = 'pending'
        RETURNING id, user_id, plan_id, duration_months, amount, order_type, energy_amount, energy_promo_code_id, auto_renew, user_email
    """, (int(inv_id),))
    result = cur.fetchone()

    if not result:
        cur.execute(f"SELECT status FROM {SCHEMA}.payment_orders WHERE robokassa_inv_id = %s", (int(inv_id),))
        existing = cur.fetchone()
        conn.close()
        if existing and existing[0] == 'paid':
            return {'statusCode': 200, 'headers': HEADERS, 'body': f'OK{inv_id}', 'isBase64Encoded': False}
        return {'statusCode': 404, 'headers': HEADERS, 'body': 'Order not found', 'isBase64Encoded': False}

    notify_event = None
    notify_extra = {}
    try:
        order_id, user_id, plan_id, duration_months, amount, order_type, energy_amount, energy_promo_id, auto_renew, user_email = result
        if order_type == 'energy':
            add_energy(cur, (order_id, user_id, amount, energy_amount, energy_promo_id))
            cur.execute(f"SELECT energy_balance FROM {SCHEMA}.users WHERE id = %s", (user_id,))
            brow = cur.fetchone()
            notify_event = 'energy_topup'
            notify_extra = {'energy_added': int(energy_amount or 0), 'energy_balance': int(brow[0]) if brow else 0}
        else:
            activate_subscription(cur, (order_id, user_id, plan_id, duration_months, amount, auto_renew, int(inv_id), user_email))
            cur.execute(f"SELECT name FROM {SCHEMA}.storage_plans WHERE id = %s", (plan_id,))
            prow = cur.fetchone()
            notify_event = 'tariff_changed'
            notify_extra = {'plan_name': prow[0] if prow else 'новый', 'duration_months': int(duration_months or 1)}
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Order activation error: {e}")
        cur.close()
        conn.close()
        return {'statusCode': 500, 'headers': HEADERS, 'body': 'Activation error', 'isBase64Encoded': False}

    cur.close()
    conn.close()

    if notify_event:
        notify(notify_event, user_id, notify_extra)

    return {'statusCode': 200, 'headers': HEADERS, 'body': f'OK{inv_id}', 'isBase64Encoded': False}