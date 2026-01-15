import json
import os
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
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'GET':
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
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            region_name='ru-central1',
            aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
            aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
            config=Config(signature_version='s3v4')
        )
        
        presigned_url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': 'foto-mix',
                'Key': s3_key
            },
            ExpiresIn=3600
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'download_url': presigned_url
            }),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
