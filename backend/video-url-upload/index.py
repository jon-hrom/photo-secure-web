import json
import os
import tempfile
import boto3
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import re
import shutil
import requests
import m3u8 as m3u8_parser
from urllib.parse import urljoin, urlparse
import subprocess

def handler(event: dict, context) -> dict:
    '''API для загрузки видео по URL (прямые ссылки, m3u8, Kinescope, YouTube, VK)'''
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
    
    user_id = event.get('headers', {}).get('X-User-Id', '')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
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
    custom_headers = body.get('headers', {})  # Кастомные заголовки (cookies, auth)
    
    if not url:
        cursor.close()
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'URL is required'})
        }
    
    print(f'[VIDEO_UPLOAD] Starting download from: {url}')
    
    # Создаём папку если нужно
    if not folder_id:
        folder_name = datetime.now().strftime('Видео %d.%m.%Y %H:%M')
        s3_prefix = f'videos/{user_id}/{int(datetime.now().timestamp())}/'
        
        cursor.execute(
            '''INSERT INTO t_p28211681_photo_secure_web.photo_folders
               (user_id, folder_name, s3_prefix, folder_type, created_at, updated_at)
               VALUES (%s, %s, %s, %s, NOW(), NOW())
               RETURNING id''',
            (user_id, folder_name, s3_prefix, 'originals')
        )
        folder_id = cursor.fetchone()['id']
        conn.commit()
        print(f'[VIDEO_UPLOAD] Created folder: {folder_name} (id={folder_id})')
    
    cursor.execute(
        'SELECT s3_prefix FROM t_p28211681_photo_secure_web.photo_folders WHERE id = %s',
        (folder_id,)
    )
    folder_result = cursor.fetchone()
    s3_prefix = folder_result['s3_prefix'] if folder_result else f'videos/{user_id}/{int(datetime.now().timestamp())}/'
    
    temp_dir = tempfile.mkdtemp()
    output_file = None
    
    try:
        # Определяем тип источника
        download_type = detect_video_type(url)
        print(f'[VIDEO_UPLOAD] Detected type: {download_type}')
        
        if download_type == 'ytdlp':
            # YouTube, VK, Vimeo и 1000+ других сайтов
            output_file = download_with_ytdlp(url, temp_dir, custom_headers)
        elif download_type == 'm3u8':
            # Kinescope, HLS стримы
            output_file = download_m3u8_segments(url, temp_dir, custom_headers)
        elif download_type == 'direct':
            # Прямая ссылка на файл
            output_file = download_direct_file(url, temp_dir, custom_headers)
        elif download_type == 'kinescope_page':
            # Страница с Kinescope плеером - извлекаем m3u8
            m3u8_url = extract_kinescope_m3u8(url, custom_headers)
            if m3u8_url:
                output_file = download_m3u8_segments(m3u8_url, temp_dir, custom_headers)
            else:
                raise Exception('Не удалось найти видео на странице. Попробуйте указать прямую ссылку на .m3u8 файл')
        else:
            raise Exception('Неподдерживаемый формат. Используйте прямую ссылку на .mp4/.mov или .m3u8 плейлист')
        
        if not output_file or not os.path.exists(output_file):
            raise Exception('Не удалось скачать видео')
        
        print(f'[VIDEO_UPLOAD] Downloaded: {output_file}')
        
        file_size = os.path.getsize(output_file)
        filename = os.path.basename(output_file)
        
        # Загружаем в S3
        s3 = boto3.client('s3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
        )
        bucket = 'files'
        
        s3_key = f'{s3_prefix}{filename}'
        print(f'[VIDEO_UPLOAD] Uploading to S3: {s3_key}')
        
        with open(output_file, 'rb') as f:
            s3.put_object(
                Bucket=bucket,
                Key=s3_key,
                Body=f,
                ContentType='video/mp4'
            )
        
        aws_key_id = os.environ['AWS_ACCESS_KEY_ID']
        s3_url = f'https://cdn.poehali.dev/projects/{aws_key_id}/bucket/{s3_key}'
        
        # Сохраняем в БД
        cursor.execute(
            '''INSERT INTO t_p28211681_photo_secure_web.photo_bank 
               (user_id, folder_id, file_name, s3_key, s3_url, file_size, 
                is_video, content_type)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id''',
            (user_id, folder_id, filename, s3_key, s3_url, file_size, True, 'video/mp4')
        )
        video_id = cursor.fetchone()['id']
        conn.commit()
        
        print(f'[VIDEO_UPLOAD] Success! video_id={video_id}')
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'video_id': video_id,
                'filename': filename,
                'size': file_size,
                's3_url': s3_url,
                'folder_id': folder_id
            })
        }
        
    except Exception as e:
        print(f'[VIDEO_UPLOAD] ERROR: {str(e)}')
        import traceback
        print(traceback.format_exc())
        
        cursor.close()
        conn.close()
        
        # Формируем понятное сообщение об ошибке
        error_msg = str(e)
        if 'DRM' in error_msg.upper() or 'encrypted' in error_msg.lower():
            error_msg = 'Видео защищено DRM - скачивание невозможно'
        elif '403' in error_msg or '401' in error_msg:
            error_msg = 'Доступ запрещён. Попробуйте скопировать cookies из браузера'
        elif 'timeout' in error_msg.lower():
            error_msg = 'Превышено время ожидания - файл слишком большой'
        
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'error': error_msg,
                'details': str(e)
            })
        }
    
    finally:
        try:
            shutil.rmtree(temp_dir)
        except:
            pass


def detect_video_type(url: str) -> str:
    '''Определяет тип источника видео'''
    url_lower = url.lower()
    
    if '.m3u8' in url_lower:
        return 'm3u8'
    
    if 'kinescope' in url_lower and not url_lower.endswith('.m3u8'):
        return 'kinescope_page'
    
    # Платформы с поддержкой yt-dlp
    ytdlp_platforms = [
        'youtube.com', 'youtu.be', 'vimeo.com', 'vk.com', 'rutube.ru',
        'ok.ru', 'dailymotion.com', 'twitch.tv', 'instagram.com', 'tiktok.com',
        'coub.com', 'facebook.com', 'twitter.com', 'x.com'
    ]
    
    if any(platform in url_lower for platform in ytdlp_platforms):
        return 'ytdlp'
    
    # Прямая ссылка на видеофайл
    video_exts = ('.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv')
    if any(url_lower.endswith(ext) for ext in video_exts):
        return 'direct'
    
    # По умолчанию пробуем yt-dlp (он поддерживает 1000+ сайтов)
    return 'ytdlp'


def download_direct_file(url: str, output_dir: str, headers: dict = None) -> str:
    '''Скачивает файл по прямой ссылке'''
    
    filename = url.split('/')[-1].split('?')[0]
    if not any(filename.endswith(ext) for ext in ['.mp4', '.mov', '.avi', '.mkv', '.webm']):
        filename = f'video_{int(datetime.now().timestamp())}.mp4'
    
    output_path = os.path.join(output_dir, filename)
    
    print(f'[DIRECT] Downloading: {url}')
    
    session = requests.Session()
    if headers:
        session.headers.update(headers)
    
    response = session.get(url, stream=True, timeout=60)
    response.raise_for_status()
    
    total_size = int(response.headers.get('content-length', 0))
    print(f'[DIRECT] Size: {total_size / 1024 / 1024:.2f} MB')
    
    downloaded = 0
    with open(output_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):  # 1MB chunks
            f.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                progress = (downloaded / total_size) * 100
                if downloaded % (10 * 1024 * 1024) == 0:  # Каждые 10MB
                    print(f'[DIRECT] Progress: {progress:.1f}%')
    
    print(f'[DIRECT] Downloaded: {output_path}')
    return output_path


def download_m3u8_segments(m3u8_url: str, output_dir: str, headers: dict = None) -> str:
    '''Скачивает все сегменты из m3u8 плейлиста и склеивает в один файл'''
    
    print(f'[M3U8] Loading playlist: {m3u8_url}')
    
    session = requests.Session()
    if headers:
        session.headers.update(headers)
    
    # Загружаем плейлист
    response = session.get(m3u8_url, timeout=30)
    response.raise_for_status()
    
    playlist = m3u8_parser.loads(response.text)
    
    # Если это master playlist (несколько качеств), выбираем лучшее
    if playlist.is_variant:
        print(f'[M3U8] Found {len(playlist.playlists)} quality variants')
        # Берём первый вариант (обычно лучшее качество)
        best_variant = playlist.playlists[0]
        variant_url = urljoin(m3u8_url, best_variant.uri)
        print(f'[M3U8] Selected variant: {variant_url}')
        
        response = session.get(variant_url, timeout=30)
        response.raise_for_status()
        playlist = m3u8_parser.loads(response.text)
        m3u8_url = variant_url
    
    segments = playlist.segments
    if not segments:
        raise Exception('Плейлист не содержит сегментов')
    
    print(f'[M3U8] Found {len(segments)} segments')
    
    # Скачиваем сегменты
    segment_files = []
    base_url = m3u8_url.rsplit('/', 1)[0] + '/'
    
    for i, segment in enumerate(segments[:100]):  # Ограничение 100 сегментов (~5 минут видео)
        segment_url = urljoin(base_url, segment.uri)
        segment_path = os.path.join(output_dir, f'segment_{i:04d}.ts')
        
        try:
            seg_response = session.get(segment_url, timeout=30)
            seg_response.raise_for_status()
            
            with open(segment_path, 'wb') as f:
                f.write(seg_response.content)
            
            segment_files.append(segment_path)
            
            if (i + 1) % 10 == 0:
                print(f'[M3U8] Downloaded {i + 1}/{len(segments)} segments')
                
        except Exception as e:
            print(f'[M3U8] Failed segment {i}: {str(e)}')
            # Продолжаем со следующим сегментом
    
    if not segment_files:
        raise Exception('Не удалось скачать ни одного сегмента')
    
    print(f'[M3U8] Downloaded {len(segment_files)} segments, merging...')
    
    # Склеиваем сегменты в один файл
    output_path = os.path.join(output_dir, f'video_{int(datetime.now().timestamp())}.ts')
    
    with open(output_path, 'wb') as outfile:
        for segment_file in segment_files:
            with open(segment_file, 'rb') as infile:
                outfile.write(infile.read())
    
    # Переименовываем в .mp4 для совместимости
    final_path = output_path.replace('.ts', '.mp4')
    os.rename(output_path, final_path)
    
    print(f'[M3U8] Merged into: {final_path}')
    return final_path


def extract_kinescope_m3u8(page_url: str, headers: dict = None) -> str:
    '''Извлекает ссылку на m3u8 плейлист со страницы с Kinescope плеером'''
    
    print(f'[KINESCOPE] Loading page: {page_url}')
    
    session = requests.Session()
    if headers:
        session.headers.update(headers)
    
    response = session.get(page_url, timeout=30)
    response.raise_for_status()
    
    html = response.text
    
    # Ищем паттерны Kinescope
    patterns = [
        r'https://[^"\']+\.kinescope\.io/[^"\']+\.m3u8[^"\']*',
        r'"videoUrl":"(https://[^"]+\.m3u8[^"]*)"',
        r"'videoUrl':'(https://[^']+\.m3u8[^']*)'",
        r'src="(https://[^"]+\.m3u8[^"]*)"',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, html)
        if matches:
            m3u8_url = matches[0]
            if isinstance(m3u8_url, tuple):
                m3u8_url = m3u8_url[0]
            
            # Декодируем escaped символы
            m3u8_url = m3u8_url.replace('\\/', '/')
            
            print(f'[KINESCOPE] Found m3u8: {m3u8_url}')
            return m3u8_url
    
    # Не нашли - возвращаем None
    print('[KINESCOPE] m3u8 not found in page')
    return None


def download_with_ytdlp(url: str, output_dir: str, headers: dict = None) -> str:
    '''Скачивает видео через yt-dlp (поддерживает 1000+ сайтов)'''
    
    print(f'[YT-DLP] Downloading from: {url}')
    
    # Проверяем наличие yt-dlp
    try:
        result = subprocess.run(['yt-dlp', '--version'], 
                              capture_output=True, text=True, timeout=5)
        print(f'[YT-DLP] Version: {result.stdout.strip()}')
    except FileNotFoundError:
        raise Exception('Для этой платформы требуется yt-dlp. Попробуйте указать прямую ссылку на видео или m3u8 плейлист.')
    except Exception as e:
        raise Exception(f'Ошибка проверки yt-dlp: {str(e)}')
    
    output_template = os.path.join(output_dir, '%(title).50s.%(ext)s')
    
    cmd = [
        'yt-dlp',
        '--format', 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
        '--output', output_template,
        '--no-playlist',
        '--no-warnings',
        '--no-check-certificates',
        '--restrict-filenames',  # Безопасные имена файлов
        '--max-filesize', '500M',  # Ограничение 500MB
        url
    ]
    
    # Добавляем кастомные заголовки если есть
    if headers:
        for key, value in headers.items():
            cmd.extend(['--add-header', f'{key}:{value}'])
    
    print(f'[YT-DLP] Command: {" ".join(cmd[:8])}...')
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        
        if result.returncode != 0:
            error_msg = result.stderr.lower()
            
            # Понятные сообщения об ошибках
            if 'drm' in error_msg or 'encrypted' in error_msg:
                raise Exception('Видео защищено DRM - скачивание невозможно')
            elif 'private' in error_msg or 'login' in error_msg:
                raise Exception('Видео приватное - требуется авторизация')
            elif 'not available' in error_msg or 'removed' in error_msg:
                raise Exception('Видео недоступно или удалено')
            elif 'geo' in error_msg or 'region' in error_msg:
                raise Exception('Видео недоступно в вашем регионе')
            elif 'max-filesize' in error_msg:
                raise Exception('Видео слишком большое (макс. 500MB)')
            else:
                print(f'[YT-DLP] Error output: {result.stderr}')
                raise Exception(f'Не удалось скачать видео: {result.stderr[-200:]}')
        
        print(f'[YT-DLP] Output: {result.stdout[:200]}...')
        
        # Находим скачанный файл
        files = [f for f in os.listdir(output_dir) 
                if f.endswith(('.mp4', '.mkv', '.webm', '.mov', '.avi'))]
        
        if not files:
            raise Exception('Файл не найден после скачивания')
        
        downloaded_file = os.path.join(output_dir, files[0])
        
        # Переименовываем в .mp4 если нужно
        if not downloaded_file.endswith('.mp4'):
            new_path = downloaded_file.rsplit('.', 1)[0] + '.mp4'
            os.rename(downloaded_file, new_path)
            downloaded_file = new_path
        
        file_size = os.path.getsize(downloaded_file)
        print(f'[YT-DLP] Downloaded: {os.path.basename(downloaded_file)} ({file_size / 1024 / 1024:.1f} MB)')
        
        return downloaded_file
        
    except subprocess.TimeoutExpired:
        raise Exception('Timeout: видео слишком большое или медленное соединение')
    except Exception as e:
        if 'yt-dlp' not in str(e).lower():
            raise
        raise Exception(f'Ошибка yt-dlp: {str(e)}')