import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

DB_SCHEMA = 't_p28211681_photo_secure_web'

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Административная функция для очистки тестовых данных из базы
    '''
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('''
                SELECT id, name FROM t_p28211681_photo_secure_web.clients 
                WHERE 
                    name = 'Тестовый Клиент' 
                    OR name = 'Иванов Иван Иванович'
                    OR name LIKE 'Тест%'
                    OR name LIKE '%тест%'
                    OR LOWER(name) LIKE '%test%'
            ''')
            test_clients = cur.fetchall()
            
            deleted_count = 0
            deleted_data = {
                'bookings': 0,
                'payments': 0, 
                'projects': 0,
                'documents': 0,
                'comments': 0,
                'messages': 0
            }
            
            for client in test_clients:
                client_id = client['id']
                client_name = client['name']
                
                cur.execute('SELECT COUNT(*) as cnt FROM t_p28211681_photo_secure_web.bookings WHERE client_id = %s', (client_id,))
                deleted_data['bookings'] += cur.fetchone()['cnt']
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.bookings WHERE client_id = %s', (client_id,))
                
                cur.execute('SELECT COUNT(*) as cnt FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))
                deleted_data['payments'] += cur.fetchone()['cnt']
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))
                
                cur.execute('SELECT COUNT(*) as cnt FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
                deleted_data['projects'] += cur.fetchone()['cnt']
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
                
                cur.execute('SELECT COUNT(*) as cnt FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
                deleted_data['documents'] += cur.fetchone()['cnt']
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
                
                cur.execute('SELECT COUNT(*) as cnt FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
                deleted_data['comments'] += cur.fetchone()['cnt']
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
                
                cur.execute('SELECT COUNT(*) as cnt FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
                deleted_data['messages'] += cur.fetchone()['cnt']
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
                
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.clients WHERE id = %s', (client_id,))
                
                deleted_count += 1
                print(f'[CLEANUP] Deleted client: {client_name} (ID: {client_id})')
            
            conn.commit()
            
            message = f'Удалено {deleted_count} клиентов'
            if sum(deleted_data.values()) > 0:
                details = []
                if deleted_data['bookings'] > 0:
                    details.append(f"{deleted_data['bookings']} записей")
                if deleted_data['projects'] > 0:
                    details.append(f"{deleted_data['projects']} проектов")
                if deleted_data['payments'] > 0:
                    details.append(f"{deleted_data['payments']} платежей")
                if deleted_data['documents'] > 0:
                    details.append(f"{deleted_data['documents']} документов")
                if details:
                    message += ' и связанных данных: ' + ', '.join(details)
            
            print(f'[CLEANUP] Successfully deleted {deleted_count} test clients with related data')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True, 
                    'deleted': deleted_count, 
                    'message': message,
                    'details': deleted_data
                }),
                'isBase64Encoded': False
            }
    
    except Exception as e:
        conn.rollback()
        print(f'[CLEANUP_ERROR] {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()