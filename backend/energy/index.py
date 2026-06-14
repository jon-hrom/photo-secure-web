'''
Внутренняя валюта "Энергия": баланс, история, промокоды на энергию, бесплатная активация.
Args: event с httpMethod, queryStringParameters (action), body, headers X-User-Id; context
Returns: HTTP ответ с балансом, историей, расчётом промокода или результатом активации
'''
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

SCHEMA = 't_p28211681_photo_secure_web'
ENERGY_RATE_RUB = 25  # рублей за 1 единицу энергии

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def resp(status, body):
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, default=str), 'isBase64Encoded': False}


def check_energy_promo(cur, code, user_id, amount):
    """Проверяет промокод на энергию. Возвращает (promo dict, error str, расчёт dict)."""
    cur.execute(f"""
        SELECT id, code, discount_type, discount_value, bonus_energy,
               max_uses, used_count, is_active, valid_until
        FROM {SCHEMA}.energy_promo_codes
        WHERE UPPER(code) = UPPER(%s)
    """, (code,))
    promo = cur.fetchone()
    if not promo:
        return None, 'Промокод не найден', None
    if not promo['is_active']:
        return None, 'Промокод деактивирован', None
    if promo['valid_until'] and datetime.now() > promo['valid_until']:
        return None, 'Промокод истёк', None
    if promo['max_uses'] and promo['used_count'] >= promo['max_uses']:
        return None, 'Промокод исчерпан', None

    cur.execute(f"""
        SELECT COUNT(*) AS c FROM {SCHEMA}.energy_promo_usages
        WHERE promo_code_id = %s AND user_id = %s
    """, (promo['id'], user_id))
    if cur.fetchone()['c'] > 0:
        return None, 'Вы уже использовали этот промокод', None

    discount_value = float(promo['discount_value'])
    bonus_energy = int(promo['bonus_energy'] or 0)

    # Тип 'energy' — промокод сразу даёт фиксированное кол-во энергии без оплаты
    if promo['discount_type'] == 'energy':
        calc = {
            'original_price': round(amount, 2),
            'discount_amount': round(amount, 2),
            'final_price': 0.0,
            'bonus_energy': bonus_energy,
            'energy_total': bonus_energy,
        }
        return dict(promo), None, calc

    if promo['discount_type'] == 'percent':
        discount_amount = amount * (discount_value / 100)
    else:  # fixed
        discount_amount = discount_value
    discount_amount = min(discount_amount, amount)
    final_price = round(max(0, amount - discount_amount), 2)
    base_energy = int(final_price // ENERGY_RATE_RUB) if final_price > 0 else int(amount // ENERGY_RATE_RUB)
    total_energy = base_energy + bonus_energy

    calc = {
        'original_price': round(amount, 2),
        'discount_amount': round(discount_amount, 2),
        'final_price': final_price,
        'bonus_energy': bonus_energy,
        'energy_total': total_energy,
    }
    return dict(promo), None, calc


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET').upper()
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return resp(401, {'error': 'X-User-Id required'})
    user_id = int(user_id)

    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', 'balance')

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if method == 'POST':
                body = json.loads(event.get('body', '{}'))
                code = str(body.get('code', '')).strip()
                amount = float(body.get('amount', 0))

                if action == 'validate-promo':
                    if not code or amount < 0:
                        return resp(400, {'error': 'Нужен code'})
                    promo, err, calc = check_energy_promo(cur, code, user_id, amount)
                    if err:
                        return resp(400, {'error': err})
                    return resp(200, {'valid': True, **calc})

                if action == 'apply-free':
                    # Применяем промокод, дающий 100% скидку или фикс. энергию — без оплаты
                    if not code or amount < 0:
                        return resp(400, {'error': 'Нужен code'})
                    promo, err, calc = check_energy_promo(cur, code, user_id, amount)
                    if err:
                        return resp(400, {'error': err})
                    if calc['final_price'] > 0:
                        return resp(400, {'error': 'Этот промокод не даёт 100% скидку, требуется оплата'})
                    energy = calc['energy_total']
                    if energy <= 0:
                        return resp(400, {'error': 'Промокод не начисляет энергию'})
                    cur.execute(f"""
                        UPDATE {SCHEMA}.users
                        SET energy_balance = COALESCE(energy_balance, 0) + %s
                        WHERE id = %s
                    """, (energy, user_id))
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.energy_transactions
                        (user_id, amount, type, rub_amount, description)
                        VALUES (%s, %s, 'promo', 0, %s)
                    """, (user_id, energy, f'Промокод {code}: +{energy} энергии'))
                    cur.execute(f"""
                        UPDATE {SCHEMA}.energy_promo_codes SET used_count = used_count + 1 WHERE id = %s
                    """, (promo['id'],))
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.energy_promo_usages (promo_code_id, user_id) VALUES (%s, %s)
                    """, (promo['id'], user_id))
                    conn.commit()
                    return resp(200, {'success': True, 'energy_added': energy, 'message': f'Начислено {energy} энергии по промокоду!'})

                return resp(400, {'error': f'Unknown action: {action}'})

            # GET
            if action == 'history':
                cur.execute(f"""
                    SELECT id, amount, type, rub_amount, description, created_at
                    FROM {SCHEMA}.energy_transactions
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    LIMIT 50
                """, (user_id,))
                rows = [dict(r) for r in cur.fetchall()]
                return resp(200, {'transactions': rows})

            cur.execute(f"SELECT energy_balance FROM {SCHEMA}.users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            balance = int(row['energy_balance']) if row else 0
            return resp(200, {'energy_balance': balance})
    finally:
        conn.close()