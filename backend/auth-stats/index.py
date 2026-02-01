"""
API для получения статистики авторизаций по провайдерам
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'


def get_db_connection():
    """Создание подключения к БД"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def get_auth_stats():
    """Получить статистику авторизаций по провайдерам"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Общая статистика по провайдерам
        cursor.execute(f"""
            SELECT 
                source,
                COUNT(*) as total_logins,
                COUNT(DISTINCT CASE WHEN last_login >= NOW() - INTERVAL '24 hours' THEN id END) as last_24h,
                COUNT(DISTINCT CASE WHEN last_login >= NOW() - INTERVAL '7 days' THEN id END) as last_7days,
                COUNT(DISTINCT CASE WHEN last_login >= NOW() - INTERVAL '30 days' THEN id END) as last_30days
            FROM {SCHEMA}.users
            WHERE source IS NOT NULL
            GROUP BY source
            ORDER BY total_logins DESC
        """)
        
        stats = cursor.fetchall()
        
        # Последние авторизации
        cursor.execute(f"""
            SELECT 
                u.id,
                u.email,
                u.display_name,
                u.source,
                u.last_login,
                u.created_at
            FROM {SCHEMA}.users u
            WHERE u.last_login IS NOT NULL
            ORDER BY u.last_login DESC
            LIMIT 100
        """)
        
        recent_logins = cursor.fetchall()
        
        return {
            'stats': [dict(row) for row in stats],
            'recent_logins': [dict(row) for row in recent_logins]
        }
    finally:
        conn.close()


def handler(event: dict, context) -> dict:
    """
    Получение статистики авторизаций
    """
    method = event.get('httpMethod', 'GET')
    
    # CORS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        data = get_auth_stats()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(data, ensure_ascii=False, default=str)
        }
        
    except Exception as e:
        print(f'[AUTH_STATS] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
