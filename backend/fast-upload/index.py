'''
Быстрая потоковая загрузка файлов напрямую в S3 через прокси
Убирает лишний запрос на получение presigned URL
'''

import json
import os
import base64
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config
from io import BytesIO

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
        config=Config(signature_version='s3v4')
    )

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Быстрая загрузка файлов напрямую в S3
    POST /fast-upload - прямая загрузка base64 файла в S3 одним запросом
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
        filename = body.get('filename')
        file_data = body.get('data')  # base64 string
        content_type = body.get('content_type', 'image/jpeg')
        folder_id = body.get('folder_id')
        
        if not filename or not file_data:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'filename and data required'}),
                'isBase64Encoded': False
            }
        
        # Декодируем base64
        file_bytes = base64.b64decode(file_data)
        file_size = len(file_bytes)
        
        # Генерируем S3 ключ
        import time
        import random
        ext = filename.split('.')[-1] if '.' in filename else 'jpg'
        timestamp = int(time.time() * 1000)
        random_str = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=8))
        s3_key = f'uploads/{user_id}/{timestamp}_{random_str}.{ext}'
        
        # Загружаем в S3 напрямую
        s3_client = get_s3_client()
        s3_client.put_object(
            Bucket=S3_BUCKET,
            Key=s3_key,
            Body=file_bytes,
            ContentType=content_type,
            Metadata={'user-id': str(user_id), 'original-name': filename}
        )
        
        s3_url = f'{S3_ENDPOINT}/{S3_BUCKET}/{s3_key}'
        
        # Сохраняем в БД
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'''
                    INSERT INTO {DB_SCHEMA}.uploads 
                    (user_id, s3_key, orig_filename, size_bytes, content_type, status)
                    VALUES (%s, %s, %s, %s, %s, 'uploaded')
                    RETURNING id
                ''', (user_id, s3_key, filename, file_size, content_type))
                
                upload_id = cur.fetchone()['id']
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'upload_id': upload_id,
                        's3_key': s3_key,
                        's3_url': s3_url,
                        'size': file_size
                    }),
                    'isBase64Encoded': False
                }
        finally:
            conn.close()
            
    except Exception as e:
        print(f'[FAST_UPLOAD] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
