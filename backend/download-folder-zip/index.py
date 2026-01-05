import json
import os
from typing import Dict, Any
import psycopg2
import boto3
from botocore.client import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Возвращает список pre-signed URLs для скачивания всех фотографий из папки
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
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    query_params = event.get('queryStringParameters') or {}
    folder_id_str: str = query_params.get('folderId', '')
    user_id_str: str = query_params.get('userId', '')
    
    if not folder_id_str or not user_id_str:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'folderId and userId are required'}),
            'isBase64Encoded': False
        }
    
    try:
        folder_id = int(folder_id_str)
        user_id = int(user_id_str)
    except ValueError:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'folderId and userId must be numbers'}),
            'isBase64Encoded': False
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
                'body': json.dumps({'error': 'Folder not found'}),
                'isBase64Encoded': False
            }
        
        folder_name, owner_id = folder_result
        
        if owner_id != user_id:
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Access denied'}),
                'isBase64Encoded': False
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
                'body': json.dumps({'error': 'No photos in folder'}),
                'isBase64Encoded': False
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
    
    # Генерируем pre-signed URLs для каждого файла
    file_urls = []
    for s3_key, file_name in photos:
        try:
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': 'foto-mix',
                    'Key': s3_key,
                    'ResponseContentDisposition': f'attachment; filename="{file_name}"'
                },
                ExpiresIn=3600
            )
            file_urls.append({
                'filename': file_name,
                'url': presigned_url
            })
        except Exception as e:
            print(f"Failed to generate URL for {file_name}: {e}")
            continue
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'isBase64Encoded': False,
        'body': json.dumps({
            'folderName': folder_name,
            'files': file_urls,
            'totalFiles': len(file_urls),
            'expiresIn': 3600
        })
    }
