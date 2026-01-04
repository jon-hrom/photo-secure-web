import json
import os
import requests
import re
from urllib.parse import urlparse, parse_qs
import tempfile
import boto3
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: dict, context) -> dict:
    '''API для загрузки фото по URL (Яндекс Диск, Google Drive и др.)'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Authorization'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    # Проверка авторизации
    auth_header = event.get('headers', {}).get('X-Authorization', '')
    if not auth_header.startswith('Bearer '):
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    session_token = auth_header.replace('Bearer ', '')
    
    # Получаем user_id из сессии
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            "SELECT user_id FROM t_p28211681_photo_secure_web.sessions WHERE session_token = %s AND expires_at > NOW()",
            (session_token,)
        )
        session = cursor.fetchone()
        
        if not session:
            cursor.close()
            conn.close()
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Invalid or expired session'})
            }
        
        user_id = session['user_id']
    except Exception as e:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database error'})
        }
    
    # Парсим тело запроса
    try:
        body = json.loads(event.get('body', '{}'))
    except:
        cursor.close()
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid JSON'})
        }
    
    url = body.get('url', '').strip()
    folder_id = body.get('folder_id')
    
    if not url:
        cursor.close()
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'URL is required'})
        }
    
    # Определяем тип URL и получаем прямую ссылку на скачивание
    try:
        download_urls = get_download_urls(url)
    except Exception as e:
        cursor.close()
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Не удалось обработать ссылку: {str(e)}'})
        }
    
    if not download_urls:
        cursor.close()
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Не удалось получить файлы по ссылке'})
        }
    
    # Фильтруем только изображения
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.raw', '.cr2', '.nef', '.arw', '.dng'}
    filtered_urls = []
    
    for url_info in download_urls:
        name = url_info.get('name', '').lower()
        if any(name.endswith(ext) for ext in image_extensions):
            filtered_urls.append(url_info)
    
    if not filtered_urls:
        cursor.close()
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'По ссылке не найдено фото'})
        }
    
    # Настройка S3
    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    bucket = 'foto-mix'
    
    # Загружаем файлы
    uploaded_files = []
    failed_files = []
    
    for url_info in filtered_urls:
        try:
            download_url = url_info['url']
            filename = url_info['name']
            
            # Скачиваем файл
            response = requests.get(download_url, timeout=30, stream=True)
            response.raise_for_status()
            
            file_size = int(response.headers.get('content-length', 0))
            
            # Сохраняем во временный файл
            with tempfile.NamedTemporaryFile(delete=False) as temp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)
                temp_path = temp_file.name
            
            # Загружаем в S3
            timestamp = int(datetime.now().timestamp() * 1000)
            s3_key = f'uploads/{user_id}/{timestamp}_{filename}'
            
            with open(temp_path, 'rb') as f:
                s3.put_object(
                    Bucket=bucket,
                    Key=s3_key,
                    Body=f,
                    ContentType=response.headers.get('content-type', 'application/octet-stream')
                )
            
            # Удаляем временный файл
            os.unlink(temp_path)
            
            # Сохраняем в БД
            cursor.execute(
                '''INSERT INTO t_p28211681_photo_secure_web.photo_bank 
                   (user_id, folder_id, file_name, s3_key, file_size, upload_source)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   RETURNING id''',
                (user_id, folder_id, filename, s3_key, file_size, 'url')
            )
            photo_id = cursor.fetchone()['id']
            conn.commit()
            
            uploaded_files.append({
                'id': photo_id,
                'filename': filename,
                'size': file_size
            })
            
        except Exception as e:
            failed_files.append({
                'filename': url_info['name'],
                'error': str(e)
            })
    
    cursor.close()
    conn.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'success': True,
            'total_found': len(filtered_urls),
            'uploaded': len(uploaded_files),
            'failed': len(failed_files),
            'files': uploaded_files,
            'errors': failed_files
        })
    }


def get_download_urls(url: str) -> list:
    '''Получает прямые ссылки на скачивание файлов'''
    
    # Яндекс Диск
    if 'disk.yandex' in url or 'yadi.sk' in url:
        return get_yandex_disk_urls(url)
    
    # Google Drive
    elif 'drive.google.com' in url:
        return get_google_drive_urls(url)
    
    # Прямая ссылка на файл
    else:
        filename = os.path.basename(urlparse(url).path) or 'file.jpg'
        return [{'url': url, 'name': filename}]


def get_yandex_disk_urls(public_url: str) -> list:
    '''Получает файлы с Яндекс Диска'''
    
    # API для получения метаданных публичного ресурса
    api_url = 'https://cloud-api.yandex.net/v1/disk/public/resources'
    
    response = requests.get(api_url, params={'public_key': public_url, 'limit': 1000})
    response.raise_for_status()
    
    data = response.json()
    
    files = []
    
    # Если это файл
    if data.get('type') == 'file':
        download_url = data.get('file')
        if download_url:
            files.append({
                'url': download_url,
                'name': data.get('name', 'file.jpg')
            })
    
    # Если это папка
    elif data.get('type') == 'dir':
        items = data.get('_embedded', {}).get('items', [])
        for item in items:
            if item.get('type') == 'file':
                download_url = item.get('file')
                if download_url:
                    files.append({
                        'url': download_url,
                        'name': item.get('name', 'file.jpg')
                    })
    
    return files


def get_google_drive_urls(url: str) -> list:
    '''Получает файлы с Google Drive'''
    
    # Извлекаем ID файла или папки из URL
    file_id_match = re.search(r'/d/([a-zA-Z0-9_-]+)', url) or re.search(r'id=([a-zA-Z0-9_-]+)', url)
    
    if not file_id_match:
        raise ValueError('Не удалось извлечь ID из ссылки Google Drive')
    
    file_id = file_id_match.group(1)
    
    # Для Google Drive используем прямую ссылку на скачивание
    download_url = f'https://drive.google.com/uc?export=download&id={file_id}'
    
    # Пытаемся получить имя файла
    try:
        head_response = requests.head(download_url, allow_redirects=True, timeout=10)
        content_disposition = head_response.headers.get('content-disposition', '')
        filename_match = re.search(r'filename="?([^"]+)"?', content_disposition)
        filename = filename_match.group(1) if filename_match else f'{file_id}.jpg'
    except:
        filename = f'{file_id}.jpg'
    
    return [{'url': download_url, 'name': filename}]