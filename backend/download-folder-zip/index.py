import json
import os
from typing import Dict, Any, Optional
from urllib.parse import quote
import psycopg2
import boto3
from botocore.client import Config


def make_presigned_url(s3_key: str) -> Optional[str]:
    '''
    Генерирует presigned URL для прямого скачивания фото с S3.
    Сначала пробует Yandex Cloud (foto-mix), затем проектный bucket (files).
    Прямая ссылка на S3 не имеет лимита размера ответа функции и
    поддерживает CORS, поэтому подходит для сборки архива на клиенте.
    '''
    # Yandex Cloud
    try:
        yc = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            region_name='ru-central1',
            aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
            aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
            config=Config(signature_version='s3v4')
        )
        yc.head_object(Bucket='foto-mix', Key=s3_key)
        return yc.generate_presigned_url(
            'get_object',
            Params={'Bucket': 'foto-mix', 'Key': s3_key},
            ExpiresIn=3600
        )
    except Exception:
        pass

    # Проектный bucket
    try:
        proj = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
        )
        proj.head_object(Bucket='files', Key=s3_key)
        return proj.generate_presigned_url(
            'get_object',
            Params={'Bucket': 'files', 'Key': s3_key},
            ExpiresIn=3600
        )
    except Exception as e:
        print(f'[PRESIGN_ERROR] {s3_key}: {e}')
        return None

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
    share_code: str = query_params.get('code', '')
    
    if not share_code and (not folder_id_str or not user_id_str):
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Either code or (folderId and userId) are required'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(dsn)
    
    try:
        cur = conn.cursor()
        
        if share_code:
            # Публичный доступ через короткую ссылку
            cur.execute(
                """
                SELECT fsl.folder_id, pf.folder_name, fsl.download_disabled
                FROM t_p28211681_photo_secure_web.folder_short_links fsl
                JOIN t_p28211681_photo_secure_web.photo_folders pf ON pf.id = fsl.folder_id
                WHERE fsl.short_code = %s
                """,
                (share_code,)
            )
            folder_result = cur.fetchone()
            
            if not folder_result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Gallery not found'}),
                    'isBase64Encoded': False
                }
            
            folder_id, folder_name, download_disabled = folder_result
            
            # Проверяем, разрешено ли скачивание
            if download_disabled:
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Download disabled for this gallery'}),
                    'isBase64Encoded': False
                }
        else:
            # Приватный доступ (авторизованный пользователь)
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
        
        cur.execute(
            """
            SELECT s3_key, file_name, s3_url FROM (
                SELECT DISTINCT ON (s3_key) s3_key, file_name, s3_url
                FROM t_p28211681_photo_secure_web.photo_bank 
                WHERE folder_id = %s AND s3_key IS NOT NULL AND is_trashed = false
                ORDER BY s3_key, id
            ) sub
            ORDER BY CAST(NULLIF(regexp_replace(file_name, '[^0-9]', '', 'g'), '') AS bigint) ASC NULLS LAST, file_name ASC
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
        
        # Инкрементируем счётчик скачиваний архива для папки
        if share_code:  # Только для публичных скачиваний (клиенты)
            cur.execute(
                """
                UPDATE t_p28211681_photo_secure_web.photo_folders 
                SET archive_download_count = COALESCE(archive_download_count, 0) + 1 
                WHERE id = %s
                """,
                (folder_id,)
            )
            
            # Логируем скачивание архива
            client_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
            user_agent = event.get('headers', {}).get('user-agent', 'unknown')
            
            cur.execute(
                "SELECT user_id FROM t_p28211681_photo_secure_web.photo_folders WHERE id = %s",
                (folder_id,)
            )
            owner_result = cur.fetchone()
            owner_user_id = owner_result[0] if owner_result else None
            
            if owner_user_id:
                # Сохраняем только IP (до 45 символов), без геолокации
                cur.execute(
                    """
                    INSERT INTO t_p28211681_photo_secure_web.download_logs
                    (user_id, folder_id, download_type, client_ip, user_agent)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (owner_user_id, folder_id, 'archive', client_ip[:45], user_agent)
                )
            
            conn.commit()
    finally:
        conn.close()
    
    # Генерируем прокси-URLs через gallery-photo-download endpoint (обход CORS)
    proxy_endpoint = 'https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215'
    
    file_urls = []
    for s3_key, file_name, s3_url in photos:
        # Прямая presigned-ссылка на S3: без лимита размера ответа функции,
        # с корректным CORS — фото любого размера попадают в архив.
        direct_url = make_presigned_url(s3_key)
        if direct_url:
            file_urls.append({
                'filename': file_name,
                'url': direct_url
            })
        else:
            # Фолбэк на прокси, если presigned сгенерировать не удалось
            file_urls.append({
                'filename': file_name,
                'url': f"{proxy_endpoint}?s3_key={quote(s3_key)}"
            })
    
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