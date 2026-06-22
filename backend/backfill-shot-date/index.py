'''
Business: Заполняет shot_date (дату и время съёмки из EXIF) для уже загруженных фото,
у которых это поле пустое. Особенно для RAW (CR2/NEF/ARW), т.к. их EXIF читается только
через специализированные библиотеки. Без shot_date не работает сортировка "По времени".
Args: event с httpMethod, body (user_id, folder_id опционально, limit опционально)
Returns: HTTP ответ со статистикой обработки
'''
import json
import os
from io import BytesIO
from datetime import datetime
import boto3
from botocore.config import Config
import psycopg2
from psycopg2.extras import RealDictCursor
import exifread

RAW_EXT = ('.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2',
           '.dng', '.orf', '.rw2', '.raf', '.pef', '.raw', '.rwl', '.iiq', '.3fr')


def _parse_exif_datetime(value: str):
    value = str(value).strip()
    for fmt in ('%Y:%m:%d %H:%M:%S', '%Y-%m-%d %H:%M:%S'):
        try:
            return datetime.strptime(value, fmt)
        except Exception:
            continue
    return None


def extract_shot_date(raw_bytes: bytes):
    '''Читает дату/время съёмки из EXIF (работает и для CR2/NEF/ARW через exifread).'''
    try:
        tags = exifread.process_file(BytesIO(raw_bytes), details=False, stop_tag='DateTimeOriginal')
        for key in ('EXIF DateTimeOriginal', 'EXIF DateTimeDigitized', 'Image DateTime'):
            if key in tags:
                dt = _parse_exif_datetime(str(tags[key]))
                if dt:
                    return dt
    except Exception as e:
        print(f'[BACKFILL] exifread failed: {e}')

    # Fallback: rawpy — берём встроенный thumbnail и читаем его EXIF
    try:
        import rawpy
        with rawpy.imread(BytesIO(raw_bytes)) as raw:
            thumb = raw.extract_thumb()
            if thumb.format == rawpy.ThumbFormat.JPEG:
                tags = exifread.process_file(BytesIO(thumb.data), details=False)
                for key in ('EXIF DateTimeOriginal', 'EXIF DateTimeDigitized', 'Image DateTime'):
                    if key in tags:
                        dt = _parse_exif_datetime(str(tags[key]))
                        if dt:
                            return dt
    except Exception as e:
        print(f'[BACKFILL] rawpy fallback failed: {e}')

    return None


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': ''
        }

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        body = {}

    qs = event.get('queryStringParameters') or {}

    user_id = body.get('user_id') or qs.get('user_id') or event.get('headers', {}).get('X-User-Id')
    folder_id = body.get('folder_id') or qs.get('folder_id')
    limit = int(body.get('limit') or qs.get('limit') or 200)

    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'user_id required'}),
            'isBase64Encoded': False
        }

    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        region_name='ru-central1',
        config=Config(signature_version='s3v4', connect_timeout=10, read_timeout=60)
    )

    conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
    processed = 0
    updated = 0
    failed = 0

    try:
        where = 'shot_date IS NULL AND is_trashed = FALSE AND user_id = %s'
        params = [int(user_id)]
        if folder_id:
            where += ' AND folder_id = %s'
            params.append(int(folder_id))
        params.append(limit)

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT id, s3_key, file_name
                FROM photo_bank
                WHERE {where}
                ORDER BY id
                LIMIT %s
            ''', params)
            rows = cur.fetchall()

        for row in rows:
            processed += 1
            try:
                obj = s3_client.get_object(Bucket='foto-mix', Key=row['s3_key'])
                raw_bytes = obj['Body'].read()
                shot_date = extract_shot_date(raw_bytes)
                del raw_bytes
                if shot_date:
                    with conn.cursor() as cur:
                        cur.execute(
                            'UPDATE photo_bank SET shot_date = %s WHERE id = %s',
                            (shot_date, row['id'])
                        )
                        conn.commit()
                    updated += 1
                else:
                    failed += 1
                    print(f'[BACKFILL] no EXIF date: id={row["id"]} {row["file_name"]}')
            except Exception as e:
                failed += 1
                print(f'[BACKFILL] error id={row["id"]}: {e}')

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'processed': processed,
                'updated': updated,
                'failed': failed,
                'remaining_hint': processed >= limit
            }),
            'isBase64Encoded': False
        }
    finally:
        conn.close()