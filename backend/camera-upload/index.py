import json
import boto3
import os
import base64
from datetime import datetime
import mimetypes
from botocore.client import Config

s3 = boto3.client('s3',
    endpoint_url='https://storage.yandexcloud.net',
    region_name='ru-central1',
    aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
    aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
    config=Config(signature_version='s3v4')
)
bucket = 'foto-mix'

def handler(event: dict, context) -> dict:
    '''API для загрузки фото/видео с камеры прямо на Yandex S3'''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }

    try:
        body = json.loads(event.get('body', '{}'))
        
        user_id = body.get('user_id')
        file_base64 = body.get('file')
        file_name = body.get('file_name', 'camera_photo.jpg')
        file_type = body.get('file_type', 'image/jpeg')
        folder_id = body.get('folder_id', 'default')

        if not user_id or not file_base64:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing user_id or file'})
            }

        file_data = base64.b64decode(file_base64)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        extension = mimetypes.guess_extension(file_type) or '.jpg'
        if extension == '.jpe':
            extension = '.jpg'
        
        s3_key = f'camera/{user_id}/{folder_id}/{timestamp}_{file_name}'
        
        s3.put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=file_data,
            ContentType=file_type
        )
        
        cdn_url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket, 'Key': s3_key},
            ExpiresIn=86400
        )
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                's3_key': s3_key,
                'cdn_url': cdn_url,
                'file_size': len(file_data)
            })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
