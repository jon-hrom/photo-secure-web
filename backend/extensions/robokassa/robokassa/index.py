import json
import os
import hashlib
import psycopg2
import random
from urllib.parse import urlencode
from datetime import datetime

SCHEMA = 't_p28211681_photo_secure_web'


def calculate_signature(*args) -> str:
    """Создание MD5 подписи по документации Robokassa"""
    joined = ':'.join(str(arg) for arg in args)
    return hashlib.md5(joined.encode()).hexdigest()


def get_db_connection():
    """Получение подключения к БД"""
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        raise ValueError('DATABASE_URL not configured')
    return psycopg2.connect(dsn)


HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Session-Id, X-Auth-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

ROBOKASSA_URL = 'https://auth.robokassa.ru/Merchant/Index.aspx'


def handler(event: dict, context) -> dict:
    '''
    Создание заказа на оплату тарифа и генерация ссылки Robokassa.
    POST body: user_id, plan_id, duration_months, success_url, fail_url
    Returns: payment_url, order_id, order_number
    '''
    method = event.get('httpMethod', 'GET').upper()

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return {'statusCode': 405, 'headers': HEADERS, 'body': json.dumps({'error': 'Method not allowed'}), 'isBase64Encoded': False}

    try:
        merchant_login = os.environ.get('ROBOKASSA_MERCHANT_LOGIN')
        password_1 = os.environ.get('ROBOKASSA_PASSWORD_1')

        if not merchant_login or not password_1:
            return {'statusCode': 500, 'headers': HEADERS, 'body': json.dumps({'error': 'Robokassa credentials not configured'}), 'isBase64Encoded': False}

        payload = json.loads(event.get('body', '{}'))

        user_id = int(payload.get('user_id', 0))
        plan_id = int(payload.get('plan_id', 0))
        duration_months = max(1, int(payload.get('duration_months', 1)))
        amount = float(payload.get('amount', 0))
        success_url = str(payload.get('success_url', ''))
        fail_url = str(payload.get('fail_url', ''))

        if not user_id or not plan_id:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'user_id and plan_id required'}), 'isBase64Encoded': False}

        conn = get_db_connection()
        cur = conn.cursor()

        # Получаем тариф и email пользователя из нашей БД (цену не доверяем клиенту)
        cur.execute(f"SELECT name, monthly_price_rub FROM {SCHEMA}.storage_plans WHERE id = %s AND is_active = TRUE", (plan_id,))
        plan = cur.fetchone()
        if not plan:
            conn.close()
            return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Тариф не найден'}), 'isBase64Encoded': False}
        plan_name, plan_price = plan[0], float(plan[1])

        cur.execute(f"SELECT email FROM {SCHEMA}.users WHERE id = %s", (user_id,))
        urow = cur.fetchone()
        user_email = (urow[0] if urow and urow[0] else 'noemail@foto-mix.ru')

        # Сумма: если передана со скидкой по промокоду — берём минимальную из переданной и базовой*срок
        base_total = plan_price * duration_months
        final_amount = round(amount if 0 < amount <= base_total else base_total, 2)
        if final_amount <= 0:
            conn.close()
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Этот тариф бесплатный, оплата не требуется'}), 'isBase64Encoded': False}

        # Генерация уникального InvoiceID
        robokassa_inv_id = random.randint(100000, 2147483647)
        for _ in range(10):
            cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.payment_orders WHERE robokassa_inv_id = %s", (robokassa_inv_id,))
            if cur.fetchone()[0] == 0:
                break
            robokassa_inv_id = random.randint(100000, 2147483647)

        order_number = f"FM-{datetime.now().strftime('%Y%m%d')}-{robokassa_inv_id}"

        cur.execute(f"""
            INSERT INTO {SCHEMA}.payment_orders
            (order_number, user_id, plan_id, duration_months, user_email, amount, robokassa_inv_id, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending')
            RETURNING id
        """, (order_number, user_id, plan_id, duration_months, user_email, final_amount, robokassa_inv_id))
        order_id = cur.fetchone()[0]

        amount_str = f"{final_amount:.2f}"
        description = f'Тариф "{plan_name}" на {duration_months} мес.'

        if success_url or fail_url:
            signature = calculate_signature(
                merchant_login, amount_str, robokassa_inv_id,
                success_url, 'GET', fail_url, 'GET', password_1
            )
        else:
            signature = calculate_signature(merchant_login, amount_str, robokassa_inv_id, password_1)

        query_params = {
            'MerchantLogin': merchant_login,
            'OutSum': amount_str,
            'InvoiceID': robokassa_inv_id,
            'SignatureValue': signature,
            'Email': user_email,
            'Culture': 'ru',
            'Description': description
        }
        if success_url:
            query_params['SuccessUrl2'] = success_url
            query_params['SuccessUrl2Method'] = 'GET'
        if fail_url:
            query_params['FailUrl2'] = fail_url
            query_params['FailUrl2Method'] = 'GET'

        payment_url = f"{ROBOKASSA_URL}?{urlencode(query_params)}"

        cur.execute(f"UPDATE {SCHEMA}.payment_orders SET payment_url = %s WHERE id = %s", (payment_url, order_id))
        conn.commit()
        cur.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps({
                'payment_url': payment_url,
                'order_id': order_id,
                'order_number': order_number
            }),
            'isBase64Encoded': False
        }
    except Exception as e:
        import traceback
        print(f"Robokassa error: {e}")
        print(traceback.format_exc())
        return {
            'statusCode': 500,
            'headers': HEADERS,
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
