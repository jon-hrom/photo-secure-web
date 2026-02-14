import json
import os
import psycopg2
import random
import string
import boto3
from botocore.client import Config
from datetime import datetime, timedelta

REGION_TIMEZONE = {
    "Калининградская область": "Europe/Kaliningrad",
    "Москва": "Europe/Moscow", "Московская область": "Europe/Moscow",
    "Санкт-Петербург": "Europe/Moscow", "Ленинградская область": "Europe/Moscow",
    "Адыгея": "Europe/Moscow", "Республика Адыгея": "Europe/Moscow",
    "Архангельская область": "Europe/Moscow",
    "Белгородская область": "Europe/Moscow",
    "Брянская область": "Europe/Moscow",
    "Владимирская область": "Europe/Moscow",
    "Вологодская область": "Europe/Moscow",
    "Воронежская область": "Europe/Moscow",
    "Ивановская область": "Europe/Moscow",
    "Калужская область": "Europe/Moscow",
    "Карелия": "Europe/Moscow", "Республика Карелия": "Europe/Moscow",
    "Коми": "Europe/Moscow", "Республика Коми": "Europe/Moscow",
    "Костромская область": "Europe/Moscow",
    "Краснодарский край": "Europe/Moscow",
    "Курская область": "Europe/Moscow",
    "Липецкая область": "Europe/Moscow",
    "Марий Эл": "Europe/Moscow", "Республика Марий Эл": "Europe/Moscow",
    "Мордовия": "Europe/Moscow", "Республика Мордовия": "Europe/Moscow",
    "Мурманская область": "Europe/Moscow",
    "Ненецкий автономный округ": "Europe/Moscow",
    "Нижегородская область": "Europe/Moscow",
    "Новгородская область": "Europe/Moscow",
    "Орловская область": "Europe/Moscow",
    "Пензенская область": "Europe/Moscow",
    "Псковская область": "Europe/Moscow",
    "Ростовская область": "Europe/Moscow",
    "Рязанская область": "Europe/Moscow",
    "Смоленская область": "Europe/Moscow",
    "Тамбовская область": "Europe/Moscow",
    "Тверская область": "Europe/Moscow",
    "Тульская область": "Europe/Moscow",
    "Ярославская область": "Europe/Moscow",
    "Кабардино-Балкария": "Europe/Moscow", "Кабардино-Балкарская Республика": "Europe/Moscow",
    "Карачаево-Черкесия": "Europe/Moscow", "Карачаево-Черкесская Республика": "Europe/Moscow",
    "Северная Осетия": "Europe/Moscow", "Республика Северная Осетия — Алания": "Europe/Moscow",
    "Чечня": "Europe/Moscow", "Чеченская Республика": "Europe/Moscow",
    "Ингушетия": "Europe/Moscow", "Республика Ингушетия": "Europe/Moscow",
    "Дагестан": "Europe/Moscow", "Республика Дагестан": "Europe/Moscow",
    "Ставропольский край": "Europe/Moscow",
    "Крым": "Europe/Moscow", "Республика Крым": "Europe/Moscow",
    "Севастополь": "Europe/Moscow",
    "Волгоградская область": "Europe/Moscow",
    "Кировская область": "Europe/Moscow",
    "Астраханская область": "Europe/Samara",
    "Самарская область": "Europe/Samara",
    "Саратовская область": "Europe/Samara",
    "Удмуртия": "Europe/Samara", "Удмуртская Республика": "Europe/Samara",
    "Ульяновская область": "Europe/Samara",
    "Башкортостан": "Asia/Yekaterinburg", "Республика Башкортостан": "Asia/Yekaterinburg",
    "Курганская область": "Asia/Yekaterinburg",
    "Оренбургская область": "Asia/Yekaterinburg",
    "Пермский край": "Asia/Yekaterinburg",
    "Свердловская область": "Asia/Yekaterinburg",
    "Тюменская область": "Asia/Yekaterinburg",
    "Челябинская область": "Asia/Yekaterinburg",
    "Ханты-Мансийский автономный округ": "Asia/Yekaterinburg",
    "Ямало-Ненецкий автономный округ": "Asia/Yekaterinburg",
    "Татарстан": "Europe/Moscow", "Республика Татарстан": "Europe/Moscow",
    "Чувашия": "Europe/Moscow", "Чувашская Республика": "Europe/Moscow",
    "Алтайский край": "Asia/Barnaul",
    "Республика Алтай": "Asia/Barnaul",
    "Кемеровская область": "Asia/Novokuznetsk",
    "Новосибирская область": "Asia/Novosibirsk",
    "Омская область": "Asia/Omsk",
    "Томская область": "Asia/Tomsk",
    "Красноярский край": "Asia/Krasnoyarsk",
    "Тыва": "Asia/Krasnoyarsk", "Республика Тыва": "Asia/Krasnoyarsk",
    "Хакасия": "Asia/Krasnoyarsk", "Республика Хакасия": "Asia/Krasnoyarsk",
    "Иркутская область": "Asia/Irkutsk",
    "Бурятия": "Asia/Irkutsk", "Республика Бурятия": "Asia/Irkutsk",
    "Забайкальский край": "Asia/Chita",
    "Амурская область": "Asia/Yakutsk",
    "Саха (Якутия)": "Asia/Yakutsk", "Республика Саха (Якутия)": "Asia/Yakutsk",
    "Еврейская автономная область": "Asia/Vladivostok",
    "Приморский край": "Asia/Vladivostok",
    "Хабаровский край": "Asia/Vladivostok",
    "Магаданская область": "Asia/Magadan",
    "Сахалинская область": "Asia/Sakhalin",
    "Камчатский край": "Asia/Kamchatka",
    "Чукотский автономный округ": "Asia/Kamchatka",
}

def get_timezone_for_region(region):
    if not region:
        return "Europe/Moscow"
    return REGION_TIMEZONE.get(region, "Europe/Moscow")

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
            
            cover_photo_id = data.get('cover_photo_id')
            cover_orientation = data.get('cover_orientation', 'horizontal')
            cover_focus_x = data.get('cover_focus_x', 0.5)
            cover_focus_y = data.get('cover_focus_y', 0.5)
            grid_gap = data.get('grid_gap', 8)
            
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
                        favorite_config = %s,
                        cover_photo_id = %s, cover_orientation = %s,
                        cover_focus_x = %s, cover_focus_y = %s, grid_gap = %s
                    WHERE short_code = %s
                    """,
                    (expires_at, password_hash, download_disabled,
                     watermark_enabled, watermark_type, watermark_text,
                     watermark_image_url, watermark_frequency, watermark_size,
                     watermark_opacity, watermark_rotation, screenshot_protection,
                     json.dumps(favorite_config) if favorite_config else None,
                     cover_photo_id, cover_orientation,
                     cover_focus_x, cover_focus_y, grid_gap, short_code)
                )
            else:
                # Создаём новую ссылку
                short_code = generate_short_code()
                cur.execute(
                    """
                    INSERT INTO t_p28211681_photo_secure_web.folder_short_links
                    (short_code, folder_id, user_id, expires_at, password_hash, download_disabled,
                     watermark_enabled, watermark_type, watermark_text, watermark_image_url,
                     watermark_frequency, watermark_size, watermark_opacity, watermark_rotation, screenshot_protection, favorite_config,
                     cover_photo_id, cover_orientation, cover_focus_x, cover_focus_y, grid_gap)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (short_code, folder_id, user_id, expires_at, password_hash, download_disabled,
                     watermark_enabled, watermark_type, watermark_text, watermark_image_url,
                     watermark_frequency, watermark_size, watermark_opacity, watermark_rotation, screenshot_protection,
                     json.dumps(favorite_config) if favorite_config else None,
                     cover_photo_id, cover_orientation, cover_focus_x, cover_focus_y, grid_gap)
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
                       fsl.favorite_config, fsl.user_id,
                       fsl.cover_photo_id, fsl.cover_orientation, fsl.cover_focus_x, fsl.cover_focus_y, fsl.grid_gap
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
             favorite_config_json, photographer_id,
             cover_photo_id, cover_orientation, cover_focus_x, cover_focus_y, grid_gap) = result
            
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
            
            cur.execute(
                """
                SELECT region FROM t_p28211681_photo_secure_web.users WHERE id = %s
                """,
                (photographer_id,)
            )
            user_row = cur.fetchone()
            photographer_timezone = get_timezone_for_region(user_row[0] if user_row else None)
            
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
                    'photographer_timezone': photographer_timezone,
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
                    'favorite_config': favorite_config,
                    'cover_photo_id': cover_photo_id,
                    'cover_orientation': cover_orientation or 'horizontal',
                    'cover_focus_x': float(cover_focus_x) if cover_focus_x is not None else 0.5,
                    'cover_focus_y': float(cover_focus_y) if cover_focus_y is not None else 0.5,
                    'grid_gap': grid_gap if grid_gap is not None else 8
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