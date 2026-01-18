import json
import os
from typing import Dict, Any
import psycopg2

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    API для получения статистики скачиваний фотографом
    '''
    method: str = event.get('httpMethod', 'GET')
    
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
    
    try:
        body = json.loads(event.get('body', '{}'))
        user_id = body.get('userId')
        
        if not user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId is required'}),
                'isBase64Encoded': False
            }
        
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        # Получаем логи скачиваний
        cur.execute(
            """
            SELECT 
                dl.id,
                dl.folder_id,
                dl.photo_id,
                dl.download_type,
                dl.client_ip,
                dl.user_agent,
                dl.downloaded_at,
                pf.folder_name,
                pb.file_name as photo_name
            FROM t_p28211681_photo_secure_web.download_logs dl
            LEFT JOIN t_p28211681_photo_secure_web.photo_folders pf ON pf.id = dl.folder_id
            LEFT JOIN t_p28211681_photo_secure_web.photo_bank pb ON pb.id = dl.photo_id
            WHERE dl.user_id = %s
            ORDER BY dl.downloaded_at DESC
            LIMIT 1000
            """,
            (user_id,)
        )
        
        rows = cur.fetchall()
        
        logs = []
        for row in rows:
            logs.append({
                'id': row[0],
                'folder_id': row[1],
                'photo_id': row[2],
                'download_type': row[3],
                'client_ip': row[4],
                'user_agent': row[5],
                'downloaded_at': row[6].isoformat() if row[6] else None,
                'folder_name': row[7],
                'photo_name': row[8]
            })
        
        # Получаем статистику избранного (по клиентам и дате)
        cur.execute(
            """
            SELECT 
                fp.client_id,
                fc.full_name as client_name,
                DATE(fp.added_at) as favorite_date,
                COUNT(fp.id) as photo_count
            FROM t_p28211681_photo_secure_web.favorite_photos fp
            JOIN t_p28211681_photo_secure_web.photo_bank pb ON pb.id = fp.photo_id
            LEFT JOIN t_p28211681_photo_secure_web.favorite_clients fc ON fc.id = fp.client_id
            WHERE pb.user_id = %s
            GROUP BY fp.client_id, fc.full_name, DATE(fp.added_at), fp.added_at
            ORDER BY fp.added_at DESC
            LIMIT 1000
            """,
            (user_id,)
        )
        
        favorite_rows = cur.fetchall()
        
        favorites = []
        for row in favorite_rows:
            favorites.append({
                'client_id': row[0],
                'client_name': row[1] or f'Клиент #{row[0]}',
                'favorite_date': row[2].isoformat() if row[2] else None,
                'photo_count': row[3]
            })
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'logs': logs,
                'favorites': favorites
            }),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }