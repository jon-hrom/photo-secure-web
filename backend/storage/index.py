'''
Business: Storage management for photobook service - presigned URLs, file listing, deletion, and usage tracking with S3 REG.Cloud
Args: event with httpMethod, body, queryStringParameters, headers; context with request_id
Returns: HTTP response with statusCode, headers, body
'''

import json
import os
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

ENDPOINT = os.environ.get('REG_S3_ENDPOINT')
REGION = os.environ.get('REG_S3_REGION')
ACCESS_KEY = os.environ.get('REG_S3_ACCESS_KEY')
SECRET_KEY = os.environ.get('REG_S3_SECRET_KEY')
BUCKET = os.environ.get('REG_S3_BUCKET')
DATABASE_URL = os.environ.get('DATABASE_URL')

SCHEMA = 't_p28211681_photo_secure_web'
MAX_UPLOAD_MB = 25

s3_client = boto3.client(
    's3',
    region_name=REGION,
    aws_access_key_id=ACCESS_KEY,
    aws_secret_access_key=SECRET_KEY,
    endpoint_url=ENDPOINT,
    config=Config(signature_version='s3v4', s3={'addressing_style': 'path'})
)

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def bytes_to_gb(b: int) -> float:
    return b / (1024 ** 3)

def get_user_from_token(event: Dict[str, Any]) -> Dict[str, Any]:
    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    
    if not user_id:
        raise ValueError('Missing user authentication')
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT u.id, u.plan_id, u.custom_quota_gb, sp.quota_gb as plan_quota_gb
                FROM {SCHEMA}.users u
                LEFT JOIN {SCHEMA}.storage_plans sp ON u.plan_id = sp.id
                WHERE u.id = %s AND u.is_active = true
            ''', (user_id,))
            user = cur.fetchone()
            
            if not user:
                raise ValueError('User not found or inactive')
            
            cur.execute(f'''
                SELECT COALESCE(SUM(bytes), 0) as total_bytes
                FROM {SCHEMA}.storage_objects
                WHERE user_id = %s AND status = 'active'
            ''', (user_id,))
            usage = cur.fetchone()
            
            return {
                'id': user['id'],
                'plan_id': user['plan_id'],
                'custom_quota_gb': float(user['custom_quota_gb']) if user['custom_quota_gb'] else None,
                'plan_quota_gb': float(user['plan_quota_gb']) if user['plan_quota_gb'] else 5.0,
                'used_bytes': usage['total_bytes']
            }
    finally:
        conn.close()

def get_settings() -> Dict[str, str]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'SELECT key, value FROM {SCHEMA}.storage_settings')
            rows = cur.fetchall()
            return {row['key']: row['value'] for row in rows}
    finally:
        conn.close()

def presign_upload(event: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    filename = body.get('filename')
    mime_type = body.get('mimeType')
    size_bytes = body.get('sizeBytes')
    
    if not filename or not mime_type or not size_bytes:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing required fields: filename, mimeType, sizeBytes'})
        }
    
    settings = get_settings()
    allowed_mimes = settings.get('allowed_mime_types', '').split(',')
    max_upload_mb = int(settings.get('max_upload_mb', '25'))
    
    if mime_type not in allowed_mimes:
        return {
            'statusCode': 415,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Unsupported media type. Allowed: {", ".join(allowed_mimes)}'})
        }
    
    if size_bytes > max_upload_mb * 1024 * 1024:
        return {
            'statusCode': 413,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'File too large. Maximum: {max_upload_mb} MB'})
        }
    
    limit_gb = float(user['custom_quota_gb'] or user['plan_quota_gb'])
    used_gb = float(bytes_to_gb(user['used_bytes']))
    new_usage_gb = used_gb + bytes_to_gb(size_bytes)
    
    if new_usage_gb > limit_gb:
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'error': 'Storage quota exceeded',
                'used_gb': round(used_gb, 3),
                'limit_gb': limit_gb,
                'upgrade_required': True
            })
        }
    
    ext = os.path.splitext(filename)[1].lower() or '.bin'
    object_key = f'users/{user["id"]}/originals/{uuid.uuid4().hex}{ext}'
    
    try:
        url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET,
                'Key': object_key,
                'ContentType': mime_type,
                'ACL': 'private'
            },
            ExpiresIn=3600
        )
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.storage_objects (user_id, key, bytes, mime, status)
                    VALUES (%s, %s, %s, %s, 'pending')
                ''', (user['id'], object_key, size_bytes, mime_type))
                conn.commit()
        finally:
            conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'uploadUrl': url,
                'objectKey': object_key,
                'expiresIn': 3600
            })
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'S3 error: {str(e)}'})
        }

def confirm_upload(event: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    object_key = body.get('objectKey')
    
    if not object_key or not object_key.startswith(f'users/{user["id"]}/'):
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Forbidden'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                UPDATE {SCHEMA}.storage_objects
                SET status = 'active'
                WHERE key = %s AND user_id = %s AND status = 'pending'
            ''', (object_key, user['id']))
            conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True})
        }
    finally:
        conn.close()

def presign_download(event: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {})
    object_key = params.get('objectKey')
    
    if not object_key or not object_key.startswith(f'users/{user["id"]}/'):
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Forbidden'})
        }
    
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': BUCKET, 'Key': object_key},
            ExpiresIn=3600
        )
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'url': url, 'expiresIn': 3600})
        }
    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'S3 error: {str(e)}'})
        }

def list_files(event: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    params = event.get('queryStringParameters', {}) or {}
    limit = int(params.get('limit', '50'))
    offset = int(params.get('offset', '0'))
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT id, key, bytes, mime, created_at
                FROM {SCHEMA}.storage_objects
                WHERE user_id = %s AND status = 'active'
                ORDER BY created_at DESC
                LIMIT %s OFFSET %s
            ''', (user['id'], limit, offset))
            files = cur.fetchall()
            
            cur.execute(f'''
                SELECT COUNT(*) as total, COALESCE(SUM(bytes), 0) as total_bytes
                FROM {SCHEMA}.storage_objects
                WHERE user_id = %s AND status = 'active'
            ''', (user['id'],))
            stats = cur.fetchone()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'files': [dict(f) for f in files],
                    'total': stats['total'],
                    'totalBytes': stats['total_bytes'],
                    'limit': limit,
                    'offset': offset
                }, default=str)
            }
    finally:
        conn.close()

def delete_file(event: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    body = json.loads(event.get('body', '{}'))
    object_key = body.get('objectKey')
    
    if not object_key or not object_key.startswith(f'users/{user["id"]}/'):
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Forbidden'})
        }
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                UPDATE {SCHEMA}.storage_objects
                SET status = 'deleted'
                WHERE key = %s AND user_id = %s AND status = 'active'
            ''', (object_key, user['id']))
            conn.commit()
        
        try:
            s3_client.delete_object(Bucket=BUCKET, Key=object_key)
        except ClientError:
            pass
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True})
        }
    finally:
        conn.close()

def get_usage(event: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    limit_gb = float(user['custom_quota_gb'] or user['plan_quota_gb'])
    used_gb = float(bytes_to_gb(user['used_bytes']))
    percent = (used_gb / limit_gb * 100) if limit_gb > 0 else 0
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'usedGb': round(used_gb, 3),
            'limitGb': limit_gb,
            'percent': round(percent, 1),
            'remainingGb': round(limit_gb - used_gb, 3),
            'warning': percent >= 80
        })
    }

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        user = get_user_from_token(event)
    except ValueError as e:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
    
    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', '')
    
    if method == 'POST' and action == 'presign-upload':
        return presign_upload(event, user)
    elif method == 'POST' and action == 'confirm-upload':
        return confirm_upload(event, user)
    elif method == 'GET' and action == 'presign-download':
        return presign_download(event, user)
    elif method == 'GET' and action == 'list':
        return list_files(event, user)
    elif method == 'DELETE' and action == 'delete':
        return delete_file(event, user)
    elif method == 'GET' and action == 'usage':
        return get_usage(event, user)
    elif method == 'GET' and not action:
        return get_usage(event, user)
    
    return {
        'statusCode': 404,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Not found'})
    }