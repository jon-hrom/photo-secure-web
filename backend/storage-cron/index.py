'''
Business: Cron jobs for storage system - daily usage snapshots and monthly billing calculations
Args: event with httpMethod, body, queryStringParameters; context with request_id
Returns: HTTP response with statusCode, headers, body
'''

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from datetime import datetime, timedelta
from decimal import Decimal

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def get_billing_rate() -> Decimal:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                SELECT value FROM {SCHEMA}.storage_settings
                WHERE key = 'billing_rub_per_gb_month'
            ''')
            row = cur.fetchone()
            return Decimal(row[0]) if row else Decimal('2.16')
    finally:
        conn.close()

def daily_snapshot(event: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT user_id, COALESCE(SUM(bytes), 0) as total_bytes
                FROM {SCHEMA}.storage_objects
                WHERE status = 'active'
                GROUP BY user_id
            ''')
            users = cur.fetchall()
            
            today = datetime.now().date()
            inserted = 0
            
            for user in users:
                user_id = user['user_id']
                total_bytes = user['total_bytes']
                used_gb = Decimal(total_bytes) / Decimal(1024 ** 3)
                
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.storage_usage_daily 
                    (user_id, date, used_gb_end_of_day)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, date) 
                    DO UPDATE SET used_gb_end_of_day = EXCLUDED.used_gb_end_of_day
                ''', (user_id, today, used_gb))
                inserted += 1
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'date': str(today),
                    'usersProcessed': inserted
                })
            }
    finally:
        conn.close()

def monthly_billing(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    period = body.get('period')
    
    if not period:
        prev_month = datetime.now().replace(day=1) - timedelta(days=1)
        period = prev_month.strftime('%Y-%m')
    
    try:
        period_date = datetime.strptime(period, '%Y-%m')
        first_day = period_date.replace(day=1)
        if period_date.month == 12:
            last_day = period_date.replace(year=period_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            last_day = period_date.replace(month=period_date.month + 1, day=1) - timedelta(days=1)
    except ValueError:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid period format. Use YYYY-MM'})
        }
    
    billing_rate = get_billing_rate()
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT user_id, AVG(used_gb_end_of_day) as avg_gb
                FROM {SCHEMA}.storage_usage_daily
                WHERE date >= %s AND date <= %s
                GROUP BY user_id
                HAVING AVG(used_gb_end_of_day) > 0
            ''', (first_day.date(), last_day.date()))
            users = cur.fetchall()
            
            invoices_created = 0
            
            for user in users:
                user_id = user['user_id']
                avg_gb = Decimal(str(user['avg_gb']))
                amount_rub = (avg_gb * billing_rate).quantize(Decimal('0.01'))
                
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.storage_invoices
                    (user_id, period, avg_gb, rate_rub_per_gb_month, amount_rub, status)
                    VALUES (%s, %s, %s, %s, %s, 'pending')
                    ON CONFLICT (user_id, period)
                    DO UPDATE SET 
                        avg_gb = EXCLUDED.avg_gb,
                        rate_rub_per_gb_month = EXCLUDED.rate_rub_per_gb_month,
                        amount_rub = EXCLUDED.amount_rub
                ''', (user_id, period, avg_gb, billing_rate, amount_rub))
                invoices_created += 1
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'period': period,
                    'invoicesCreated': invoices_created,
                    'billingRate': str(billing_rate)
                })
            }
    finally:
        conn.close()

def get_invoices(event: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    user_id = params.get('userId')
    period = params.get('period')
    status = params.get('status')
    limit = int(params.get('limit', '50'))
    offset = int(params.get('offset', '0'))
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            where_clauses = []
            query_params = []
            
            if user_id:
                where_clauses.append('i.user_id = %s')
                query_params.append(user_id)
            if period:
                where_clauses.append('i.period = %s')
                query_params.append(period)
            if status:
                where_clauses.append('i.status = %s')
                query_params.append(status)
            
            where_sql = 'WHERE ' + ' AND '.join(where_clauses) if where_clauses else ''
            
            cur.execute(f'''
                SELECT 
                    i.*, u.email
                FROM {SCHEMA}.storage_invoices i
                JOIN {SCHEMA}.users u ON i.user_id = u.id
                {where_sql}
                ORDER BY i.period DESC, i.created_at DESC
                LIMIT %s OFFSET %s
            ''', query_params + [limit, offset])
            invoices = cur.fetchall()
            
            cur.execute(f'''
                SELECT COUNT(*) as total, COALESCE(SUM(amount_rub), 0) as total_amount
                FROM {SCHEMA}.storage_invoices i
                {where_sql}
            ''', query_params)
            stats = cur.fetchone()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'invoices': [dict(inv) for inv in invoices],
                    'total': stats['total'],
                    'totalAmount': float(stats['total_amount']),
                    'limit': limit,
                    'offset': offset
                }, default=str)
            }
    finally:
        conn.close()

def update_invoice_status(event: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    invoice_id = body.get('invoiceId')
    status = body.get('status')
    
    if not invoice_id or not status:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing invoiceId or status'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            if status == 'paid':
                cur.execute(f'''
                    UPDATE {SCHEMA}.storage_invoices
                    SET status = %s, paid_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                ''', (status, invoice_id))
            else:
                cur.execute(f'''
                    UPDATE {SCHEMA}.storage_invoices
                    SET status = %s
                    WHERE id = %s
                ''', (status, invoice_id))
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
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Cron-Secret',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', '')
    
    if method == 'POST' and action == 'daily-snapshot':
        return daily_snapshot(event)
    elif method == 'POST' and action == 'monthly-billing':
        return monthly_billing(event)
    elif method == 'GET' and action == 'invoices':
        return get_invoices(event)
    elif method == 'PUT' and action == 'invoice-status':
        return update_invoice_status(event)
    elif method == 'GET' and not action:
        return get_invoices(event)
    
    return {
        'statusCode': 404,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Not found'})
    }