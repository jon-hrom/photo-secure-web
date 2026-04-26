'''Генерирует JPEG-превью для RAW фотографий через полный демозаик rawpy.

КРИТИЧНО: для CR2/NEF/ARW/DNG ВСЕГДА используем postprocess() c camera matrix,
а не встроенный JPEG-превью камеры (он зашит со своим WB и S-кривой и часто
даёт красный пере-контраст). Это даёт цвет/тоны как в Capture One/Lightroom.
'''
import json
import os
import time
import boto3
from io import BytesIO
from PIL import Image, ImageOps
import rawpy
import psycopg2
from psycopg2.extras import RealDictCursor

# Только эти RAW-форматы заведомо умеют postprocess через libraw.
# Для них ВСЕГДА делаем полноценный демозаик.
TRUE_RAW_EXT = ('.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2',
                '.dng', '.orf', '.rw2', '.raf', '.pef', '.raw', '.rwl', '.iiq', '.3fr')


def is_true_raw(file_name: str) -> bool:
    name = (file_name or '').lower()
    return any(name.endswith(ext) for ext in TRUE_RAW_EXT)


def postprocess_raw_capture_one_style(raw_data: bytes, file_name: str) -> Image.Image:
    """Полный демозаик с настройками, имитирующими Capture One:
    - camera WB (как поставила камера, но с матрицей)
    - AHD demosaic — самый качественный, минимум артефактов
    - sRGB output
    - 16-bit обработка → конверсия в 8-bit с гаммой
    - мягкий highlight recovery (мода 1 = blend)
    - без auto-bright чтобы не задирать экспозицию
    - bright=1.0, gamma sRGB (2.4, 12.92) — стандарт
    """
    is_dng = file_name.lower().endswith('.dng')

    with rawpy.imread(BytesIO(raw_data)) as raw:
        params = dict(
            use_camera_wb=True,                      # WB по матрице камеры
            demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD,
            output_color=rawpy.ColorSpace.sRGB,      # sRGB для веба
            output_bps=8,
            # Auto-bright ВКЛ + лёгкий лимит на пересвет, как в Capture One —
            # без него Canon CR2 выходят сильно тёмными.
            no_auto_bright=False,
            auto_bright_thr=0.001,                   # 0.1% пикселей в пересвете — мягко
            bright=1.0,
            gamma=(2.222, 4.5),                      # BT.709/Rec.709 — мягче и натуральнее в тенях, чем sRGB
            highlight_mode=rawpy.HighlightMode.Blend,
            # user_flip=None → libraw применяет ориентацию из EXIF самостоятельно
            # (этого требуют все вертикальные CR2). user_flip=0 принудительно ОТКЛЮЧАЕТ поворот.
            half_size=True,                          # 25MP → 12MP, для лимита памяти 256MB
            fbdd_noise_reduction=rawpy.FBDDNoiseReductionMode.Light,
        )
        if is_dng:
            params['bright'] = 1.1
        rgb = raw.postprocess(**params)

    return Image.fromarray(rgb)


def try_extract_embedded_jpeg(raw_data):
    """Fallback: извлекает встроенный JPEG-превью из RAW.
    Используется ТОЛЬКО если postprocess упал (например, неизвестная камера).
    """
    try:
        with rawpy.imread(BytesIO(raw_data)) as raw:
            try:
                thumb = raw.extract_thumb()
            except rawpy.LibRawNoThumbnailError:
                return None
            if thumb.format == rawpy.ThumbFormat.JPEG:
                return Image.open(BytesIO(thumb.data))
            elif thumb.format == rawpy.ThumbFormat.BITMAP:
                return Image.fromarray(thumb.data)
    except Exception as e:
        print(f'[THUMBNAIL] Embedded extract failed: {e}')
    return None


def process_single_thumbnail(conn, s3_client, photo_id, force=False):
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
        
        if photo['thumbnail_s3_key'] and not force:
            return {'photo_id': photo_id, 'skipped': True, 'reason': 'already exists', 'thumbnail_key': photo['thumbnail_s3_key']}
    
    print(f'[THUMBNAIL] Downloading: {photo["s3_key"]}')
    
    response = s3_client.get_object(Bucket='foto-mix', Key=photo['s3_key'])
    raw_data = response['Body'].read()
    dl_time = time.time() - start
    
    print(f'[THUMBNAIL] Downloaded {len(raw_data)//1024//1024}MB in {dl_time:.1f}s, converting...')

    img = None
    source = None
    file_name = photo['file_name'] or ''

    # Для RAW — ВСЕГДА полный демозаик с матрицей камеры (Capture One-style),
    # а не встроенный JPEG-превью (он часто красный/перекрученный).
    if is_true_raw(file_name):
        try:
            img = postprocess_raw_capture_one_style(raw_data, file_name)
            source = 'postprocess(C1-style)'
        except Exception as e:
            print(f'[THUMBNAIL] postprocess failed ({e}), fallback to embedded JPEG')
            img = try_extract_embedded_jpeg(raw_data)
            source = 'embedded(fallback)'
    else:
        # Не RAW (например прислали JPEG с RAW-расширением .raw в имени) — берём embedded
        img = try_extract_embedded_jpeg(raw_data)
        source = 'embedded'
        if img is None:
            img = postprocess_raw_capture_one_style(raw_data, file_name)
            source = 'postprocess(fallback)'

    del raw_data

    if img is None:
        raise RuntimeError('Failed to decode RAW: both postprocess and embedded JPEG returned None')

    try:
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        print(f'[THUMBNAIL] exif_transpose failed: {e}')

    # Превью отдаём как с камеры (camera WB + лёгкое auto-bright libraw),
    # БЕЗ цветокора. Пресет применяется только на этапе ретуши.
    img.thumbnail((2400, 2400), Image.Resampling.LANCZOS)

    jpeg_buffer = BytesIO()
    img.save(jpeg_buffer, format='JPEG', quality=92, subsampling=0)
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
        force = bool(body.get('force', False))
        
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
                result = process_single_thumbnail(conn, s3_client, photo_id, force=force)
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