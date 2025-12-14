import json
import os
from typing import Dict, Any
import psycopg2
import boto3
from botocore.client import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Confirm file upload and save metadata to database
    Args: event with httpMethod, body (userId, key, originalFilename)
    Returns: JSON with file metadata
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
    s3_key: str = body_data.get('key')
    original_filename: str = body_data.get('originalFilename', '')
    
    if not user_id or not s3_key:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'userId and key are required'})
        }
    
    s3_client = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        config=Config(signature_version='s3v4')
    )
    
    try:
        head_response = s3_client.head_object(Bucket='files', Key=s3_key)
        size_bytes = head_response['ContentLength']
        content_type = head_response.get('ContentType', 'application/octet-stream')
        checksum = head_response.get('ETag', '').strip('"')
    except s3_client.exceptions.NoSuchKey:
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'File not found in storage'})
        }
    
    dsn = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(dsn)
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO user_files (owner_user_id, s3_key, size_bytes, content_type, original_filename, checksum, status)
            VALUES (%s, %s, %s, %s, %s, %s, 'uploaded')
            RETURNING id, created_at
            """,
            (user_id, s3_key, size_bytes, content_type, original_filename, checksum)
        )
        file_id, created_at = cur.fetchone()
        conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'id': file_id,
                'key': s3_key,
                'sizeBytes': size_bytes,
                'contentType': content_type,
                'createdAt': created_at.isoformat()
            })
        }
    except psycopg2.IntegrityError:
        conn.rollback()
        return {
            'statusCode': 409,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'File already registered'})
        }
    finally:
        conn.close()