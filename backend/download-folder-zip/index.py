import json
import os
import io
import zipfile
from typing import Dict, Any
import psycopg2
import boto3
from botocore.client import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Создает ZIP архив всех фотографий из папки и возвращает подписанную ссылку для скачивания
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    query_params = event.get('queryStringParameters') or {}
    folder_id_str: str = query_params.get('folderId', '')
    user_id_str: str = query_params.get('userId', '')
    
    if not folder_id_str or not user_id_str:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'folderId and userId are required'})
        }
    
    try:
        folder_id = int(folder_id_str)
        user_id = int(user_id_str)
    except ValueError:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'folderId and userId must be numbers'})
        }
    
    dsn = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(dsn)
    
    try:
        cur = conn.cursor()
        
        # Проверяем владельца папки
        cur.execute(
            "SELECT folder_name, user_id FROM t_p28211681_photo_secure_web.photo_folders WHERE id = %s",
            (folder_id,)
        )
        folder_result = cur.fetchone()
        
        if not folder_result:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Folder not found'})
            }
        
        folder_name, owner_id = folder_result
        
        if owner_id != user_id:
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Access denied'})
            }
        
        # Получаем все фотографии из папки
        cur.execute(
            """
            SELECT s3_key, file_name 
            FROM t_p28211681_photo_secure_web.photo_bank 
            WHERE folder_id = %s AND s3_key IS NOT NULL AND is_trashed = false
            ORDER BY file_name
            """,
            (folder_id,)
        )
        photos = cur.fetchall()
        
        if not photos:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'No photos in folder'})
            }
    finally:
        conn.close()
    
    # Создаем S3 клиент
    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )
    
    # Создаем ZIP архив в памяти
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for s3_key, file_name in photos:
            try:
                # Скачиваем файл из S3
                response = s3_client.get_object(Bucket='foto-mix', Key=s3_key)
                file_content = response['Body'].read()
                
                # Добавляем файл в архив
                zip_file.writestr(file_name, file_content)
            except Exception as e:
                print(f"Failed to add {file_name} to zip: {e}")
                continue
    
    # Загружаем ZIP архив в S3
    zip_buffer.seek(0)
    zip_filename = f"archives/{user_id}/{folder_name}.zip"
    
    s3_client.put_object(
        Bucket='foto-mix',
        Key=zip_filename,
        Body=zip_buffer.getvalue(),
        ContentType='application/zip'
    )
    
    # Генерируем подписанную ссылку на скачивание
    presigned_url = s3_client.generate_presigned_url(
        'get_object',
        Params={
            'Bucket': 'foto-mix',
            'Key': zip_filename
        },
        ExpiresIn=3600
    )
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'isBase64Encoded': False,
        'body': json.dumps({
            'url': presigned_url,
            'filename': f"{folder_name}.zip",
            'expiresIn': 3600
        })
    }