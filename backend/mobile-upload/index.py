import json
import os
import time
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

# S3 configuration для Yandex Cloud
S3_BUCKET = 'foto-mix'
S3_ENDPOINT = 'https://storage.yandexcloud.net'
DB_SCHEMA = 't_p28211681_photo_secure_web'

def get_s3_client():
    '''Возвращает S3 клиент для Yandex Cloud'''
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
    API для загрузки фотографий с мобильного устройства фотографа напрямую в S3
    
    GET /mobile-upload?action=get-url - получить pre-signed URL для загрузки
    POST /mobile-upload?action=confirm - подтвердить успешную загрузку файла
    GET /mobile-upload?action=list - получить список загруженных файлов
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database not configured'}),
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(dsn)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            params = event.get('queryStringParameters', {})
            action = params.get('action', 'list')
            
            if action == 'get-url':
                # Генерируем pre-signed URL для загрузки файла
                filename = params.get('filename', 'photo.jpg')
                content_type = params.get('contentType', 'image/jpeg')
                shoot_id = params.get('shoot_id')
                
                # Генерируем уникальный ключ для файла
                ext = filename.split('.')[-1] if '.' in filename else 'jpg'
                timestamp = int(time.time() * 1000)
                import random
                random_str = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=8))
                
                if shoot_id:
                    s3_key = f'shoots/{user_id}/{shoot_id}/originals/{timestamp}_{random_str}.{ext}'
                else:
                    s3_key = f'uploads/{user_id}/{timestamp}_{random_str}.{ext}'
                
                # Создаём pre-signed URL для PUT запроса
                s3_client = get_s3_client()
                presigned_url = s3_client.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': S3_BUCKET,
                        'Key': s3_key,
                        'ContentType': content_type
                    },
                    ExpiresIn=900  # 15 минут
                )
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'url': presigned_url,
                        'key': s3_key,
                        'expires_in': 900
                    }),
                    'isBase64Encoded': False
                }
            
            elif action == 'list':
                # Получаем список загруженных файлов пользователя
                shoot_id = params.get('shoot_id')
                
                if shoot_id:
                    cur.execute('''
                        SELECT id, s3_key, orig_filename, size_bytes, uploaded_at, status, content_type
                        FROM t_p28211681_photo_secure_web.uploads
                        WHERE user_id = %s AND shoot_id = %s
                        ORDER BY uploaded_at DESC
                    ''', (user_id, shoot_id))
                else:
                    cur.execute('''
                        SELECT id, s3_key, orig_filename, size_bytes, uploaded_at, status, content_type
                        FROM t_p28211681_photo_secure_web.uploads
                        WHERE user_id = %s
                        ORDER BY uploaded_at DESC
                        LIMIT 100
                    ''', (user_id,))
                
                uploads = cur.fetchall()
                
                # Генерируем pre-signed URLs для просмотра
                s3_client = get_s3_client()
                result = []
                for upload in uploads:
                    view_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': S3_BUCKET,
                            'Key': upload['s3_key']
                        },
                        ExpiresIn=3600  # 1 час
                    )
                    result.append({
                        'id': upload['id'],
                        's3_key': upload['s3_key'],
                        'filename': upload['orig_filename'],
                        'size_bytes': upload['size_bytes'],
                        'uploaded_at': str(upload['uploaded_at']),
                        'status': upload['status'],
                        'content_type': upload['content_type'],
                        'view_url': view_url
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(result),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action', 'confirm')
            
            if action == 'confirm':
                # Подтверждаем успешную загрузку файла
                s3_key = body.get('s3_key')
                orig_filename = body.get('orig_filename')
                size_bytes = body.get('size_bytes', 0)
                content_type = body.get('content_type', 'application/octet-stream')
                shoot_id = body.get('shoot_id')
                
                if not s3_key:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 's3_key required'}),
                        'isBase64Encoded': False
                    }
                
                # Сохраняем информацию о загрузке в БД
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.uploads 
                    (user_id, shoot_id, s3_key, orig_filename, size_bytes, content_type, status)
                    VALUES (%s, %s, %s, %s, %s, %s, 'uploaded')
                    ON CONFLICT (s3_key) DO UPDATE SET
                        orig_filename = EXCLUDED.orig_filename,
                        size_bytes = EXCLUDED.size_bytes,
                        content_type = EXCLUDED.content_type
                    RETURNING id, uploaded_at
                ''', (user_id, shoot_id, s3_key, orig_filename, size_bytes, content_type))
                
                result = cur.fetchone()
                conn.commit()
                
                print(f'[UPLOAD_CONFIRM] User {user_id} uploaded {orig_filename} ({size_bytes} bytes) to {s3_key}')
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': True,
                        'upload_id': result['id'],
                        'uploaded_at': str(result['uploaded_at'])
                    }),
                    'isBase64Encoded': False
                }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    finally:
        cur.close()
        conn.close()