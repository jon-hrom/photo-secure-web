import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

def handler(event: dict, context) -> dict:
    '''Возвращает список папок и фотографий с presigned S3 URLs'''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': ''
        }

    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }

    user_id = event.get('headers', {}).get('X-User-Id')
    folder_id = event.get('queryStringParameters', {}).get('folder_id')
    action = event.get('queryStringParameters', {}).get('action', 'list_photos')

    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'User ID required'})
        }

    # Инициализируем S3 клиент для presigned URLs
    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )

    conn = None
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        schema = os.environ['MAIN_DB_SCHEMA']

        if action == 'list':
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"SELECT id, folder_name, created_at, folder_type, parent_folder_id FROM {schema}.photo_folders WHERE user_id = %s AND (is_trashed IS NULL OR is_trashed = false) ORDER BY created_at DESC",
                    (user_id,)
                )
                rows = cur.fetchall()
            
            folders = []
            for row in rows:
                folder = dict(row)
                folder['created_at'] = folder['created_at'].isoformat() if folder['created_at'] else None
                folders.append(folder)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'folders': folders})
            }

        elif action == 'list_photos' and folder_id:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"SELECT id, folder_id, file_name, s3_key, thumbnail_s3_key, s3_url, thumbnail_s3_url, file_size, width, height, created_at, is_video, photo_download_count FROM {schema}.photo_bank WHERE folder_id = %s AND user_id = %s AND (is_trashed IS NULL OR is_trashed = false) ORDER BY created_at DESC",
                    (folder_id, user_id)
                )
                rows = cur.fetchall()
            
            photos = []
            for row in rows:
                photo = dict(row)
                photo['created_at'] = photo['created_at'].isoformat() if photo['created_at'] else None
                
                # Если фото хранится в Poehali CDN - используем постоянный URL
                if row['s3_url'] and 'cdn.poehali.dev' in row['s3_url']:
                    photo['photo_url'] = row['s3_url']
                    photo['thumbnail_url'] = row['thumbnail_s3_url'] if row['thumbnail_s3_url'] else row['s3_url']
                    print(f'[PRESIGNED] Photo {row["id"]} uses Poehali CDN: {row["s3_url"][:80]}...')
                # Иначе генерируем presigned URLs для Yandex S3
                elif row['s3_key']:
                    photo_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': 'foto-mix',
                            'Key': row['s3_key']
                        },
                        ExpiresIn=3600
                    )
                    
                    thumbnail_url = photo_url
                    if row['thumbnail_s3_key']:
                        thumbnail_url = s3_client.generate_presigned_url(
                            'get_object',
                            Params={
                                'Bucket': 'foto-mix',
                                'Key': row['thumbnail_s3_key']
                            },
                            ExpiresIn=3600
                        )
                    
                    photo['photo_url'] = photo_url
                    photo['thumbnail_url'] = thumbnail_url
                    print(f'[PRESIGNED] Photo {row["id"]} uses Yandex S3 presigned URL')
                else:
                    print(f'[PRESIGNED] Photo {row["id"]} has NO s3_key or s3_url!')
                    photo['photo_url'] = None
                    photo['thumbnail_url'] = None
                
                photos.append(photo)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'photos': photos})
            }

        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid action'})
        }

    except Exception as e:
        import traceback
        error_details = {
            'error': str(e),
            'type': type(e).__name__,
            'traceback': traceback.format_exc()
        }
        print(f'[ERROR] Exception in photos-presigned: {error_details}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            conn.close()