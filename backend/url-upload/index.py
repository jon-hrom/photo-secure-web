import json
import os
import requests
import re
from urllib.parse import urlparse, parse_qs, urljoin
import tempfile
import boto3
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
from PIL import Image
from io import BytesIO
from bs4 import BeautifulSoup

def handler(event: dict, context) -> dict:
    '''API для загрузки фото по URL (Яндекс Диск, Google Drive и др.)'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    # Получаем user_id из заголовка
    user_id = event.get('headers', {}).get('X-User-Id', '')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    # Подключаемся к БД
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
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
    
    # Если folder_id не указан, создаём новую папку с датой и временем
    if not folder_id:
        folder_name = datetime.now().strftime('Загрузка %d.%m.%Y %H:%M')
        s3_prefix = f'uploads/{user_id}/{int(datetime.now().timestamp())}/'
        
        cursor.execute(
            '''INSERT INTO t_p28211681_photo_secure_web.photo_folders
               (user_id, folder_name, s3_prefix, folder_type, created_at, updated_at)
               VALUES (%s, %s, %s, %s, NOW(), NOW())
               RETURNING id''',
            (user_id, folder_name, s3_prefix, 'originals')
        )
        folder_id = cursor.fetchone()['id']
        conn.commit()
        print(f'[URL_UPLOAD] Created new folder: {folder_name} (id={folder_id})')
    
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
    
    # Ограничиваем до 5 файлов за раз (чтобы уложиться в 30 сек)
    max_files = 5
    total_found = len(filtered_urls)
    filtered_urls = filtered_urls[:max_files]
    
    print(f'[URL_UPLOAD] Found {total_found} images, will process first {len(filtered_urls)}')
    
    # Настройка S3
    s3 = boto3.client('s3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    bucket = 'files'
    
    # Загружаем файлы
    uploaded_files = []
    failed_files = []
    
    for idx, url_info in enumerate(filtered_urls):
        try:
            download_url = url_info['url']
            filename = url_info['name']
            
            print(f'[URL_UPLOAD] Processing {idx+1}/{len(filtered_urls)}: {filename}')
            
            # Скачиваем файл (снижаем timeout)
            response = requests.get(download_url, timeout=8, stream=True)
            response.raise_for_status()
            
            print(f'[URL_UPLOAD] Downloaded {filename}, size: {response.headers.get("content-length", "unknown")}')
            
            file_size = int(response.headers.get('content-length', 0))
            file_content = response.content
            
            # Получаем folder s3_prefix из БД
            cursor.execute(
                '''SELECT s3_prefix FROM t_p28211681_photo_secure_web.photo_folders
                   WHERE id = %s''',
                (folder_id,)
            )
            folder_result = cursor.fetchone()
            s3_prefix = folder_result['s3_prefix'] if folder_result else f'uploads/{user_id}/{int(datetime.now().timestamp())}/'
            
            # Загружаем в S3 с оригинальным именем
            s3_key = f'{s3_prefix}{filename}'
            
            print(f'[URL_UPLOAD] Uploading to S3: {s3_key}')
            
            s3.put_object(
                Bucket=bucket,
                Key=s3_key,
                Body=file_content,
                ContentType=response.headers.get('content-type', 'application/octet-stream')
            )
            
            print(f'[URL_UPLOAD] Uploaded to S3 successfully')
            
            # Формируем CDN URL
            aws_key_id = os.environ['AWS_ACCESS_KEY_ID']
            s3_url = f'https://cdn.poehali.dev/projects/{aws_key_id}/bucket/{s3_key}'
            
            # Генерируем превью только для небольших изображений (не RAW)
            thumbnail_s3_key = None
            thumbnail_s3_url = None
            width = None
            height = None
            is_raw = filename.lower().endswith(('.cr2', '.nef', '.arw', '.dng', '.raw'))
            
            # Пропускаем превью для RAW файлов и больших файлов (>10MB)
            if not is_raw and file_size < 10 * 1024 * 1024:
                try:
                    img = Image.open(BytesIO(file_content))
                    width, height = img.size
                    
                    # Создаём превью (макс 800px для экономии памяти)
                    img.thumbnail((800, 800), Image.Resampling.LANCZOS)
                    
                    # Конвертируем в JPEG если нужно
                    if img.mode in ('RGBA', 'LA', 'P'):
                        background = Image.new('RGB', img.size, (255, 255, 255))
                        if img.mode == 'P':
                            img = img.convert('RGBA')
                        background.paste(img, mask=img.getchannel('A') if 'A' in img.getbands() else None)
                        img = background
                    elif img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Сохраняем в буфер с меньшим качеством
                    thumb_buffer = BytesIO()
                    img.save(thumb_buffer, format='JPEG', quality=75, optimize=True)
                    thumb_buffer.seek(0)
                    
                    # Загружаем превью в S3
                    # Убираем расширение из filename, чтобы избежать .jpg.jpg
                    base_name = os.path.splitext(filename)[0]
                    thumbnail_s3_key = f'{s3_prefix}thumbnails/{base_name}.jpg'
                    s3.put_object(
                        Bucket=bucket,
                        Key=thumbnail_s3_key,
                        Body=thumb_buffer.getvalue(),
                        ContentType='image/jpeg'
                    )
                    thumbnail_s3_url = f'https://cdn.poehali.dev/projects/{aws_key_id}/bucket/{thumbnail_s3_key}'
                    
                    print(f'[URL_UPLOAD] Generated thumbnail: {thumbnail_s3_key}')
                except Exception as thumb_error:
                    print(f'[URL_UPLOAD] Could not generate thumbnail: {str(thumb_error)}')
            else:
                print(f'[URL_UPLOAD] Skipping thumbnail for RAW/large file: {filename}')
            
            # Сохраняем в БД
            cursor.execute(
                '''INSERT INTO t_p28211681_photo_secure_web.photo_bank 
                   (user_id, folder_id, file_name, s3_key, s3_url, file_size, width, height, thumbnail_s3_key, thumbnail_s3_url, is_raw)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id''',
                (user_id, folder_id, filename, s3_key, s3_url, file_size, width, height, thumbnail_s3_key, thumbnail_s3_url, is_raw)
            )
            photo_id = cursor.fetchone()['id']
            conn.commit()
            
            uploaded_files.append({
                'id': photo_id,
                'filename': filename,
                'size': file_size,
                's3_url': s3_url,
                'thumbnail_s3_url': thumbnail_s3_url
            })
            
            print(f'[URL_UPLOAD] Saved to DB with id={photo_id}')
            
        except Exception as e:
            print(f'[URL_UPLOAD] Error processing {url_info["name"]}: {str(e)}')
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
            'total_found': total_found,
            'uploaded': len(uploaded_files),
            'failed': len(failed_files),
            'files': uploaded_files,
            'errors': failed_files,
            'folder_id': folder_id,
            'message': f'Загружено {len(uploaded_files)} из {total_found} фото' if total_found > max_files else None
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
    
    # Dropbox
    elif 'dropbox.com' in url:
        return get_dropbox_urls(url)
    
    # OneDrive / SharePoint
    elif '1drv.ms' in url or 'onedrive.live.com' in url or 'sharepoint.com' in url:
        return get_onedrive_urls(url)
    
    # Wfolio или другие HTML-галереи
    elif 'wfolio.ru' in url or url.endswith('/photos') or '/disk/' in url:
        return get_html_gallery_urls(url)
    
    # Прямая ссылка на файл
    else:
        # Проверяем, является ли это HTML-страницей или прямой ссылкой на изображение
        parsed = urlparse(url)
        path_lower = parsed.path.lower()
        image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.raw', '.cr2', '.nef', '.arw', '.dng', '.webp')
        
        if path_lower.endswith(image_extensions):
            # Прямая ссылка на изображение
            filename = os.path.basename(parsed.path) or 'file.jpg'
            return [{'url': url, 'name': filename}]
        else:
            # Возможно HTML-галерея - пытаемся парсить
            return get_html_gallery_urls(url)


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


def get_dropbox_urls(url: str) -> list:
    '''Получает файлы с Dropbox'''
    
    # Преобразуем ссылку для просмотра в ссылку для скачивания
    # www.dropbox.com/s/xxx/file.jpg?dl=0 → dl.dropboxusercontent.com/s/xxx/file.jpg
    # www.dropbox.com/sh/xxx → папка (требует API)
    
    files = []
    
    # Если это прямая ссылка на файл
    if '/s/' in url or '/scl/fi/' in url:
        # Заменяем параметр dl=0 на dl=1 для прямого скачивания
        download_url = url.replace('dl=0', 'dl=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        
        # Если параметра dl нет, добавляем
        if 'dl=' not in download_url:
            separator = '&' if '?' in download_url else '?'
            download_url = f"{download_url}{separator}dl=1"
        
        # Извлекаем имя файла из URL
        path_parts = urlparse(url).path.split('/')
        filename = path_parts[-1].split('?')[0] if path_parts else 'file.jpg'
        
        files.append({
            'url': download_url,
            'name': filename
        })
    
    # Папки Dropbox не поддерживаются без API токена
    elif '/sh/' in url:
        raise ValueError('Ссылки на папки Dropbox не поддерживаются. Используйте прямую ссылку на файл.')
    
    return files


def get_onedrive_urls(url: str) -> list:
    '''Получает файлы с OneDrive'''
    
    files = []
    
    # OneDrive имеет несколько форматов ссылок:
    # 1drv.ms/i/xxx (короткая ссылка)
    # onedrive.live.com/redir?resid=xxx
    # onedrive.live.com/embed?resid=xxx
    
    # Для коротких ссылок (1drv.ms) - пытаемся получить прямую ссылку
    if '1drv.ms' in url:
        try:
            # Следуем за редиректом
            response = requests.head(url, allow_redirects=True, timeout=10)
            final_url = response.url
            
            # Преобразуем в ссылку для скачивания
            if 'onedrive.live.com' in final_url:
                # Заменяем embed/view на download
                download_url = final_url.replace('/embed?', '/download?').replace('/view.aspx?', '/download.aspx?')
                
                # Пытаемся извлечь имя файла
                filename_match = re.search(r'resid=([^&]+)', final_url)
                filename = filename_match.group(1) + '.jpg' if filename_match else 'file.jpg'
                
                files.append({
                    'url': download_url,
                    'name': filename
                })
            else:
                raise ValueError('Не удалось обработать ссылку OneDrive')
        except Exception as e:
            raise ValueError(f'Ошибка обработки ссылки OneDrive: {str(e)}')
    
    # Прямые ссылки на onedrive.live.com или sharepoint.com
    elif 'onedrive.live.com' in url or 'sharepoint.com' in url:
        # Преобразуем в download URL
        download_url = url.replace('/embed?', '/download?').replace('/view.aspx?', '/download.aspx?')
        
        # Если это уже download URL, оставляем как есть
        if '/download' not in download_url and '?download=1' not in download_url:
            separator = '&' if '?' in download_url else '?'
            download_url = f"{download_url}{separator}download=1"
        
        filename = 'file.jpg'  # OneDrive не всегда предоставляет имя в URL
        
        files.append({
            'url': download_url,
            'name': filename
        })
    
    return files


def get_html_gallery_urls(url: str) -> list:
    '''Парсит HTML-страницу и извлекает все изображения'''
    
    try:
        # Проверяем, не wfolio ли это
        if 'wfolio.ru' in url or '/disk/' in url:
            return get_wfolio_gallery_urls(url)
        
        # Загружаем страницу
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Парсим HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        base_url = f"{urlparse(url).scheme}://{urlparse(url).netloc}"
        
        files = []
        seen_urls = set()
        
        # Ищем изображения в разных местах
        # 1. Обычные <img> теги
        for img in soup.find_all('img'):
            src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
            if src:
                # Преобразуем относительные URL в абсолютные
                full_url = urljoin(url, src)
                
                # Пропускаем маленькие иконки и служебные изображения
                if any(skip in full_url.lower() for skip in ['icon', 'logo', 'avatar', 'sprite']):
                    continue
                
                # Извлекаем имя файла
                filename = os.path.basename(urlparse(full_url).path.split('?')[0])
                
                # Добавляем если еще не добавлено
                if full_url not in seen_urls and filename:
                    seen_urls.add(full_url)
                    files.append({
                        'url': full_url,
                        'name': filename or f'image_{len(files)+1}.jpg'
                    })
        
        # 2. Ищем в srcset атрибутах (для responsive изображений)
        for img in soup.find_all(['img', 'source']):
            srcset = img.get('srcset')
            if srcset:
                # srcset содержит список URL с размерами: "url1 1x, url2 2x"
                for src_entry in srcset.split(','):
                    src = src_entry.strip().split()[0]
                    full_url = urljoin(url, src)
                    
                    if full_url not in seen_urls:
                        filename = os.path.basename(urlparse(full_url).path.split('?')[0])
                        if filename:
                            seen_urls.add(full_url)
                            files.append({
                                'url': full_url,
                                'name': filename or f'image_{len(files)+1}.jpg'
                            })
        
        # 3. Ищем фоновые изображения в style атрибутах
        for element in soup.find_all(style=True):
            style = element.get('style', '')
            bg_matches = re.findall(r'url\(["\']?([^"\')]+)["\']?\)', style)
            for bg_url in bg_matches:
                full_url = urljoin(url, bg_url)
                
                if full_url not in seen_urls:
                    filename = os.path.basename(urlparse(full_url).path.split('?')[0])
                    if filename and any(full_url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                        seen_urls.add(full_url)
                        files.append({
                            'url': full_url,
                            'name': filename or f'image_{len(files)+1}.jpg'
                        })
        
        # 4. Ищем специфичные паттерны для wfolio
        for picture in soup.find_all('picture'):
            for source in picture.find_all('source'):
                src = source.get('srcset', '').split()[0] if source.get('srcset') else None
                if src:
                    full_url = urljoin(url, src)
                    if full_url not in seen_urls:
                        filename = os.path.basename(urlparse(full_url).path.split('?')[0])
                        if filename:
                            seen_urls.add(full_url)
                            files.append({
                                'url': full_url,
                                'name': filename or f'image_{len(files)+1}.jpg'
                            })
        
        # Фильтруем только изображения (исключаем SVG, иконки и т.д.)
        image_extensions = ('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.raw', '.cr2', '.nef', '.arw', '.dng')
        filtered_files = []
        
        for file_info in files:
            filename_lower = file_info['name'].lower()
            # Проверяем расширение и размер URL (отсекаем base64)
            if any(filename_lower.endswith(ext) for ext in image_extensions):
                if not file_info['url'].startswith('data:'):
                    filtered_files.append(file_info)
        
        print(f'[HTML_GALLERY] Found {len(filtered_files)} images on page')
        
        return filtered_files
    
    except Exception as e:
        print(f'[HTML_GALLERY] Error parsing page: {str(e)}')
        raise ValueError(f'Не удалось распарсить страницу: {str(e)}')


def get_wfolio_gallery_urls(url: str) -> list:
    '''Получает изображения из галереи wfolio'''
    
    try:
        # Парсим URL чтобы построить API endpoint
        parsed = urlparse(url)
        
        # URL формата: https://ponomarev-pro.ru/disk/ds-vishenka-3-gruppa-z1pqps/photos
        # API endpoint: /disk/ds-vishenka-3-gruppa-z1pqps/pieces?design_variant=masonry&folder_path=photos
        
        path_parts = parsed.path.strip('/').split('/')
        
        if len(path_parts) < 2:
            raise ValueError('Некорректный URL wfolio галереи')
        
        # Извлекаем disk_id и folder_path
        disk_id = path_parts[1] if len(path_parts) > 1 else None
        folder_path = path_parts[2] if len(path_parts) > 2 else 'photos'
        
        if not disk_id:
            raise ValueError('Не удалось извлечь ID галереи из URL')
        
        # Формируем API endpoint
        api_url = f"{parsed.scheme}://{parsed.netloc}/disk/{disk_id}/pieces"
        params = {
            'design_variant': 'masonry',
            'folder_path': folder_path
        }
        
        print(f'[WFOLIO] Fetching gallery from: {api_url}')
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Referer': url
        }
        
        response = requests.get(api_url, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Парсим HTML ответ
        soup = BeautifulSoup(response.text, 'html.parser')
        
        files = []
        seen_urls = set()
        
        # Ищем все фото-элементы в галерее
        # wfolio использует структуру: <div class="piece" data-piece-id="...">
        pieces = soup.find_all('div', class_='piece')
        
        print(f'[WFOLIO] Found {len(pieces)} piece elements')
        
        for piece in pieces:
            try:
                piece_id = piece.get('data-piece-id')
                
                # Ищем ссылку с данными галереи
                link = piece.find('a', attrs={'data-gallery-title': True})
                
                if link:
                    title = link.get('data-gallery-title', '').strip()
                    
                    # Ищем img тег внутри piece
                    img = piece.find('img', class_='lazyload')
                    
                    if img:
                        # Получаем srcset с разными разрешениями
                        srcset = img.get('data-srcset', '')
                        
                        if srcset:
                            # srcset формата: "url1 1280w, url2 1920w, url3 2560w"
                            # Берем последний (самый большой)
                            srcset_parts = [s.strip() for s in srcset.split(',')]
                            
                            if srcset_parts:
                                # Берем последнюю часть (самое большое разрешение)
                                largest = srcset_parts[-1].split()[0]
                                
                                # Добавляем протокол если нужно
                                if largest.startswith('//'):
                                    img_url = f"{parsed.scheme}:{largest}"
                                else:
                                    img_url = urljoin(url, largest)
                                
                                # Генерируем имя файла
                                if title:
                                    filename = title
                                elif piece_id:
                                    filename = f'photo_{piece_id}.jpg'
                                else:
                                    filename = os.path.basename(urlparse(img_url).path.split('?')[0])
                                
                                # Очищаем имя файла от лишних пробелов
                                filename = filename.strip()
                                if not filename:
                                    filename = f'image_{len(files)+1}.jpg'
                                
                                # Проверяем расширение
                                if not any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                                    filename += '.jpg'
                                
                                if img_url not in seen_urls:
                                    seen_urls.add(img_url)
                                    files.append({
                                        'url': img_url,
                                        'name': filename
                                    })
                                    print(f'[WFOLIO] Found image: {filename} -> {img_url[:80]}...')
            
            except Exception as e:
                print(f'[WFOLIO] Error processing piece: {str(e)}')
                continue
        
        # Если не нашли через data-gallery-versions, пробуем искать обычным способом
        if not files:
            print('[WFOLIO] No images found via data-gallery-versions, trying img tags')
            
            for img in soup.find_all('img'):
                src = img.get('src') or img.get('data-src')
                srcset = img.get('srcset', '')
                
                # Из srcset берем самое большое изображение
                if srcset:
                    srcset_parts = [s.strip().split()[0] for s in srcset.split(',')]
                    if srcset_parts:
                        src = srcset_parts[-1]  # Последнее обычно самое большое
                
                if src:
                    # Преобразуем в абсолютный URL
                    if src.startswith('//'):
                        src = f"{parsed.scheme}:{src}"
                    elif not src.startswith('http'):
                        src = urljoin(url, src)
                    
                    # Фильтруем служебные изображения
                    if any(skip in src.lower() for skip in ['icon', 'logo', 'avatar', 'sprite', 'placeholder']):
                        continue
                    
                    if src not in seen_urls:
                        filename = os.path.basename(urlparse(src).path.split('?')[0])
                        if filename and any(filename.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                            seen_urls.add(src)
                            files.append({
                                'url': src,
                                'name': filename
                            })
        
        print(f'[WFOLIO] Found {len(files)} images total')
        
        return files
    
    except Exception as e:
        print(f'[WFOLIO] Error: {str(e)}')
        raise ValueError(f'Не удалось получить изображения из wfolio галереи: {str(e)}')