import json
import os
import psycopg2
import random
import string
import boto3
from botocore.client import Config
from datetime import datetime, timedelta

def generate_short_code(length=8):
    """Генерирует короткий уникальный код для ссылки"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def handler(event: dict, context) -> dict:
    """
    API для создания коротких ссылок на папки с фото и просмотра галереи
    POST /gallery-share - создать короткую ссылку на папку
    GET /gallery-share?code=xxx - получить все фото из папки
    """
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database not configured'})
        }
    
    try:
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        if method == 'POST':
            data = json.loads(event.get('body', '{}'))
            folder_id = data.get('folder_id')
            user_id = data.get('user_id') or event.get('headers', {}).get('x-user-id')
            expires_days = data.get('expires_days', 30)
            password = data.get('password')
            download_disabled = data.get('download_disabled', False)
            
            if not folder_id or not user_id:
                cur.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'folder_id and user_id required'})
                }
            
            cur.execute(
                """
                SELECT id FROM t_p28211681_photo_secure_web.photo_folders
                WHERE id = %s AND user_id = %s
                """,
                (folder_id, user_id)
            )
            
            if not cur.fetchone():
                cur.close()
                conn.close()
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Folder not found or access denied'})
                }
            
            short_code = generate_short_code()
            expires_at = datetime.now() + timedelta(days=expires_days) if expires_days else None
            
            password_hash = None
            if password:
                import hashlib
                password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            cur.execute(
                """
                INSERT INTO t_p28211681_photo_secure_web.folder_short_links
                (short_code, folder_id, user_id, expires_at, password_hash, download_disabled)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING short_code
                """,
                (short_code, folder_id, user_id, expires_at, password_hash, download_disabled)
            )
            conn.commit()
            
            cur.close()
            conn.close()
            
            base_url = os.environ.get('BASE_URL', 'http://localhost:5173')
            share_url = f"{base_url}/g/{short_code}"
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'short_code': short_code,
                    'share_url': share_url,
                    'expires_at': expires_at.isoformat() if expires_at else None
                })
            }
        
        elif method == 'GET':
            short_code = event.get('queryStringParameters', {}).get('code')
            
            if not short_code:
                cur.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Code required'})
                }
            
            cur.execute(
                """
                SELECT fsl.folder_id, fsl.expires_at, pf.folder_name, fsl.password_hash, fsl.download_disabled
                FROM t_p28211681_photo_secure_web.folder_short_links fsl
                JOIN t_p28211681_photo_secure_web.photo_folders pf ON pf.id = fsl.folder_id
                WHERE fsl.short_code = %s
                """,
                (short_code,)
            )
            
            result = cur.fetchone()
            if not result:
                cur.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Gallery not found'})
                }
            
            folder_id, expires_at, folder_name, password_hash, download_disabled = result
            
            if password_hash:
                provided_password = event.get('queryStringParameters', {}).get('password', '')
                print(f'[PASSWORD_CHECK] Provided: {provided_password}, Hash stored: {password_hash[:16]}...')
                import hashlib
                provided_hash = hashlib.sha256(provided_password.encode()).hexdigest()
                print(f'[PASSWORD_CHECK] Provided hash: {provided_hash[:16]}..., Expected: {password_hash[:16]}...')
                if provided_hash != password_hash:
                    print(f'[PASSWORD_CHECK] Password mismatch!')
                    cur.close()
                    conn.close()
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Invalid password', 'requires_password': True})
                    }
                print(f'[PASSWORD_CHECK] Password correct!')
            
            if expires_at and datetime.now() > expires_at:
                cur.close()
                conn.close()
                return {
                    'statusCode': 410,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Gallery link expired'})
                }
            
            cur.execute(
                """
                UPDATE t_p28211681_photo_secure_web.folder_short_links
                SET access_count = access_count + 1
                WHERE short_code = %s
                """,
                (short_code,)
            )
            conn.commit()
            
            cur.execute(
                """
                SELECT id, file_name, s3_key, thumbnail_s3_key, width, height, file_size
                FROM t_p28211681_photo_secure_web.photo_bank
                WHERE folder_id = %s AND is_trashed = false
                  AND LOWER(file_name) NOT LIKE '%.cr2'
                  AND LOWER(file_name) NOT LIKE '%.raw'
                  AND LOWER(file_name) NOT LIKE '%.nef'
                  AND LOWER(file_name) NOT LIKE '%.arw'
                ORDER BY created_at DESC
                """,
                (folder_id,)
            )
            
            photos = cur.fetchall()
            
            yc_s3 = boto3.client('s3',
                endpoint_url='https://storage.yandexcloud.net',
                region_name='ru-central1',
                aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
                aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
                config=Config(signature_version='s3v4')
            )
            
            bucket_name = 'foto-mix'
            photos_data = []
            total_size = 0
            
            for photo in photos:
                photo_id, file_name, s3_key, thumbnail_s3_key, width, height, file_size = photo
                
                photo_url = yc_s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket_name, 'Key': s3_key},
                    ExpiresIn=3600
                )
                
                thumbnail_url = None
                if thumbnail_s3_key:
                    thumbnail_url = yc_s3.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': bucket_name, 'Key': thumbnail_s3_key},
                        ExpiresIn=3600
                    )
                
                photos_data.append({
                    'id': photo_id,
                    'file_name': file_name,
                    'photo_url': photo_url,
                    'thumbnail_url': thumbnail_url,
                    'width': width,
                    'height': height,
                    'file_size': file_size
                })
                
                total_size += file_size or 0
            
            cur.execute(
                """
                UPDATE t_p28211681_photo_secure_web.folder_short_links
                SET view_count = view_count + 1
                WHERE short_code = %s
                """,
                (short_code,)
            )
            conn.commit()
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'folder_name': folder_name,
                    'photos': photos_data,
                    'total_size': total_size,
                    'download_disabled': download_disabled
                })
            }
        
        else:
            cur.close()
            conn.close()
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    except psycopg2.Error as e:
        return {
            'statusCode': 404 if 'not found' in str(e).lower() else 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Gallery not found' if 'not found' in str(e).lower() else str(e)})
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }