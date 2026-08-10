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
                ),
                own_clients AS (
                    SELECT id, name, phone, COALESCE(email, '') AS email
                    FROM t_p28211681_photo_secure_web.clients
                    WHERE photographer_id = %s
                ),
                own_gallery_clients AS (
                    SELECT fc.id, fc.full_name, fc.phone, COALESCE(fc.email, '') AS email,
                           fc.is_online, fc.last_seen_at, COALESCE(fc.max_link, '') AS max_link,
                           fc.gallery_code
                    FROM t_p28211681_photo_secure_web.favorite_clients fc
                    JOIN t_p28211681_photo_secure_web.folder_short_links fsl
                      ON fsl.short_code = fc.gallery_code
                    JOIN t_p28211681_photo_secure_web.photo_folders pf
                      ON pf.id = fsl.folder_id AND pf.user_id = %s
                )
                SELECT 
                    lm.client_id,
                    COALESCE(oc.name, gc.full_name),
                    COALESCE(oc.phone, gc.phone, ''),
                    COALESCE(oc.email, gc.email, ''),
                    lm.content,
                    lm.image_url,
                    lm.sender_type,
                    lm.created_at,
                    COALESCE(uc.cnt, 0),
                    COALESCE(gc.is_online, FALSE),
                    gc.last_seen_at,
                    COALESCE(gc.max_link, ''),
                    COALESCE(gc.gallery_code, '')
                FROM latest_messages lm
                LEFT JOIN own_clients oc ON oc.id = lm.client_id
                LEFT JOIN own_gallery_clients gc ON gc.id = lm.client_id
                LEFT JOIN unread_counts uc ON uc.client_id = lm.client_id
                WHERE oc.id IS NOT NULL OR gc.id IS NOT NULL
                ORDER BY lm.created_at DESC
            """, (photographer_id, photographer_id, photographer_id, photographer_id))
            
            chats = []
            for row in cur.fetchall():
                last_seen = row[10]
                is_online = row[9]
                # Клиент считается офлайн, если не был активен более 60 секунд
                if is_online and last_seen is not None:
                    if (datetime.now() - last_seen).total_seconds() > 60:
                        is_online = False
                chats.append({
                    'client_id': row[0],
                    'client_name': row[1],
                    'client_phone': row[2],
                    'client_email': row[3],
                    'last_message': row[4],
                    'last_message_image': row[5],
                    'last_sender': row[6],
                    'last_message_time': row[7].isoformat() if row[7] else None,
                    'unread_count': row[8],
                    'is_online': is_online,
                    'last_seen_at': last_seen.isoformat() if last_seen else None,
                    'max_link': row[11],
                    'gallery_code': row[12]
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