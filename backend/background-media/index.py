"""
Управление медиа-файлами для фона сайта (изображения и видео).
Хранит файлы в Yandex S3 с presigned URLs для доступа.
"""
import json
import boto3
import os
import base64
from typing import Dict, Any
from botocore.client import Config

s3 = boto3.client(
    's3',
    endpoint_url='https://storage.yandexcloud.net',
    region_name='ru-central1',
    aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
    aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
    config=Config(signature_version='s3v4')
)
bucket = 'foto-mix'

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Управление медиа-файлами для фона сайта"""
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'GET':
        try:
            params = event.get('queryStringParameters') or {}
            media_type = params.get('type', 'all')
            
            print(f'[BG_MEDIA] GET request, type={media_type}')
            
            response = s3.list_objects_v2(Bucket=bucket, Prefix='background-media/')
            print(f'[BG_MEDIA] S3 list response: {response.get("KeyCount", 0)} objects')
            
            files = []
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    key = obj['Key']
                    filename = key.replace('background-media/', '')
                    
                    if filename == '':
                        continue
                    
                    is_video = filename.endswith(('.mp4', '.webm', '.mov'))
                    is_image = filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp'))
                    
                    if media_type == 'video' and not is_video:
                        continue
                    if media_type == 'image' and not is_image:
                        continue
                    
                    presigned_url = s3.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': bucket, 'Key': key},
                        ExpiresIn=86400
                    )
                    
                    file_data = {
                        'id': filename.rsplit('.', 1)[0],
                        'url': presigned_url,
                        'name': filename,
                        'size': obj['Size'],
                        'type': 'video' if is_video else 'image',
                        'uploaded': obj['LastModified'].isoformat()
                    }
                    files.append(file_data)
                    print(f'[BG_MEDIA] Added file: {filename}, type={file_data["type"]}')
            
            print(f'[BG_MEDIA] Returning {len(files)} files')
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': True, 'files': files}),
                'isBase64Encoded': False
            }
        except Exception as e:
            print(f'[BG_MEDIA] GET error: {e}')
            import traceback
            print(f'[BG_MEDIA] Traceback: {traceback.format_exc()}')
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': False, 'error': str(e)}),
                'isBase64Encoded': False
            }
    
    if method == 'POST':
        try:
            print('[BG_MEDIA] POST request started')
            body = json.loads(event.get('body', '{}'))
            file_data = body.get('file')
            filename = body.get('filename', 'media')
            file_type = body.get('type', 'image')
            
            print(f'[BG_MEDIA] POST data: filename={filename}, type={file_type}, has_file={bool(file_data)}')
            
            if not file_data:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'success': False, 'error': 'No file provided'}),
                    'isBase64Encoded': False
                }
            
            file_bytes = base64.b64decode(file_data)
            print(f'[BG_MEDIA] Decoded file size: {len(file_bytes)} bytes')
            
            filename_lower = filename.lower()
            if file_type == 'video':
                content_type = 'video/webm'
                extension = '.webm'
            elif filename_lower.endswith('.gif'):
                content_type = 'image/gif'
                extension = '.gif'
            elif filename_lower.endswith('.png'):
                content_type = 'image/png'
                extension = '.png'
            elif filename_lower.endswith('.webp'):
                content_type = 'image/webp'
                extension = '.webp'
            else:
                content_type = 'image/jpeg'
                extension = '.jpg'
            
            file_id = f"{context.request_id}"
            key = f"background-media/{file_id}{extension}"
            
            print(f'[BG_MEDIA] Uploading to Yandex S3: bucket={bucket}, key={key}, size={len(file_bytes)}')
            
            s3.put_object(
                Bucket=bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
                CacheControl='public, max-age=31536000'
            )
            
            print(f'[BG_MEDIA] S3 upload successful! Key: {key}')
            
            presigned_url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=86400
            )
            
            print(f'[BG_MEDIA] POST success: id={file_id}')
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'file': {
                        'id': file_id,
                        'url': presigned_url,
                        'name': f"{file_id}{extension}",
                        'size': len(file_bytes),
                        'type': file_type
                    }
                }),
                'isBase64Encoded': False
            }
            
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': False, 'error': str(e)}),
                'isBase64Encoded': False
            }
    
    if method == 'DELETE':
        try:
            raw_body = event.get('body', '') or '{}'
            body = json.loads(raw_body) if raw_body.strip() else {}
            file_id = body.get('fileId')
            
            if not file_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'success': False, 'error': 'No fileId provided'}),
                    'isBase64Encoded': False
                }
            
            response = s3.list_objects_v2(Bucket=bucket, Prefix=f'background-media/{file_id}')
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    s3.delete_object(Bucket=bucket, Key=obj['Key'])
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': False, 'error': str(e)}),
                'isBase64Encoded': False
            }
    
    return {
        'statusCode': 405,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'success': False, 'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }