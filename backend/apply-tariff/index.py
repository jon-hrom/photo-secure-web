"""
Применение тарифного плана для пользователя (публичный эндпоинт)
Args: event с body {user_id, plan_id, promo_code?}, httpMethod POST
Returns: Подтверждение применения тарифа или ожидание оплаты
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    # Парсим DATABASE_URL и добавляем параметры для удалённого подключения
    if DATABASE_URL and 'host=' not in DATABASE_URL.lower():
        # Если DATABASE_URL в формате postgresql://user:pass@host:port/db
        return psycopg2.connect(DATABASE_URL)
    else:
        # Если неправильный формат, используем параметры напрямую
        import re
        match = re.search(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', DATABASE_URL)
        if match:
            user, password, host, port, dbname = match.groups()
            return psycopg2.connect(
                host=host,
                port=port,
                dbname=dbname,
                user=user,
                password=password
            )
        else:
            # Fallback - пробуем подключиться как есть
            return psycopg2.connect(DATABASE_URL)

def escape_sql_string(value: Any) -> str:
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Публичный эндпоинт для применения тарифа пользователем"""
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Invalid JSON'}),
            'isBase64Encoded': False
        }
    
    user_id = body.get('user_id')
    plan_id = body.get('plan_id')
    promo_code = body.get('promo_code', '').strip().upper()
    duration_months = body.get('duration_months', 1)
    
    print(f'[APPLY_TARIFF] user_id={user_id}, plan_id={plan_id}, promo_code={promo_code}, duration={duration_months}')
    
    if not user_id or not plan_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'user_id и plan_id обязательны'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Проверяем существование пользователя
            cur.execute(f'SELECT id FROM {SCHEMA}.users WHERE id = {user_id}')
            if not cur.fetchone():
                return {
                    'statusCode': 404,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Пользователь не найден'}),
                    'isBase64Encoded': False
                }
            
            # Получаем информацию о тарифе
            cur.execute(f'''
                SELECT id, name as plan_name, quota_gb, monthly_price_rub as price_rub, max_clients
                FROM {SCHEMA}.storage_plans 
                WHERE id = {plan_id} AND is_active = TRUE
            ''')
            plan = cur.fetchone()
            
            if not plan:
                return {
                    'statusCode': 404,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Тариф не найден или неактивен'}),
                    'isBase64Encoded': False
                }
            
            base_price = float(plan['price_rub']) * duration_months
            final_price = base_price
            discount_percent = 0
            promo_code_id = None
            
            # Применяем промокод если указан
            if promo_code:
                cur.execute(f'''
                    SELECT id, discount_type, discount_value, max_uses, used_count, valid_until, 
                           duration_months, subscription_duration_type
                    FROM {SCHEMA}.promo_codes
                    WHERE code = {escape_sql_string(promo_code)} AND is_active = TRUE
                ''')
                promo = cur.fetchone()
                
                if not promo:
                    return {
                        'statusCode': 400,
                        'headers': CORS_HEADERS,
                        'body': json.dumps({'error': 'Промокод не найден или неактивен'}),
                        'isBase64Encoded': False
                    }
                
                # Проверяем валидность промокода
                if promo['valid_until'] and promo['valid_until'] < datetime.now():
                    return {
                        'statusCode': 400,
                        'headers': CORS_HEADERS,
                        'body': json.dumps({'error': 'Промокод истек'}),
                        'isBase64Encoded': False
                    }
                
                if promo['max_uses'] and promo['used_count'] >= promo['max_uses']:
                    return {
                        'statusCode': 400,
                        'headers': CORS_HEADERS,
                        'body': json.dumps({'error': 'Лимит использований промокода исчерпан'}),
                        'isBase64Encoded': False
                    }
                
                # Проверяем, использовал ли пользователь этот промокод ранее
                cur.execute(f'''
                    SELECT id FROM {SCHEMA}.promo_code_usages
                    WHERE user_id = {user_id} AND promo_code_id = {promo['id']}
                ''')
                if cur.fetchone():
                    return {
                        'statusCode': 400,
                        'headers': CORS_HEADERS,
                        'body': json.dumps({'error': 'Вы уже использовали этот промокод'}),
                        'isBase64Encoded': False
                    }
                
                # Вычисляем скидку на основе типа
                discount_value = float(promo['discount_value'])
                if promo['discount_type'] == 'percent':
                    discount_percent = discount_value
                    final_price = base_price * (1 - discount_percent / 100)
                elif promo['discount_type'] == 'fixed':
                    discount_percent = (discount_value / base_price * 100) if base_price > 0 else 0
                    final_price = max(0, base_price - discount_value)
                else:
                    discount_percent = 0
                    final_price = base_price
                
                promo_code_id = promo['id']
                subscription_expires_at = None
                
                # Определяем срок подписки на основе типа
                duration_type = promo.get('subscription_duration_type', 'plan_default')
                
                if duration_type == 'fixed_months' and promo['duration_months']:
                    duration_months = promo['duration_months']
                    subscription_expires_at = datetime.now() + timedelta(days=30 * duration_months)
                elif duration_type == 'until_date' and promo['valid_until']:
                    subscription_expires_at = promo['valid_until']
                    duration_months = max(1, int((subscription_expires_at - datetime.now()).days / 30))
                else:
                    # plan_default - используем стандартный срок (duration_months из параметра)
                    subscription_expires_at = datetime.now() + timedelta(days=30 * duration_months)
                
                print(f'[APPLY_TARIFF] Promo applied: type={promo["discount_type"]}, value={discount_value}, discount={discount_percent}%, final={final_price}, duration_type={duration_type}, expires={subscription_expires_at}')
            
            # Для бесплатного тарифа или с оплатой через промокод применяем сразу
            if final_price == 0:
                # Создаем подписку
                # Если промокод задал expires_at, используем его, иначе вычисляем
                if promo_code_id and subscription_expires_at:
                    expires_at = subscription_expires_at
                else:
                    expires_at = datetime.now() + timedelta(days=30 * duration_months)
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.user_subscriptions 
                    (user_id, plan_id, expires_at, promo_code_id, discount_percent, price_paid_rub, payment_status, created_at)
                    VALUES ({user_id}, {plan_id}, {escape_sql_string(expires_at)}, 
                            {promo_code_id if promo_code_id else 'NULL'}, 
                            {discount_percent}, {final_price}, 'completed', CURRENT_TIMESTAMP)
                    RETURNING id
                ''')
                subscription_id = cur.fetchone()['id']
                
                # Обновляем лимиты пользователя
                cur.execute(f'''
                    UPDATE {SCHEMA}.users 
                    SET plan_id = {plan_id},
                        custom_quota_gb = {plan['quota_gb']}
                    WHERE id = {user_id}
                ''')
                
                # Увеличиваем счетчик использований промокода
                if promo_code_id:
                    cur.execute(f'''
                        UPDATE {SCHEMA}.promo_codes 
                        SET used_count = used_count + 1 
                        WHERE id = {promo_code_id}
                    ''')
                    
                    # Записываем использование промокода
                    cur.execute(f'''
                        INSERT INTO {SCHEMA}.promo_code_usages 
                        (user_id, promo_code_id, subscription_id, used_at)
                        VALUES ({user_id}, {promo_code_id}, {subscription_id}, CURRENT_TIMESTAMP)
                    ''')
                
                conn.commit()
                print(f'[APPLY_TARIFF] FREE plan activated: subscription_id={subscription_id}')
                
                return {
                    'statusCode': 200,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({
                        'success': True,
                        'subscription_id': subscription_id,
                        'plan_name': plan['plan_name'],
                        'expires_at': expires_at.isoformat(),
                        'price_paid': 0,
                        'payment_required': False,
                        'message': f'Тариф "{plan["plan_name"]}" успешно активирован!'
                    }),
                    'isBase64Encoded': False
                }
            
            # Для платных тарифов создаем запись с pending статусом
            # В будущем здесь будет интеграция с платежной системой
            if promo_code_id and subscription_expires_at:
                expires_at = subscription_expires_at
            else:
                expires_at = datetime.now() + timedelta(days=30 * duration_months)
            cur.execute(f'''
                INSERT INTO {SCHEMA}.user_subscriptions 
                (user_id, plan_id, expires_at, promo_code_id, discount_percent, price_paid_rub, payment_status, created_at)
                VALUES ({user_id}, {plan_id}, {escape_sql_string(expires_at)}, 
                        {promo_code_id if promo_code_id else 'NULL'}, 
                        {discount_percent}, {final_price}, 'pending', CURRENT_TIMESTAMP)
                RETURNING id
            ''')
            subscription_id = cur.fetchone()['id']
            
            # НЕ обновляем лимиты пока не будет оплаты
            # Это будет сделано после подтверждения платежа
            
            conn.commit()
            print(f'[APPLY_TARIFF] PENDING subscription created: subscription_id={subscription_id}, amount={final_price}')
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'subscription_id': subscription_id,
                    'plan_name': plan['plan_name'],
                    'payment_required': True,
                    'amount': final_price,
                    'discount_applied': discount_percent,
                    'message': f'Подписка создана. Требуется оплата {final_price:.2f} ₽'
                }),
                'isBase64Encoded': False
            }
            
    except Exception as e:
        conn.rollback()
        print(f'[ERROR] apply_tariff failed: {e}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Ошибка применения тарифа: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()