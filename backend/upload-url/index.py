import json
import os
from typing import Dict, Any
import psycopg2
from uuid import uuid4
import boto3
from botocore.client import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Generate pre-signed PUT URL for uploading files to Yandex Object Storage
    Args: event with httpMethod, body (contentType, ext, plannedSize, userId)
    Returns: JSON with presigned URL and S3 key
    '''
    method: str = event.get('httpMethod', 'GET')
    
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
    
    body_data = json.loads(event.get('body', '{}'))
    user_id: int = body_data.get('userId')
    content_type: str = body_data.get('contentType', 'image/jpeg')
    ext: str = body_data.get('ext', 'jpg')
    planned_size: int = body_data.get('plannedSize', 0)
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'userId is required'})
        }
    
    quota_limit = 5 * 1024 * 1024 * 1024
    
    dsn = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(dsn)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT COALESCE(SUM(size_bytes), 0) FROM user_files WHERE owner_user_id = %s AND status IN ('uploaded', 'processing', 'processed')",
            (user_id,)
        )
        used_bytes = cur.fetchone()[0]
        
        if used_bytes + planned_size > quota_limit:
            left = quota_limit - used_bytes
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': f'Quota exceeded. Available: {left} bytes'})
            }
    finally:
        conn.close()
    
    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        region_name='ru-central1',
        config=Config(signature_version='s3v4')
    )
    
    file_uuid = str(uuid4())
    s3_key = f"incoming/{user_id}/{file_uuid}.{ext}"
    
    presigned_url = s3_client.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': 'foto-mix',
            'Key': s3_key,
            'ContentType': content_type,
            'Metadata': {
                'user-id': str(user_id)
            }
        },
        ExpiresIn=900
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
            'key': s3_key,
            'expiresIn': 900
        })
    }
