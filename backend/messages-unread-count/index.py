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
            query = f'''
                SELECT COUNT(*) as unread_count
                FROM t_p28211681_photo_secure_web.client_messages
                WHERE photographer_id = {int(photographer_id)} 
                  AND client_id = {int(client_id)}
                  AND is_read = FALSE 
                  AND sender_type = 'photographer'
            '''
            cur.execute(query)
            
            row = cur.fetchone()
            unread_count = row[0] if row else 0
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'unread_count': unread_count})
            }
        
        # Вернуть непрочитанные сообщения сгруппированные по folder_id
        query = f'''
            SELECT fsl.folder_id, SUM(unread_cnt) as total_unread
            FROM (
                SELECT cm.client_id, COUNT(*) as unread_cnt
                FROM t_p28211681_photo_secure_web.client_messages cm
                WHERE cm.photographer_id = {int(photographer_id)} 
                  AND cm.is_read = FALSE 
                  AND cm.sender_type = 'client'
                GROUP BY cm.client_id
            ) unread
            JOIN t_p28211681_photo_secure_web.favorite_clients fc ON fc.id = unread.client_id
            JOIN t_p28211681_photo_secure_web.folder_short_links fsl ON fsl.short_code = fc.gallery_code
            WHERE fsl.user_id = {int(photographer_id)}
            GROUP BY fsl.folder_id
        '''
        cur.execute(query)
        
        results = []
        for row in cur.fetchall():
            results.append({
                'folder_id': row[0],
                'unread_count': row[1]
            })
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'folders': results})
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }