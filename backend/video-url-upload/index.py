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
from urllib.parse import urljoin

try:
    import yt_dlp
    HAS_YTDLP = True
except ImportError:
    HAS_YTDLP = False

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
}

MAX_FILE_SIZE = 500 * 1024 * 1024


def resp(code, body):
    return {
        'statusCode': code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body) if isinstance(body, (dict, list)) else str(body)
    }


def handler(event: dict, context) -> dict:
    '''Универсальная загрузка видео по ссылке — YouTube, VK, RuTube, файлообменники и прямые ссылки'''
    if event.get('httpMethod') == 'OPTIONS':
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

    if event.get('httpMethod') != 'POST':
        return resp(405, {'error': 'Method not allowed'})

    user_id = event.get('headers', {}).get('X-User-Id', '')
    if not user_id:
        return resp(401, {'error': 'Unauthorized'})

    try:
        body = json.loads(event.get('body', '{}'))
    except Exception:
        return resp(400, {'error': 'Invalid JSON'})

    url = body.get('url', '').strip()
    folder_id = body.get('folder_id')
    mode = body.get('mode', 'upload')

    if not url:
        return resp(400, {'error': 'URL is required'})

    url = fix_url(url)
    print(f'[VIDEO] mode={mode} url={url}')

    if mode == 'extract':
        return handle_extract(url)

    return handle_upload(url, user_id, folder_id)


def fix_url(url):
    if url.startswith('ttps://'):
        return 'h' + url
    if url.startswith('ttp://'):
        return 'h' + url
    if not url.startswith(('http://', 'https://')):
        return 'https://' + url
    return url


def handle_extract(url):
    if HAS_YTDLP:
        try:
            info = ytdlp_extract(url)
            return resp(200, info)
        except Exception as e:
            print(f'[EXTRACT] yt-dlp failed: {e}')

    if is_direct_video_url(url):
        fname = url.split('/')[-1].split('?')[0] or 'video.mp4'
        return resp(200, {
            'success': True,
            'title': fname.rsplit('.', 1)[0],
            'download_url': url,
            'ext': fname.rsplit('.', 1)[-1] if '.' in fname else 'mp4',
            'duration': 0,
            'filesize': 0,
            'thumbnail': ''
        })

    return resp(400, {'error': 'Не удалось получить ссылку на видео. Попробуйте прямую ссылку на файл.'})


