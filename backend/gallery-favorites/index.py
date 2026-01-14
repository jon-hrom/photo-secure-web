import json
import os
import psycopg2
import boto3
from datetime import timedelta

def generate_presigned_url(s3_url: str, expiration: int = 3600) -> str:
    '''Генерирует presigned URL для S3 объекта'''
    if not s3_url or 'storage.yandexcloud.net' not in s3_url:
        return s3_url
    
    try:
        parts = s3_url.replace('https://storage.yandexcloud.net/', '').split('/', 1)
        if len(parts) != 2:
            return s3_url
        
        bucket_name = parts[0]
        object_key = parts[1]
        
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
            region_name='ru-central1'
        )
        
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': object_key},
            ExpiresIn=expiration
        )
        
        return presigned_url
    except Exception as e:
        print(f'Error generating presigned URL: {e}')
        return s3_url

def handler(event: dict, context) -> dict:
    '''API для работы с избранными фото клиентов галереи'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    try:
        if method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'add_to_favorites':
                gallery_code = body.get('gallery_code')
                full_name = body.get('full_name')
                phone = body.get('phone', '')
                email = body.get('email')
                photo_id = body.get('photo_id')
                
                if not all([gallery_code, full_name, photo_id is not None]):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Missing required fields'})
                    }
                
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.favorite_clients 
                    (gallery_code, full_name, phone, email)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (gallery_code, full_name, phone) 
                    DO UPDATE SET email = EXCLUDED.email
                    RETURNING id
                ''', (gallery_code, full_name, phone, email))
                
                client_id = cur.fetchone()[0]
                
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.favorite_photos 
                    (client_id, photo_id)
                    VALUES (%s, %s)
                    ON CONFLICT (client_id, photo_id) DO NOTHING
                ''', (client_id, photo_id))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True, 'client_id': client_id})
                }
            
            elif action == 'login':
                gallery_code = body.get('gallery_code')
                full_name = body.get('full_name')
                phone = body.get('phone', '')
                email = body.get('email', '')
                
                if not all([gallery_code, full_name]):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Missing required fields'})
                    }
                
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.favorite_clients 
                    (gallery_code, full_name, phone, email)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (gallery_code, full_name, phone) 
                    DO UPDATE SET email = EXCLUDED.email
                    RETURNING id, full_name, phone, email
                ''', (gallery_code, full_name, phone, email))
                
                client = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'client_id': client[0],
                        'full_name': client[1],
                        'phone': client[2],
                        'email': client[3]
                    })
                }
        
        elif method == 'GET':
            params = event.get('queryStringParameters') or {}
            client_id = params.get('client_id')
            gallery_code = params.get('gallery_code')
            folder_id = params.get('folder_id')
            
            if folder_id:
                cur.execute('''
                    SELECT 
                        id, file_name, s3_url, thumbnail_s3_url, 
                        width, height, file_size
                    FROM t_p28211681_photo_secure_web.photo_bank
                    WHERE folder_id = %s AND is_trashed = FALSE
                    ORDER BY created_at DESC
                ''', (folder_id,))
                
                photos = []
                for row in cur.fetchall():
                    s3_url = row[2] if row[2] else ''
                    thumbnail_s3_url = row[3] if row[3] else ''
                    
                    # Если миниатюры нет или это .CR2, используем оригинальный URL
                    if not thumbnail_s3_url or thumbnail_s3_url.endswith('.CR2'):
                        thumbnail_s3_url = s3_url
                    
                    photo_url = generate_presigned_url(s3_url) if s3_url else ''
                    thumbnail_url = generate_presigned_url(thumbnail_s3_url) if thumbnail_s3_url else photo_url
                    
                    photos.append({
                        'id': row[0],
                        'file_name': row[1],
                        'photo_url': photo_url,
                        'thumbnail_url': thumbnail_url,
                        'width': row[4],
                        'height': row[5],
                        'file_size': row[6]
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'photos': photos})
                }
            
            elif gallery_code:
                cur.execute('''
                    SELECT 
                        fc.id as client_id,
                        fc.full_name,
                        fc.phone,
                        fc.email,
                        fp.photo_id,
                        fp.added_at
                    FROM t_p28211681_photo_secure_web.favorite_clients fc
                    LEFT JOIN t_p28211681_photo_secure_web.favorite_photos fp ON fc.id = fp.client_id
                    WHERE fc.gallery_code = %s
                    ORDER BY fc.full_name, fp.added_at DESC
                ''', (gallery_code,))
                
                clients = {}
                for row in cur.fetchall():
                    client_id_row = row[0]
                    if client_id_row not in clients:
                        clients[client_id_row] = {
                            'client_id': client_id_row,
                            'full_name': row[1],
                            'phone': row[2],
                            'email': row[3],
                            'photos': []
                        }
                    
                    if row[4]:
                        clients[client_id_row]['photos'].append({
                            'photo_id': row[4],
                            'added_at': row[5].isoformat() if row[5] else None
                        })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'clients': list(clients.values())})
                }
            
            elif client_id:
                cur.execute('''
                    SELECT fp.photo_id, fp.added_at
                    FROM t_p28211681_photo_secure_web.favorite_photos fp
                    WHERE fp.client_id = %s
                    ORDER BY fp.added_at DESC
                ''', (client_id,))
                
                photos = []
                for row in cur.fetchall():
                    photos.append({
                        'photo_id': row[0],
                        'added_at': row[1].isoformat() if row[1] else None
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'photos': photos})
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id or gallery_code required'})
                }
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters') or {}
            client_id = params.get('client_id')
            photo_id = params.get('photo_id')
            
            if not all([client_id, photo_id]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id and photo_id required'})
                }
            
            cur.execute('''
                DELETE FROM t_p28211681_photo_secure_web.favorite_photos
                WHERE client_id = %s AND photo_id = %s
            ''', (client_id, photo_id))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True})
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cur.close()
        conn.close()