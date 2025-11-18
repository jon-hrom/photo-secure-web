'''
Business: Admin panel for storage management - CRUD plans, user management, billing, analytics
Args: event with httpMethod, body, queryStringParameters, headers; context with request_id
Returns: HTTP response with statusCode, headers, body
'''

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any, List

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def is_admin(user_id: int) -> bool:
    return user_id == 1

def get_user_from_token(event: Dict[str, Any]) -> int:
    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    
    if not user_id:
        raise ValueError('Missing user authentication')
    
    return int(user_id)

def list_plans(event: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    include_inactive = params.get('includeInactive') == 'true'
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query = f'SELECT * FROM {SCHEMA}.storage_plans'
            if not include_inactive:
                query += ' WHERE is_active = true'
            query += ' ORDER BY quota_gb ASC'
            
            cur.execute(query)
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
    name = body.get('name')
    quota_gb = body.get('quotaGb')
    monthly_price_rub = body.get('monthlyPriceRub')
    features_json = json.dumps(body.get('features', {}))
    is_active = body.get('isActive', True)
    
    if not name or quota_gb is None or monthly_price_rub is None:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing required fields'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                INSERT INTO {SCHEMA}.storage_plans 
                (name, quota_gb, monthly_price_rub, features_json, is_active)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *
            ''', (name, quota_gb, monthly_price_rub, features_json, is_active))
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
    plan_id = body.get('id')
    name = body.get('name')
    quota_gb = body.get('quotaGb')
    monthly_price_rub = body.get('monthlyPriceRub')
    features_json = json.dumps(body.get('features', {})) if body.get('features') else None
    is_active = body.get('isActive')
    
    if not plan_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing plan ID'})
        }
    
    updates = []
    params = []
    
    if name:
        updates.append('name = %s')
        params.append(name)
    if quota_gb is not None:
        updates.append('quota_gb = %s')
        params.append(quota_gb)
    if monthly_price_rub is not None:
        updates.append('monthly_price_rub = %s')
        params.append(monthly_price_rub)
    if features_json:
        updates.append('features_json = %s')
        params.append(features_json)
    if is_active is not None:
        updates.append('is_active = %s')
        params.append(is_active)
    
    updates.append('updated_at = CURRENT_TIMESTAMP')
    params.append(plan_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                UPDATE {SCHEMA}.storage_plans
                SET {", ".join(updates)}
                WHERE id = %s
                RETURNING *
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

def assign_plan_to_user(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    user_id = body.get('userId')
    plan_id = body.get('planId')
    custom_quota_gb = body.get('customQuotaGb')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing user ID'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                UPDATE {SCHEMA}.users
                SET plan_id = %s, custom_quota_gb = %s
                WHERE id = %s
            ''', (plan_id, custom_quota_gb, user_id))
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True})
            }
    finally:
        conn.close()

def get_user_storage(event: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    user_id = params.get('userId')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing user ID'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT 
                    u.id, u.email, u.plan_id, u.custom_quota_gb,
                    sp.name as plan_name, sp.quota_gb as plan_quota_gb,
                    COUNT(so.id) as file_count,
                    COALESCE(SUM(so.bytes), 0) as total_bytes
                FROM {SCHEMA}.users u
                LEFT JOIN {SCHEMA}.storage_plans sp ON u.plan_id = sp.id
                LEFT JOIN {SCHEMA}.storage_objects so ON u.id = so.user_id AND so.status = 'active'
                WHERE u.id = %s
                GROUP BY u.id, u.email, u.plan_id, u.custom_quota_gb, sp.name, sp.quota_gb
            ''', (user_id,))
            user = cur.fetchone()
            
            if not user:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'User not found'})
                }
            
            limit_gb = float(user['custom_quota_gb']) if user['custom_quota_gb'] else float(user['plan_quota_gb'] or 5.0)
            used_gb = user['total_bytes'] / (1024 ** 3)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'user': dict(user),
                    'usedGb': round(used_gb, 3),
                    'limitGb': limit_gb,
                    'percent': round((used_gb / limit_gb * 100) if limit_gb > 0 else 0, 1)
                }, default=str)
            }
    finally:
        conn.close()

def get_all_users_storage(event: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    limit = int(params.get('limit', '50'))
    offset = int(params.get('offset', '0'))
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT 
                    u.id, u.email, u.plan_id, u.custom_quota_gb,
                    sp.name as plan_name, sp.quota_gb as plan_quota_gb,
                    COUNT(so.id) as file_count,
                    COALESCE(SUM(so.bytes), 0) as total_bytes
                FROM {SCHEMA}.users u
                LEFT JOIN {SCHEMA}.storage_plans sp ON u.plan_id = sp.id
                LEFT JOIN {SCHEMA}.storage_objects so ON u.id = so.user_id AND so.status = 'active'
                GROUP BY u.id, u.email, u.plan_id, u.custom_quota_gb, sp.name, sp.quota_gb
                ORDER BY total_bytes DESC
                LIMIT %s OFFSET %s
            ''', (limit, offset))
            users = cur.fetchall()
            
            result = []
            for user in users:
                limit_gb = float(user['custom_quota_gb']) if user['custom_quota_gb'] else float(user['plan_quota_gb'] or 5.0)
                used_gb = user['total_bytes'] / (1024 ** 3)
                result.append({
                    **dict(user),
                    'usedGb': round(used_gb, 3),
                    'limitGb': limit_gb,
                    'percent': round((used_gb / limit_gb * 100) if limit_gb > 0 else 0, 1)
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'users': result, 'limit': limit, 'offset': offset}, default=str)
            }
    finally:
        conn.close()

def get_settings(event: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SELECT * FROM {SCHEMA}.storage_settings ORDER BY key')
            settings = cur.fetchall()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'settings': [dict(s) for s in settings]}, default=str)
            }
    finally:
        conn.close()

def update_settings(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    settings = body.get('settings', {})
    
    if not settings:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'No settings provided'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            for key, value in settings.items():
                cur.execute(f'''
                    UPDATE {SCHEMA}.storage_settings
                    SET value = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE key = %s
                ''', (value, key))
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True})
            }
    finally:
        conn.close()

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        user_id = get_user_from_token(event)
        if not is_admin(user_id):
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Admin access required'})
            }
    except ValueError as e:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    
    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', '')
    
    if method == 'GET' and action == 'plans':
        return list_plans(event)
    elif method == 'POST' and action == 'plans':
        return create_plan(event)
    elif method == 'PUT' and action == 'plans':
        return update_plan(event)
    elif method == 'POST' and action == 'assign-plan':
        return assign_plan_to_user(event)
    elif method == 'GET' and action == 'user-storage':
        return get_user_storage(event)
    elif method == 'GET' and action == 'users-storage':
        return get_all_users_storage(event)
    elif method == 'GET' and action == 'settings':
        return get_settings(event)
    elif method == 'PUT' and action == 'settings':
        return update_settings(event)
    elif method == 'GET' and not action:
        return list_plans(event)
    
    return {
        'statusCode': 404,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Not found'})
    }