import json
import os
import base64
from typing import Dict, Any, Optional
import boto3
from botocore.client import Config
import psycopg2

def get_user_id_from_folder(folder_id: Optional[int]) -> Optional[int]:
    '''
    Получает user_id по folder_id
    '''
    if not folder_id:
        return None
    
    try:
        dsn = os.environ.get('DATABASE_URL')
        if not dsn:
            return None
        
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        cur.execute(
            "SELECT user_id FROM t_p28211681_photo_secure_web.photo_folders WHERE id = %s",
            (folder_id,)
        )
        
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        return result[0] if result else None
    except:
        return None

def log_download(photo_id: Optional[int], folder_id: Optional[int], client_ip: str, user_agent: str) -> None:
    '''
    Логирует скачивание фото в базу данных
    '''
    print(f'[LOG_DOWNLOAD] Called with photo_id={photo_id}, folder_id={folder_id}, ip={client_ip}')
    try:
        user_id = get_user_id_from_folder(folder_id)
        print(f'[LOG_DOWNLOAD] Resolved user_id={user_id}')
        if not user_id:
            print(f'[LOG_DOWNLOAD] No user_id found, skipping')
            return
        
        dsn = os.environ.get('DATABASE_URL')
        if not dsn:
            return
        
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        cur.execute(
            "INSERT INTO t_p28211681_photo_secure_web.download_logs (user_id, folder_id, photo_id, download_type, client_ip, user_agent) VALUES (%s, %s, %s, %s, %s, %s)",
            (user_id, folder_id, photo_id, 'photo', client_ip, user_agent)
        )
        
        conn.commit()
        print(f'[LOG_DOWNLOAD] Successfully logged download')
        cur.close()
        conn.close()
    except Exception as e:
        print(f'[LOG_DOWNLOAD_ERROR] {str(e)}')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Прокси для скачивания фото из публичной галереи (обход CORS)
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method not in ['GET', 'HEAD']:
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    query_params = event.get('queryStringParameters') or {}
    s3_key: str = query_params.get('s3_key', '')
    use_presigned: bool = query_params.get('presigned', 'false').lower() == 'true'
    photo_id_str = query_params.get('photo_id')
    folder_id_str = query_params.get('folder_id')
    
    # Извлекаем IP и User-Agent для статистики
    request_context = event.get('requestContext', {})
    identity = request_context.get('identity', {})
    client_ip = identity.get('sourceIp', 'unknown')
    headers = event.get('headers', {})
    user_agent = headers.get('user-agent', 'unknown')
    
    # Конвертируем ID в int если возможно
    photo_id = int(photo_id_str) if photo_id_str and photo_id_str.isdigit() else None
    folder_id = int(folder_id_str) if folder_id_str and folder_id_str.isdigit() else None
    
    print(f'[HANDLER] photo_id={photo_id}, folder_id={folder_id}, presigned={use_presigned}, ip={client_ip}')
    
    if not s3_key:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 's3_key parameter is required'}),
            'isBase64Encoded': False
        }
    
    try:
        # Извлекаем имя файла из s3_key
        filename = s3_key.split('/')[-1] if '/' in s3_key else s3_key
        
        # Пробуем сначала из Yandex Cloud (foto-mix)
        s3_client = None
        bucket = None
        yc_error = None
        
        try:
            s3_client = boto3.client(
                's3',
                endpoint_url='https://storage.yandexcloud.net',
                region_name='ru-central1',
                aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
                aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
                config=Config(signature_version='s3v4')
            )
            bucket = 'foto-mix'
            # Проверяем существование файла
            s3_client.head_object(Bucket=bucket, Key=s3_key)
        except Exception as e:
            yc_error = str(e)
            # Если не нашли в Yandex Cloud, пробуем проектный bucket
            s3_client = boto3.client(
                's3',
                endpoint_url='https://bucket.poehali.dev',
                aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
            )
            bucket = 'files'
            # Проверяем существование файла
            s3_client.head_object(Bucket=bucket, Key=s3_key)
        
        # Если запрашивается presigned URL (для больших файлов)
        if use_presigned:
            # Логируем скачивание ДО генерации presigned URL
            log_download(photo_id, folder_id, client_ip, user_agent)
            
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': s3_key},
                ExpiresIn=3600
            )
            
            # Возвращаем JSON с presigned URL (не редирект - из-за CORS)
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'download_url': presigned_url,
                    'filename': filename
                }),
                'isBase64Encoded': False
            }
        
        # Для HEAD запроса возвращаем метаданные
        if method == 'HEAD':
            metadata = s3_client.head_object(Bucket=bucket, Key=s3_key)
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': metadata.get('ContentType', 'application/octet-stream'),
                    'Content-Length': str(metadata.get('ContentLength', 0))
                },
                'body': '',
                'isBase64Encoded': False
            }
        
        # Для обычного GET возвращаем файл (только для небольших файлов)
        response = s3_client.get_object(Bucket=bucket, Key=s3_key)
        file_content = response['Body'].read()
        content_type = response.get('ContentType', 'application/octet-stream')
        
        # Логируем скачивание
        log_download(photo_id, folder_id, client_ip, user_agent)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': content_type,
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': f'attachment; filename="{filename}"'
            },
            'body': base64.b64encode(file_content).decode('utf-8'),
            'isBase64Encoded': True
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }