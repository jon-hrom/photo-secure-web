import json
import os
from typing import Dict, Any, List
import psycopg2
from uuid import uuid4
import boto3
from botocore.client import Config

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Handle multipart upload operations (initiate, get part URLs, complete, abort)
    Args: event with httpMethod, body (action, userId, key, uploadId, parts, etc)
    Returns: JSON with uploadId, part URLs, or completion status
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
    action: str = body_data.get('action')
    user_id: int = body_data.get('userId')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'userId is required'})
        }
    
    s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        region_name='ru-central1',
        config=Config(signature_version='s3v4')
    )
    
    if action == 'initiate':
        content_type: str = body_data.get('contentType', 'image/jpeg')
        ext: str = body_data.get('ext', 'jpg')
        planned_size: int = body_data.get('plannedSize', 0)
        
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
        
        file_uuid = str(uuid4())
        s3_key = f"incoming/{user_id}/{file_uuid}.{ext}"
        
        response = s3_client.create_multipart_upload(
            Bucket='foto-mix',
            Key=s3_key,
            ContentType=content_type,
            Metadata={'user-id': str(user_id)}
        )
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'uploadId': response['UploadId'],
                'key': s3_key
            })
        }
    
    elif action == 'getPartUrls':
        s3_key: str = body_data.get('key')
        upload_id: str = body_data.get('uploadId')
        part_count: int = body_data.get('partCount', 1)
        
        if not s3_key or not upload_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'key and uploadId are required'})
            }
        
        part_urls: List[Dict[str, Any]] = []
        for part_number in range(1, part_count + 1):
            presigned_url = s3_client.generate_presigned_url(
                'upload_part',
                Params={
                    'Bucket': 'foto-mix',
                    'Key': s3_key,
                    'UploadId': upload_id,
                    'PartNumber': part_number
                },
                ExpiresIn=900
            )
            part_urls.append({
                'partNumber': part_number,
                'url': presigned_url
            })
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'partUrls': part_urls})
        }
    
    elif action == 'complete':
        s3_key: str = body_data.get('key')
        upload_id: str = body_data.get('uploadId')
        parts: List[Dict[str, Any]] = body_data.get('parts', [])
        
        if not s3_key or not upload_id or not parts:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'key, uploadId, and parts are required'})
            }
        
        multipart_upload = {
            'Parts': [
                {'PartNumber': part['partNumber'], 'ETag': part['etag']}
                for part in parts
            ]
        }
        
        s3_client.complete_multipart_upload(
            Bucket='foto-mix',
            Key=s3_key,
            UploadId=upload_id,
            MultipartUpload=multipart_upload
        )
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'success': True, 'key': s3_key})
        }
    
    elif action == 'abort':
        s3_key: str = body_data.get('key')
        upload_id: str = body_data.get('uploadId')
        
        if not s3_key or not upload_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'key and uploadId are required'})
            }
        
        s3_client.abort_multipart_upload(
            Bucket='foto-mix',
            Key=s3_key,
            UploadId=upload_id
        )
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'isBase64Encoded': False,
            'body': json.dumps({'success': True})
        }
    
    return {
        'statusCode': 400,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Invalid action. Use: initiate, getPartUrls, complete, abort'})
    }
