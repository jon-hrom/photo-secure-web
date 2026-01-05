import json
import os
from typing import Dict, Any
import psycopg2
import boto3
from botocore.client import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Генерирует pre-signed URL для скачивания файла (с проверкой владельца)
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
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
    s3_key: str = query_params.get('key', '')
    user_id_str: str = query_params.get('userId', '')
    
    if not s3_key or not user_id_str:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'key and userId are required'}),
            'isBase64Encoded': False
        }
    
    try:
        user_id = int(user_id_str)
    except ValueError:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'userId must be a number'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(dsn)
    try:
        cur = conn.cursor()
        
        # Проверяем владельца файла в photo_bank
        cur.execute(
            "SELECT user_id FROM t_p28211681_photo_secure_web.photo_bank WHERE s3_key = %s",
            (s3_key,)
        )
        result = cur.fetchone()
        
        if not result:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'File not found'}),
                'isBase64Encoded': False
            }
        
        owner_id = result[0]
        
        if owner_id != user_id:
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Access denied'}),
                'isBase64Encoded': False
            }
    finally:
        conn.close()
    
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
        'isBase64Encoded': False,
        'body': json.dumps({
            'url': presigned_url,
            'expiresIn': 3600
        })
    }
