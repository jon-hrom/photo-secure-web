import json
import os
import base64
from typing import Dict, Any
import boto3
from botocore.client import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Прокси для скачивания фото из публичной галереи (обход CORS)
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method not in ['GET', 'HEAD']:
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    query_params = event.get('queryStringParameters') or {}
    s3_key: str = query_params.get('s3_key', '')
    
    if not s3_key:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 's3_key parameter is required'}),
            'isBase64Encoded': False
        }
    
    try:
        # Пробуем сначала из Yandex Cloud (foto-mix)
        yc_error = None
        try:
            s3_client_yc = boto3.client(
                's3',
                endpoint_url='https://storage.yandexcloud.net',
                region_name='ru-central1',
                aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
                aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
                config=Config(signature_version='s3v4')
            )
            
            response = s3_client_yc.get_object(Bucket='foto-mix', Key=s3_key)
            file_content = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
        except Exception as e:
            yc_error = str(e)
            # Если не нашли в Yandex Cloud, пробуем проектный bucket
            s3_client_project = boto3.client(
                's3',
                endpoint_url='https://bucket.poehali.dev',
                aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
            )
            
            response = s3_client_project.get_object(Bucket='files', Key=s3_key)
            file_content = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
        
        # Извлекаем имя файла из s3_key
        filename = s3_key.split('/')[-1] if '/' in s3_key else s3_key
        
        # Для HEAD запроса возвращаем только заголовки
        if method == 'HEAD':
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': content_type,
                    'Access-Control-Allow-Origin': '*',
                    'Content-Length': str(len(file_content)),
                    'Content-Disposition': f'attachment; filename="{filename}"'
                },
                'body': '',
                'isBase64Encoded': False
            }
        
        # Для GET возвращаем файл как base64
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': content_type,
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': f'attachment; filename="{filename}"'
            },
            'body': base64.b64encode(file_content).decode('utf-8'),
            'isBase64Encoded': True
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }