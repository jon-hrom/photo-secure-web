import json
import os
import boto3
from datetime import timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: dict, context) -> dict:
    '''Генерирует presigned URLs для фотографий из S3-хранилища'''
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

    conn = None
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        schema = os.environ['MAIN_DB_SCHEMA']

        if action == 'list':
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"SELECT id, name, created_at FROM {schema}.photo_folders WHERE user_id = %s ORDER BY created_at DESC",
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
            s3 = boto3.client(
                's3',
                endpoint_url='https://storage.yandexcloud.net',
                aws_access_key_id=os.environ['YC_S3_KEY_ID'],
                aws_secret_access_key=os.environ['YC_S3_SECRET']
            )
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    f"SELECT id, folder_id, file_name, s3_key, thumbnail_s3_key, file_size, width, height, created_at, is_video FROM {schema}.photo_bank WHERE folder_id = %s AND user_id = %s AND (is_trashed IS NULL OR is_trashed = false) ORDER BY created_at DESC",
                    (folder_id, user_id)
                )
                rows = cur.fetchall()
            
            photos = []
            for row in rows:
                photo = dict(row)
                photo['created_at'] = photo['created_at'].isoformat() if photo['created_at'] else None
                
                photo_url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': 'foto-mix', 'Key': row['s3_key']},
                    ExpiresIn=int(timedelta(hours=1).total_seconds())
                )
                
                thumbnail_url = photo_url
                if row['thumbnail_s3_key']:
                    thumbnail_url = s3.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': 'foto-mix', 'Key': row['thumbnail_s3_key']},
                        ExpiresIn=int(timedelta(hours=1).total_seconds())
                    )
                
                photo['photo_url'] = photo_url
                photo['thumbnail_url'] = thumbnail_url
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
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    finally:
        if conn:
            conn.close()