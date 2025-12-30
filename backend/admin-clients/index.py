import json
import os
from typing import Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor

DB_SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    '''Получает подключение к БД'''
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    '''API для управления всеми клиентами в админке - просмотр, фильтрация и полное удаление клиентов из БД'''
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    # Проверка прав администратора
    user_id = event.get('headers', {}).get('X-User-Id')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Требуется авторизация'}),
            'isBase64Encoded': False
        }
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        if method == 'GET':
            return handle_get_clients(cursor, conn)
        elif method == 'DELETE':
            return handle_delete_client(cursor, conn, event)
        else:
            cursor.close()
            conn.close()
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Метод не поддерживается'}),
                'isBase64Encoded': False
            }
            
    except Exception as e:
        print(f'Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }

def handle_get_clients(cursor, conn) -> dict:
    '''Получает список всех клиентов со всеми данными'''
    try:
        # Получаем всех клиентов с данными фотографов
        query = f'''
            SELECT 
                c.id,
                c.user_id,
                c.photographer_id,
                c.name,
                c.phone,
                c.email,
                c.address,
                c.vk_profile,
                c.shooting_date,
                c.shooting_time,
                c.shooting_duration,
                c.shooting_address,
                c.project_price,
                c.project_comments,
                c.created_at,
                c.updated_at,
                u.email as photographer_email,
                u.username as photographer_name,
                COUNT(DISTINCT cp.id) as projects_count,
                COUNT(DISTINCT cpay.id) as payments_count,
                COUNT(DISTINCT cd.id) as documents_count,
                COUNT(DISTINCT b.id) as bookings_count,
                COALESCE(SUM(cpay.amount), 0) as total_paid
            FROM {DB_SCHEMA}.clients c
            LEFT JOIN {DB_SCHEMA}.users u ON c.photographer_id = u.id
            LEFT JOIN {DB_SCHEMA}.client_projects cp ON c.id = cp.client_id
            LEFT JOIN {DB_SCHEMA}.client_payments cpay ON c.id = cpay.client_id
            LEFT JOIN {DB_SCHEMA}.client_documents cd ON c.id = cd.client_id
            LEFT JOIN {DB_SCHEMA}.bookings b ON c.id = b.client_id
            GROUP BY c.id, u.email, u.username
            ORDER BY c.created_at DESC
        '''
        
        cursor.execute(query)
        clients = cursor.fetchall()
        
        # Преобразуем данные в JSON-friendly формат
        result = []
        for client in clients:
            result.append({
                'id': client['id'],
                'user_id': client['user_id'],
                'photographer_id': client['photographer_id'],
                'photographer_email': client['photographer_email'],
                'photographer_name': client['photographer_name'],
                'name': client['name'],
                'phone': client['phone'],
                'email': client['email'],
                'address': client['address'],
                'vk_profile': client['vk_profile'],
                'shooting_date': str(client['shooting_date']) if client['shooting_date'] else None,
                'shooting_time': str(client['shooting_time']) if client['shooting_time'] else None,
                'shooting_duration': client['shooting_duration'],
                'shooting_address': client['shooting_address'],
                'project_price': float(client['project_price']) if client['project_price'] else None,
                'project_comments': client['project_comments'],
                'created_at': str(client['created_at']),
                'updated_at': str(client['updated_at']),
                'stats': {
                    'projects_count': client['projects_count'],
                    'payments_count': client['payments_count'],
                    'documents_count': client['documents_count'],
                    'bookings_count': client['bookings_count'],
                    'total_paid': float(client['total_paid'])
                }
            })
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'clients': result, 'total': len(result)}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        cursor.close()
        conn.close()
        raise e

def handle_delete_client(cursor, conn, event: dict) -> dict:
    '''Полностью удаляет клиента из БД со всеми связанными данными'''
    try:
        body = json.loads(event.get('body', '{}'))
        client_id = body.get('client_id')
        
        if not client_id:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'client_id обязателен'}),
                'isBase64Encoded': False
            }
        
        # Удаляем все связанные данные (CASCADE работает автоматически благодаря REFERENCES)
        # Но для уверенности удаляем вручную
        cursor.execute(f"DELETE FROM {DB_SCHEMA}.client_messages WHERE client_id = %s", (client_id,))
        cursor.execute(f"DELETE FROM {DB_SCHEMA}.client_comments WHERE client_id = %s", (client_id,))
        cursor.execute(f"DELETE FROM {DB_SCHEMA}.client_documents WHERE client_id = %s", (client_id,))
        cursor.execute(f"DELETE FROM {DB_SCHEMA}.client_payments WHERE client_id = %s", (client_id,))
        cursor.execute(f"DELETE FROM {DB_SCHEMA}.client_projects WHERE client_id = %s", (client_id,))
        cursor.execute(f"DELETE FROM {DB_SCHEMA}.bookings WHERE client_id = %s", (client_id,))
        cursor.execute(f"DELETE FROM {DB_SCHEMA}.clients WHERE id = %s", (client_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True, 'message': 'Клиент полностью удалён из БД'}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        raise e