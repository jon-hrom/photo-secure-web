'''
API для статистики фотографа: клиенты, проекты, платежи, бронирования
Args: event с httpMethod, queryStringParameters, headers с X-User-Id
Returns: HTTP ответ с статистикой по выбранному периоду
'''

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = 't_p28211681_photo_secure_web'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Получение статистики для фотографа по всем направлениям'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': '',
            'isBase64Encoded': False
        }
    
    # Получаем photographer_id из headers
    headers = event.get('headers', {})
    photographer_id = headers.get('X-User-Id') or headers.get('x-user-id')
    
    if not photographer_id:
        return {
            'statusCode': 401,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Missing X-User-Id header'}),
            'isBase64Encoded': False
        }
    
    # Параметры периода
    params = event.get('queryStringParameters', {}) or {}
    period = params.get('period', 'month')  # day, week, month, quarter, year, all, custom
    start_date = params.get('start_date')  # для custom периода
    end_date = params.get('end_date')  # для custom периода
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Определяем временной диапазон
            date_filter = get_date_filter(period, start_date, end_date)
            prev_date_filter = get_prev_period_filter(period, start_date, end_date)
            
            # === 1. ОБЩАЯ СТАТИСТИКА ===
            general_stats = get_general_stats(cur, photographer_id, date_filter, prev_date_filter)
            
            # === 2. КЛИЕНТЫ ===
            clients_stats = get_clients_stats(cur, photographer_id, date_filter)
            
            # === 3. ПРОЕКТЫ ===
            projects_stats = get_projects_stats(cur, photographer_id, date_filter)
            
            # === 4. ФИНАНСЫ ===
            financial_stats = get_financial_stats(cur, photographer_id, date_filter, prev_date_filter)
            
            # === 5. ГРАФИКИ ПО ПЕРИОДАМ ===
            charts_data = get_charts_data(cur, photographer_id, period, date_filter)
            
            # === 6. ТОПЫ ===
            tops = get_tops(cur, photographer_id, date_filter)
            
            # === 7. ПРЕДУПРЕЖДЕНИЯ ===
            alerts = get_alerts(cur, photographer_id)
            
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({
                    'period': period,
                    'date_range': {
                        'start': start_date,
                        'end': end_date
                    },
                    'general': general_stats,
                    'clients': clients_stats,
                    'projects': projects_stats,
                    'financial': financial_stats,
                    'charts': charts_data,
                    'tops': tops,
                    'alerts': alerts
                }, default=str),
                'isBase64Encoded': False
            }
            
    except Exception as e:
        print(f'[ERROR] Statistics failed: {e}')
        import traceback
        print(f'[ERROR] Traceback: {traceback.format_exc()}')
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Failed to get statistics: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()

def get_date_filter(period: str, start_date: str = None, end_date: str = None) -> str:
    '''Генерирует SQL фильтр по дате'''
    if period == 'custom' and start_date and end_date:
        return f"BETWEEN '{start_date}' AND '{end_date}'"
    elif period == 'day':
        return ">= CURRENT_DATE"
    elif period == 'week':
        return ">= CURRENT_DATE - INTERVAL '7 days'"
    elif period == 'month':
        return ">= CURRENT_DATE - INTERVAL '30 days'"
    elif period == 'quarter':
        return ">= CURRENT_DATE - INTERVAL '90 days'"
    elif period == 'year':
        return ">= CURRENT_DATE - INTERVAL '365 days'"
    else:  # all
        return ">= '1970-01-01'"

def get_prev_period_filter(period: str, start_date: str = None, end_date: str = None) -> str:
    '''Генерирует SQL фильтр для предыдущего периода (для сравнения)'''
    if period == 'custom' and start_date and end_date:
        days = (datetime.strptime(end_date, '%Y-%m-%d') - datetime.strptime(start_date, '%Y-%m-%d')).days
        prev_start = (datetime.strptime(start_date, '%Y-%m-%d') - timedelta(days=days)).strftime('%Y-%m-%d')
        prev_end = start_date
        return f"BETWEEN '{prev_start}' AND '{prev_end}'"
    elif period == 'day':
        return "BETWEEN CURRENT_DATE - INTERVAL '1 day' AND CURRENT_DATE"
    elif period == 'week':
        return "BETWEEN CURRENT_DATE - INTERVAL '14 days' AND CURRENT_DATE - INTERVAL '7 days'"
    elif period == 'month':
        return "BETWEEN CURRENT_DATE - INTERVAL '60 days' AND CURRENT_DATE - INTERVAL '30 days'"
    elif period == 'quarter':
        return "BETWEEN CURRENT_DATE - INTERVAL '180 days' AND CURRENT_DATE - INTERVAL '90 days'"
    elif period == 'year':
        return "BETWEEN CURRENT_DATE - INTERVAL '730 days' AND CURRENT_DATE - INTERVAL '365 days'"
    else:
        return ">= '1970-01-01'"

def get_general_stats(cur, photographer_id: str, date_filter: str, prev_date_filter: str) -> Dict[str, Any]:
    '''Общая статистика'''
    
    # Количество клиентов
    cur.execute(f'''
        SELECT COUNT(*) as total_clients,
               COUNT(CASE WHEN created_at {date_filter} THEN 1 END) as new_clients,
               COUNT(CASE WHEN created_at {prev_date_filter} THEN 1 END) as prev_period_clients
        FROM {SCHEMA}.clients
        WHERE photographer_id = {photographer_id}
    ''')
    clients_data = cur.fetchone()
    
    # Количество проектов
    cur.execute(f'''
        SELECT COUNT(*) as total_projects,
               COUNT(CASE WHEN cp.created_at {date_filter} THEN 1 END) as new_projects,
               COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects
        FROM {SCHEMA}.client_projects cp
        JOIN {SCHEMA}.clients c ON cp.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
    ''')
    projects_data = cur.fetchone()
    
    # Количество бронирований
    cur.execute(f'''
        SELECT COUNT(*) as total_bookings,
               COUNT(CASE WHEN b.created_at {date_filter} THEN 1 END) as new_bookings
        FROM {SCHEMA}.bookings b
        JOIN {SCHEMA}.clients c ON b.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
    ''')
    bookings_data = cur.fetchone()
    
    return {
        'clients': {
            'total': clients_data['total_clients'],
            'new': clients_data['new_clients'],
            'growth': calculate_growth(clients_data['new_clients'], clients_data['prev_period_clients'])
        },
        'projects': {
            'total': projects_data['total_projects'],
            'new': projects_data['new_projects'],
            'completed': projects_data['completed_projects'],
            'completion_rate': round((projects_data['completed_projects'] / projects_data['total_projects'] * 100) if projects_data['total_projects'] > 0 else 0, 1)
        },
        'bookings': {
            'total': bookings_data['total_bookings'],
            'new': bookings_data['new_bookings']
        }
    }

def get_clients_stats(cur, photographer_id: str, date_filter: str) -> Dict[str, Any]:
    '''Статистика по клиентам'''
    
    # Новые vs постоянные клиенты
    cur.execute(f'''
        SELECT 
            c.id,
            c.name,
            c.created_at,
            COUNT(cp.id) as projects_count,
            COALESCE(SUM(pay.amount), 0) as total_spent
        FROM {SCHEMA}.clients c
        LEFT JOIN {SCHEMA}.client_projects cp ON c.id = cp.client_id
        LEFT JOIN {SCHEMA}.client_payments pay ON c.id = pay.client_id AND pay.status = 'completed'
        WHERE c.photographer_id = {photographer_id}
        GROUP BY c.id, c.name, c.created_at
    ''')
    all_clients = cur.fetchall()
    
    new_clients = [c for c in all_clients if str(c['created_at']) > str(datetime.now() - timedelta(days=30))]
    returning_clients = [c for c in all_clients if c['projects_count'] > 1]
    
    # Возвращаемость клиентов
    total_with_projects = len([c for c in all_clients if c['projects_count'] > 0])
    returning_rate = round((len(returning_clients) / total_with_projects * 100) if total_with_projects > 0 else 0, 1)
    
    return {
        'total_clients': len(all_clients),
        'new_clients': len(new_clients),
        'returning_clients': len(returning_clients),
        'returning_rate': returning_rate,
        'one_time_clients': len(all_clients) - len(returning_clients)
    }

