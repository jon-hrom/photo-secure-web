'''Фоновая догенерация постоянных миниатюр для обычных изображений (JPEG/PNG/WebP)
без готового thumbnail_s3_key. Обрабатывает партию за вызов (лёгкий Pillow-ресайз ~500px).
RAW-файлы пропускает — для них есть отдельная тяжёлая функция generate-thumbnail.
Вызывается многократно партиями, пока remaining не станет 0.
'''
import json
import os
import time
import boto3
from io import BytesIO
from PIL import Image, ImageOps
import psycopg2
from psycopg2.extras import RealDictCursor
from botocore.client import Config

RAW_EXT = ('.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2', '.dng',
           '.orf', '.rw2', '.raf', '.pef', '.raw', '.rwl', '.iiq', '.3fr')

THUMB_MAX = 500
JPEG_QUALITY = 78


def is_raw(name: str) -> bool:
    n = (name or '').lower()
    return any(n.endswith(e) for e in RAW_EXT)


def handler(event: dict, context) -> dict:
    '''Догенерирует миниатюры для партии обычных фото без превью.'''
    method = event.get('httpMethod', 'POST')
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
        'Content-Type': 'application/json',
    }
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    try:
        batch = int(params.get('batch', 30))
    except (TypeError, ValueError):
        batch = 30
    batch = max(1, min(batch, 60))

    # Точечная генерация для конкретных фото (сразу после загрузки)
    photo_ids = []
    if event.get('body'):
        try:
            body = json.loads(event['body'])
            raw_ids = body.get('photo_ids') or ([body['photo_id']] if body.get('photo_id') else [])
            photo_ids = [int(x) for x in raw_ids if str(x).isdigit()]
        except Exception:
            photo_ids = []

    schema = os.environ['MAIN_DB_SCHEMA']

    s3 = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4'),
    )

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    processed, failed, skipped_raw = 0, 0, 0
    errors = []
    deadline = time.time() + 22  # оставляем запас до таймаута функции (30с)

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if photo_ids:
                cur.execute(f'''
                    SELECT id, s3_key, file_name
                    FROM {schema}.photo_bank
                    WHERE id = ANY(%s)
                      AND thumbnail_s3_key IS NULL
                      AND (is_trashed IS NULL OR is_trashed = false)
                      AND (is_video IS NULL OR is_video = false)
                      AND s3_key IS NOT NULL
                ''', (photo_ids,))
            else:
                cur.execute(f'''
                    SELECT id, s3_key, file_name
                    FROM {schema}.photo_bank
                    WHERE thumbnail_s3_key IS NULL
                      AND (is_trashed IS NULL OR is_trashed = false)
                      AND (is_video IS NULL OR is_video = false)
                      AND s3_key IS NOT NULL
                    ORDER BY id DESC
                    LIMIT %s
                ''', (batch,))
            rows = cur.fetchall()

        for row in rows:
            if time.time() > deadline:
                break
            if is_raw(row['file_name']):
                skipped_raw += 1
                continue
            try:
                obj = s3.get_object(Bucket='foto-mix', Key=row['s3_key'])
                data = obj['Body'].read()

                img = Image.open(BytesIO(data))
                img = ImageOps.exif_transpose(img)
                full_w, full_h = img.size
                if img.mode not in ('RGB', 'L'):
                    img = img.convert('RGB')
                img.thumbnail((THUMB_MAX, THUMB_MAX), Image.Resampling.LANCZOS)

                out = BytesIO()
                img.save(out, format='JPEG', quality=JPEG_QUALITY, optimize=True, progressive=True)

                thumb_key = row['s3_key'].rsplit('.', 1)[0] + '_thumb.jpg'
                s3.put_object(
                    Bucket='foto-mix',
                    Key=thumb_key,
                    Body=out.getvalue(),
                    ContentType='image/jpeg',
                )

                with conn.cursor() as ucur:
                    ucur.execute(f'''
                        UPDATE {schema}.photo_bank
                        SET thumbnail_s3_key = %s,
                            width = COALESCE(width, %s),
                            height = COALESCE(height, %s)
                        WHERE id = %s
                    ''', (thumb_key, full_w, full_h, row['id']))
                conn.commit()
                processed += 1
            except Exception as e:
                conn.rollback()
                failed += 1
                if len(errors) < 5:
                    errors.append(f'id={row["id"]}: {e}')

        with conn.cursor() as cur:
            cur.execute(f'''
                SELECT COUNT(*) FROM {schema}.photo_bank
                WHERE thumbnail_s3_key IS NULL
                  AND (is_trashed IS NULL OR is_trashed = false)
                  AND (is_video IS NULL OR is_video = false)
                  AND s3_key IS NOT NULL
            ''')
            remaining = cur.fetchone()[0]
    finally:
        conn.close()

    return {
        'statusCode': 200,
        'headers': cors,
        'body': json.dumps({
            'processed': processed,
            'failed': failed,
            'skipped_raw': skipped_raw,
            'remaining': remaining,
            'errors': errors,
        }),
        'isBase64Encoded': False,
    }