def handle_upload(url, user_id, folder_id):
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor(cursor_factory=RealDictCursor)
    tmp = tempfile.mkdtemp()

    try:
        if not folder_id:
            name = datetime.now().strftime('Видео %d.%m.%Y %H:%M')
            prefix = f'videos/{user_id}/{int(datetime.now().timestamp())}/'
            cur.execute(
                '''INSERT INTO t_p28211681_photo_secure_web.photo_folders
                   (user_id, folder_name, s3_prefix, folder_type, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, NOW(), NOW()) RETURNING id''',
                (user_id, name, prefix, 'originals')
            )
            folder_id = cur.fetchone()['id']
            conn.commit()

        cur.execute(
            'SELECT s3_prefix FROM t_p28211681_photo_secure_web.photo_folders WHERE id = %s',
            (folder_id,)
        )
        row = cur.fetchone()
        s3_prefix = row['s3_prefix'] if row else f'videos/{user_id}/{int(datetime.now().timestamp())}/'

        filepath, filename = download_video(url, tmp)

        fsize = os.path.getsize(filepath)
        if fsize > MAX_FILE_SIZE:
            raise Exception(f'Файл слишком большой ({fsize // 1048576} МБ, максимум {MAX_FILE_SIZE // 1048576} МБ)')

        from botocore.client import Config
        s3 = boto3.client('s3',
            endpoint_url='https://storage.yandexcloud.net',
            region_name='ru-central1',
            aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
            aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
            config=Config(signature_version='s3v4')
        )

        s3_key = f'{s3_prefix}{filename}'
        ctype = 'video/mp4'
        if filename.endswith('.webm'):
            ctype = 'video/webm'
        elif filename.endswith('.ts'):
            ctype = 'video/mp2t'
        elif filename.endswith('.mov'):
            ctype = 'video/quicktime'

        with open(filepath, 'rb') as f:
            s3.put_object(Bucket='foto-mix', Key=s3_key, Body=f, ContentType=ctype)

        s3_url = f'https://storage.yandexcloud.net/foto-mix/{s3_key}'

        cur.execute(
            '''INSERT INTO t_p28211681_photo_secure_web.photo_bank
               (user_id, folder_id, file_name, s3_key, s3_url, file_size, is_video, content_type)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (user_id, folder_id, filename, s3_key, s3_url, fsize, True, ctype)
        )
        vid = cur.fetchone()['id']
        conn.commit()
        print(f'[VIDEO] Uploaded: {filename} ({fsize} bytes) video_id={vid}')

        return resp(200, {
            'success': True,
            'video_id': vid,
            'filename': filename,
            'size': fsize,
            's3_url': s3_url,
            'folder_id': folder_id
        })

    except Exception as e:
        print(f'[UPLOAD] Error: {e}')
        import traceback
        print(traceback.format_exc())
        return resp(400, {'error': friendly_error(str(e))})

    finally:
        cur.close()
        conn.close()
        shutil.rmtree(tmp, ignore_errors=True)


def ytdlp_extract(url):
    opts = {
        'quiet': True,
        'no_warnings': True,
        'format': 'best[ext=mp4]/best',
        'noplaylist': True,
        'socket_timeout': 15,
        'nocheckcertificate': True,
        'cachedir': False,
        'no_color': True,
    }

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    download_url = info.get('url', '')

    if not download_url and info.get('requested_formats'):
        download_url = info['requested_formats'][0].get('url', '')

    if not download_url and info.get('formats'):
        fmts = info['formats']
        combined = [
            f for f in fmts
            if f.get('vcodec', 'none') != 'none'
            and f.get('acodec', 'none') != 'none'
            and f.get('url')
        ]
        if combined:
            mp4s = [f for f in combined if f.get('ext') == 'mp4']
            best = mp4s[-1] if mp4s else combined[-1]
            download_url = best.get('url', '')
        elif fmts:
            download_url = fmts[-1].get('url', '')

    if not download_url:
        raise Exception('Не удалось извлечь ссылку на видео')

    title = info.get('title', 'video')
    title = re.sub(r'[^\w\s\-]', '', title).strip()[:100] or 'video'

    return {
        'success': True,
        'title': title,
        'download_url': download_url,
        'thumbnail': info.get('thumbnail', ''),
        'duration': info.get('duration', 0),
        'filesize': info.get('filesize') or info.get('filesize_approx') or 0,
        'ext': info.get('ext', 'mp4')
    }


def download_video(url, output_dir):
    if HAS_YTDLP and not is_direct_video_url(url):
        try:
            return ytdlp_download(url, output_dir)
        except Exception as e:
            print(f'[DL] yt-dlp failed, trying fallback: {e}')

    if '.m3u8' in url.lower():
        path = download_m3u8(url, output_dir)
        return path, os.path.basename(path)

    if is_direct_video_url(url):
        path = download_direct(url, output_dir)
        return path, os.path.basename(path)

    if HAS_YTDLP:
        return ytdlp_download(url, output_dir)

    raise Exception('Не удалось скачать видео. Попробуйте прямую ссылку на файл.')


def ytdlp_download(url, output_dir):
    template = os.path.join(output_dir, '%(title).80s.%(ext)s')
    opts = {
        'format': 'best[ext=mp4][filesize<500M]/best[ext=mp4]/best[filesize<500M]/best',
        'outtmpl': template,
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'socket_timeout': 30,
        'retries': 2,
        'noprogress': True,
        'nocheckcertificate': True,
        'cachedir': False,
        'no_color': True,
    }

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filepath = ydl.prepare_filename(info)

    if not os.path.exists(filepath):
        for f in os.listdir(output_dir):
            full = os.path.join(output_dir, f)
            if os.path.isfile(full) and f.endswith(('.mp4', '.webm', '.mkv', '.ts', '.mov')):
                filepath = full
                break

    if not os.path.exists(filepath):
        raise Exception('Файл не найден после скачивания')

    basename = os.path.basename(filepath)
    safe = re.sub(r'[^\w\s\-\.]', '_', basename).strip()
    if not safe or safe.replace('_', '') == '':
        safe = f'video_{int(datetime.now().timestamp())}.mp4'

    return filepath, safe


def download_direct(url, output_dir):
    fname = url.split('/')[-1].split('?')[0]
    if not any(fname.lower().endswith(e) for e in ('.mp4', '.mov', '.avi', '.mkv', '.webm')):
        fname = f'video_{int(datetime.now().timestamp())}.mp4'

    path = os.path.join(output_dir, fname)

    session = requests.Session()
    if 'kinescope.io' in url:
        session.headers['Referer'] = 'https://kinescope.io/'

    r = session.get(url, stream=True, timeout=60)
    r.raise_for_status()

    with open(path, 'wb') as f:
        for chunk in r.iter_content(1024 * 1024):
            f.write(chunk)

    return path


def download_m3u8(url, output_dir):
    import m3u8 as m3u8_parser

    r = requests.get(url, timeout=30)
    r.raise_for_status()
    playlist = m3u8_parser.loads(r.text)

    if playlist.is_variant:
        variant_url = urljoin(url, playlist.playlists[0].uri)
        r = requests.get(variant_url, timeout=30)
        r.raise_for_status()
        playlist = m3u8_parser.loads(r.text)
        url = variant_url

    segments = playlist.segments
    if not segments:
        raise Exception('Плейлист не содержит сегментов')

    base = url.rsplit('/', 1)[0] + '/'
    max_seg = min(30, len(segments))
    parts = []

    for i, seg in enumerate(segments[:max_seg]):
        seg_url = urljoin(base, seg.uri)
        seg_path = os.path.join(output_dir, f'seg_{i:04d}.ts')
        try:
            sr = requests.get(seg_url, timeout=15)
            sr.raise_for_status()
            with open(seg_path, 'wb') as f:
                f.write(sr.content)
            parts.append(seg_path)
        except Exception:
            pass

    if not parts:
        raise Exception('Не удалось скачать сегменты')

    out = os.path.join(output_dir, f'video_{int(datetime.now().timestamp())}.mp4')
    with open(out, 'wb') as o:
        for p in parts:
            with open(p, 'rb') as inp:
                o.write(inp.read())

    return out


def is_direct_video_url(url):
    lower = url.lower()
    return any(e in lower for e in ('.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv'))


def friendly_error(msg):
    if 'Sign in' in msg or 'login' in msg.lower():
        return 'Видео требует авторизации — попробуйте другую ссылку'
    if 'Private' in msg or 'private' in msg:
        return 'Видео приватное — доступ ограничен'
    if 'unavailable' in msg.lower() or 'not available' in msg.lower():
        return 'Видео недоступно или удалено'
    if 'DRM' in msg.upper() or 'encrypted' in msg.lower():
        return 'Видео защищено DRM — скачивание невозможно'
    if '403' in msg or '401' in msg:
        return 'Доступ запрещён — попробуйте другую ссылку'
    if 'timeout' in msg.lower():
        return 'Превышено время ожидания — видео слишком большое'
    if 'Unsupported URL' in msg:
        return 'Ссылка не поддерживается — попробуйте прямую ссылку на видео'
    if 'age' in msg.lower() and ('restrict' in msg.lower() or 'gate' in msg.lower()):
        return 'Видео с возрастным ограничением — требуется авторизация'
    return msg[:200]