def get_projects_stats(cur, photographer_id: str, date_filter: str) -> Dict[str, Any]:
    '''Статистика по проектам'''
    
    # Проекты по категориям
    cur.execute(f'''
        SELECT 
            COALESCE(cp.category, 'Не указано') as category,
            COUNT(cp.id) as count,
            COALESCE(SUM(pay.amount), 0) as revenue
        FROM {SCHEMA}.client_projects cp
        JOIN {SCHEMA}.clients c ON cp.client_id = c.id
        LEFT JOIN {SCHEMA}.client_payments pay ON cp.id = pay.project_id AND pay.status = 'completed'
        WHERE c.photographer_id = {photographer_id}
          AND cp.created_at {date_filter}
        GROUP BY cp.category
        ORDER BY count DESC
    ''')
    projects_by_category = cur.fetchall()
    
    # Статусы проектов
    cur.execute(f'''
        SELECT 
            status,
            COUNT(*) as count
        FROM {SCHEMA}.client_projects cp
        JOIN {SCHEMA}.clients c ON cp.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
          AND cp.created_at {date_filter}
        GROUP BY status
    ''')
    projects_by_status = cur.fetchall()
    
    return {
        'by_category': [dict(p) for p in projects_by_category],
        'by_status': [dict(p) for p in projects_by_status]
    }

def get_financial_stats(cur, photographer_id: str, date_filter: str, prev_date_filter: str) -> Dict[str, Any]:
    '''Финансовая статистика'''
    
    # Доходы за период
    cur.execute(f'''
        SELECT 
            COALESCE(SUM(CASE WHEN pay.payment_date {date_filter} AND pay.status = 'completed' THEN pay.amount END), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN pay.payment_date {prev_date_filter} AND pay.status = 'completed' THEN pay.amount END), 0) as prev_revenue,
            COALESCE(SUM(CASE WHEN pay.status = 'pending' THEN pay.amount END), 0) as pending_amount,
            COUNT(CASE WHEN pay.status = 'pending' THEN 1 END) as pending_count,
            COALESCE(AVG(CASE WHEN pay.status = 'completed' AND pay.payment_date {date_filter} THEN pay.amount END), 0) as avg_check
        FROM {SCHEMA}.client_payments pay
        JOIN {SCHEMA}.clients c ON pay.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
    ''')
    finance_data = cur.fetchone()
    
    # Доходы по методам оплаты
    cur.execute(f'''
        SELECT 
            method,
            COUNT(*) as count,
            COALESCE(SUM(amount), 0) as total
        FROM {SCHEMA}.client_payments pay
        JOIN {SCHEMA}.clients c ON pay.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
          AND pay.status = 'completed'
          AND pay.payment_date {date_filter}
        GROUP BY method
    ''')
    by_method = cur.fetchall()
    
    return {
        'total_revenue': float(finance_data['total_revenue']),
        'prev_revenue': float(finance_data['prev_revenue']),
        'revenue_growth': calculate_growth(finance_data['total_revenue'], finance_data['prev_revenue']),
        'avg_check': float(finance_data['avg_check']),
        'pending': {
            'amount': float(finance_data['pending_amount']),
            'count': finance_data['pending_count']
        },
        'by_method': [dict(m) for m in by_method]
    }

def get_charts_data(cur, photographer_id: str, period: str, date_filter: str) -> Dict[str, Any]:
    '''Данные для графиков'''
    
    # Определяем формат группировки по дате
    if period in ['day', 'week']:
        date_trunc = 'hour'
    elif period in ['month', 'quarter']:
        date_trunc = 'day'
    else:
        date_trunc = 'month'
    
    # График проектов по времени
    cur.execute(f'''
        SELECT 
            DATE_TRUNC('{date_trunc}', cp.created_at) as period,
            COUNT(*) as count
        FROM {SCHEMA}.client_projects cp
        JOIN {SCHEMA}.clients c ON cp.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
          AND cp.created_at {date_filter}
        GROUP BY DATE_TRUNC('{date_trunc}', cp.created_at)
        ORDER BY period
    ''')
    projects_timeline = cur.fetchall()
    
    # График доходов по времени
    cur.execute(f'''
        SELECT 
            DATE_TRUNC('{date_trunc}', pay.payment_date) as period,
            COALESCE(SUM(amount), 0) as revenue
        FROM {SCHEMA}.client_payments pay
        JOIN {SCHEMA}.clients c ON pay.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
          AND pay.status = 'completed'
          AND pay.payment_date {date_filter}
        GROUP BY DATE_TRUNC('{date_trunc}', pay.payment_date)
        ORDER BY period
    ''')
    revenue_timeline = cur.fetchall()
    
    # График новых клиентов
    cur.execute(f'''
        SELECT 
            DATE_TRUNC('{date_trunc}', created_at) as period,
            COUNT(*) as count
        FROM {SCHEMA}.clients
        WHERE photographer_id = {photographer_id}
          AND created_at {date_filter}
        GROUP BY DATE_TRUNC('{date_trunc}', created_at)
        ORDER BY period
    ''')
    clients_timeline = cur.fetchall()
    
    return {
        'projects_timeline': [dict(p) for p in projects_timeline],
        'revenue_timeline': [dict(r) for r in revenue_timeline],
        'clients_timeline': [dict(c) for c in clients_timeline]
    }

