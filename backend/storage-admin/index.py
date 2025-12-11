'''
Админ-панель управления хранилищем: создание тарифов, управление пользователями, статистика и финансы
Args: event с httpMethod, body, queryStringParameters, headers с X-Admin-Key; context с request_id
Returns: HTTP ответ с statusCode, headers, body
'''

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL')
ADMIN_KEY = os.environ.get('ADMIN_KEY', 'admin123')
SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def check_admin(event: Dict[str, Any]) -> bool:
    # Check admin key from query params (no CORS preflight needed)
    params = event.get('queryStringParameters', {}) or {}
    admin_key_query = params.get('admin_key')
    if admin_key_query == ADMIN_KEY:
        return True
    
    # Fallback: check headers (triggers CORS preflight)
    headers = event.get('headers', {})
    admin_key = headers.get('X-Admin-Key') or headers.get('x-admin-key')
    return admin_key == ADMIN_KEY

def escape_sql_string(value: Any) -> str:
    """Экранирует значение для безопасной вставки в SQL запрос"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    # Экранируем одинарные кавычки удвоением
    return "'" + str(value).replace("'", "''") + "'"

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    print(f'[HANDLER] Received {method} request')
    print(f'[HANDLER] Event: {json.dumps(event, default=str)}')
    
    # CRITICAL: Always handle OPTIONS first for CORS preflight
    if method == 'OPTIONS':
        print('[OPTIONS] Handling CORS preflight')
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': '',
            'isBase64Encoded': False
        }
    
    if not check_admin(event):
        return {
            'statusCode': 403,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Admin access required'}),
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', 'list-plans')
    
    handlers = {
        'list-plans': list_plans,
        'create-plan': create_plan,
        'update-plan': update_plan,
        'delete-plan': delete_plan,
        'set-default-plan': set_default_plan,
        'list-users': list_users,
        'update-user': update_user,
        'usage-stats': usage_stats,
        'revenue-stats': revenue_stats,
        'financial-stats': financial_stats,
        'subscribe-user': subscribe_user,
    }
    
    handler_func = handlers.get(action)
    if not handler_func:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Unknown action: {action}'}),
            'isBase64Encoded': False
        }
    
    return handler_func(event)

def list_plans(event: Dict[str, Any]) -> Dict[str, Any]:
    print('[LIST_PLANS] Starting...')
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print('[LIST_PLANS] Executing query...')
            cur.execute(f'''
                SELECT 
                    id as plan_id, 
                    name as plan_name, 
                    quota_gb, 
                    monthly_price_rub as price_rub, 
                    is_active, 
                    created_at, 
                    visible_to_users, 
                    max_clients, 
                    description,
                    stats_enabled,
                    track_storage_usage,
                    track_client_count,
                    track_booking_analytics,
                    track_revenue,
                    track_upload_history,
                    track_download_stats
                FROM {SCHEMA}.storage_plans
                ORDER BY quota_gb ASC
            ''')
            plans = cur.fetchall()
            print(f'[LIST_PLANS] Found {len(plans)} plans')
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'plans': [dict(p) for p in plans]}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] list_plans failed: {e}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to list plans: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def create_plan(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    plan_name = body.get('plan_name')
    quota_gb = body.get('quota_gb')
    price_rub = body.get('price_rub', 0)
    is_active = body.get('is_active', True)
    visible_to_users = body.get('visible_to_users', False)
    max_clients = body.get('max_clients')
    description = body.get('description')
    stats_enabled = body.get('stats_enabled', True)
    track_storage_usage = body.get('track_storage_usage', True)
    track_client_count = body.get('track_client_count', True)
    track_booking_analytics = body.get('track_booking_analytics', True)
    track_revenue = body.get('track_revenue', True)
    track_upload_history = body.get('track_upload_history', True)
    track_download_stats = body.get('track_download_stats', True)
    
    if not plan_name or quota_gb is None:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing plan_name or quota_gb'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print(f'[CREATE_PLAN] Creating plan: name={plan_name}, quota={quota_gb}, price={price_rub}')
            
            # Используем простые запросы без параметризации
            max_clients_val = escape_sql_string(max_clients)
            description_val = escape_sql_string(description)
            
            query = f'''
                INSERT INTO {SCHEMA}.storage_plans (
                    name, quota_gb, monthly_price_rub, is_active, visible_to_users, 
                    max_clients, description, stats_enabled, track_storage_usage,
                    track_client_count, track_booking_analytics, track_revenue,
                    track_upload_history, track_download_stats
                )
                VALUES (
                    {escape_sql_string(plan_name)}, 
                    {quota_gb}, 
                    {price_rub}, 
                    {is_active}, 
                    {visible_to_users}, 
                    {max_clients_val}, 
                    {description_val}, 
                    {stats_enabled}, 
                    {track_storage_usage},
                    {track_client_count}, 
                    {track_booking_analytics}, 
                    {track_revenue},
                    {track_upload_history}, 
                    {track_download_stats}
                )
                RETURNING 
                    id as plan_id, name as plan_name, quota_gb, monthly_price_rub as price_rub, 
                    is_active, visible_to_users, created_at, max_clients, description,
                    stats_enabled, track_storage_usage, track_client_count, 
                    track_booking_analytics, track_revenue, track_upload_history, track_download_stats
            '''
            
            print(f'[CREATE_PLAN] Executing query: {query}')
            cur.execute(query)
            plan = cur.fetchone()
            conn.commit()
            print(f'[CREATE_PLAN] Successfully created plan_id={plan["plan_id"]}')
            
            return {
                'statusCode': 201,
                'headers': CORS_HEADERS,
                'body': json.dumps({'plan': dict(plan)}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] create_plan failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to create plan: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def update_plan(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    plan_id = body.get('plan_id')
    
    if not plan_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing plan_id'}),
            'isBase64Encoded': False
        }
    
    updates = []
    
    if 'plan_name' in body:
        updates.append(f'name = {escape_sql_string(body["plan_name"])}')
    if 'quota_gb' in body and body['quota_gb'] is not None:
        updates.append(f'quota_gb = {body["quota_gb"]}')
    if 'price_rub' in body and body['price_rub'] is not None:
        updates.append(f'monthly_price_rub = {body["price_rub"]}')
    if 'is_active' in body and body['is_active'] is not None:
        updates.append(f'is_active = {escape_sql_string(body["is_active"])}')
    if 'visible_to_users' in body and body['visible_to_users'] is not None:
        updates.append(f'visible_to_users = {escape_sql_string(body["visible_to_users"])}')
    if 'max_clients' in body:
        updates.append(f'max_clients = {escape_sql_string(body["max_clients"])}')
    if 'description' in body:
        updates.append(f'description = {escape_sql_string(body["description"])}')
    if 'stats_enabled' in body and body['stats_enabled'] is not None:
        updates.append(f'stats_enabled = {escape_sql_string(body["stats_enabled"])}')
    if 'track_storage_usage' in body and body['track_storage_usage'] is not None:
        updates.append(f'track_storage_usage = {escape_sql_string(body["track_storage_usage"])}')
    if 'track_client_count' in body and body['track_client_count'] is not None:
        updates.append(f'track_client_count = {escape_sql_string(body["track_client_count"])}')
    if 'track_booking_analytics' in body and body['track_booking_analytics'] is not None:
        updates.append(f'track_booking_analytics = {escape_sql_string(body["track_booking_analytics"])}')
    if 'track_revenue' in body and body['track_revenue'] is not None:
        updates.append(f'track_revenue = {escape_sql_string(body["track_revenue"])}')
    if 'track_upload_history' in body and body['track_upload_history'] is not None:
        updates.append(f'track_upload_history = {escape_sql_string(body["track_upload_history"])}')
    if 'track_download_stats' in body and body['track_download_stats'] is not None:
        updates.append(f'track_download_stats = {escape_sql_string(body["track_download_stats"])}')
    
    if not updates:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'No fields to update'}),
            'isBase64Encoded': False
        }
    
    updates.append('updated_at = NOW()')
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = f'''
                UPDATE {SCHEMA}.storage_plans
                SET {', '.join(updates)}
                WHERE id = {plan_id}
                RETURNING 
                    id as plan_id, name as plan_name, quota_gb, monthly_price_rub as price_rub, 
                    is_active, visible_to_users, created_at, max_clients, description,
                    stats_enabled, track_storage_usage, track_client_count, 
                    track_booking_analytics, track_revenue, track_upload_history, track_download_stats
            '''
            
            print(f'[UPDATE_PLAN] Executing query: {query}')
            cur.execute(query)
            plan = cur.fetchone()
            
            if not plan:
                return {
                    'statusCode': 404,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Plan not found'}),
                    'isBase64Encoded': False
                }
            
            conn.commit()
            print(f'[UPDATE_PLAN] Successfully updated plan_id={plan["plan_id"]}')
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'plan': dict(plan)}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] update_plan failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to update plan: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def delete_plan(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    plan_id = body.get('plan_id')
    
    if not plan_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing plan_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            query = f'DELETE FROM {SCHEMA}.storage_plans WHERE id = {plan_id}'
            print(f'[DELETE_PLAN] Executing: {query}')
            cur.execute(query)
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] delete_plan failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to delete plan: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def set_default_plan(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    plan_id = body.get('plan_id')
    
    if not plan_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing plan_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Обновляем пользователей без подписки
            query = f'''
                UPDATE {SCHEMA}.vk_users
                SET plan_id = {plan_id}
                WHERE user_id NOT IN (
                    SELECT DISTINCT user_id FROM {SCHEMA}.user_subscriptions 
                    WHERE status = 'active' AND ended_at > NOW()
                )
            '''
            print(f'[SET_DEFAULT_PLAN] Executing: {query}')
            cur.execute(query)
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] set_default_plan failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to set default plan: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def list_users(event: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    limit = int(params.get('limit', 100))
    offset = int(params.get('offset', 0))
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Получаем пользователей с их тарифами и подписками
            query = f'''
                SELECT 
                    v.user_id,
                    v.full_name as username,
                    v.email,
                    COALESCE(s.plan_id, p_default.id) as plan_id,
                    COALESCE(p_active.name, p_default.name, 'Бесплатный') as plan_name,
                    s.custom_quota_gb,
                    s.amount_rub,
                    s.started_at,
                    s.ended_at,
                    s.status as subscription_status,
                    COALESCE(
                        (SELECT COALESCE(SUM(file_size), 0) / 1073741824.0 
                         FROM {SCHEMA}.photo_bank 
                         WHERE user_id = v.user_id AND is_deleted = FALSE),
                        0
                    ) as used_gb,
                    v.registered_at as created_at
                FROM {SCHEMA}.vk_users v
                LEFT JOIN {SCHEMA}.user_subscriptions s ON v.user_id = s.user_id 
                    AND s.status = 'active' AND s.ended_at > NOW()
                LEFT JOIN {SCHEMA}.storage_plans p_active ON s.plan_id = p_active.id
                LEFT JOIN (
                    SELECT * FROM {SCHEMA}.storage_plans 
                    WHERE is_active = TRUE 
                    ORDER BY monthly_price_rub ASC 
                    LIMIT 1
                ) p_default ON TRUE
                WHERE v.is_active = TRUE
                ORDER BY v.registered_at DESC
                LIMIT {limit} OFFSET {offset}
            '''
            
            print(f'[LIST_USERS] Executing query with limit={limit}, offset={offset}')
            cur.execute(query)
            users = cur.fetchall()
            print(f'[LIST_USERS] Found {len(users)} users')
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'users': [dict(u) for u in users]}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] list_users failed: {e}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to list users: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def update_user(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    user_id = body.get('user_id')
    plan_id = body.get('plan_id')
    custom_quota_gb = body.get('custom_quota_gb')
    custom_price = body.get('custom_price')
    started_at = body.get('started_at')
    ended_at = body.get('ended_at')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing user_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print(f'[UPDATE_USER] Updating user_id={user_id} with plan_id={plan_id}')
            
            # Проверяем существующую активную подписку
            check_query = f'''
                SELECT id FROM {SCHEMA}.user_subscriptions
                WHERE user_id = {user_id} AND status = 'active' AND ended_at > NOW()
            '''
            cur.execute(check_query)
            existing = cur.fetchone()
            
            if existing:
                # Обновляем существующую подписку
                updates = [f'plan_id = {plan_id}']
                if custom_quota_gb is not None:
                    updates.append(f'custom_quota_gb = {custom_quota_gb}')
                if custom_price is not None:
                    updates.append(f'amount_rub = {custom_price}')
                if started_at:
                    updates.append(f"started_at = '{started_at}'")
                if ended_at:
                    updates.append(f"ended_at = '{ended_at}'")
                updates.append('updated_at = NOW()')
                
                update_query = f'''
                    UPDATE {SCHEMA}.user_subscriptions
                    SET {', '.join(updates)}
                    WHERE id = {existing['id']}
                '''
                print(f'[UPDATE_USER] Updating subscription: {update_query}')
                cur.execute(update_query)
            else:
                # Создаем новую подписку
                started_val = f"'{started_at}'" if started_at else 'NOW()'
                ended_val = f"'{ended_at}'" if ended_at else "(NOW() + INTERVAL '30 days')"
                quota_val = custom_quota_gb if custom_quota_gb is not None else 'NULL'
                price_val = custom_price if custom_price is not None else 0
                
                insert_query = f'''
                    INSERT INTO {SCHEMA}.user_subscriptions 
                    (user_id, plan_id, custom_quota_gb, amount_rub, started_at, ended_at, status)
                    VALUES ({user_id}, {plan_id}, {quota_val}, {price_val}, {started_val}, {ended_val}, 'active')
                '''
                print(f'[UPDATE_USER] Creating subscription: {insert_query}')
                cur.execute(insert_query)
            
            conn.commit()
            print(f'[UPDATE_USER] Successfully updated user_id={user_id}')
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] update_user failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to update user: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def subscribe_user(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    user_id = body.get('user_id')
    plan_id = body.get('plan_id')
    
    if not user_id or not plan_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing user_id or plan_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Получаем цену тарифа
            cur.execute(f'SELECT monthly_price_rub FROM {SCHEMA}.storage_plans WHERE id = {plan_id}')
            plan = cur.fetchone()
            
            if not plan:
                return {
                    'statusCode': 404,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'Plan not found'}),
                    'isBase64Encoded': False
                }
            
            price = plan['monthly_price_rub']
            
            # Деактивируем старые подписки
            cur.execute(f'''
                UPDATE {SCHEMA}.user_subscriptions
                SET status = 'cancelled', updated_at = NOW()
                WHERE user_id = {user_id} AND status = 'active'
            ''')
            
            # Создаем новую подписку
            insert_query = f'''
                INSERT INTO {SCHEMA}.user_subscriptions 
                (user_id, plan_id, amount_rub, started_at, ended_at, status, payment_method)
                VALUES (
                    {user_id}, 
                    {plan_id}, 
                    {price}, 
                    NOW(), 
                    NOW() + INTERVAL '30 days', 
                    'active',
                    'admin'
                )
                RETURNING id
            '''
            cur.execute(insert_query)
            result = cur.fetchone()
            conn.commit()
            
            print(f'[SUBSCRIBE_USER] Created subscription id={result["id"]} for user_id={user_id}')
            
            return {
                'statusCode': 201,
                'headers': CORS_HEADERS,
                'body': json.dumps({'subscription_id': result['id']}),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] subscribe_user failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to subscribe user: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def usage_stats(event: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    days = int(params.get('days', 30))
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = f'''
                SELECT 
                    DATE(uploaded_at) as date,
                    COUNT(*) as uploads,
                    COALESCE(SUM(file_size) / 1073741824.0, 0) as total_size_gb,
                    COUNT(DISTINCT user_id) as unique_users
                FROM {SCHEMA}.photo_bank
                WHERE uploaded_at >= NOW() - INTERVAL '{days} days'
                    AND is_deleted = FALSE
                GROUP BY DATE(uploaded_at)
                ORDER BY date DESC
            '''
            
            print(f'[USAGE_STATS] Fetching stats for last {days} days')
            cur.execute(query)
            stats = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'stats': [dict(s) for s in stats]}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] usage_stats failed: {e}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to get usage stats: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def revenue_stats(event: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = f'''
                SELECT 
                    p.name as plan_name,
                    COUNT(DISTINCT s.user_id) as users_count,
                    COALESCE(SUM(s.amount_rub), 0) as total_revenue
                FROM {SCHEMA}.user_subscriptions s
                JOIN {SCHEMA}.storage_plans p ON s.plan_id = p.id
                WHERE s.status = 'active' AND s.ended_at > NOW()
                GROUP BY p.name
                ORDER BY total_revenue DESC
            '''
            
            print('[REVENUE_STATS] Fetching revenue by plan')
            cur.execute(query)
            revenue = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'revenue': [dict(r) for r in revenue]}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] revenue_stats failed: {e}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to get revenue stats: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def financial_stats(event: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    period = params.get('period', 'month')  # day, week, month, year, all
    
    # Определяем интервал группировки
    if period == 'day':
        date_trunc = 'hour'
        interval = "1 day"
    elif period == 'week':
        date_trunc = 'day'
        interval = "7 days"
    elif period == 'month':
        date_trunc = 'day'
        interval = "30 days"
    elif period == 'year':
        date_trunc = 'month'
        interval = "365 days"
    else:  # all
        date_trunc = 'month'
        interval = "10 years"
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Статистика по периодам
            stats_query = f'''
                SELECT 
                    DATE_TRUNC('{date_trunc}', s.created_at) as date,
                    COALESCE(SUM(
                        (SELECT COALESCE(SUM(file_size), 0) / 1073741824.0 
                         FROM {SCHEMA}.photo_bank 
                         WHERE user_id = s.user_id AND is_deleted = FALSE)
                    ), 0) as storage_gb,
                    COUNT(DISTINCT s.user_id) as active_users,
                    COALESCE(SUM(s.amount_rub), 0) as total_revenue,
                    COALESCE(SUM(
                        (SELECT COALESCE(SUM(file_size), 0) / 1073741824.0 
                         FROM {SCHEMA}.photo_bank 
                         WHERE user_id = s.user_id AND is_deleted = FALSE) * 2
                    ), 0) as estimated_cost
                FROM {SCHEMA}.user_subscriptions s
                WHERE s.status = 'active' 
                    AND s.created_at >= NOW() - INTERVAL '{interval}'
                GROUP BY DATE_TRUNC('{date_trunc}', s.created_at)
                ORDER BY date DESC
            '''
            
            print(f'[FINANCIAL_STATS] Fetching stats for period={period}')
            cur.execute(stats_query)
            stats = cur.fetchall()
            
            # Итоговые показатели
            summary_query = f'''
                SELECT 
                    COALESCE(SUM(s.amount_rub), 0) as total_revenue,
                    COALESCE(SUM(
                        (SELECT COALESCE(SUM(file_size), 0) / 1073741824.0 
                         FROM {SCHEMA}.photo_bank 
                         WHERE user_id = s.user_id AND is_deleted = FALSE) * 2
                    ), 0) as total_cost
                FROM {SCHEMA}.user_subscriptions s
                WHERE s.status = 'active' 
                    AND s.created_at >= NOW() - INTERVAL '{interval}'
            '''
            
            cur.execute(summary_query)
            summary = cur.fetchone()
            
            profit = summary['total_revenue'] - summary['total_cost']
            margin = (profit / summary['total_revenue'] * 100) if summary['total_revenue'] > 0 else 0
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'stats': [dict(s) for s in stats],
                    'summary': {
                        'total_revenue': float(summary['total_revenue']),
                        'total_cost': float(summary['total_cost']),
                        'profit': float(profit),
                        'margin_percent': float(margin)
                    }
                }, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] financial_stats failed: {e}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to get financial stats: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()