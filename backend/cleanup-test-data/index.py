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
            # Находим всех тестовых клиентов
            cur.execute('''
                SELECT id FROM t_p28211681_photo_secure_web.clients 
                WHERE name = 'Тестовый Клиент' OR name = 'Иванов Иван Иванович'
            ''')
            test_clients = cur.fetchall()
            
            deleted_count = 0
            for client in test_clients:
                client_id = client['id']
                
                # Удаляем в правильном порядке (сначала зависимости, потом родителей)
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.bookings WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.clients WHERE id = %s', (client_id,))
                
                deleted_count += 1
            
            conn.commit()
            print(f'[CLEANUP] Successfully deleted {deleted_count} test clients')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'deleted': deleted_count, 'message': f'Удалено {deleted_count} тестовых клиентов'}),
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
