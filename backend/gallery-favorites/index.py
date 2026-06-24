import json
import os
import re
import psycopg2
import boto3
from botocore.client import Config
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


def build_photo_urls(s3_key, s3_url, thumbnail_s3_key, thumbnail_s3_url,
                     grid_thumbnail_s3_key, grid_thumbnail_s3_url, is_raw):
    '''Строит (photo_url, thumbnail_url) по ключам S3 — точно как в gallery-share.
    Для RAW (.CR2) превью берётся из thumbnail_s3_key, т.к. сам .CR2 браузер не покажет.'''
    use_poehali = bool(s3_url and 'cdn.poehali.dev' in s3_url)

    # Готовый CDN URL от poehali — presigned не нужен
    if use_poehali and s3_url:
        photo_url = s3_url
        thumbnail_url = thumbnail_s3_url or grid_thumbnail_s3_url or s3_url
        return photo_url, thumbnail_url

    yc_s3 = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )
    bucket = 'foto-mix'

    def presign(key):
        if not key:
            return None
        try:
            return yc_s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=3600
            )
        except Exception as e:
            print(f'Error presign key {key}: {e}')
            return None

    if is_raw and thumbnail_s3_key:
        url = presign(thumbnail_s3_key)
        return url, url

    photo_url = presign(s3_key) or generate_presigned_url(s3_url)
    thumbnail_url = presign(grid_thumbnail_s3_key) or presign(thumbnail_s3_key) or photo_url
    return photo_url, thumbnail_url

def handler(event: dict, context) -> dict:
    '''API для работы с избранными фото клиентов галереи'''
    method = event.get('httpMethod', 'GET')
    print(f'[FAVORITES] Method: {method}, Event keys: {list(event.keys())}')
    
    headers = event.get('headers', {})
    origin = headers.get('origin') or headers.get('Origin') or '*'
    cors_headers = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    }
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {**cors_headers, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    try:
        if method == 'POST':
            raw_body = event.get('body', '{}')
            try:
                body = json.loads(raw_body) if raw_body else {}
            except (json.JSONDecodeError, TypeError):
                return {
                    'statusCode': 400,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'error': 'Invalid JSON body'})
                }
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
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
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
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
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
                    
                    update_fields.extend(['is_online = TRUE', 'last_seen_at = NOW()'])
                    update_values.append(client_id)
                    cur.execute(f'''
                        UPDATE t_p28211681_photo_secure_web.favorite_clients
                        SET {', '.join(update_fields)}
                        WHERE id = %s
                    ''', tuple(update_values))
                else:
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.favorite_clients 
                        (gallery_code, full_name, phone, email, is_online, last_seen_at)
                        VALUES (%s, %s, %s, %s, TRUE, NOW())
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
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'success': True, 'client_id': client_id})
                }
            
            elif action == 'register_client':
                gallery_code = body.get('gallery_code')
                full_name = (body.get('full_name') or '').strip()
                phone = (body.get('phone') or '').strip()
                email = (body.get('email') or '').strip() or None
                
                print(f'[REGISTER_CLIENT] gallery_code={gallery_code}, full_name={full_name!r}, phone={phone!r}, email={email!r}')
                
                if not gallery_code or (not full_name and not phone and not email):
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
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
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Gallery link is blocked', 'blocked': True})
                    }
                
                existing = None
                norm_phone = re.sub(r'[^0-9+]', '', phone) if phone else ''
                
                if full_name and phone:
                    cur.execute('''
                        SELECT id FROM t_p28211681_photo_secure_web.favorite_clients
                        WHERE gallery_code = %s AND LOWER(TRIM(full_name)) = LOWER(%s) 
                          AND REGEXP_REPLACE(TRIM(phone), '[^0-9+]', '', 'g') = %s
                        ORDER BY id DESC LIMIT 1
                    ''', (gallery_code, full_name, norm_phone))
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
                    ''', (gallery_code, norm_phone))
                    existing = cur.fetchone()
                elif email:
                    cur.execute('''
                        SELECT id FROM t_p28211681_photo_secure_web.favorite_clients
                        WHERE gallery_code = %s AND LOWER(TRIM(email)) = LOWER(%s)
                        ORDER BY id DESC LIMIT 1
                    ''', (gallery_code, email))
                    existing = cur.fetchone()
                
                print(f'[REGISTER_CLIENT] existing={existing}')
                
                if existing:
                    client_id = existing[0]
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.favorite_clients
                        SET is_online = TRUE, last_seen_at = NOW()
                        WHERE id = %s
                    ''', (client_id,))
                    print(f'[REGISTER_CLIENT] Updated existing client_id={client_id}')
                else:
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.favorite_clients 
                        (gallery_code, full_name, phone, email, is_online, last_seen_at)
                        VALUES (%s, %s, %s, %s, TRUE, NOW())
                        RETURNING id
                    ''', (gallery_code, full_name or '', phone or '', email))
                    client_id = cur.fetchone()[0]
                    print(f'[REGISTER_CLIENT] Inserted new client_id={client_id}')
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'success': True, 'client_id': client_id})
                }
            
            elif action == 'list_registered_clients':
                gallery_code = body.get('gallery_code')
                user_id = event.get('headers', {}).get('x-user-id') or event.get('headers', {}).get('X-User-Id')
                
                if not gallery_code or not user_id:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'gallery_code and auth required'})
                    }
                
                cur.execute('''
                    SELECT fsl.id FROM t_p28211681_photo_secure_web.folder_short_links fsl
                    WHERE fsl.short_code = %s AND fsl.user_id = %s
                ''', (gallery_code, user_id))
                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Access denied'})
                    }
                
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.favorite_clients
                    SET is_online = FALSE
                    WHERE gallery_code = %s AND is_online = TRUE
                      AND last_seen_at < NOW() - INTERVAL '60 seconds'
                ''', (gallery_code,))
                conn.commit()
                
                cur.execute('''
                    SELECT id, full_name, phone, email, created_at, COALESCE(upload_enabled, FALSE),
                           COALESCE(is_online, FALSE), last_seen_at
                    FROM t_p28211681_photo_secure_web.favorite_clients
                    WHERE gallery_code = %s
                    ORDER BY is_online DESC, last_seen_at DESC NULLS LAST, created_at DESC
                ''', (gallery_code,))
                
                registered = []
                for row in cur.fetchall():
                    registered.append({
                        'id': row[0],
                        'full_name': row[1] or '',
                        'phone': row[2] or '',
                        'email': row[3] or '',
                        'created_at': row[4].isoformat() if row[4] else None,
                        'upload_enabled': row[5],
                        'is_online': row[6],
                        'last_seen_at': row[7].isoformat() if row[7] else None
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'clients': registered})
                }
            
            elif action == 'toggle_upload':
                client_id = body.get('client_id')
                upload_enabled = body.get('upload_enabled', False)
                gallery_code = body.get('gallery_code')
                user_id = event.get('headers', {}).get('x-user-id') or event.get('headers', {}).get('X-User-Id')
                
                if not client_id or not gallery_code or not user_id:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'client_id, gallery_code and auth required'})
                    }
                
                cur.execute('''
                    SELECT fsl.id FROM t_p28211681_photo_secure_web.folder_short_links fsl
                    WHERE fsl.short_code = %s AND fsl.user_id = %s
                ''', (gallery_code, user_id))
                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Access denied'})
                    }
                
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.favorite_clients
                    SET upload_enabled = %s
                    WHERE id = %s AND gallery_code = %s
                ''', (upload_enabled, client_id, gallery_code))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'success': True, 'upload_enabled': upload_enabled})
                }
            
            elif action == 'heartbeat':
                client_id = body.get('client_id')
                gallery_code = body.get('gallery_code')
                
                if not client_id or not gallery_code:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'client_id and gallery_code required'})
                    }
                
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.favorite_clients
                    SET is_online = TRUE, last_seen_at = NOW()
                    WHERE id = %s AND gallery_code = %s
                    RETURNING COALESCE(upload_enabled, FALSE)
                ''', (client_id, gallery_code))
                row = cur.fetchone()
                conn.commit()
                
                if not row:
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Client not found'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'ok': True, 'upload_enabled': row[0]})
                }
            
            elif action == 'go_offline':
                client_id = body.get('client_id')
                gallery_code = body.get('gallery_code')
                
                if client_id and gallery_code:
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.favorite_clients
                        SET is_online = FALSE
                        WHERE id = %s AND gallery_code = %s
                    ''', (client_id, gallery_code))
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'ok': True})
                }
            
            elif action == 'login':
                gallery_code = body.get('gallery_code')
                full_name = body.get('full_name', '').strip()
                phone = body.get('phone', '').strip()
                email = (body.get('email') or '').strip()
                
                if not gallery_code:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
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
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Gallery link is blocked', 'blocked': True})
                    }
                
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
                    SELECT id, full_name, phone, email, COALESCE(upload_enabled, FALSE)
                    FROM t_p28211681_photo_secure_web.favorite_clients
                    WHERE {where_clause}
                    ORDER BY id DESC LIMIT 1
                '''
                
                cur.execute(query, tuple(params))
                existing_client = cur.fetchone()
                
                if existing_client:
                    client_id = existing_client[0]
                    update_parts = ['is_online = TRUE', 'last_seen_at = NOW()']
                    update_params = []
                    
                    if email and email != existing_client[3]:
                        update_parts.append('email = %s')
                        update_params.append(email)
                    
                    update_params.append(client_id)
                    update_query = f'''
                        UPDATE t_p28211681_photo_secure_web.favorite_clients
                        SET {', '.join(update_parts)}
                        WHERE id = %s
                        RETURNING id, full_name, phone, email, COALESCE(upload_enabled, FALSE)
                    '''
                    cur.execute(update_query, tuple(update_params))
                    client = cur.fetchone()
                else:
                    # Клиент не найден - возвращаем 404
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Client not found. Add photos to favorites first.'})
                    }
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({
                        'client_id': client[0],
                        'full_name': client[1] or '',
                        'phone': client[2] or '',
                        'email': client[3] or '',
                        'upload_enabled': client[4] if len(client) > 4 else False
                    })
                }
            
            elif action == 'create_list':
                gallery_code = body.get('gallery_code')
                client_id = body.get('client_id')
                name = (body.get('name') or '').strip()
                note = (body.get('note') or '').strip() or None
                if not gallery_code or not client_id or not name:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'gallery_code, client_id, name required'})
                    }
                if len(name) > 255:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'name too long'})
                    }
                cur.execute('''
                    SELECT id, folder_id FROM t_p28211681_photo_secure_web.folder_short_links
                    WHERE short_code = %s
                      AND COALESCE(is_blocked, FALSE) = FALSE
                      AND (expires_at IS NULL OR expires_at > NOW())
                ''', (gallery_code,))
                link = cur.fetchone()
                if not link:
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Gallery not found'})
                    }
                cur.execute('''
                    SELECT id FROM t_p28211681_photo_secure_web.favorite_clients
                    WHERE id = %s AND gallery_code = %s
                ''', (client_id, gallery_code))
                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Client not allowed'})
                    }
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.favorite_lists
                        (gallery_code, parent_folder_id, short_link_id, client_id, name, note)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                ''', (gallery_code, link[1], link[0], int(client_id), name, note))
                row = cur.fetchone()
                conn.commit()
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({
                        'list': {
                            'id': row[0],
                            'name': name,
                            'note': note,
                            'created_at': row[1].isoformat() if row[1] else None,
                            'photo_count': 0
                        }
                    })
                }

            elif action == 'add_photos_to_list':
                list_id = body.get('list_id')
                gallery_code = body.get('gallery_code')
                client_id = body.get('client_id')
                photo_ids = body.get('photo_ids') or []
                if not list_id or not gallery_code or not client_id or not isinstance(photo_ids, list) or not photo_ids:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'list_id, gallery_code, client_id, photo_ids required'})
                    }
                cur.execute('''
                    SELECT gallery_code, client_id FROM t_p28211681_photo_secure_web.favorite_lists
                    WHERE id = %s
                ''', (int(list_id),))
                row = cur.fetchone()
                if not row:
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'List not found'})
                    }
                if row[0] != gallery_code or row[1] != int(client_id):
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Access denied'})
                    }
                added = 0
                for pid in photo_ids:
                    try:
                        pid_int = int(pid)
                    except (TypeError, ValueError):
                        continue
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.favorite_list_photos (list_id, photo_id)
                        VALUES (%s, %s)
                        ON CONFLICT (list_id, photo_id) DO NOTHING
                    ''', (int(list_id), pid_int))
                    added += cur.rowcount
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.favorite_lists
                    SET updated_at = NOW() WHERE id = %s
                ''', (int(list_id),))
                conn.commit()
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'added': added})
                }

            elif action == 'delete_list':
                list_id = body.get('list_id')
                gallery_code = body.get('gallery_code')
                client_id = body.get('client_id')
                if not list_id or not gallery_code or not client_id:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'list_id, gallery_code, client_id required'})
                    }
                cur.execute('''
                    SELECT gallery_code, client_id FROM t_p28211681_photo_secure_web.favorite_lists
                    WHERE id = %s
                ''', (int(list_id),))
                row = cur.fetchone()
                if not row:
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'List not found'})
                    }
                if row[0] != gallery_code or row[1] != int(client_id):
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Access denied'})
                    }
                cur.execute('''
                    DELETE FROM t_p28211681_photo_secure_web.favorite_list_photos
                    WHERE list_id = %s
                ''', (int(list_id),))
                cur.execute('''
                    DELETE FROM t_p28211681_photo_secure_web.favorite_lists
                    WHERE id = %s
                ''', (int(list_id),))
                conn.commit()
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'ok': True})
                }

            elif action == 'remove_photo_from_list':
                list_id = body.get('list_id')
                gallery_code = body.get('gallery_code')
                client_id = body.get('client_id')
                photo_id = body.get('photo_id')
                if not list_id or not gallery_code or not client_id or not photo_id:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'list_id, gallery_code, client_id, photo_id required'})
                    }
                cur.execute('''
                    SELECT gallery_code, client_id FROM t_p28211681_photo_secure_web.favorite_lists
                    WHERE id = %s
                ''', (int(list_id),))
                row = cur.fetchone()
                if not row:
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'List not found'})
                    }
                if row[0] != gallery_code or row[1] != int(client_id):
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Access denied'})
                    }
                cur.execute('''
                    DELETE FROM t_p28211681_photo_secure_web.favorite_list_photos
                    WHERE list_id = %s AND photo_id = %s
                ''', (int(list_id), int(photo_id)))
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.favorite_lists
                    SET updated_at = NOW() WHERE id = %s
                ''', (int(list_id),))
                conn.commit()
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'ok': True})
                }

            elif action == 'rename_list':
                list_id = body.get('list_id')
                gallery_code = body.get('gallery_code')
                client_id = body.get('client_id')
                name = (body.get('name') or '').strip()
                if not list_id or not gallery_code or not client_id or not name:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'list_id, gallery_code, client_id, name required'})
                    }
                cur.execute('''
                    SELECT gallery_code, client_id FROM t_p28211681_photo_secure_web.favorite_lists
                    WHERE id = %s
                ''', (int(list_id),))
                row = cur.fetchone()
                if not row:
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'List not found'})
                    }
                if row[0] != gallery_code or row[1] != int(client_id):
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Access denied'})
                    }
                note = body.get('note')
                if note is None:
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.favorite_lists
                        SET name = %s, updated_at = NOW() WHERE id = %s
                    ''', (name, int(list_id)))
                else:
                    note_val = (note or '').strip() or None
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.favorite_lists
                        SET name = %s, note = %s, updated_at = NOW() WHERE id = %s
                    ''', (name, note_val, int(list_id)))
                conn.commit()
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'ok': True})
                }

            else:
                return {
                    'statusCode': 400,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'error': f'Unknown action: {action}'})
                }
        
        elif method == 'GET':
            params = event.get('queryStringParameters') or {}
            action = params.get('action')

            if action == 'client_lists':
                gallery_code = params.get('gallery_code')
                client_id = params.get('client_id')
                if not gallery_code or not client_id:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'gallery_code and client_id required'})
                    }
                cur.execute('''
                    SELECT fl.id, fl.name, fl.note, fl.created_at,
                           (SELECT COUNT(*) FROM t_p28211681_photo_secure_web.favorite_list_photos flp WHERE flp.list_id = fl.id) AS photo_count
                    FROM t_p28211681_photo_secure_web.favorite_lists fl
                    WHERE fl.gallery_code = %s AND fl.client_id = %s
                    ORDER BY fl.created_at DESC
                ''', (gallery_code, int(client_id)))
                lists_out = []
                for r in cur.fetchall():
                    lists_out.append({
                        'id': r[0],
                        'name': r[1],
                        'note': r[2],
                        'created_at': r[3].isoformat() if r[3] else None,
                        'photo_count': r[4]
                    })
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'lists': lists_out})
                }

            if action == 'list_photos':
                list_id = params.get('list_id')
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                cur.execute('''
                    SELECT photo_id FROM t_p28211681_photo_secure_web.favorite_list_photos
                    WHERE list_id = %s ORDER BY added_at ASC
                ''', (int(list_id),))
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'photo_ids': [r[0] for r in cur.fetchall()]})
                }

            if action == 'photographer_list_photos':
                user_id = event.get('headers', {}).get('x-user-id') or event.get('headers', {}).get('X-User-Id')
                list_id = params.get('list_id')
                if not user_id:
                    return {
                        'statusCode': 401,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Unauthorized'})
                    }
                if not list_id:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'list_id required'})
                    }
                cur.execute('''
                    SELECT fl.parent_folder_id
                    FROM t_p28211681_photo_secure_web.favorite_lists fl
                    WHERE fl.id = %s
                ''', (int(list_id),))
                row = cur.fetchone()
                if not row:
                    return {
                        'statusCode': 404,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'List not found'})
                    }
                parent_folder_id = row[0]
                cur.execute('''
                    SELECT id FROM t_p28211681_photo_secure_web.photo_folders
                    WHERE id = %s AND user_id = %s
                ''', (int(parent_folder_id), int(user_id)))
                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Access denied'})
                    }
                cur.execute('''
                    SELECT pb.id, pb.file_name, pb.s3_url, pb.thumbnail_s3_url,
                           pb.width, pb.height, pb.file_size, pb.s3_key
                    FROM t_p28211681_photo_secure_web.favorite_list_photos flp
                    JOIN t_p28211681_photo_secure_web.photo_bank pb ON pb.id = flp.photo_id
                    WHERE flp.list_id = %s AND pb.is_trashed = FALSE
                    ORDER BY flp.added_at ASC
                ''', (int(list_id),))
                photos_out = []
                for r in cur.fetchall():
                    s3_url = r[2] or ''
                    thumbnail_s3_url = r[3] or ''
                    if not thumbnail_s3_url or thumbnail_s3_url.endswith('.CR2'):
                        thumbnail_s3_url = s3_url
                    photo_url = generate_presigned_url(s3_url) if s3_url else ''
                    thumbnail_url = generate_presigned_url(thumbnail_s3_url) if thumbnail_s3_url else photo_url
                    photos_out.append({
                        'id': r[0],
                        'file_name': r[1],
                        'photo_url': photo_url,
                        'thumbnail_url': thumbnail_url,
                        'width': r[4],
                        'height': r[5],
                        'file_size': r[6],
                        's3_key': r[7]
                    })
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'photos': photos_out})
                }

            if action == 'photographer_lists':
                user_id = event.get('headers', {}).get('x-user-id') or event.get('headers', {}).get('X-User-Id')
                parent_folder_id = params.get('parent_folder_id')
                if not user_id:
                    return {
                        'statusCode': 401,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Unauthorized'})
                    }
                if not parent_folder_id:
                    return {
                        'statusCode': 400,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'parent_folder_id required'})
                    }
                cur.execute('''
                    SELECT id FROM t_p28211681_photo_secure_web.photo_folders
                    WHERE id = %s AND user_id = %s
                ''', (int(parent_folder_id), int(user_id)))
                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {**cors_headers, 'Content-Type': 'application/json'},
                        'body': json.dumps({'error': 'Access denied'})
                    }
                cur.execute('''
                    SELECT fl.id, fl.name, fl.note, fl.created_at, fl.client_id,
                           fc.full_name, fc.phone,
                           (SELECT COUNT(*) FROM t_p28211681_photo_secure_web.favorite_list_photos flp WHERE flp.list_id = fl.id) AS photo_count
                    FROM t_p28211681_photo_secure_web.favorite_lists fl
                    LEFT JOIN t_p28211681_photo_secure_web.favorite_clients fc ON fc.id = fl.client_id
                    WHERE fl.parent_folder_id = %s
                    ORDER BY fl.created_at DESC
                ''', (int(parent_folder_id),))
                lists_out = []
                for r in cur.fetchall():
                    lists_out.append({
                        'id': r[0],
                        'name': r[1],
                        'note': r[2],
                        'created_at': r[3].isoformat() if r[3] else None,
                        'client_id': r[4],
                        'client_name': r[5],
                        'client_phone': r[6],
                        'photo_count': r[7]
                    })
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'lists': lists_out})
                }

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
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'photos': photos})
                }
            
            elif gallery_code:
                # JOIN с photo_bank, чтобы у каждого избранного фото были полные URL.
                # Тогда фотограф видит избранное клиентов с ЛЮБОГО уровня вложенности
                # папок, а не только из текущей открытой папки.
                cur.execute('''
                    SELECT 
                        fc.id as client_id,
                        fc.full_name,
                        fc.phone,
                        fc.email,
                        fp.photo_id,
                        fp.added_at,
                        pb.file_name, pb.s3_key, pb.s3_url,
                        pb.thumbnail_s3_key, pb.thumbnail_s3_url,
                        pb.grid_thumbnail_s3_key, pb.grid_thumbnail_s3_url,
                        COALESCE(pb.is_raw, FALSE),
                        pb.width, pb.height, pb.file_size
                    FROM t_p28211681_photo_secure_web.favorite_clients fc
                    LEFT JOIN t_p28211681_photo_secure_web.favorite_photos fp ON fc.id = fp.client_id
                    LEFT JOIN t_p28211681_photo_secure_web.photo_bank pb
                        ON pb.id = fp.photo_id AND pb.is_trashed = FALSE
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
                        photo_url, thumbnail_url = build_photo_urls(
                            s3_key=row[7], s3_url=row[8] or '',
                            thumbnail_s3_key=row[9], thumbnail_s3_url=row[10] or '',
                            grid_thumbnail_s3_key=row[11], grid_thumbnail_s3_url=row[12] or '',
                            is_raw=row[13]
                        )

                        clients[client_id_row]['photos'].append({
                            'photo_id': row[4],
                            'added_at': row[5].isoformat() if row[5] else None,
                            'file_name': row[6],
                            'photo_url': photo_url,
                            'thumbnail_url': thumbnail_url,
                            'width': row[14],
                            'height': row[15],
                            'file_size': row[16],
                            's3_key': row[7]
                        })
                
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'clients': list(clients.values())})
                }
            
            elif client_id:
                # Возвращаем избранное вместе с полными данными фото (JOIN с photo_bank),
                # чтобы клиент видел избранное с любого уровня вложенности папок,
                # даже если фото нет в текущей сетке галереи.
                cur.execute('''
                    SELECT fp.photo_id, fp.added_at,
                           pb.file_name, pb.s3_key, pb.s3_url,
                           pb.thumbnail_s3_key, pb.thumbnail_s3_url,
                           pb.grid_thumbnail_s3_key, pb.grid_thumbnail_s3_url,
                           COALESCE(pb.is_raw, FALSE),
                           pb.width, pb.height, pb.file_size
                    FROM t_p28211681_photo_secure_web.favorite_photos fp
                    LEFT JOIN t_p28211681_photo_secure_web.photo_bank pb
                        ON pb.id = fp.photo_id AND pb.is_trashed = FALSE
                    WHERE fp.client_id = %s
                    ORDER BY fp.added_at DESC
                ''', (client_id,))
                
                photos = []
                for row in cur.fetchall():
                    photo_url, thumbnail_url = build_photo_urls(
                        s3_key=row[3], s3_url=row[4] or '',
                        thumbnail_s3_key=row[5], thumbnail_s3_url=row[6] or '',
                        grid_thumbnail_s3_key=row[7], grid_thumbnail_s3_url=row[8] or '',
                        is_raw=row[9]
                    )

                    photos.append({
                        'photo_id': row[0],
                        'added_at': row[1].isoformat() if row[1] else None,
                        'file_name': row[2],
                        'photo_url': photo_url,
                        'thumbnail_url': thumbnail_url,
                        'width': row[10],
                        'height': row[11],
                        'file_size': row[12],
                        's3_key': row[3]
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'photos': photos})
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
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
                    'headers': {**cors_headers, 'Content-Type': 'application/json'},
                    'body': json.dumps({'error': 'client_id and photo_id required'})
                }
            
            cur.execute('''
                DELETE FROM t_p28211681_photo_secure_web.favorite_photos
                WHERE client_id = %s AND photo_id = %s
            ''', (client_id, photo_id))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {**cors_headers, 'Content-Type': 'application/json'},
                'body': json.dumps({'success': True})
            }
        
        print(f'[FAVORITES] Unhandled method: {method}')
        return {
            'statusCode': 405,
            'headers': {**cors_headers, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': f'Method {method} not allowed'})
        }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {**cors_headers, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cur.close()
        conn.close()