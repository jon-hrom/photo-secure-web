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
            'body': ''
        }
    
    if not check_admin(event):
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Admin access required'})
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
    }
    
    handler_func = handlers.get(action)
    if not handler_func:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Unknown action: {action}'})
        }
    
    return handler_func(event)

def list_plans(event: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT id as plan_id, name as plan_name, quota_gb, monthly_price_rub as price_rub, is_active, created_at
                FROM {SCHEMA}.storage_plans
                ORDER BY quota_gb ASC
            ''')
            plans = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'plans': [dict(p) for p in plans]}, default=str)
            }
    finally:
        conn.close()

def create_plan(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    plan_name = body.get('plan_name')
    quota_gb = body.get('quota_gb')
    price_rub = body.get('price_rub', 0)
    is_active = body.get('is_active', True)
    
    if not plan_name or quota_gb is None:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing plan_name or quota_gb'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                INSERT INTO {SCHEMA}.storage_plans (name, quota_gb, monthly_price_rub, is_active)
                VALUES (%s, %s, %s, %s)
                RETURNING id as plan_id, name as plan_name, quota_gb, monthly_price_rub as price_rub, is_active, created_at
            ''', (plan_name, quota_gb, price_rub, is_active))
            plan = cur.fetchone()
            conn.commit()
            
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'plan': dict(plan)}, default=str)
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
    
    if not plan_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing plan_id'})
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
    
    if not updates:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'No fields to update'})
        }
    
    updates.append('updated_at = CURRENT_TIMESTAMP')
    params.append(plan_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                UPDATE {SCHEMA}.storage_plans
                SET {", ".join(updates)}
                WHERE id = %s
                RETURNING id as plan_id, name as plan_name, quota_gb, monthly_price_rub as price_rub, is_active, created_at
            ''', params)
            plan = cur.fetchone()
            conn.commit()
            
            if not plan:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Plan not found'})
                }
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'plan': dict(plan)}, default=str)
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
            'body': json.dumps({'error': 'Missing plan_id'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'DELETE FROM {SCHEMA}.storage_plans WHERE id = %s', (plan_id,))
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True})
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
            cur.execute(f'''
                SELECT 
                    vk.id as user_id, vk.first_name || ' ' || vk.last_name as username,
                    COALESCE(ss.plan_id, 1) as plan_id, 
                    sp.name as plan_name,
                    ss.custom_quota_gb,
                    COALESCE(SUM(so.bytes), 0) / (1024.0 * 1024.0 * 1024.0) as used_gb,
                    vk.created_at
                FROM {SCHEMA}.vk_users vk
                LEFT JOIN {SCHEMA}.storage_settings ss ON vk.id = ss.user_id
                LEFT JOIN {SCHEMA}.storage_plans sp ON COALESCE(ss.plan_id, 1) = sp.id
                LEFT JOIN {SCHEMA}.storage_objects so ON vk.id = so.user_id
                GROUP BY vk.id, vk.first_name, vk.last_name, ss.plan_id, sp.name, ss.custom_quota_gb, vk.created_at
                ORDER BY vk.id DESC
                LIMIT %s OFFSET %s
            ''', (limit, offset))
            users = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'users': [dict(u) for u in users]}, default=str)
            }
    finally:
        conn.close()

def update_user(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    user_id = body.get('user_id')
    plan_id = body.get('plan_id')
    custom_quota_gb = body.get('custom_quota_gb')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing user_id'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                INSERT INTO {SCHEMA}.storage_settings (user_id, plan_id, custom_quota_gb)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id) 
                DO UPDATE SET plan_id = EXCLUDED.plan_id, custom_quota_gb = EXCLUDED.custom_quota_gb
            ''', (user_id, plan_id, custom_quota_gb))
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True})
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
                    snapshot_date::text as date,
                    COUNT(DISTINCT user_id) as unique_users,
                    COUNT(*) as uploads,
                    SUM(size_bytes) / (1024.0 * 1024.0 * 1024.0) as total_size_gb
                FROM {SCHEMA}.storage_usage_daily
                WHERE snapshot_date >= CURRENT_DATE - INTERVAL '%s days'
                GROUP BY snapshot_date
                ORDER BY snapshot_date ASC
            ''' % days)
            stats = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'stats': [dict(s) for s in stats]}, default=str)
            }
    finally:
        conn.close()

def revenue_stats(event: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT 
                    sp.name as plan_name,
                    COUNT(DISTINCT ss.user_id) as users_count,
                    sp.monthly_price_rub * COUNT(DISTINCT ss.user_id) as total_revenue
                FROM {SCHEMA}.storage_plans sp
                LEFT JOIN {SCHEMA}.storage_settings ss ON sp.id = ss.plan_id
                WHERE sp.is_active = true
                GROUP BY sp.name, sp.monthly_price_rub
                ORDER BY total_revenue DESC
            ''')
            revenue = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'revenue': [dict(r) for r in revenue]}, default=str)
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
            'body': json.dumps({'error': 'Missing plan_id'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                INSERT INTO {SCHEMA}.storage_settings (user_id, plan_id)
                SELECT vk.id, %s
                FROM {SCHEMA}.vk_users vk
                WHERE NOT EXISTS (
                    SELECT 1 FROM {SCHEMA}.storage_settings ss WHERE ss.user_id = vk.id
                )
            ''', (plan_id,))
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'affected': cur.rowcount})
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
            cur.execute(f'''
                WITH daily_stats AS (
                    SELECT 
                        DATE(sd.snapshot_date) as date,
                        SUM(sd.size_bytes) / (1024.0 * 1024.0 * 1024.0) as storage_gb,
                        COUNT(DISTINCT sd.user_id) as active_users
                    FROM {SCHEMA}.storage_usage_daily sd
                    WHERE sd.snapshot_date >= CURRENT_DATE - INTERVAL '%s'
                    GROUP BY DATE(sd.snapshot_date)
                ),
                revenue_stats AS (
                    SELECT
                        SUM(sp.monthly_price_rub) as total_revenue,
                        COUNT(DISTINCT ss.user_id) as paying_users
                    FROM {SCHEMA}.storage_settings ss
                    JOIN {SCHEMA}.storage_plans sp ON ss.plan_id = sp.id
                    WHERE sp.is_active = true
                )
                SELECT 
                    ds.date::text,
                    ds.storage_gb,
                    ds.active_users,
                    rs.total_revenue,
                    rs.paying_users,
                    (ds.storage_gb * 0.5) as estimated_cost
                FROM daily_stats ds
                CROSS JOIN revenue_stats rs
                ORDER BY ds.date ASC
            ''' % interval)
            stats = cur.fetchall()
            
            total_revenue = sum(float(s.get('total_revenue', 0) or 0) for s in stats) / max(len(stats), 1)
            total_cost = sum(float(s.get('estimated_cost', 0)) for s in stats)
            profit = total_revenue - total_cost
            
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
                }, default=str)
            }
    finally:
        conn.close()