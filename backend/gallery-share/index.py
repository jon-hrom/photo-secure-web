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
            # Получаем expires_days: null = бессрочная, число = дней до истечения
            # Если ключ отсутствует - по умолчанию 30 дней
            expires_days = data['expires_days'] if 'expires_days' in data else 30
            password = data.get('password')
            download_disabled = data.get('download_disabled', False)
            
            watermark_enabled = data.get('watermark_enabled', False)
            watermark_type = data.get('watermark_type', 'text')
            watermark_text = data.get('watermark_text')
            watermark_image_url = data.get('watermark_image_url')
            watermark_frequency = data.get('watermark_frequency', 50)
            watermark_size = data.get('watermark_size', 20)
            watermark_opacity = data.get('watermark_opacity', 50)
            watermark_rotation = data.get('watermark_rotation', 0)
            screenshot_protection = data.get('screenshot_protection', False)
            favorite_config = data.get('favorite_config')
            
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
            
            # Проверяем, есть ли уже ссылка для этой папки
            cur.execute(
                """
                SELECT short_code FROM t_p28211681_photo_secure_web.folder_short_links
                WHERE folder_id = %s AND user_id = %s
                ORDER BY created_at DESC LIMIT 1
                """,
                (folder_id, user_id)
            )
            existing_link = cur.fetchone()
            
            expires_at = datetime.now() + timedelta(days=expires_days) if expires_days else None
            
            password_hash = None
            if password:
                import hashlib
                password_hash = hashlib.sha256(password.encode()).hexdigest()
            
            if existing_link:
                # Обновляем существующую ссылку
                short_code = existing_link[0]
                cur.execute(
                    """
                    UPDATE t_p28211681_photo_secure_web.folder_short_links
                    SET expires_at = %s, password_hash = %s, download_disabled = %s,
                        watermark_enabled = %s, watermark_type = %s, watermark_text = %s,
                        watermark_image_url = %s, watermark_frequency = %s, watermark_size = %s,
                        watermark_opacity = %s, watermark_rotation = %s, screenshot_protection = %s,
                        favorite_config = %s
                    WHERE short_code = %s
                    """,
                    (expires_at, password_hash, download_disabled,
                     watermark_enabled, watermark_type, watermark_text,
                     watermark_image_url, watermark_frequency, watermark_size,
                     watermark_opacity, watermark_rotation, screenshot_protection,
                     json.dumps(favorite_config) if favorite_config else None, short_code)
                )
            else:
                # Создаём новую ссылку
                short_code = generate_short_code()
                cur.execute(
                    """
                    INSERT INTO t_p28211681_photo_secure_web.folder_short_links
                    (short_code, folder_id, user_id, expires_at, password_hash, download_disabled,
                     watermark_enabled, watermark_type, watermark_text, watermark_image_url,
                     watermark_frequency, watermark_size, watermark_opacity, watermark_rotation, screenshot_protection, favorite_config)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (short_code, folder_id, user_id, expires_at, password_hash, download_disabled,
                     watermark_enabled, watermark_type, watermark_text, watermark_image_url,
                     watermark_frequency, watermark_size, watermark_opacity, watermark_rotation, screenshot_protection,
                     json.dumps(favorite_config) if favorite_config else None)
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
                SELECT fsl.folder_id, fsl.expires_at, pf.folder_name, fsl.password_hash, fsl.download_disabled,
                       fsl.watermark_enabled, fsl.watermark_type, fsl.watermark_text, fsl.watermark_image_url,
                       fsl.watermark_frequency, fsl.watermark_size, fsl.watermark_opacity, fsl.watermark_rotation, fsl.screenshot_protection,
                       fsl.favorite_config, fsl.user_id
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
            
            (folder_id, expires_at, folder_name, password_hash, download_disabled,
             watermark_enabled, watermark_type, watermark_text, watermark_image_url,
             watermark_frequency, watermark_size, watermark_opacity, watermark_rotation, screenshot_protection,
             favorite_config_json, photographer_id) = result
            
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
                SELECT id, file_name, s3_key, s3_url, thumbnail_s3_key, thumbnail_s3_url, width, height, file_size, is_raw, is_video, content_type
                FROM t_p28211681_photo_secure_web.photo_bank
                WHERE folder_id = %s AND is_trashed = false
                  AND (is_raw = false OR (is_raw = true AND thumbnail_s3_key IS NOT NULL))
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
            
            poehali_s3 = boto3.client('s3',
                endpoint_url='https://bucket.poehali.dev',
                aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
            )
            
            yc_bucket = 'foto-mix'
            poehali_bucket = 'files'
            photos_data = []
            total_size = 0
            
            print(f'[GALLERY] Found {len(photos)} photos (including RAW with previews)')
            
            for photo in photos:
                try:
                    photo_id, file_name, s3_key, s3_url, thumbnail_s3_key, thumbnail_s3_url, width, height, file_size, is_raw, is_video, content_type = photo
                    
                    # Определяем, какой S3 используется по s3_url
                    use_poehali_s3 = s3_url and 'cdn.poehali.dev' in s3_url
                    s3_client = poehali_s3 if use_poehali_s3 else yc_s3
                    bucket = poehali_bucket if use_poehali_s3 else yc_bucket
                    
                    print(f'[GALLERY] Photo {photo_id}: using {"poehali" if use_poehali_s3 else "yandex"} S3, s3_url={s3_url[:50] if s3_url else "none"}...')
                    
                    # Для видео используем больший срок действия URL (12 часов)
                    expires_in = 43200 if is_video else 3600
                    
                    # Если в БД уже есть CDN URL от poehali.dev - используем его напрямую
                    if use_poehali_s3 and s3_url:
                        photo_url = s3_url
                        thumbnail_url = thumbnail_s3_url if thumbnail_s3_url else None
                        print(f'[GALLERY] Using stored CDN URLs for photo {photo_id}')
                    else:
                        # Генерируем presigned URLs для Yandex S3
                        if is_raw and thumbnail_s3_key:
                            photo_url = s3_client.generate_presigned_url(
                                'get_object',
                                Params={'Bucket': bucket, 'Key': thumbnail_s3_key},
                                ExpiresIn=expires_in
                            )
                            thumbnail_url = photo_url
                        else:
                            photo_url = s3_client.generate_presigned_url(
                                'get_object',
                                Params={'Bucket': bucket, 'Key': s3_key},
                                ExpiresIn=expires_in
                            )
                            thumbnail_url = None
                            if thumbnail_s3_key:
                                thumbnail_url = s3_client.generate_presigned_url(
                                    'get_object',
                                    Params={'Bucket': bucket, 'Key': thumbnail_s3_key},
                                    ExpiresIn=3600
                                )
                    
                    photos_data.append({
                        'id': photo_id,
                        'file_name': file_name,
                        'photo_url': photo_url,
                        'thumbnail_url': thumbnail_url,
                        'width': width,
                        'height': height,
                        'file_size': file_size,
                        'is_video': is_video,
                        'content_type': content_type,
                        's3_key': s3_key,
                        'folder_id': folder_id
                    })
                    
                    total_size += file_size or 0
                except Exception as e:
                    print(f'[GALLERY] Error processing photo, error: {str(e)}')
                    continue
            
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
            
            favorite_config = None
            if favorite_config_json:
                try:
                    favorite_config = json.loads(favorite_config_json) if isinstance(favorite_config_json, str) else favorite_config_json
                except:
                    favorite_config = None
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'folder_name': folder_name,
                    'photos': photos_data,
                    'total_size': total_size,
                    'download_disabled': download_disabled,
                    'photographer_id': photographer_id,
                    'watermark': {
                        'enabled': watermark_enabled,
                        'type': watermark_type,
                        'text': watermark_text,
                        'image_url': watermark_image_url,
                        'frequency': watermark_frequency,
                        'size': watermark_size,
                        'opacity': watermark_opacity,
                        'rotation': watermark_rotation
                    },
                    'screenshot_protection': screenshot_protection,
                    'favorite_config': favorite_config
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