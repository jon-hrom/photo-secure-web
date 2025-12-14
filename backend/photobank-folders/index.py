'''
Business: Управление папками фотобанка с хранением в Yandex Cloud S3
Args: event with httpMethod, body, queryStringParameters, headers (X-User-Id)
Returns: HTTP response with folders data and S3 upload URLs
'''

import json
import os
import uuid
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config
from PIL import Image
import io

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, Accept, Authorization',
                'Access-Control-Max-Age': '86400',
                'Access-Control-Allow-Credentials': 'false'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'User not authenticated'}),
            'isBase64Encoded': False
        }
    
    db_url = os.environ.get('DATABASE_URL')
    s3_key_id = os.environ.get('AWS_ACCESS_KEY_ID')
    s3_secret = os.environ.get('AWS_SECRET_ACCESS_KEY')
    bucket = 'files'
    
    s3_client = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=s3_key_id,
        aws_secret_access_key=s3_secret,
        config=Config(signature_version='s3v4')
    )
    
    try:
        conn = psycopg2.connect(db_url)
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Database connection failed: {str(e)}'}),
            'isBase64Encoded': False
        }
    
    try:
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'list')
            
            if action == 'list':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT 
                            id, 
                            folder_name, 
                            s3_prefix,
                            created_at, 
                            updated_at,
                            (SELECT COUNT(*) FROM photo_bank 
                             WHERE folder_id = photo_folders.id AND is_trashed = FALSE) as photo_count
                        FROM photo_folders
                        WHERE user_id = %s AND is_trashed = FALSE
                        ORDER BY created_at DESC
                    ''', (user_id,))
                    folders = cur.fetchall()
                    
                    for folder in folders:
                        if folder['created_at']:
                            folder['created_at'] = folder['created_at'].isoformat()
                        if folder['updated_at']:
                            folder['updated_at'] = folder['updated_at'].isoformat()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'folders': folders}),
                    'isBase64Encoded': False
                }
            
            elif action == 'get_upload_url':
                folder_id = event.get('queryStringParameters', {}).get('folder_id')
                file_name = event.get('queryStringParameters', {}).get('file_name', 'image.jpg')
                
                if not folder_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT s3_prefix 
                        FROM photo_folders 
                        WHERE id = %s AND user_id = %s AND is_trashed = FALSE
                    ''', (folder_id, user_id))
                    folder = cur.fetchone()
                    
                    if not folder:
                        return {
                            'statusCode': 404,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Folder not found'}),
                            'isBase64Encoded': False
                        }
                
                file_ext = file_name.split('.')[-1] if '.' in file_name else 'jpg'
                s3_key = f'{folder["s3_prefix"]}{uuid.uuid4()}.{file_ext}'
                
                presigned_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': bucket,
                        'Key': s3_key,
                        'ContentType': 'image/jpeg',
                        'Metadata': {
                            'user-id': str(user_id),
                            'folder-id': str(folder_id)
                        }
                    },
                    ExpiresIn=900
                )
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'url': presigned_url,
                        'key': s3_key,
                        'expiresIn': 900
                    }),
                    'isBase64Encoded': False
                }
            
            elif action == 'list_photos':
                folder_id = event.get('queryStringParameters', {}).get('folder_id')
                if not folder_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT 
                            pb.id, 
                            pb.file_name, 
                            pb.s3_key,
                            pb.file_size, 
                            pb.width, 
                            pb.height, 
                            pb.created_at
                        FROM photo_bank pb
                        JOIN photo_folders pf ON pb.folder_id = pf.id
                        WHERE pb.folder_id = %s 
                          AND pb.user_id = %s 
                          AND pb.is_trashed = FALSE
                        ORDER BY pb.created_at DESC
                    ''', (folder_id, user_id))
                    photos = cur.fetchall()
                    
                    result_photos = []
                    for photo in photos:
                        if photo['created_at']:
                            photo['created_at'] = photo['created_at'].isoformat()
                        
                        if photo['s3_key']:
                            try:
                                # Пытаемся сгенерировать URL для нового bucket 'files'
                                download_url = s3_client.generate_presigned_url(
                                    'get_object',
                                    Params={'Bucket': bucket, 'Key': photo['s3_key']},
                                    ExpiresIn=600
                                )
                                photo['s3_url'] = download_url
                            except Exception as e:
                                print(f'[FALLBACK] Trying old bucket for {photo["s3_key"]}')
                                # Fallback: пытаемся старый bucket 'foto-mix' на Yandex Cloud
                                try:
                                    old_s3_client = boto3.client(
                                        's3',
                                        endpoint_url='https://storage.yandexcloud.net',
                                        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
                                        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
                                        region_name='ru-central1',
                                        config=Config(signature_version='s3v4')
                                    )
                                    download_url = old_s3_client.generate_presigned_url(
                                        'get_object',
                                        Params={'Bucket': 'foto-mix', 'Key': photo['s3_key']},
                                        ExpiresIn=600
                                    )
                                    photo['s3_url'] = download_url
                                    print(f'[FALLBACK] Success with old bucket')
                                except Exception as e2:
                                    print(f'[FALLBACK] Failed for {photo["s3_key"]}: {e2}')
                                    photo['s3_url'] = None
                        
                        result_photos.append(photo)
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'photos': result_photos}),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'create':
                folder_name = body_data.get('folder_name')
                if not folder_name:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_name required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('SELECT id FROM users WHERE id = %s', (user_id,))
                    user_exists = cur.fetchone()
                    if not user_exists:
                        return {
                            'statusCode': 403,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'User not found'}),
                            'isBase64Encoded': False
                        }
                    
                    cur.execute('''
                        INSERT INTO photo_folders (user_id, folder_name, s3_prefix)
                        VALUES (%s, %s, NULL)
                        RETURNING id, folder_name, created_at
                    ''', (user_id, folder_name))
                    conn.commit()
                    folder = cur.fetchone()
                    
                    folder_id = folder['id']
                    s3_prefix = f'photobank/{user_id}/{folder_id}/'
                    
                    cur.execute('''
                        UPDATE photo_folders 
                        SET s3_prefix = %s 
                        WHERE id = %s
                    ''', (s3_prefix, folder_id))
                    conn.commit()
                    
                    folder['s3_prefix'] = s3_prefix
                    
                    if folder['created_at']:
                        folder['created_at'] = folder['created_at'].isoformat()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'folder': folder}),
                    'isBase64Encoded': False
                }
            
            elif action == 'upload_direct':
                folder_id = body_data.get('folder_id')
                file_name = body_data.get('file_name')
                file_data = body_data.get('file_data')
                width = body_data.get('width')
                height = body_data.get('height')
                
                print(f'[UPLOAD_DIRECT] folder_id={folder_id}, file_name={file_name}, width={width}, height={height}')
                
                if not all([folder_id, file_name, file_data]):
                    print('[UPLOAD_DIRECT] Missing required fields')
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id, file_name, and file_data required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT s3_prefix 
                        FROM photo_folders 
                        WHERE id = %s AND user_id = %s AND is_trashed = FALSE
                    ''', (folder_id, user_id))
                    folder = cur.fetchone()
                    
                    if not folder:
                        print(f'[UPLOAD_DIRECT] Folder not found: {folder_id}')
                        return {
                            'statusCode': 404,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Folder not found'}),
                            'isBase64Encoded': False
                        }
                
                import base64
                # Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
                if file_data.startswith('data:'):
                    file_data = file_data.split(',', 1)[1]
                
                file_bytes = base64.b64decode(file_data)
                file_size = len(file_bytes)
                print(f'[UPLOAD_DIRECT] File size after decode: {file_size} bytes ({file_size / 1024 / 1024:.2f} MB)')
                
                file_ext = file_name.split('.')[-1] if '.' in file_name else 'jpg'
                s3_key = f'{folder["s3_prefix"]}{uuid.uuid4()}.{file_ext}'
                
                print(f'[UPLOAD_DIRECT] Uploading to S3: {s3_key}, size={file_size}')
                try:
                    s3_client.put_object(
                        Bucket=bucket,
                        Key=s3_key,
                        Body=file_bytes,
                        ContentType='image/jpeg',
                        Metadata={'user-id': str(user_id), 'folder-id': str(folder_id)}
                    )
                    print('[UPLOAD_DIRECT] S3 upload success')
                except Exception as e:
                    print(f'[UPLOAD_DIRECT] S3 upload failed: {str(e)}')
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': f'S3 upload failed: {str(e)}'}),
                        'isBase64Encoded': False
                    }
                
                s3_url = f'https://storage.yandexcloud.net/{bucket}/{s3_key}'
                
                print('[UPLOAD_DIRECT] Inserting to DB')
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        INSERT INTO photo_bank 
                        (user_id, folder_id, file_name, s3_key, s3_url, file_size, width, height)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, file_name, s3_key, file_size, created_at
                    ''', (user_id, folder_id, file_name, s3_key, s3_url, file_size, width, height))
                    conn.commit()
                    photo = cur.fetchone()
                    print(f'[UPLOAD_DIRECT] DB insert success, photo_id={photo["id"]}')
                    
                    if photo['created_at']:
                        photo['created_at'] = photo['created_at'].isoformat()
                
                print('[UPLOAD_DIRECT] Complete!')
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'photo': photo}),
                    'isBase64Encoded': False
                }
            
            elif action == 'confirm_upload':
                folder_id = body_data.get('folder_id')
                s3_key = body_data.get('s3_key')
                file_name = body_data.get('file_name')
                width = body_data.get('width')
                height = body_data.get('height')
                
                print(f'[CONFIRM_UPLOAD] Received: folder_id={folder_id}, s3_key={s3_key}, file_name={file_name}, user_id={user_id}')
                
                if not all([folder_id, s3_key, file_name]):
                    print(f'[CONFIRM_UPLOAD] Missing fields!')
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id, s3_key, and file_name required'}),
                        'isBase64Encoded': False
                    }
                
                print(f'[CONFIRM_UPLOAD] Checking S3 object: {s3_key}')
                try:
                    head_response = s3_client.head_object(Bucket=bucket, Key=s3_key)
                    file_size = head_response['ContentLength']
                    print(f'[CONFIRM_UPLOAD] S3 object found, size={file_size}')
                except Exception as e:
                    print(f'[CONFIRM_UPLOAD] S3 object not found: {str(e)}')
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': f'File not found in S3: {str(e)}'}),
                        'isBase64Encoded': False
                    }
                
                if not width or not height:
                    print(f'[CONFIRM_UPLOAD] Getting dimensions from S3 image')
                    try:
                        image_response = s3_client.get_object(Bucket=bucket, Key=s3_key)
                        image_data = image_response['Body'].read()
                        image = Image.open(io.BytesIO(image_data))
                        width = image.width
                        height = image.height
                        print(f'[CONFIRM_UPLOAD] Extracted dimensions: {width}x{height}')
                    except Exception as e:
                        print(f'[CONFIRM_UPLOAD] Failed to get dimensions: {str(e)}')
                        width = None
                        height = None
                
                s3_url = f'https://storage.yandexcloud.net/{bucket}/{s3_key}'
                
                print(f'[CONFIRM_UPLOAD] Inserting to DB...')
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        INSERT INTO photo_bank 
                        (user_id, folder_id, file_name, s3_key, s3_url, file_size, width, height)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, file_name, s3_key, file_size, created_at
                    ''', (user_id, folder_id, file_name, s3_key, s3_url, file_size, width, height))
                    conn.commit()
                    photo = cur.fetchone()
                    print(f'[CONFIRM_UPLOAD] Inserted photo id={photo["id"]}')
                    
                    if photo['created_at']:
                        photo['created_at'] = photo['created_at'].isoformat()
                
                print(f'[CONFIRM_UPLOAD] Success!')
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'photo': photo}),
                    'isBase64Encoded': False
                }
        
        elif method == 'DELETE':
            folder_id = event.get('queryStringParameters', {}).get('folder_id')
            
            if not folder_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'folder_id required'}),
                    'isBase64Encoded': False
                }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT s3_prefix 
                    FROM photo_folders 
                    WHERE id = %s AND user_id = %s
                ''', (folder_id, user_id))
                folder = cur.fetchone()
                
                if not folder:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Folder not found'}),
                        'isBase64Encoded': False
                    }
                
                cur.execute('''
                    UPDATE photo_folders
                    SET is_trashed = TRUE, trashed_at = NOW()
                    WHERE id = %s
                ''', (folder_id,))
                
                cur.execute('''
                    UPDATE photo_bank
                    SET is_trashed = TRUE, trashed_at = NOW()
                    WHERE folder_id = %s
                ''', (folder_id,))
                
                conn.commit()
            
            prefix = folder['s3_prefix']
            paginator = s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
            
            moved_count = 0
            for page in pages:
                for obj in page.get('Contents', []):
                    src_key = obj['Key']
                    dst_key = f'trash/{src_key}'
                    
                    try:
                        s3_client.copy_object(
                            Bucket=bucket,
                            CopySource={'Bucket': bucket, 'Key': src_key},
                            Key=dst_key
                        )
                        s3_client.delete_object(Bucket=bucket, Key=src_key)
                        moved_count += 1
                    except Exception as e:
                        print(f'Failed to move {src_key} to trash: {e}')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'ok': True,
                    'moved_files': moved_count
                }),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'[ERROR] {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        if conn:
            conn.close()