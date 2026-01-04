'''
Прямая загрузка файлов в S3 с минимальной латентностью
Использует streaming upload без буферизации в памяти
'''

import json
import os
import time
import random
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

S3_BUCKET = 'foto-mix'
S3_ENDPOINT = 'https://storage.yandexcloud.net'
DB_SCHEMA = 't_p28211681_photo_secure_web'

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        region_name='ru-central1',
        aws_access_key_id=os.environ['YC_S3_KEY_ID'],
        aws_secret_access_key=os.environ['YC_S3_SECRET'],
        config=Config(
            signature_version='s3v4',
            connect_timeout=5,
            read_timeout=60,
            retries={'max_attempts': 3, 'mode': 'adaptive'}
        )
    )

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Быстрая загрузка через batch presigned URLs
    POST /direct-upload?action=init - инициализация batch загрузки
    POST /direct-upload?action=batch-urls - получить URLs для множества файлов за раз
    '''
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
            'body': json.dumps({'error': 'User ID required'}),
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
        action = body.get('action', 'batch-urls')
        
        if action == 'batch-urls':
            # Генерируем presigned URLs для множества файлов за один запрос
            files = body.get('files', [])  # [{"name": "file.jpg", "type": "image/jpeg", "size": 12345}, ...]
            
            if not files or len(files) == 0:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'files array required'}),
                    'isBase64Encoded': False
                }
            
            # Ограничение - максимум 100 файлов за раз
            if len(files) > 100:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Maximum 100 files per request'}),
                    'isBase64Encoded': False
                }
            
            s3_client = get_s3_client()
            timestamp = int(time.time() * 1000)
            results = []
            
            # Генерируем URLs для всех файлов за один проход
            for file_info in files:
                filename = file_info.get('name', 'photo.jpg')
                content_type = file_info.get('type', 'image/jpeg')
                
                ext = filename.split('.')[-1] if '.' in filename else 'jpg'
                random_str = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=8))
                s3_key = f'uploads/{user_id}/{timestamp}_{random_str}.{ext}'
                timestamp += 1  # Уникальность ключа
                
                # Генерируем presigned URL
                presigned_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': S3_BUCKET,
                        'Key': s3_key,
                        'ContentType': content_type
                    },
                    ExpiresIn=1800  # 30 минут для batch загрузки
                )
                
                results.append({
                    'filename': filename,
                    'url': presigned_url,
                    'key': s3_key,
                    'content_type': content_type
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'uploads': results,
                    'expires_in': 1800
                }),
                'isBase64Encoded': False
            }
        
        elif action == 'confirm-batch':
            # Подтверждение загрузки множества файлов
            uploads = body.get('uploads', [])  # [{"key": "...", "filename": "...", "size": 123}, ...]
            
            if not uploads:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'uploads array required'}),
                    'isBase64Encoded': False
                }
            
            dsn = os.environ.get('DATABASE_URL')
            conn = psycopg2.connect(dsn)
            
            try:
                inserted_ids = []
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    for upload in uploads:
                        s3_key = upload.get('key')
                        filename = upload.get('filename')
                        size = upload.get('size', 0)
                        content_type = upload.get('content_type', 'image/jpeg')
                        
                        if not s3_key or not filename:
                            continue
                        
                        cur.execute(f'''
                            INSERT INTO {DB_SCHEMA}.uploads 
                            (user_id, s3_key, orig_filename, size_bytes, content_type, status)
                            VALUES (%s, %s, %s, %s, %s, 'uploaded')
                            RETURNING id
                        ''', (user_id, s3_key, filename, size, content_type))
                        
                        upload_id = cur.fetchone()['id']
                        inserted_ids.append(upload_id)
                    
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'uploaded_count': len(inserted_ids),
                        'upload_ids': inserted_ids
                    }),
                    'isBase64Encoded': False
                }
            finally:
                conn.close()
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Unknown action: {action}'}),
                'isBase64Encoded': False
            }
            
    except Exception as e:
        print(f'[DIRECT_UPLOAD] Error: {str(e)}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