def get_tops(cur, photographer_id: str, date_filter: str) -> Dict[str, Any]:
    '''Топ клиентов и проектов'''
    
    # Топ-5 клиентов по доходу
    cur.execute(f'''
        SELECT 
            c.id,
            c.name,
            c.phone,
            COALESCE(SUM(pay.amount), 0) as total_spent,
            COUNT(DISTINCT cp.id) as projects_count
        FROM {SCHEMA}.clients c
        LEFT JOIN {SCHEMA}.client_projects cp ON c.id = cp.client_id
        LEFT JOIN {SCHEMA}.client_payments pay ON c.id = pay.client_id AND pay.status = 'completed'
        WHERE c.photographer_id = {photographer_id}
        GROUP BY c.id, c.name, c.phone
        ORDER BY total_spent DESC
        LIMIT 5
    ''')
    top_clients = cur.fetchall()
    
    # Топ-5 самых крупных заказов
    cur.execute(f'''
        SELECT 
            cp.id,
            cp.name as project_name,
            c.name as client_name,
            COALESCE(SUM(pay.amount), 0) as total_amount,
            cp.status,
            cp.created_at
        FROM {SCHEMA}.client_projects cp
        JOIN {SCHEMA}.clients c ON cp.client_id = c.id
        LEFT JOIN {SCHEMA}.client_payments pay ON cp.id = pay.project_id
        WHERE c.photographer_id = {photographer_id}
        GROUP BY cp.id, cp.name, c.name, cp.status, cp.created_at
        ORDER BY total_amount DESC
        LIMIT 5
    ''')
    top_projects = cur.fetchall()
    
    return {
        'top_clients': [dict(c) for c in top_clients],
        'top_projects': [dict(p) for p in top_projects]
    }

def get_alerts(cur, photographer_id: str) -> Dict[str, Any]:
    '''Предупреждения и задачи'''
    
    # Неоплаченные заказы - считаем остаток со всех проектов
    cur.execute(f'''
        SELECT 
            COUNT(*) as count,
            COALESCE(SUM(GREATEST(COALESCE(cp.budget, 0) - COALESCE(paid.total_paid, 0), 0)), 0) as total_amount
        FROM {SCHEMA}.client_projects cp
        JOIN {SCHEMA}.clients c ON cp.client_id = c.id
        LEFT JOIN (
            SELECT project_id, SUM(amount) as total_paid
            FROM {SCHEMA}.client_payments
            WHERE status = 'completed'
            GROUP BY project_id
        ) paid ON cp.id = paid.project_id
        WHERE c.photographer_id = {photographer_id}
          AND cp.budget IS NOT NULL
          AND cp.budget > 0
          AND (COALESCE(cp.budget, 0) - COALESCE(paid.total_paid, 0)) > 0
    ''')
    unpaid = cur.fetchone()
    
    # Проекты без даты
    cur.execute(f'''
        SELECT COUNT(*) as count
        FROM {SCHEMA}.client_projects cp
        JOIN {SCHEMA}.clients c ON cp.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
          AND cp.start_date IS NULL
    ''')
    no_date = cur.fetchone()
    
    # Просроченные бронирования
    cur.execute(f'''
        SELECT COUNT(*) as count
        FROM {SCHEMA}.bookings b
        JOIN {SCHEMA}.clients c ON b.client_id = c.id
        WHERE c.photographer_id = {photographer_id}
          AND b.booking_date < NOW()
    ''')
    overdue = cur.fetchone()
    
    return {
        'unpaid_orders': {
            'count': unpaid['count'],
            'amount': float(unpaid['total_amount'])
        },
        'projects_without_date': no_date['count'],
        'overdue_bookings': overdue['count']
    }

def calculate_growth(current: float, previous: float) -> float:
    '''Расчет роста в процентах'''
    # Защита от None и non-numeric значений
    try:
        curr = float(current) if current is not None else 0.0
        prev = float(previous) if previous is not None else 0.0
        
        if prev == 0:
            return 100.0 if curr > 0 else 0.0
        return round(((curr - prev) / prev) * 100, 1)
    except (ValueError, TypeError):
        return 0.0