"""
Перегенерация thumbnail до 2000px для существующих фото.
Запускается батчами по 20 фото, можно вызывать повторно до завершения.
"""
import os
import json
import boto3
import psycopg2
from io import BytesIO
from PIL import Image
from botocore.config import Config


def handler(event: dict, context) -> dict:
    """Перегенерирует thumbnails существующих фото до 2000px по длинной стороне."""
    
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
        }, 'body': ''}

    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    # Только POST с секретным ключом
    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'})}

    raw_body = event.get('body') or '{}'
    if isinstance(raw_body, str):
        try:
            body = json.loads(raw_body)
        except Exception:
            body = {}
    elif isinstance(raw_body, dict):
        body = raw_body
    else:
        body = {}
    # После двойной сериализации может прийти строка вместо dict
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except Exception:
            body = {}
    admin_secret = os.environ.get('ADMIN_SECRET', '')
    if not admin_secret or body.get('secret') != admin_secret:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Forbidden'})}

    batch_size = int(body.get('batch_size', 20))

    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )
    bucket = 'foto-mix'

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    # Берём фото без CDN url (presigned) или у которых thumbnail_s3_key есть — перегенерируем
    cur.execute("""
        SELECT id, s3_key, thumbnail_s3_key, file_name, is_video, is_raw, content_type
        FROM t_p28211681_photo_secure_web.photo_bank
        WHERE (is_trashed = false OR is_trashed IS NULL)
          AND is_video = false
          AND (is_raw = false OR is_raw IS NULL)
          AND s3_key IS NOT NULL
          AND thumbnail_s3_key IS NOT NULL
          AND regen_2000 IS NOT TRUE
        LIMIT %s
    """, (batch_size,))
    
    photos = cur.fetchall()
    processed = 0
    failed = 0
    errors = []

    for row in photos:
        photo_id, s3_key, thumb_key, file_name, is_video, is_raw, content_type = row
        try:
            # Скачиваем оригинал
            obj = s3.get_object(Bucket=bucket, Key=s3_key)
            file_content = obj['Body'].read()

            img = Image.open(BytesIO(file_content))
            
            # Конвертируем цвет
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.getchannel('A') if 'A' in img.getbands() else None)
                img = background
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Ресайз до 2000px
            img.thumbnail((2000, 2000), Image.Resampling.LANCZOS)

            thumb_buffer = BytesIO()
            img.save(thumb_buffer, format='JPEG', quality=85, optimize=True)
            thumb_buffer.seek(0)

            # Заливаем обратно по тому же ключу
            s3.put_object(
                Bucket=bucket,
                Key=thumb_key,
                Body=thumb_buffer.getvalue(),
                ContentType='image/jpeg'
            )

            # Помечаем как перегенерированный
            cur.execute(
                "UPDATE t_p28211681_photo_secure_web.photo_bank SET regen_2000 = TRUE WHERE id = %s",
                (photo_id,)
            )
            conn.commit()
            processed += 1

        except Exception as e:
            conn.rollback()
            failed += 1
            errors.append({'id': photo_id, 'file': file_name, 'error': str(e)})
            print(f'[REGEN] Error photo {photo_id}: {e}')

    # Считаем сколько осталось
    cur.execute("""
        SELECT COUNT(*) FROM t_p28211681_photo_secure_web.photo_bank
        WHERE (is_trashed = false OR is_trashed IS NULL)
          AND is_video = false
          AND (is_raw = false OR is_raw IS NULL)
          AND s3_key IS NOT NULL
          AND thumbnail_s3_key IS NOT NULL
          AND regen_2000 IS NOT TRUE
    """)
    remaining = cur.fetchone()[0]

    cur.close()
    conn.close()

    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'processed': processed,
            'failed': failed,
            'remaining': remaining,
            'done': remaining == 0,
            'errors': errors[:5]
        })
    }