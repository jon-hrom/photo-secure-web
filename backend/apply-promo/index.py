'''
Применение промокода пользователем к подписке
Args: event с httpMethod, body, queryStringParameters; context с request_id
Returns: HTTP ответ с расчетом скидки и финальной ценой
'''

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def escape_sql_string(value: Any) -> str:
    """Экранирует значение для безопасной вставки в SQL запрос"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    print(f'[HANDLER] Received {method} request')
    
    # Handle CORS OPTIONS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'POST':
        return apply_promo_code(event)
    elif method == 'GET':
        return validate_promo_code(event)
    
    return {
        'statusCode': 405,
        'headers': CORS_HEADERS,
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }

def validate_promo_code(event: Dict[str, Any]) -> Dict[str, Any]:
    """Проверка валидности промокода без применения"""
    params = event.get('queryStringParameters', {}) or {}
    code = params.get('code', '').strip().upper()
    user_id = params.get('user_id')
    plan_id = params.get('plan_id')
    
    if not code or not user_id or not plan_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing code, user_id or plan_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Получаем промокод
            cur.execute(f'''
                SELECT 
                    id, code, discount_type, discount_value, duration_months,
                    max_uses, used_count, is_active, valid_from, valid_until
                FROM {SCHEMA}.promo_codes
                WHERE code = {escape_sql_string(code)}
            ''')
            promo = cur.fetchone()
            
            if not promo:
                return {
                    'statusCode': 404,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Промокод не найден'}),
                    'isBase64Encoded': False
                }
            
            # Проверки валидности
            if not promo['is_active']:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Промокод деактивирован'}),
                    'isBase64Encoded': False
                }
            
            if promo['valid_until'] and datetime.now() > promo['valid_until']:
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
                    'body': json.dumps({'error': 'Промокод исчерпан'}),
                    'isBase64Encoded': False
                }
            
            # Проверяем, использовал ли пользователь этот промокод ранее
            cur.execute(f'''
                SELECT COUNT(*) as count
                FROM {SCHEMA}.promo_code_usages
                WHERE promo_code_id = {promo['id']} AND user_id = {user_id}
            ''')
            usage_check = cur.fetchone()
            
            if usage_check['count'] > 0:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Вы уже использовали этот промокод'}),
                    'isBase64Encoded': False
                }
            
            # Получаем цену тарифа
            cur.execute(f'''
                SELECT monthly_price_rub
                FROM {SCHEMA}.storage_plans
                WHERE id = {plan_id}
            ''')
            plan = cur.fetchone()
            
            if not plan:
                return {
                    'statusCode': 404,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Тариф не найден'}),
                    'isBase64Encoded': False
                }
            
            original_price = float(plan['monthly_price_rub'])
            
            # Рассчитываем скидку
            if promo['discount_type'] == 'percent':
                discount_amount = original_price * (float(promo['discount_value']) / 100)
            else:  # fixed
                discount_amount = float(promo['discount_value'])
            
            final_price = max(0, original_price - discount_amount)
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'valid': True,
                    'promo_code': dict(promo),
                    'original_price': original_price,
                    'discount_amount': discount_amount,
                    'final_price': final_price,
                    'savings_percent': round((discount_amount / original_price * 100), 2) if original_price > 0 else 0
                }, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] validate_promo_code failed: {e}')
        import traceback
        print(f'[ERROR] Traceback: {traceback.format_exc()}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to validate promo code: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def apply_promo_code(event: Dict[str, Any]) -> Dict[str, Any]:
    """Применение промокода к подписке пользователя"""
    body = json.loads(event.get('body', '{}'))
    code = body.get('code', '').strip().upper()
    user_id = body.get('user_id')
    plan_id = body.get('plan_id')
    
    if not code or not user_id or not plan_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing code, user_id or plan_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Валидируем промокод (тот же код что и в validate_promo_code)
            cur.execute(f'''
                SELECT 
                    id, code, discount_type, discount_value, duration_months,
                    max_uses, used_count, is_active, valid_from, valid_until
                FROM {SCHEMA}.promo_codes
                WHERE code = {escape_sql_string(code)}
            ''')
            promo = cur.fetchone()
            
            if not promo or not promo['is_active']:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Промокод недействителен'}),
                    'isBase64Encoded': False
                }
            
            # Получаем цену тарифа
            cur.execute(f'''
                SELECT monthly_price_rub, quota_gb
                FROM {SCHEMA}.storage_plans
                WHERE id = {plan_id}
            ''')
            plan = cur.fetchone()
            
            original_price = float(plan['monthly_price_rub'])
            
            # Рассчитываем скидку
            if promo['discount_type'] == 'percent':
                discount_amount = original_price * (float(promo['discount_value']) / 100)
            else:
                discount_amount = float(promo['discount_value'])
            
            final_price = max(0, original_price - discount_amount)
            
            # Создаем/обновляем подписку
            duration = promo['duration_months'] if promo['duration_months'] else 1
            ended_at = f"NOW() + INTERVAL '{duration} months'"
            
            # Деактивируем старые подписки
            cur.execute(f'''
                UPDATE {SCHEMA}.user_subscriptions
                SET status = 'cancelled', updated_at = NOW()
                WHERE user_id = {user_id} AND status = 'active'
            ''')
            
            # Создаем новую подписку
            cur.execute(f'''
                INSERT INTO {SCHEMA}.user_subscriptions (
                    user_id, plan_id, amount_rub, started_at, ended_at, status, payment_method
                )
                VALUES (
                    {user_id}, {plan_id}, {final_price}, NOW(), {ended_at}, 'active', 'promo_code'
                )
                RETURNING id
            ''')
            subscription = cur.fetchone()
            
            # Записываем использование промокода
            cur.execute(f'''
                INSERT INTO {SCHEMA}.promo_code_usages (
                    promo_code_id, user_id, subscription_id, 
                    discount_amount, original_price, final_price
                )
                VALUES (
                    {promo['id']}, {user_id}, {subscription['id']},
                    {discount_amount}, {original_price}, {final_price}
                )
            ''')
            
            # Увеличиваем счетчик использований
            cur.execute(f'''
                UPDATE {SCHEMA}.promo_codes
                SET used_count = used_count + 1
                WHERE id = {promo['id']}
            ''')
            
            conn.commit()
            
            print(f'[APPLY_PROMO] User {user_id} applied promo {code}, subscription {subscription["id"]}')
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'success': True,
                    'subscription_id': subscription['id'],
                    'original_price': original_price,
                    'discount_amount': discount_amount,
                    'final_price': final_price,
                    'duration_months': duration
                }, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] apply_promo_code failed: {e}')
        conn.rollback()
        import traceback
        print(f'[ERROR] Traceback: {traceback.format_exc()}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to apply promo code: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()
