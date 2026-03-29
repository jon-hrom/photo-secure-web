import json
import os
import io
import psycopg2
import boto3
from botocore.client import Config
from PIL import Image
import pillow_heif

SCHEMA = 't_p28211681_photo_secure_web'
S3_ENDPOINT = 'https://storage.yandexcloud.net'
S3_BUCKET = 'foto-mix'

pillow_heif.register_heif_opener()


def get_s3():
    return boto3.client('s3',
        endpoint_url=S3_ENDPOINT,
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4'))


def handler(event: dict, context) -> dict:
    """Конвертация HEIC фото в JPEG на сервере"""
    method = event.get('httpMethod', 'GET')
    headers = event.get('headers', {})
    origin = headers.get('origin') or headers.get('Origin') or '*'
    cors = {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if method != 'POST':
        return {'statusCode': 405, 'headers': cors, 'body': json.dumps({'error': 'Method not allowed'})}

    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {'statusCode': 500, 'headers': cors, 'body': json.dumps({'error': 'DB not configured'})}

    data = json.loads(event.get('body', '{}'))
    action = data.get('action', 'convert_existing')

    if action == 'convert_existing':
        result = convert_existing_heic(dsn)
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(result)}

    if action == 'convert_single':
        s3_key = data.get('s3_key')
        if not s3_key:
            return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 's3_key required'})}
        result = convert_single_heic(dsn, s3_key)
        return {'statusCode': 200, 'headers': cors, 'body': json.dumps(result)}

    return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'Unknown action'})}


def convert_heic_bytes_to_jpeg(heic_data):
    img = Image.open(io.BytesIO(heic_data))
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=92)
    buf.seek(0)
    return buf.getvalue()


def convert_existing_heic(dsn):
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    cur.execute(
        f"""SELECT id, file_name, s3_key, s3_url
        FROM {SCHEMA}.client_upload_photos
        WHERE (file_name ILIKE '%%.heic' OR file_name ILIKE '%%.heif'
               OR s3_key ILIKE '%%.heic' OR s3_key ILIKE '%%.heif')
        ORDER BY id"""
    )
    rows = cur.fetchall()

    if not rows:
        cur.close()
        conn.close()
        return {'converted': 0, 'message': 'No HEIC photos found'}

    s3 = get_s3()
    converted = 0
    errors = []

    for row in rows:
        photo_id, file_name, s3_key, s3_url = row
        try:
            response = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
            heic_data = response['Body'].read()

            jpeg_data = convert_heic_bytes_to_jpeg(heic_data)

            new_s3_key = s3_key.rsplit('.', 1)[0] + '.jpg'
            s3.put_object(
                Bucket=S3_BUCKET,
                Key=new_s3_key,
                Body=jpeg_data,
                ContentType='image/jpeg'
            )

            new_s3_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{new_s3_key}"
            new_file_name = file_name.rsplit('.', 1)[0] + '.jpg'

            cur.execute(
                f"""UPDATE {SCHEMA}.client_upload_photos
                SET s3_key = %s, s3_url = %s, file_name = %s, content_type = 'image/jpeg', file_size = %s
                WHERE id = %s""",
                (new_s3_key, new_s3_url, new_file_name, len(jpeg_data), photo_id)
            )
            conn.commit()

            try:
                s3.delete_object(Bucket=S3_BUCKET, Key=s3_key)
            except:
                pass

            converted += 1
            print(f'[HEIC_CONVERT] Converted photo {photo_id}: {file_name} -> {new_file_name}')

        except Exception as e:
            errors.append({'photo_id': photo_id, 'file_name': file_name, 'error': str(e)})
            print(f'[HEIC_CONVERT] Error converting photo {photo_id}: {e}')

    cur.close()
    conn.close()

    return {'converted': converted, 'errors': errors, 'total_found': len(rows)}


def convert_single_heic(dsn, s3_key):
    s3 = get_s3()
    try:
        response = s3.get_object(Bucket=S3_BUCKET, Key=s3_key)
        heic_data = response['Body'].read()
    except Exception as e:
        return {'error': f'Failed to download: {e}'}

    jpeg_data = convert_heic_bytes_to_jpeg(heic_data)

    new_s3_key = s3_key.rsplit('.', 1)[0] + '.jpg'
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=new_s3_key,
        Body=jpeg_data,
        ContentType='image/jpeg'
    )

    try:
        s3.delete_object(Bucket=S3_BUCKET, Key=s3_key)
    except:
        pass

    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    cur.execute(
        f"""UPDATE {SCHEMA}.client_upload_photos
        SET s3_key = %s, s3_url = %s,
            file_name = REPLACE(REPLACE(file_name, '.heic', '.jpg'), '.HEIC', '.jpg'),
            content_type = 'image/jpeg', file_size = %s
        WHERE s3_key = %s""",
        (new_s3_key, f"https://storage.yandexcloud.net/{S3_BUCKET}/{new_s3_key}",
         len(jpeg_data), s3_key)
    )
    conn.commit()
    cur.close()
    conn.close()

    return {'converted': True, 'new_s3_key': new_s3_key, 'size': len(jpeg_data)}
