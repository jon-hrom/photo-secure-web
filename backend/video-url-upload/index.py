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

def handler(event: dict, context) -> dict:
    '''API для загрузки видео по URL (прямые ссылки, m3u8, Kinescope)'''
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
    custom_headers = body.get('headers', {})
    
    if not url:
        cursor.close()
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'URL is required'})
        }
    
    # Fix common URL issues
    if url.startswith('ttps://'):
        url = 'h' + url
    elif url.startswith('ttp://'):
        url = 'h' + url
    elif not url.startswith('http://') and not url.startswith('https://'):
        url = 'https://' + url
    
    print(f'[VIDEO_UPLOAD] Starting download from: {url}')
    
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
        download_type = detect_video_type(url)
        print(f'[VIDEO_UPLOAD] Detected type: {download_type}')
        
        if download_type == 'm3u8':
            output_file = download_m3u8_segments(url, temp_dir, custom_headers)
        elif download_type == 'direct':
            output_file = download_direct_file(url, temp_dir, custom_headers)
        elif download_type == 'kinescope_page':
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
    
    video_exts = ('.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv')
    if any(url_lower.endswith(ext) for ext in video_exts):
        return 'direct'
    
    return 'unknown'


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
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            f.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                progress = (downloaded / total_size) * 100
                if downloaded % (10 * 1024 * 1024) == 0:
                    print(f'[DIRECT] Progress: {progress:.1f}%')
    
    print(f'[DIRECT] Downloaded: {output_path}')
    return output_path


def download_m3u8_segments(m3u8_url: str, output_dir: str, headers: dict = None) -> str:
    '''Скачивает все сегменты из m3u8 плейлиста и склеивает в один файл'''
    
    print(f'[M3U8] Loading playlist: {m3u8_url}')
    
    session = requests.Session()
    if headers:
        session.headers.update(headers)
    
    response = session.get(m3u8_url, timeout=30)
    response.raise_for_status()
    
    playlist = m3u8_parser.loads(response.text)
    
    if playlist.is_variant:
        print(f'[M3U8] Found {len(playlist.playlists)} quality variants')
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
    
    segment_files = []
    base_url = m3u8_url.rsplit('/', 1)[0] + '/'
    
    for i, segment in enumerate(segments[:100]):
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
    
    if not segment_files:
        raise Exception('Не удалось скачать ни одного сегмента')
    
    print(f'[M3U8] Downloaded {len(segment_files)} segments, merging...')
    
    output_path = os.path.join(output_dir, f'video_{int(datetime.now().timestamp())}.ts')
    
    with open(output_path, 'wb') as outfile:
        for segment_file in segment_files:
            with open(segment_file, 'rb') as infile:
                outfile.write(infile.read())
    
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
            
            m3u8_url = m3u8_url.replace('\\/', '/')
            
            print(f'[KINESCOPE] Found m3u8: {m3u8_url}')
            return m3u8_url
    
    print('[KINESCOPE] m3u8 not found in page')
    return None