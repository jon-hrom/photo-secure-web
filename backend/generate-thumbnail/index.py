'''Генерирует JPEG-превью для RAW фотографий'''
import json
import os
import boto3
from io import BytesIO
from PIL import Image
import rawpy
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: dict, context) -> dict:
    '''Генерирует JPEG-превью из RAW файлов (CR2, NEF, ARW и др.)'''
    
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
        photo_id = body.get('photo_id')
        
        if not photo_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'photo_id required'}),
                'isBase64Encoded': False
            }
        
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('''
                SELECT id, s3_key, user_id, file_name, thumbnail_s3_key
                FROM photo_bank
                WHERE id = %s AND is_trashed = FALSE
            ''', (photo_id,))
            photo = cur.fetchone()
            
            if not photo:
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Photo not found'}),
                    'isBase64Encoded': False
                }
            
            if photo['thumbnail_s3_key']:
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'message': 'Thumbnail already exists', 'thumbnail_key': photo['thumbnail_s3_key']}),
                    'isBase64Encoded': False
                }
        
        s3_client = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
        )
        
        print(f'[THUMBNAIL] Downloading RAW file: {photo["s3_key"]}')
        
        # Скачиваем из Yandex bucket (файлы загружаются через mobile-upload)
        from botocore.config import Config
        yandex_s3 = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
            aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
            region_name='ru-central1',
            config=Config(signature_version='s3v4')
        )
        response = yandex_s3.get_object(Bucket='foto-mix', Key=photo['s3_key'])
        raw_data = response['Body'].read()
        
        print(f'[THUMBNAIL] Downloaded {len(raw_data)} bytes, converting to JPEG')
        
        # Конвертируем RAW в JPEG
        with rawpy.imread(BytesIO(raw_data)) as raw:
            rgb = raw.postprocess(
                use_camera_wb=True,
                half_size=True,  # Уменьшаем размер для превью
                no_auto_bright=False,
                output_bps=8
            )
        
        # Создаем PIL Image и сжимаем до 1920px по длинной стороне
        img = Image.fromarray(rgb)
        img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
        
        # Сохраняем в JPEG с хорошим качеством
        jpeg_buffer = BytesIO()
        img.save(jpeg_buffer, format='JPEG', quality=85, optimize=True)
        jpeg_buffer.seek(0)
        
        # Загружаем превью в Yandex S3 (туда же, где оригинал)
        thumbnail_key = photo['s3_key'].rsplit('.', 1)[0] + '_thumb.jpg'
        
        yandex_s3.put_object(
            Bucket='foto-mix',
            Key=thumbnail_key,
            Body=jpeg_buffer.getvalue(),
            ContentType='image/jpeg',
            Metadata={
                'original-key': photo['s3_key'],
                'photo-id': str(photo_id)
            }
        )
        
        print(f'[THUMBNAIL] Uploaded thumbnail: {thumbnail_key}')
        
        # Обновляем БД
        with conn.cursor() as cur:
            cur.execute('''
                UPDATE photo_bank 
                SET thumbnail_s3_key = %s, is_raw = TRUE
                WHERE id = %s
            ''', (thumbnail_key, photo_id))
            conn.commit()
        
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'thumbnail_key': thumbnail_key,
                'original_key': photo['s3_key']
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