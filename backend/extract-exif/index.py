import json
import os
from typing import Dict, Any
import boto3
from botocore.client import Config
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import io
from datetime import datetime
import rawpy

S3_BUCKET = 'files'
S3_ENDPOINT = 'https://bucket.poehali.dev'

def get_s3_client():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        config=Config(signature_version='s3v4')
    )

def extract_exif_from_raw(raw_data: bytes) -> Dict[str, Any]:
    '''Извлекает EXIF из RAW файла используя rawpy'''
    try:
        with rawpy.imread(io.BytesIO(raw_data)) as raw:
            # Получаем встроенное JPEG превью с EXIF
            try:
                thumb = raw.extract_thumb()
                if thumb.format == rawpy.ThumbFormat.JPEG:
                    # Извлекаем EXIF из встроенного JPEG
                    return extract_exif_from_jpeg(thumb.data)
            except:
                pass
            
            # Если превью нет, берём базовые данные из RAW
            exif_data = {}
            exif_data['ImageWidth'] = raw.sizes.width
            exif_data['ImageHeight'] = raw.sizes.height
            exif_data['Format'] = 'RAW'
            return exif_data
    except Exception as e:
        print(f'Error extracting EXIF from RAW: {e}')
        return {}

def extract_exif_from_jpeg(image_data: bytes) -> Dict[str, Any]:
    '''Извлекает EXIF из JPEG файла используя Pillow'''
    try:
        image = Image.open(io.BytesIO(image_data))
        
        exif_data = {}
        info = image.getexif()
        
        if not info:
            return {}
        
        for tag_id, value in info.items():
            tag = TAGS.get(tag_id, tag_id)
            
            if tag == 'GPSInfo':
                gps_data = {}
                for gps_tag_id, gps_value in value.items():
                    gps_tag = GPSTAGS.get(gps_tag_id, gps_tag_id)
                    gps_data[gps_tag] = gps_value
                exif_data['GPSInfo'] = gps_data
            elif tag == 'DateTime' or tag == 'DateTimeOriginal' or tag == 'DateTimeDigitized':
                try:
                    dt = datetime.strptime(value, '%Y:%m:%d %H:%M:%S')
                    exif_data[tag] = dt.isoformat()
                except:
                    exif_data[tag] = str(value)
            elif isinstance(value, bytes):
                try:
                    exif_data[tag] = value.decode('utf-8', errors='ignore')
                except:
                    exif_data[tag] = str(value)
            else:
                exif_data[tag] = str(value)
        
        width, height = image.size
        exif_data['ImageWidth'] = width
        exif_data['ImageHeight'] = height
        exif_data['Format'] = image.format
        
        return exif_data
    except Exception as e:
        print(f'Error extracting EXIF from JPEG: {e}')
        return {}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Извлекает EXIF данные из фото в S3
    
    POST /extract-exif
    Body: { "s3_key": "uploads/123/..." }
    '''
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        body_str = event.get('body') or '{}'
        body = json.loads(body_str) if body_str else {}
        s3_key = body.get('s3_key')
        
        if not s3_key:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 's3_key required'}),
                'isBase64Encoded': False
            }
        
        s3_client = get_s3_client()
        
        response = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        image_data = response['Body'].read()
        
        # Определяем тип файла по расширению
        file_ext = s3_key.lower().split('.')[-1]
        raw_extensions = ['cr2', 'nef', 'arw', 'dng', 'orf', 'rw2', 'raw']
        
        if file_ext in raw_extensions:
            print(f'[EXIF] Processing RAW file: {s3_key}')
            exif_data = extract_exif_from_raw(image_data)
        else:
            print(f'[EXIF] Processing regular image: {s3_key}')
            exif_data = extract_exif_from_jpeg(image_data)
        
        result = {
            'success': True,
            's3_key': s3_key,
            'exif': exif_data,
            'file_size': len(image_data)
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(result),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'Error: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }