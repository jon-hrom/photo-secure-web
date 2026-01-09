"""
Автоматическое обновление статусов заказов по расписанию.
Функция запускается по таймеру (каждый час) и обновляет статусы заказов.
"""
import json
import os
import psycopg2
from datetime import datetime


def handler(event: dict, context) -> dict:
    """Обновление статусов заказов автоматически"""
    method = event.get('httpMethod', 'GET')
    
    # CORS для OPTIONS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    # Подключение к БД
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = None
    try:
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        # Обновляем pending платежи старше 24 часов на cancelled
        cur.execute("""
            UPDATE t_p28211681_photo_secure_web.client_payments
            SET 
                status = 'cancelled',
                description = COALESCE(description, '') || ' [Автоматически отменён]'
            WHERE 
                status = 'pending' 
                AND created_at < NOW() - INTERVAL '24 hours'
        """)
        
        updated_count = cur.rowcount
        
        conn.commit()
        cur.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': True,
                'updated_orders': updated_count,
                'timestamp': datetime.now().isoformat(),
                'message': f'Обновлено статусов: {updated_count}'
            })
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
        }
    finally:
        if conn:
            conn.close()