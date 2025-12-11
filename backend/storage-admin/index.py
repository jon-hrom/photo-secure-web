'''
Business: Admin panel for storage management - plans CRUD, user management, analytics with stats
Args: event with httpMethod, body, queryStringParameters, headers with X-Admin-Key; context with request_id
Returns: HTTP response with statusCode, headers, body
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
    headers = event.get('headers', {})
    admin_key = headers.get('X-Admin-Key') or headers.get('x-admin-key')
    return admin_key == ADMIN_KEY

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if not check_admin(event):
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'plans': [dict(p) for p in plans]}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] list_plans failed: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing plan_name or quota_gb'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print(f'[CREATE_PLAN] Creating plan: name={plan_name}, quota={quota_gb}, price={price_rub}')
            cur.execute(f'''
                INSERT INTO {SCHEMA}.storage_plans (
                    name, quota_gb, monthly_price_rub, is_active, visible_to_users, 
                    max_clients, description, stats_enabled, track_storage_usage,
                    track_client_count, track_booking_analytics, track_revenue,
                    track_upload_history, track_download_stats
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING 
                    id as plan_id, name as plan_name, quota_gb, monthly_price_rub as price_rub, 
                    is_active, visible_to_users, created_at, max_clients, description,
                    stats_enabled, track_storage_usage, track_client_count, 
                    track_booking_analytics, track_revenue, track_upload_history, track_download_stats
            ''', (plan_name, quota_gb, price_rub, is_active, visible_to_users, max_clients, 
                  description, stats_enabled, track_storage_usage, track_client_count,
                  track_booking_analytics, track_revenue, track_upload_history, track_download_stats))
            plan = cur.fetchone()
            conn.commit()
            print(f'[CREATE_PLAN] Successfully created plan_id={plan["plan_id"]}')
            
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'plan': dict(plan)}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] create_plan failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Failed to create plan: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def update_plan(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    plan_id = body.get('plan_id')
    plan_name = body.get('plan_name')
    quota_gb = body.get('quota_gb')
    price_rub = body.get('price_rub')
    is_active = body.get('is_active')
    max_clients = body.get('max_clients')
    description = body.get('description')
    
    if not plan_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing plan_id'}),
            'isBase64Encoded': False
        }
    
    updates = []
    params = []
    
    if plan_name:
        updates.append('name = %s')
        params.append(plan_name)
    if quota_gb is not None:
        updates.append('quota_gb = %s')
        params.append(quota_gb)
    if price_rub is not None:
        updates.append('monthly_price_rub = %s')
        params.append(price_rub)
    if is_active is not None:
        updates.append('is_active = %s')
        params.append(is_active)
    if max_clients is not None:
        updates.append('max_clients = %s')
        params.append(max_clients)
    if description is not None:
        updates.append('description = %s')
        params.append(description)
    
    visible_to_users = body.get('visible_to_users')
    if visible_to_users is not None:
        updates.append('visible_to_users = %s')
        params.append(visible_to_users)
    
    stats_enabled = body.get('stats_enabled')
    if stats_enabled is not None:
        updates.append('stats_enabled = %s')
        params.append(stats_enabled)
    
    track_storage_usage = body.get('track_storage_usage')
    if track_storage_usage is not None:
        updates.append('track_storage_usage = %s')
        params.append(track_storage_usage)
    
    track_client_count = body.get('track_client_count')
    if track_client_count is not None:
        updates.append('track_client_count = %s')
        params.append(track_client_count)
    
    track_booking_analytics = body.get('track_booking_analytics')
    if track_booking_analytics is not None:
        updates.append('track_booking_analytics = %s')
        params.append(track_booking_analytics)
    
    track_revenue = body.get('track_revenue')
    if track_revenue is not None:
        updates.append('track_revenue = %s')
        params.append(track_revenue)
    
    track_upload_history = body.get('track_upload_history')
    if track_upload_history is not None:
        updates.append('track_upload_history = %s')
        params.append(track_upload_history)
    
    track_download_stats = body.get('track_download_stats')
    if track_download_stats is not None:
        updates.append('track_download_stats = %s')
        params.append(track_download_stats)
    
    if not updates:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'No fields to update'}),
            'isBase64Encoded': False
        }
    
    updates.append('updated_at = CURRENT_TIMESTAMP')
    params.append(plan_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print(f'[UPDATE_PLAN] Updating plan_id={plan_id} with fields: {updates}')
            cur.execute(f'''
                UPDATE {SCHEMA}.storage_plans
                SET {", ".join(updates)}
                WHERE id = %s
                RETURNING 
                    id as plan_id, name as plan_name, quota_gb, monthly_price_rub as price_rub, 
                    is_active, visible_to_users, created_at, max_clients, description,
                    stats_enabled, track_storage_usage, track_client_count,
                    track_booking_analytics, track_revenue, track_upload_history, track_download_stats
            ''', params)
            plan = cur.fetchone()
            conn.commit()
            
            if not plan:
                print(f'[ERROR] Plan not found: plan_id={plan_id}')
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Plan not found'}),
                    'isBase64Encoded': False
                }
            
            print(f'[UPDATE_PLAN] Successfully updated plan_id={plan_id}')
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'plan': dict(plan)}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] update_plan failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing plan_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'UPDATE {SCHEMA}.storage_plans SET is_active = false WHERE id = %s', (plan_id,))
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
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
            print(f'[LIST_USERS] Fetching users with limit={limit}, offset={offset}')
            
            # Объединяем пользователей из обеих таблиц
            cur.execute(f'''
                WITH all_users AS (
                    SELECT 
                        u.id as user_id,
                        COALESCE(u.email, 'Пользователь #' || u.id) as username,
                        u.plan_id,
                        u.created_at
                    FROM {SCHEMA}.users u
                    UNION ALL
                    SELECT 
                        vk.id as user_id,
                        vk.first_name || ' ' || vk.last_name as username,
                        NULL as plan_id,
                        vk.created_at
                    FROM {SCHEMA}.vk_users vk
                )
                SELECT 
                    au.user_id,
                    au.username,
                    COALESCE(us.plan_id, au.plan_id) as plan_id,
                    sp.name as plan_name,
                    us.custom_quota_gb,
                    0.0 as used_gb,
                    au.created_at
                FROM all_users au
                LEFT JOIN (
                    SELECT DISTINCT ON (user_id) user_id, plan_id, custom_quota_gb
                    FROM {SCHEMA}.user_subscriptions 
                    WHERE status = 'active'
                    ORDER BY user_id, started_at DESC
                ) us ON au.user_id = us.user_id
                LEFT JOIN {SCHEMA}.storage_plans sp ON COALESCE(us.plan_id, au.plan_id) = sp.id
                ORDER BY au.user_id DESC
                LIMIT %s OFFSET %s
            ''', (limit, offset))
            users = cur.fetchall()
            
            print(f'[LIST_USERS] Found {len(users)} users')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'users': [dict(u) for u in users]}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] list_users failed: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing user_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print(f'[UPDATE_USER] Updating user_id={user_id}, plan_id={plan_id}, custom_price={custom_price}, custom_quota={custom_quota_gb}')
            
            # Обновляем plan_id в таблице users
            cur.execute(f'''
                UPDATE {SCHEMA}.users
                SET plan_id = %s
                WHERE id = %s
            ''', (plan_id, user_id))
            
            # Если назначен тариф, создаём/обновляем активную подписку
            if plan_id:
                # Получаем стандартную цену из тарифа
                cur.execute(f'''
                    SELECT monthly_price_rub, quota_gb FROM {SCHEMA}.storage_plans WHERE id = %s
                ''', (plan_id,))
                plan_data = cur.fetchone()
                
                if not plan_data:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Plan not found'})
                    }
                
                # Используем индивидуальную цену или стандартную из тарифа
                final_price = custom_price if custom_price is not None else plan_data['monthly_price_rub']
                
                # Дата начала: заданная или текущая
                subscription_start = started_at if started_at else 'CURRENT_TIMESTAMP'
                subscription_end = ended_at if ended_at else None
                
                print(f'[UPDATE_USER] Final price: {final_price}, started_at: {subscription_start}, ended_at: {subscription_end}')
                
                # Отменяем старые активные подписки
                cur.execute(f'''
                    UPDATE {SCHEMA}.user_subscriptions
                    SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s AND status = 'active'
                ''', (user_id,))
                
                # Создаём новую подписку с индивидуальными параметрами
                if subscription_start == 'CURRENT_TIMESTAMP':
                    cur.execute(f'''
                        INSERT INTO {SCHEMA}.user_subscriptions 
                        (user_id, plan_id, status, amount_rub, custom_quota_gb, started_at, ended_at)
                        VALUES (%s, %s, 'active', %s, %s, CURRENT_TIMESTAMP, %s)
                        RETURNING id
                    ''', (user_id, plan_id, final_price, custom_quota_gb, subscription_end))
                else:
                    cur.execute(f'''
                        INSERT INTO {SCHEMA}.user_subscriptions 
                        (user_id, plan_id, status, amount_rub, custom_quota_gb, started_at, ended_at)
                        VALUES (%s, %s, 'active', %s, %s, %s, %s)
                        RETURNING id
                    ''', (user_id, plan_id, final_price, custom_quota_gb, subscription_start, subscription_end))
                
                subscription_id = cur.fetchone()['id']
                print(f'[UPDATE_USER] Created subscription id={subscription_id}')
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] update_user failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing user_id or plan_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Получаем стоимость тарифа
            cur.execute(f'SELECT monthly_price_rub FROM {SCHEMA}.storage_plans WHERE id = %s', (plan_id,))
            plan = cur.fetchone()
            
            if not plan:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Plan not found'}),
                    'isBase64Encoded': False
                }
            
            # Отменяем старые подписки
            cur.execute(f'''
                UPDATE {SCHEMA}.user_subscriptions
                SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP
                WHERE user_id = %s AND status = 'active'
            ''', (user_id,))
            
            # Создаём новую подписку
            cur.execute(f'''
                INSERT INTO {SCHEMA}.user_subscriptions 
                (user_id, plan_id, status, amount_rub, started_at)
                VALUES (%s, %s, 'active', %s, CURRENT_TIMESTAMP)
                RETURNING id
            ''', (user_id, plan_id, plan['monthly_price_rub']))
            
            subscription_id = cur.fetchone()['id']
            
            # Обновляем plan_id в users
            cur.execute(f'UPDATE {SCHEMA}.users SET plan_id = %s WHERE id = %s', (plan_id, user_id))
            
            conn.commit()
            
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'subscription_id': subscription_id}),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] subscribe_user failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
            cur.execute(f'''
                SELECT
                    date::text,
                    COALESCE(COUNT(DISTINCT user_id), 0) as unique_users,
                    COALESCE(COUNT(*), 0) as uploads,
                    COALESCE(SUM(used_gb_end_of_day), 0) as total_size_gb
                FROM {SCHEMA}.storage_usage_daily
                WHERE date >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY date
                ORDER BY date ASC
            ''' % days)
            stats = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'stats': [dict(s) for s in stats]}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] usage_stats failed: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Failed to get usage stats: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def revenue_stats(event: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print('[REVENUE_STATS] Calculating revenue from subscriptions')
            
            # Считаем доход на основе активных подписок
            cur.execute(f'''
                SELECT 
                    sp.name as plan_name,
                    COUNT(DISTINCT us.user_id) as users_count,
                    sp.monthly_price_rub * COUNT(DISTINCT us.user_id) as total_revenue
                FROM {SCHEMA}.user_subscriptions us
                JOIN {SCHEMA}.storage_plans sp ON us.plan_id = sp.id
                WHERE us.status = 'active'
                GROUP BY sp.name, sp.monthly_price_rub
                ORDER BY total_revenue DESC
            ''')
            revenue = cur.fetchall()
            
            print(f'[REVENUE_STATS] Found {len(revenue)} revenue entries')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'revenue': [dict(r) for r in revenue]}, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] revenue_stats failed: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Failed to get revenue stats: {str(e)}'}),
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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing plan_id'}),
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Получаем цену тарифа
            cur.execute(f'SELECT monthly_price_rub FROM {SCHEMA}.storage_plans WHERE id = %s', (plan_id,))
            plan = cur.fetchone()
            
            if not plan:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Plan not found'}),
                    'isBase64Encoded': False
                }
            
            # Назначаем всем пользователям без подписки
            cur.execute(f'''
                INSERT INTO {SCHEMA}.user_subscriptions (user_id, plan_id, status, amount_rub, started_at)
                SELECT u.id, %s, 'active', %s, CURRENT_TIMESTAMP
                FROM {SCHEMA}.users u
                WHERE NOT EXISTS (
                    SELECT 1 FROM {SCHEMA}.user_subscriptions us 
                    WHERE us.user_id = u.id AND us.status = 'active'
                )
            ''', (plan_id, plan['monthly_price_rub']))
            
            affected = cur.rowcount
            
            # Обновляем plan_id в users
            cur.execute(f'''
                UPDATE {SCHEMA}.users SET plan_id = %s
                WHERE id IN (
                    SELECT u.id FROM {SCHEMA}.users u
                    WHERE u.plan_id IS NULL OR NOT EXISTS (
                        SELECT 1 FROM {SCHEMA}.user_subscriptions us 
                        WHERE us.user_id = u.id AND us.status = 'active'
                    )
                )
            ''', (plan_id,))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'affected': affected}),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] set_default_plan failed: {e}')
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Failed to set default plan: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def financial_stats(event: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    period = params.get('period', 'month')
    
    period_map = {
        'day': '1 day',
        'week': '7 days',
        'month': '30 days',
        'year': '365 days'
    }
    
    interval = period_map.get(period, '30 days')
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            print(f'[FINANCIAL_STATS] Calculating for period: {period} ({interval})')
            
            # Считаем финансы по месяцам на основе подписок
            cur.execute(f'''
                WITH date_series AS (
                    SELECT generate_series(
                        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '%s'),
                        DATE_TRUNC('month', CURRENT_DATE),
                        '1 month'::interval
                    )::date as month_date
                ),
                monthly_revenue AS (
                    SELECT 
                        DATE_TRUNC('month', us.started_at)::date as month_date,
                        COUNT(DISTINCT us.user_id) as new_subscriptions,
                        SUM(us.amount_rub) as revenue
                    FROM {SCHEMA}.user_subscriptions us
                    WHERE us.started_at >= CURRENT_DATE - INTERVAL '%s'
                    AND us.status = 'active'
                    GROUP BY DATE_TRUNC('month', us.started_at)
                ),
                active_subscriptions AS (
                    SELECT 
                        COUNT(DISTINCT user_id) as total_active,
                        SUM(amount_rub) as total_revenue
                    FROM {SCHEMA}.user_subscriptions
                    WHERE status = 'active'
                )
                SELECT 
                    ds.month_date::text as date,
                    COALESCE(mr.new_subscriptions, 0) as new_users,
                    COALESCE(mr.revenue, 0) as monthly_revenue,
                    acs.total_active as active_users,
                    acs.total_revenue as total_revenue,
                    0.0 as storage_gb,
                    (COALESCE(mr.revenue, 0) * 0.1) as estimated_cost
                FROM date_series ds
                LEFT JOIN monthly_revenue mr ON ds.month_date = mr.month_date
                CROSS JOIN active_subscriptions acs
                ORDER BY ds.month_date ASC
            ''' % (interval, interval))
            stats = cur.fetchall()
            
            # Рассчитываем итоги
            total_revenue = sum(float(s.get('total_revenue', 0) or 0) for s in stats) / max(len(stats), 1)
            total_cost = sum(float(s.get('estimated_cost', 0) or 0) for s in stats)
            profit = total_revenue - total_cost
            
            print(f'[FINANCIAL_STATS] Total revenue: {total_revenue}, cost: {total_cost}, profit: {profit}')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'stats': [dict(s) for s in stats],
                    'summary': {
                        'total_revenue': round(total_revenue, 2),
                        'total_cost': round(total_cost, 2),
                        'profit': round(profit, 2),
                        'margin_percent': round((profit / total_revenue * 100) if total_revenue > 0 else 0, 2)
                    }
                }, default=str),
                'isBase64Encoded': False
            }
    except Exception as e:
        print(f'[ERROR] financial_stats failed: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Failed to get financial stats: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()