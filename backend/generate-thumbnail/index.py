'''Генерирует JPEG-превью для RAW фотографий'''
import json
import os
import time
import boto3
from io import BytesIO
from PIL import Image, ImageOps
import rawpy
import psycopg2
from psycopg2.extras import RealDictCursor

MIN_PREVIEW_SIZE = 800

def try_extract_embedded_jpeg(raw_data):
    """Извлекает встроенный JPEG-превью из RAW если он достаточного размера"""
    try:
        with rawpy.imread(BytesIO(raw_data)) as raw:
            try:
                thumb = raw.extract_thumb()
            except rawpy.LibRawNoThumbnailError:
                print('[THUMBNAIL] No embedded thumbnail found')
                return None
            
            if thumb.format == rawpy.ThumbFormat.JPEG:
                img = Image.open(BytesIO(thumb.data))
                w, h = img.size
                print(f'[THUMBNAIL] Embedded JPEG found: {w}x{h}')
                if min(w, h) >= MIN_PREVIEW_SIZE:
                    return img
                else:
                    print(f'[THUMBNAIL] Embedded JPEG too small ({w}x{h}), will postprocess')
                    return None
            elif thumb.format == rawpy.ThumbFormat.BITMAP:
                img = Image.fromarray(thumb.data)
                w, h = img.size
                print(f'[THUMBNAIL] Embedded bitmap found: {w}x{h}')
                if min(w, h) >= MIN_PREVIEW_SIZE:
                    return img
                return None
    except Exception as e:
        print(f'[THUMBNAIL] Embedded extract failed: {e}')
    return None


def postprocess_raw(raw_data, file_name):
    """Конвертирует RAW через postprocess с учётом формата"""
    is_dng = file_name.lower().endswith('.dng')
    
    with rawpy.imread(BytesIO(raw_data)) as raw:
        if is_dng:
            rgb = raw.postprocess(
                use_camera_wb=True,
                half_size=True,
                no_auto_bright=False,
                output_bps=8,
                bright=1.2
            )
        else:
            rgb = raw.postprocess(
                use_camera_wb=True,
                half_size=True,
                no_auto_bright=True,
                output_bps=8
            )
    
    return Image.fromarray(rgb)


def process_single_thumbnail(conn, s3_client, photo_id):
    start = time.time()
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('''
            SELECT id, s3_key, user_id, file_name, thumbnail_s3_key
            FROM photo_bank
            WHERE id = %s AND is_trashed = FALSE
        ''', (photo_id,))
        photo = cur.fetchone()
        
        if not photo:
            return {'photo_id': photo_id, 'skipped': True, 'reason': 'not found'}
        
        if photo['thumbnail_s3_key']:
            return {'photo_id': photo_id, 'skipped': True, 'reason': 'already exists', 'thumbnail_key': photo['thumbnail_s3_key']}
    
    print(f'[THUMBNAIL] Downloading: {photo["s3_key"]}')
    
    response = s3_client.get_object(Bucket='foto-mix', Key=photo['s3_key'])
    raw_data = response['Body'].read()
    dl_time = time.time() - start
    
    print(f'[THUMBNAIL] Downloaded {len(raw_data)//1024//1024}MB in {dl_time:.1f}s, converting...')
    
    img = try_extract_embedded_jpeg(raw_data)
    source = 'embedded'
    
    if img is None:
        print(f'[THUMBNAIL] Fallback to postprocess for {photo["file_name"]}')
        img = postprocess_raw(raw_data, photo['file_name'])
        source = 'postprocess'
    
    del raw_data
    
    try:
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        print(f'[THUMBNAIL] exif_transpose failed: {e}')
    
    img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
    
    jpeg_buffer = BytesIO()
    img.save(jpeg_buffer, format='JPEG', quality=85)
    jpeg_buffer.seek(0)
    del img
    
    print(f'[THUMBNAIL] Generated from {source}')
    
    thumbnail_key = photo['s3_key'].rsplit('.', 1)[0] + '_thumb.jpg'
    
    s3_client.put_object(
        Bucket='foto-mix',
        Key=thumbnail_key,
        Body=jpeg_buffer.getvalue(),
        ContentType='image/jpeg'
    )
    
    total_time = time.time() - start
    print(f'[THUMBNAIL] Done photo_id={photo_id} in {total_time:.1f}s (download: {dl_time:.1f}s)')
    
    with conn.cursor() as cur:
        cur.execute('''
            UPDATE photo_bank 
            SET thumbnail_s3_key = %s, is_raw = TRUE
            WHERE id = %s
        ''', (thumbnail_key, photo_id))
        conn.commit()
    
    return {'photo_id': photo_id, 'thumbnail_key': thumbnail_key, 'time': round(total_time, 1)}


def handler(event: dict, context) -> dict:
    '''Генерирует JPEG-превью из RAW файлов (CR2, NEF, ARW, DNG и др.)'''
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body_str = event.get('body', '{}')
        if not body_str or body_str.strip() == '':
            body = {}
        else:
            body = json.loads(body_str)
        
        photo_ids = body.get('photo_ids', [])
        single_id = body.get('photo_id')
        if single_id:
            photo_ids = [single_id]
        
        if not photo_ids:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'photo_id or photo_ids required'}),
                'isBase64Encoded': False
            }
        
        from botocore.config import Config
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
            aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
            region_name='ru-central1',
            config=Config(
                signature_version='s3v4',
                connect_timeout=10,
                read_timeout=60
            )
        )
        
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        results = []
        
        for photo_id in photo_ids:
            try:
                result = process_single_thumbnail(conn, s3_client, photo_id)
                results.append(result)
            except Exception as e:
                print(f'[THUMBNAIL_ERROR] photo_id={photo_id}: {str(e)}')
                results.append({'photo_id': photo_id, 'error': str(e)})
        
        conn.close()
        
        successful = [r for r in results if 'thumbnail_key' in r]
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'processed': len(results),
                'successful': len(successful),
                'results': results
            }),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'[THUMBNAIL_ERROR] {str(e)}')
        import traceback
        traceback.print_exc()
        
        if 'conn' in locals():
            conn.close()
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }