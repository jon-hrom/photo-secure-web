import json
import os
from typing import Dict, Any, Optional
import psycopg2
import requests

def get_location_from_ip(ip: str) -> Optional[Dict[str, str]]:
    '''
    Определяет город по IP через ipapi.co
    '''
    if not ip or ip in ['127.0.0.1', 'localhost', '::1']:
        return None
    
    try:
        response = requests.get(f'https://ipapi.co/{ip}/json/', timeout=2)
        if response.status_code == 200:
            data = response.json()
            city = data.get('city')
            country = data.get('country_name')
            country_code = data.get('country_code', '')
            
            # Эмодзи флага страны
            emoji = ''
            if country_code and len(country_code) == 2:
                emoji = ''.join(chr(127397 + ord(c)) for c in country_code.upper())
            
            if city or country:
                return {
                    'city': city or '',
                    'country': country or '',
                    'emoji': emoji
                }
    except:
        pass
    
    return None

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
            ip = row[4]
            location = get_location_from_ip(ip)
            
            # Если геолокация определена - сохраняем JSON, иначе - просто IP
            if location:
                ip_display = json.dumps(location, ensure_ascii=False)
            else:
                ip_display = ip
            
            logs.append({
                'id': row[0],
                'folder_id': row[1],
                'photo_id': row[2],
                'download_type': row[3],
                'client_ip': ip_display,
                'user_agent': row[5],
                'downloaded_at': row[6].isoformat() if row[6] else None,
                'folder_name': row[7],
                'photo_name': row[8]
            })
        
        # Получаем статистику избранного (по клиентам, дате и папкам)
        cur.execute(
            """
            SELECT 
                fp.client_id,
                fc.full_name as client_name,
                DATE(fp.added_at) as favorite_date,
                COUNT(fp.id) as photo_count,
                pf.id as folder_id,
                pf.folder_name
            FROM t_p28211681_photo_secure_web.favorite_photos fp
            JOIN t_p28211681_photo_secure_web.photo_bank pb ON pb.id = fp.photo_id
            JOIN t_p28211681_photo_secure_web.photo_folders pf ON pf.id = pb.folder_id
            LEFT JOIN t_p28211681_photo_secure_web.favorite_clients fc ON fc.id = fp.client_id
            WHERE pf.user_id = %s
            GROUP BY fp.client_id, fc.full_name, DATE(fp.added_at), pf.id, pf.folder_name, fp.added_at
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
                'photo_count': row[3],
                'folder_id': row[4],
                'folder_name': row[5]
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