import json
import os
import hashlib
import psycopg2
import random
from urllib.parse import urlencode, quote
from datetime import datetime

SCHEMA = 't_p28211681_photo_secure_web'

# Ставка НДС для самозанятого (НПД) — без НДС
RECEIPT_TAX = 'none'


def build_receipt_json(item_name: str, amount: float) -> str:
    """Формирует фискальный чек (Receipt) для Робокассы — компактный JSON (без URL-кодирования).
    Систему налогообложения (sno) НЕ передаём — Robokassa берёт её из настроек магазина."""
    # Название номенклатуры: убираем кавычки (двойные/ёлочки) — они ломают
    # экранирование JSON и URL-кодирование, что приводит к ошибке 29.
    clean_name = item_name.replace('"', '').replace('«', '').replace('»', '').strip()
    receipt = {
        'items': [
            {
                'name': clean_name[:128],
                'quantity': 1,
                'sum': round(float(amount), 2),
                'payment_method': 'full_payment',
                'payment_object': 'service',
                'tax': RECEIPT_TAX,
            }
        ],
    }
    # Компактный JSON без пробелов (separators) — обязательное требование Robokassa.
    return json.dumps(receipt, ensure_ascii=False, separators=(',', ':'))


def calculate_signature(*args) -> str:
    """Создание SHA256 подписи Robokassa (боевой режим).
    Алгоритм SHA256 выбран в ЛК Robokassa (Технические настройки)."""
    joined = ':'.join(str(arg) for arg in args)
    return hashlib.sha256(joined.encode()).hexdigest()


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
ENERGY_RATE_RUB = 25  # рублей за 1 единицу энергии (500₽=20, 1000₽=40, 2500₽=100, 5000₽=200)


def handler(event: dict, context) -> dict:
    '''
    Создание заказа на оплату тарифа ИЛИ пополнение энергии и генерация ссылки Robokassa.
    POST body (tariff): order_type='tariff', user_id, plan_id, duration_months, amount, success_url, fail_url
    POST body (energy): order_type='energy', user_id, amount, success_url, fail_url
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

        order_type = str(payload.get('order_type', 'tariff'))
        user_id = int(payload.get('user_id', 0))
        amount = float(payload.get('amount', 0))
        success_url = str(payload.get('success_url', ''))
        fail_url = str(payload.get('fail_url', ''))
        # Согласие на автопродление (рекуррентные списания) — только для тарифов
        auto_renew = bool(payload.get('auto_renew', False)) and order_type == 'tariff'
        # Метод оплаты: 'sbp' → IncCurrLabel=SBP, иначе стандартная страница Robokassa
        payment_method = str(payload.get('payment_method', '')).lower()

        if not user_id:
            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'user_id required'}), 'isBase64Encoded': False}

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(f"SELECT email FROM {SCHEMA}.users WHERE id = %s", (user_id,))
        urow = cur.fetchone()
        user_email = (urow[0] if urow and urow[0] else 'noemail@foto-mix.ru')

        plan_id = 0
        duration_months = 1
        energy_amount = None
        energy_promo_id = None

        if order_type == 'energy':
            base_amount = round(amount, 2)
            if base_amount < ENERGY_RATE_RUB:
                conn.close()
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': f'Минимальная сумма пополнения — {ENERGY_RATE_RUB} ₽'}), 'isBase64Encoded': False}

            final_amount = base_amount
            bonus_energy = 0
            code = str(payload.get('code', '')).strip()
            if code:
                cur.execute(f"""
                    SELECT id, discount_type, discount_value, bonus_energy, max_uses, used_count, is_active, valid_until
                    FROM {SCHEMA}.energy_promo_codes WHERE UPPER(code) = UPPER(%s)
                """, (code,))
                pr = cur.fetchone()
                if pr:
                    pr_id, d_type, d_val, b_energy, max_uses, used_count, is_active, valid_until = pr
                    cur.execute(f"SELECT COUNT(*) FROM {SCHEMA}.energy_promo_usages WHERE promo_code_id = %s AND user_id = %s", (pr_id, user_id))
                    already_used = cur.fetchone()[0] > 0
                    valid = is_active and not already_used
                    if valid and max_uses and used_count >= max_uses:
                        valid = False
                    if valid and valid_until and datetime.now() > valid_until:
                        valid = False
                    if valid:
                        d_val = float(d_val)
                        if d_type == 'energy':
                            # Промокод даёт фикс. энергию без оплаты — отправляем на бесплатную активацию
                            conn.close()
                            return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Этот промокод начисляет энергию без оплаты'}), 'isBase64Encoded': False}
                        discount = base_amount * (d_val / 100) if d_type == 'percent' else d_val
                        discount = min(discount, base_amount)
                        final_amount = round(max(0, base_amount - discount), 2)
                        bonus_energy = int(b_energy or 0)
                        energy_promo_id = pr_id

            if final_amount < ENERGY_RATE_RUB and final_amount > 0:
                # после скидки сумма слишком мала для онлайн-оплаты Робокассы
                conn.close()
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': f'Сумма к оплате после скидки меньше минимальной ({ENERGY_RATE_RUB} ₽)'}), 'isBase64Encoded': False}
            if final_amount <= 0:
                conn.close()
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Промокод даёт 100% скидку — оплата не нужна, начисление без Робокассы'}), 'isBase64Encoded': False}

            energy_amount = int(final_amount // ENERGY_RATE_RUB) + bonus_energy
            description = f'Пополнение энергии: {energy_amount} ед.'
        else:
            plan_id = int(payload.get('plan_id', 0))
            duration_months = max(1, int(payload.get('duration_months', 1)))
            if not plan_id:
                conn.close()
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'plan_id required'}), 'isBase64Encoded': False}
            cur.execute(f"SELECT name, monthly_price_rub FROM {SCHEMA}.storage_plans WHERE id = %s AND is_active = TRUE", (plan_id,))
            plan = cur.fetchone()
            if not plan:
                conn.close()
                return {'statusCode': 404, 'headers': HEADERS, 'body': json.dumps({'error': 'Тариф не найден'}), 'isBase64Encoded': False}
            plan_name, plan_price = plan[0], float(plan[1])
            base_total = plan_price * duration_months
            final_amount = round(amount if 0 < amount <= base_total else base_total, 2)
            if final_amount <= 0:
                conn.close()
                return {'statusCode': 400, 'headers': HEADERS, 'body': json.dumps({'error': 'Этот тариф бесплатный, оплата не требуется'}), 'isBase64Encoded': False}
            description = f'Тариф "{plan_name}" на {duration_months} мес.'

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
            (order_number, user_id, plan_id, duration_months, user_email, amount, robokassa_inv_id, status, order_type, energy_amount, energy_promo_code_id, auto_renew)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s)
            RETURNING id
        """, (order_number, user_id, plan_id, duration_months, user_email, final_amount, robokassa_inv_id, order_type, energy_amount, energy_promo_id, auto_renew))
        order_id = cur.fetchone()[0]

        amount_str = f"{final_amount:.2f}"

        # ДИАГНОСТИКА: при ROBOKASSA_NO_RECEIPT=1 убираем чек целиком,
        # чтобы проверить базовую подпись MerchantLogin:OutSum:InvId:Password1.
        no_receipt = str(os.environ.get('ROBOKASSA_NO_RECEIPT', '')).strip() in ('1', 'true', 'True')

        other_params = {
            'MerchantLogin': merchant_login,
            'OutSum': amount_str,
            'InvId': str(robokassa_inv_id),
            'Culture': 'ru',
            'Description': description,
            'IncCurrLabel': 'SBPQRcode',
        }
        if user_email:
            other_params['Email'] = user_email
        if auto_renew:
            other_params['Recurring'] = 'true'

        if no_receipt:
            # Голая подпись без чека
            signature = calculate_signature(merchant_login, amount_str, robokassa_inv_id, password_1)
            other_params['SignatureValue'] = signature
            print(f"[ROBOKASSA] NO_RECEIPT base={merchant_login}:{amount_str}:{robokassa_inv_id}:*** sig={signature}")
            query_string = urlencode(other_params)
        else:
            receipt_raw = build_receipt_json(description, final_amount)
            receipt_encoded = quote(receipt_raw, safe='')
            # По документации Robokassa: в ПОДПИСЬ Receipt входит в URL-кодированном виде
            # ровно так, как он передаётся в URL. Используем ОДНУ И ТУ ЖЕ строку receipt_encoded.
            sig_mode = str(os.environ.get('ROBOKASSA_RECEIPT_SIG', 'raw')).strip().lower()
            receipt_for_sign = receipt_raw if sig_mode == 'raw' else receipt_encoded
            signature = calculate_signature(merchant_login, amount_str, robokassa_inv_id, receipt_for_sign, password_1)
            other_params['SignatureValue'] = signature
            print(f"[ROBOKASSA] WITH_RECEIPT sig_mode={sig_mode} raw={receipt_raw} enc_len={len(receipt_encoded)} sig={signature}")
            query_string = urlencode(other_params) + f"&Receipt={receipt_encoded}"
        payment_url = f"{ROBOKASSA_URL}?{query_string}"

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