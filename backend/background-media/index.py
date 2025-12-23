"""
Управление медиа-файлами для фона сайта (изображения и видео).
Хранит файлы в S3 с CDN для быстрой загрузки.
"""
import json
import boto3
import os
import base64
from typing import Dict, Any

s3 = boto3.client(
    's3',
    endpoint_url='https://bucket.poehali.dev',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Управление медиа-файлами для фона сайта
    
    Args:
        event: HTTP запрос с method, body, queryStringParameters
        context: контекст с request_id
    
    Returns:
        HTTP ответ с URL медиа-файлов
    """
    method: str = event.get('httpMethod', 'GET')
    
    # CORS
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
    
    # GET - список файлов
    if method == 'GET':
        try:
            params = event.get('queryStringParameters') or {}
            media_type = params.get('type', 'all')  # 'video', 'image', 'all'
            
            print(f'[BG_MEDIA] GET request, type={media_type}')
            
            response = s3.list_objects_v2(Bucket='files', Prefix='background-media/')
            print(f'[BG_MEDIA] S3 response: {response.get("KeyCount", 0)} objects')
            
            files = []
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    key = obj['Key']
                    filename = key.replace('background-media/', '')
                    
                    if filename == '':
                        continue
                    
                    # Фильтруем по типу
                    is_video = filename.endswith(('.mp4', '.webm', '.mov'))
                    is_image = filename.endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp'))
                    
                    if media_type == 'video' and not is_video:
                        continue
                    if media_type == 'image' and not is_image:
                        continue
                    
                    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
                    
                    file_data = {
                        'id': filename.rsplit('.', 1)[0],
                        'url': cdn_url,
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
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': False, 'error': str(e)}),
                'isBase64Encoded': False
            }
    
    # POST - загрузка файла
    if method == 'POST':
        try:
            print('[BG_MEDIA] POST request started')
            body = json.loads(event.get('body', '{}'))
            file_data = body.get('file')
            filename = body.get('filename', 'media')
            file_type = body.get('type', 'image')
            
            print(f'[BG_MEDIA] POST data: filename={filename}, type={file_type}, has_file={bool(file_data)}')
            
            if not file_data:
                print('[BG_MEDIA] POST error: No file data')
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'success': False, 'error': 'No file provided'}),
                    'isBase64Encoded': False
                }
            
            # Декодируем base64
            file_bytes = base64.b64decode(file_data)
            print(f'[BG_MEDIA] Decoded file size: {len(file_bytes)} bytes')
            
            # Определяем content type
            content_type = 'video/webm' if file_type == 'video' else 'image/jpeg'
            extension = '.webm' if file_type == 'video' else '.jpg'
            
            # Генерируем уникальное имя
            file_id = f"{context.request_id}"
            key = f"background-media/{file_id}{extension}"
            
            print(f'[BG_MEDIA] Uploading to S3: bucket=files, key={key}, size={len(file_bytes)}')
            
            # Загружаем в S3
            s3.put_object(
                Bucket='files',
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
                CacheControl='public, max-age=31536000'  # Кэш на год
            )
            
            print(f'[BG_MEDIA] S3 upload successful! Key: {key}')
            
            cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
            
            print(f'[BG_MEDIA] POST success: id={file_id}, url={cdn_url}')
            
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
                        'url': cdn_url,
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
    
    # DELETE - удаление файла
    if method == 'DELETE':
        try:
            body = json.loads(event.get('body', '{}'))
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
            
            # Ищем файл с любым расширением
            response = s3.list_objects_v2(Bucket='files', Prefix=f'background-media/{file_id}')
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    s3.delete_object(Bucket='files', Key=obj['Key'])
            
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