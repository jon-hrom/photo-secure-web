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
            aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
            aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
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
    print(f'[FAVORITES] Method: {method}, Event keys: {list(event.keys())}')
    
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
                full_name = body.get('full_name', '').strip()
                phone = body.get('phone', '').strip()
                email = (body.get('email') or '').strip() or None
                photo_id = body.get('photo_id')
                
                if not gallery_code or photo_id is None or (not full_name and not phone and not email):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Missing required fields'})
                    }
                
                cur.execute('''
                    SELECT COALESCE(is_blocked, FALSE)
                    FROM t_p28211681_photo_secure_web.folder_short_links
                    WHERE short_code = %s
                ''', (gallery_code,))
                link_row = cur.fetchone()
                if link_row and link_row[0]:
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Gallery link is blocked', 'blocked': True})
                    }
                
                # Ищем существующего клиента по gallery_code и доступным полям
                existing = None
                
                if full_name and phone:
                    cur.execute('''
                        SELECT id FROM t_p28211681_photo_secure_web.favorite_clients
                        WHERE gallery_code = %s AND LOWER(TRIM(full_name)) = LOWER(%s) 
                          AND REGEXP_REPLACE(TRIM(phone), '[^0-9+]', '', 'g') = %s
                        ORDER BY id DESC LIMIT 1
                    ''', (gallery_code, full_name, phone))
                    existing = cur.fetchone()
                elif full_name:
                    cur.execute('''
                        SELECT id FROM t_p28211681_photo_secure_web.favorite_clients
                        WHERE gallery_code = %s AND LOWER(TRIM(full_name)) = LOWER(%s)
                        ORDER BY id DESC LIMIT 1
                    ''', (gallery_code, full_name))
                    existing = cur.fetchone()
                elif phone:
                    cur.execute('''
                        SELECT id FROM t_p28211681_photo_secure_web.favorite_clients
                        WHERE gallery_code = %s AND REGEXP_REPLACE(TRIM(phone), '[^0-9+]', '', 'g') = %s
                        ORDER BY id DESC LIMIT 1
                    ''', (gallery_code, phone))
                    existing = cur.fetchone()
                elif email:
                    cur.execute('''
                        SELECT id FROM t_p28211681_photo_secure_web.favorite_clients
                        WHERE gallery_code = %s AND LOWER(TRIM(email)) = LOWER(%s)
                        ORDER BY id DESC LIMIT 1
                    ''', (gallery_code, email))
                    existing = cur.fetchone()
                
                if existing:
                    client_id = existing[0]
                    # Обновляем поля если изменились
                    update_fields = []
                    update_values = []
                    
                    if email:
                        update_fields.append('email = %s')
                        update_values.append(email)
                    if full_name and not update_fields:
                        update_fields.append('full_name = %s')
                        update_values.append(full_name)
                    if phone and len(update_fields) < 2:
                        update_fields.append('phone = %s')
                        update_values.append(phone)
                    
                    if update_fields:
                        update_values.append(client_id)
                        cur.execute(f'''
                            UPDATE t_p28211681_photo_secure_web.favorite_clients
                            SET {', '.join(update_fields)}
                            WHERE id = %s
                        ''', tuple(update_values))
                else:
                    # Создаём нового клиента
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.favorite_clients 
                        (gallery_code, full_name, phone, email)
                        VALUES (%s, %s, %s, %s)
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
                full_name = body.get('full_name', '').strip()
                phone = body.get('phone', '').strip()
                email = (body.get('email') or '').strip()
                
                if not gallery_code:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'gallery_code is required'})
                    }
                
                cur.execute('''
                    SELECT COALESCE(is_blocked, FALSE)
                    FROM t_p28211681_photo_secure_web.folder_short_links
                    WHERE short_code = %s
                ''', (gallery_code,))
                link_check = cur.fetchone()
                if link_check and link_check[0]:
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Gallery link is blocked', 'blocked': True})
                    }
                
                import re
                if phone:
                    phone = re.sub(r'[^\d+]', '', phone)
                    if phone.startswith('8'):
                        phone = '+7' + phone[1:]
                    elif phone.startswith('7') and not phone.startswith('+7'):
                        phone = '+7' + phone[1:]
                    elif not phone.startswith('+7') and len(phone) >= 10:
                        phone = '+7' + phone
                
                where_conditions = ['gallery_code = %s']
                params = [gallery_code]
                
                if full_name:
                    where_conditions.append('LOWER(TRIM(full_name)) = LOWER(%s)')
                    params.append(full_name)
                
                if phone:
                    where_conditions.append("REGEXP_REPLACE(TRIM(phone), '[^0-9+]', '', 'g') = %s")
                    params.append(phone)
                
                if email:
                    where_conditions.append('LOWER(TRIM(email)) = LOWER(%s)')
                    params.append(email)
                
                where_clause = ' AND '.join(where_conditions)
                
                query = f'''
                    SELECT id, full_name, phone, email
                    FROM t_p28211681_photo_secure_web.favorite_clients
                    WHERE {where_clause}
                    ORDER BY id DESC LIMIT 1
                '''
                
                cur.execute(query, tuple(params))
                existing_client = cur.fetchone()
                
                if existing_client:
                    client_id = existing_client[0]
                    # Обновляем поля если изменились
                    update_parts = []
                    update_params = []
                    
                    if email and email != existing_client[3]:
                        update_parts.append('email = %s')
                        update_params.append(email)
                    
                    if update_parts:
                        update_params.append(client_id)
                        update_query = f'''
                            UPDATE t_p28211681_photo_secure_web.favorite_clients
                            SET {', '.join(update_parts)}
                            WHERE id = %s
                            RETURNING id, full_name, phone, email
                        '''
                        cur.execute(update_query, tuple(update_params))
                        client = cur.fetchone()
                    else:
                        client = existing_client
                else:
                    # Клиент не найден - возвращаем 404
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Client not found. Add photos to favorites first.'})
                    }
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'client_id': client[0],
                        'full_name': client[1] or '',
                        'phone': client[2] or '',
                        'email': client[3] or ''
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
                    
                    print(f'[DEBUG] Photo {row[0]}: s3_url={s3_url[:80] if s3_url else "empty"}, thumbnail_s3_url={thumbnail_s3_url[:80] if thumbnail_s3_url else "empty"}')
                    
                    # Если миниатюры нет или это .CR2, используем оригинальный URL
                    if not thumbnail_s3_url or thumbnail_s3_url.endswith('.CR2'):
                        thumbnail_s3_url = s3_url
                        print(f'[DEBUG] Photo {row[0]}: Using original URL as thumbnail')
                    
                    photo_url = generate_presigned_url(s3_url) if s3_url else ''
                    thumbnail_url = generate_presigned_url(thumbnail_s3_url) if thumbnail_s3_url else photo_url
                    
                    print(f'[DEBUG] Photo {row[0]}: Final URLs - photo_url contains .CR2: {".CR2" in photo_url}, thumbnail_url contains .CR2: {".CR2" in thumbnail_url}')
                    
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
            
            print(f'[FAVORITES DELETE] Params: {params}, client_id={client_id}, photo_id={photo_id}')
            
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
        
        print(f'[FAVORITES] Unhandled method: {method}')
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Method {method} not allowed'})
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