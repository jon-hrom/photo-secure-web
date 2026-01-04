'''
Восстанавливает фото из папки tech_rejects обратно в originals
Args: event с photo_id для восстановления
Returns: Статус восстановления
'''

import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Восстанавливает фото из tech_rejects обратно в originals
    """
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
            'body': json.dumps({'error': 'User not authenticated'}),
            'isBase64Encoded': False
        }
    
    # Получаем photo_id из body
    try:
        body = json.loads(event.get('body', '{}'))
        photo_id = body.get('photo_id')
    except:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid JSON body'}),
            'isBase64Encoded': False
        }
    
    if not photo_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'photo_id required'}),
            'isBase64Encoded': False
        }
    
    db_url = os.environ.get('DATABASE_URL')
    s3_key_id = os.environ.get('YC_S3_KEY_ID')
    s3_secret = os.environ.get('YC_S3_SECRET')
    bucket = 'foto-mix'
    
    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
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
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Получаем информацию о фото
            cur.execute('''
                SELECT pb.id, pb.s3_key, pb.s3_url, pb.file_name, pb.folder_id,
                       pf.parent_folder_id, pf.folder_type
                FROM t_p28211681_photo_secure_web.photo_bank pb
                JOIN t_p28211681_photo_secure_web.photo_folders pf ON pb.folder_id = pf.id
                WHERE pb.id = %s AND pb.user_id = %s AND pb.is_trashed = FALSE
            ''', (photo_id, user_id))
            
            photo = cur.fetchone()
            
            print(f'[PHOTO_RESTORE] Photo data: id={photo_id}, s3_key={photo.get("s3_key") if photo else None}, folder_type={photo.get("folder_type") if photo else None}')
            
            if not photo:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Photo not found'}),
                    'isBase64Encoded': False
                }
            
            # Проверяем что фото находится в папке tech_rejects
            if photo['folder_type'] != 'tech_rejects':
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Photo is not in tech_rejects folder'}),
                    'isBase64Encoded': False
                }
            
            # Получаем родительскую папку (originals)
            parent_folder_id = photo['parent_folder_id']
            if not parent_folder_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Parent folder not found'}),
                    'isBase64Encoded': False
                }
            
            # Получаем s3_prefix родительской папки
            cur.execute('''
                SELECT s3_prefix
                FROM t_p28211681_photo_secure_web.photo_folders
                WHERE id = %s AND user_id = %s AND is_trashed = FALSE
            ''', (parent_folder_id, user_id))
            
            parent_folder = cur.fetchone()
            if not parent_folder:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Parent folder not found'}),
                    'isBase64Encoded': False
                }
            
            # Извлекаем актуальный s3_key
            current_s3_key = photo['s3_key']
            if not current_s3_key and photo['s3_url']:
                # Извлекаем ключ из URL вида https://storage.yandexcloud.net/foto-mix/path/file.jpg
                current_s3_key = photo['s3_url'].replace('https://storage.yandexcloud.net/foto-mix/', '')
            
            print(f'[PHOTO_RESTORE] Current S3 key: {current_s3_key}')
            
            if not current_s3_key:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Photo has no S3 storage reference'}),
                    'isBase64Encoded': False
                }
            
            # Формируем новый s3_key в папке originals
            new_s3_key = f"{parent_folder['s3_prefix']}{photo['file_name']}"
            
            print(f'[PHOTO_RESTORE] Copying: {current_s3_key} -> {new_s3_key}')
            
            # Проверяем существование файла в S3
            try:
                s3_client.head_object(Bucket=bucket, Key=current_s3_key)
                print(f'[PHOTO_RESTORE] S3 object exists')
            except Exception as head_err:
                print(f'[PHOTO_RESTORE] S3 object not found: {str(head_err)}')
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': f'File not found in S3: {current_s3_key}'}),
                    'isBase64Encoded': False
                }
            
            # Копируем фото обратно в originals
            try:
                s3_client.copy_object(
                    Bucket=bucket,
                    CopySource={'Bucket': bucket, 'Key': current_s3_key},
                    Key=new_s3_key
                )
                print(f'[PHOTO_RESTORE] S3 copy successful')
            except Exception as copy_err:
                print(f'[PHOTO_RESTORE] S3 copy failed: {str(copy_err)}')
                raise
            
            # Обновляем запись в БД
            cur.execute('''
                UPDATE t_p28211681_photo_secure_web.photo_bank
                SET folder_id = %s,
                    s3_key = %s,
                    tech_reject_reason = NULL,
                    tech_analyzed = TRUE,
                    updated_at = NOW()
                WHERE id = %s
            ''', (parent_folder_id, new_s3_key, photo_id))
            
            # Удаляем старый файл из S3
            try:
                s3_client.delete_object(Bucket=bucket, Key=current_s3_key)
                print(f'[PHOTO_RESTORE] Old S3 file deleted')
            except Exception as del_err:
                print(f'[PHOTO_RESTORE] Failed to delete old file: {str(del_err)}')
                # Не критичная ошибка, продолжаем
            
            conn.commit()
            
            print(f'[PHOTO_RESTORE] Success! Photo {photo_id} restored to folder {parent_folder_id}')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'message': 'Фото восстановлено в оригиналы',
                    'photo_id': photo_id,
                    'new_folder_id': parent_folder_id
                }),
                'isBase64Encoded': False
            }
            
    except Exception as e:
        print(f'[PHOTO_RESTORE] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Internal server error: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()