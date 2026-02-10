import json
import os
import psycopg2
from datetime import datetime

def handler(event: dict, context) -> dict:
    '''API для получения списка всех чатов фотографа с клиентами и удаления переписок'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
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
            # Используем author как fallback для имени клиента
            cur.execute("""
                WITH latest_messages AS (
                    SELECT DISTINCT ON (client_id)
                        client_id,
                        content,
                        image_url,
                        sender_type,
                        created_at,
                        author
                    FROM t_p28211681_photo_secure_web.client_messages
                    WHERE photographer_id = %s
                    ORDER BY client_id, created_at DESC
                ),
                unread_counts AS (
                    SELECT client_id, COUNT(*) as cnt
                    FROM t_p28211681_photo_secure_web.client_messages
                    WHERE photographer_id = %s 
                      AND sender_type = 'client' 
                      AND is_read = FALSE
                    GROUP BY client_id
                )
                SELECT 
                    lm.client_id,
                    COALESCE(fc.full_name, lm.author, 'Клиент'),
                    COALESCE(fc.phone, ''),
                    COALESCE(fc.email, ''),
                    lm.content,
                    lm.image_url,
                    lm.sender_type,
                    lm.created_at,
                    COALESCE(uc.cnt, 0)
                FROM latest_messages lm
                LEFT JOIN t_p28211681_photo_secure_web.favorite_clients fc ON fc.id = lm.client_id
                LEFT JOIN unread_counts uc ON uc.client_id = lm.client_id
                ORDER BY lm.created_at DESC
            """, (photographer_id, photographer_id))
            
            chats = []
            for row in cur.fetchall():
                chats.append({
                    'client_id': row[0],
                    'client_name': row[1],
                    'client_phone': row[2],
                    'client_email': row[3],
                    'last_message': row[4],
                    'last_message_image': row[5],
                    'last_sender': row[6],
                    'last_message_time': row[7].isoformat() if row[7] else None,
                    'unread_count': row[8]
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
        
        elif method == 'DELETE':
            # Удаление всей переписки с конкретным клиентом
            query_params = event.get('queryStringParameters', {})
            client_id = query_params.get('client_id')
            
            if not client_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id required'})
                }
            
            cur.execute("""
                DELETE FROM t_p28211681_photo_secure_web.client_messages
                WHERE photographer_id = %s AND client_id = %s
            """, (photographer_id, client_id))
            
            conn.commit()
            deleted_count = cur.rowcount
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'deleted_messages': deleted_count})
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