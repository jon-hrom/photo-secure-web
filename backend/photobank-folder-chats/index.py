import json
import os
import psycopg2

def handler(event: dict, context) -> dict:
    """
    API для получения клиентов папки с чатами и непрочитанными сообщениями
    GET ?folder_id=X - список клиентов папки с количеством непрочитанных сообщений
    """
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
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database not configured'})
        }
    
    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    try:
        folder_id = event.get('queryStringParameters', {}).get('folder_id')
        if not folder_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'folder_id required'})
            }
        
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        # Проверяем что папка принадлежит пользователю
        cur.execute(
            """
            SELECT id FROM t_p28211681_photo_secure_web.photo_folders
            WHERE id = %s AND user_id = %s
            """,
            (folder_id, user_id)
        )
        
        if not cur.fetchone():
            cur.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Folder not found'})
            }
        
        # Получаем клиента папки с информацией о непрочитанных сообщениях
        schema = 't_p28211681_photo_secure_web'
        query = f"""
            WITH latest_message AS (
                SELECT DISTINCT ON (cm.client_id)
                    cm.client_id,
                    cm.content,
                    cm.created_at
                FROM {schema}.client_messages cm
                WHERE cm.photographer_id = %s
                ORDER BY cm.client_id, cm.created_at DESC
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
                c.id,
                c.name,
                c.phone,
                COALESCE(uc.cnt, 0) as unread_count,
                lm.content as last_message,
                lm.created_at as last_message_time
            FROM {schema}.photo_folders pf
            INNER JOIN {schema}.clients c ON pf.client_id = c.id
            LEFT JOIN unread_counts uc ON uc.client_id = c.id
            LEFT JOIN latest_message lm ON lm.client_id = c.id
            WHERE pf.id = %s AND pf.user_id = %s
            ORDER BY lm.created_at DESC NULLS LAST
        """
        
        cur.execute(query, (user_id, user_id, folder_id, user_id))
        
        clients = []
        for row in cur.fetchall():
            clients.append({
                'id': row[0],
                'name': row[1],
                'phone': row[2],
                'unread_count': row[3],
                'last_message': row[4],
                'last_message_time': row[5].isoformat() if row[5] else None
            })
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'clients': clients})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }