import json
import os
import psycopg2

def handler(event: dict, context) -> dict:
    '''API для получения количества непрочитанных сообщений по всем клиентам фотографа'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
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
        params = event.get('queryStringParameters', {})
        photographer_id = params.get('photographer_id')
        client_id = params.get('client_id')
        
        if not photographer_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'photographer_id required'})
            }
        
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        # Если указан client_id - вернуть непрочитанные сообщения ОТ ФОТОГРАФА для этого клиента
        if client_id:
            cur.execute('''
                SELECT COUNT(*) as unread_count
                FROM t_p28211681_photo_secure_web.client_messages
                WHERE photographer_id = %s 
                  AND client_id = %s
                  AND is_read = FALSE 
                  AND sender_type = 'photographer'
            ''', (int(photographer_id), int(client_id)))
            
            row = cur.fetchone()
            unread_count = row[0] if row else 0
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'unread_count': unread_count})
            }
        
        # Иначе вернуть список всех клиентов с непрочитанными
        cur.execute('''
            SELECT client_id, COUNT(*) as unread_count
            FROM t_p28211681_photo_secure_web.client_messages
            WHERE photographer_id = %s 
              AND is_read = FALSE 
              AND sender_type = 'client'
            GROUP BY client_id
        ''', (int(photographer_id),))
        
        results = []
        for row in cur.fetchall():
            client_id = row[0]
            unread_count = row[1]
            
            # Получаем имя клиента отдельным запросом
            cur.execute('SELECT full_name FROM t_p28211681_photo_secure_web.clients WHERE id = %s', (client_id,))
            client_row = cur.fetchone()
            client_name = client_row[0] if client_row else 'Клиент'
            
            results.append({
                'client_id': client_id,
                'client_name': client_name,
                'unread_count': unread_count
            })
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'clients': results})
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }