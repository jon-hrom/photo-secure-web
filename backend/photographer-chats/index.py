import json
import os
import psycopg2
from datetime import datetime

def handler(event: dict, context) -> dict:
    '''API для получения списка всех чатов фотографа с клиентами'''
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
    
    try:
        headers = event.get('headers', {})
        photographer_id = headers.get('x-user-id') or headers.get('X-User-Id')
        
        if not photographer_id:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Authorization required'})
            }
        
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        if method == 'GET':
            # Получаем список всех чатов с последним сообщением и количеством непрочитанных
            schema = 't_p28211681_photo_secure_web'
            query = f"""
                WITH latest_messages AS (
                    SELECT DISTINCT ON (client_id)
                        client_id,
                        content,
                        image_url,
                        sender_type,
                        created_at
                    FROM {schema}.client_messages
                    WHERE photographer_id = %s
                    ORDER BY client_id, created_at DESC
                ),
                unread_counts AS (
                    SELECT client_id, COUNT(*) as cnt
                    FROM {schema}.client_messages
                    WHERE photographer_id = %s 
                      AND sender_type = 'client' 
                      AND is_read = FALSE
                    GROUP BY client_id
                )
                SELECT 
                    lm.client_id,
                    c.full_name,
                    c.phone,
                    lm.content,
                    lm.image_url,
                    lm.sender_type,
                    lm.created_at,
                    COALESCE(uc.cnt, 0)
                FROM latest_messages lm
                JOIN {schema}.clients c ON c.id = lm.client_id
                LEFT JOIN unread_counts uc ON uc.client_id = lm.client_id
                ORDER BY lm.created_at DESC
            """
            cur.execute(query, (photographer_id, photographer_id))
            
            chats = []
            for row in cur.fetchall():
                chats.append({
                    'client_id': row[0],
                    'client_name': row[1],
                    'client_phone': row[2],
                    'last_message': row[3],
                    'last_message_image': row[4],
                    'last_sender': row[5],
                    'last_message_time': row[6].isoformat() if row[6] else None,
                    'unread_count': row[7]
                })
            
            # Сортируем по времени последнего сообщения
            chats.sort(key=lambda x: x['last_message_time'] or '', reverse=True)
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'chats': chats})
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
        
    except Exception as e:
        print(f'Error in photographer chats: {str(e)}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }