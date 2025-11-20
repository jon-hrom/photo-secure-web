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

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
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
    s3_key_id = os.environ.get('YC_S3_KEY_ID')
    s3_secret = os.environ.get('YC_S3_SECRET')
    bucket = 'foto-mix'
    
    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_key_id,
        aws_secret_access_key=s3_secret,
        region_name='ru-central1',
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
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT email_verified_at FROM users WHERE id = %s', (user_id,))
            user_check = cur.fetchone()
            if not user_check or not user_check['email_verified_at']:
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Email not verified', 'requireEmailVerification': True}),
                    'isBase64Encoded': False
                }
        
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
                                download_url = s3_client.generate_presigned_url(
                                    'get_object',
                                    Params={'Bucket': bucket, 'Key': photo['s3_key']},
                                    ExpiresIn=600
                                )
                                photo['s3_url'] = download_url
                            except Exception as e:
                                print(f'Failed to generate presigned URL for {photo["s3_key"]}: {e}')
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
            
            elif action == 'upload_url':
                folder_id = body_data.get('folder_id')
                file_name = body_data.get('file_name')
                content_type = body_data.get('content_type', 'image/jpeg')
                
                if not all([folder_id, file_name]):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id and file_name required'}),
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
                
                upload_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': bucket,
                        'Key': s3_key,
                        'ContentType': content_type,
                        'Metadata': {'user-id': str(user_id), 'folder-id': str(folder_id)}
                    },
                    ExpiresIn=900
                )
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'upload_url': upload_url,
                        's3_key': s3_key,
                        'folder_id': folder_id
                    }),
                    'isBase64Encoded': False
                }
            
            elif action == 'confirm_upload':
                folder_id = body_data.get('folder_id')
                s3_key = body_data.get('s3_key')
                file_name = body_data.get('file_name')
                width = body_data.get('width')
                height = body_data.get('height')
                
                if not all([folder_id, s3_key, file_name]):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id, s3_key, and file_name required'}),
                        'isBase64Encoded': False
                    }
                
                try:
                    head_response = s3_client.head_object(Bucket=bucket, Key=s3_key)
                    file_size = head_response['ContentLength']
                except Exception as e:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': f'File not found in S3: {str(e)}'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        INSERT INTO photo_bank 
                        (user_id, folder_id, file_name, s3_key, file_size, width, height)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, file_name, s3_key, file_size, created_at
                    ''', (user_id, folder_id, file_name, s3_key, file_size, width, height))
                    conn.commit()
                    photo = cur.fetchone()
                    
                    if photo['created_at']:
                        photo['created_at'] = photo['created_at'].isoformat()
                
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
