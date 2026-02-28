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

YOUTUBE_HOSTS = ('youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com', 'www.youtube.com', 'm.youtube.com')


def is_youtube_url(url):
    from urllib.parse import urlparse
    try:
        host = urlparse(url).hostname or ''
        return any(host == h or host.endswith('.' + h) for h in YOUTUBE_HOSTS)
    except Exception:
        return False


def get_proxy():
    proxy = os.environ.get('YOUTUBE_PROXY', '')
    return proxy if proxy else None


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

    audio_only = body.get('audio_only', False)

    if mode == 'extract':
        return handle_extract(url, audio_only)

    format_id = body.get('format_id', '')

    if mode == 'cleanup_tmp':
        return handle_cleanup_tmp(user_id)

    if mode == 'device_download':
        return handle_device_download(url, user_id, folder_id, format_id, audio_only)

    return handle_upload(url, user_id, folder_id, format_id, audio_only)


def fix_url(url):
    if url.startswith('ttps://'):
        url = 'h' + url
    elif url.startswith('ttp://'):
        url = 'h' + url
    elif not url.startswith(('http://', 'https://')):
        url = 'https://' + url

    url = normalize_ok_url(url)
    return url


def normalize_ok_url(url):
    from urllib.parse import urlparse, urlunparse, urlencode, parse_qs
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or '').lower()
        if not (host == 'ok.ru' or host.endswith('.ok.ru')):
            return url

        # m.ok.ru/clip?owner_id=X&clip_id=Y  →  ok.ru/video/Y
        if parsed.path.startswith('/clip'):
            qs = parse_qs(parsed.query)
            clip_id = (qs.get('clip_id') or [''])[0]
            if clip_id:
                return f'https://ok.ru/video/{clip_id}'

        # Заменяем любой субдомен (m., www.) на ok.ru
        normalized = parsed._replace(scheme='https', netloc='ok.ru')
        return urlunparse(normalized)
    except Exception:
        return url


def handle_extract(url, audio_only=False):
    if HAS_YTDLP:
        try:
            info = ytdlp_extract(url, audio_only)
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


def handle_cleanup_tmp(user_id):
    from botocore.client import Config
    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )

    objects = s3.list_objects_v2(Bucket='foto-mix', Prefix='tmp_downloads/')
    contents = objects.get('Contents', [])
    if not contents:
        return resp(200, {'success': True, 'deleted': 0, 'message': 'Папка tmp_downloads пуста'})

    deleted = 0
    files_info = []
    for obj in contents:
        key = obj['Key']
        size = obj['Size']
        files_info.append({'key': key, 'size': size})
        s3.delete_object(Bucket='foto-mix', Key=key)
        deleted += 1
        print(f'[CLEANUP] Deleted {key} ({size} bytes)')

    total_mb = sum(o['Size'] for o in contents) / 1048576
    return resp(200, {
        'success': True,
        'deleted': deleted,
        'freed_mb': round(total_mb, 1),
        'files': files_info
    })


def handle_device_download(url, user_id, folder_id, format_id='', audio_only=False):
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

        filepath, filename = download_video(url, tmp, format_id, audio_only)
        fsize = os.path.getsize(filepath)
        if fsize > MAX_FILE_SIZE:
            raise Exception(f'Файл слишком большой ({fsize // 1048576} МБ)')

        from botocore.client import Config
        s3 = boto3.client('s3',
            endpoint_url='https://storage.yandexcloud.net',
            region_name='ru-central1',
            aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
            aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
            config=Config(signature_version='s3v4')
        )

        s3_key = f'{s3_prefix}{filename}'
        is_audio = audio_only or filename.endswith(('.mp3', '.m4a', '.ogg', '.opus', '.wav'))
        ctype = get_content_type(filename, is_audio)

        with open(filepath, 'rb') as f:
            s3.put_object(Bucket='foto-mix', Key=s3_key, Body=f, ContentType=ctype)

        s3_url = f'https://storage.yandexcloud.net/foto-mix/{s3_key}'

        cur.execute(
            '''INSERT INTO t_p28211681_photo_secure_web.photo_bank
               (user_id, folder_id, file_name, s3_key, s3_url, file_size, is_video, content_type)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (user_id, folder_id, filename, s3_key, s3_url, fsize, not is_audio, ctype)
        )
        vid = cur.fetchone()['id']
        conn.commit()

        presigned_url = s3.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': 'foto-mix',
                'Key': s3_key,
                'ResponseContentDisposition': f'attachment; filename="{filename}"',
                'ResponseContentType': ctype,
            },
            ExpiresIn=600,
        )

        print(f'[DEVICE_DL] Saved to photobank id={vid}, presigned for {filename} ({fsize} bytes)')
        return resp(200, {
            'success': True,
            'download_url': presigned_url,
            'filename': filename,
            'size': fsize,
            'video_id': vid,
            'folder_id': folder_id,
        })

    except Exception as e:
        print(f'[DEVICE_DL] Error: {e}')
        import traceback
        print(traceback.format_exc())
        return resp(400, {'error': friendly_error(str(e))})
    finally:
        cur.close()
        conn.close()
        shutil.rmtree(tmp, ignore_errors=True)


def get_content_type(filename, is_audio=False):
    if is_audio:
        if filename.endswith('.mp3'): return 'audio/mpeg'
        if filename.endswith('.m4a'): return 'audio/mp4'
        if filename.endswith(('.ogg', '.opus')): return 'audio/ogg'
        if filename.endswith('.wav'): return 'audio/wav'
        return 'audio/mpeg'
    if filename.endswith('.webm'): return 'video/webm'
    if filename.endswith('.ts'): return 'video/mp2t'
    if filename.endswith('.mov'): return 'video/quicktime'
    return 'video/mp4'


def handle_upload(url, user_id, folder_id, format_id='', audio_only=False):
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

        filepath, filename = download_video(url, tmp, format_id, audio_only)

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
        is_audio = audio_only or filename.endswith(('.mp3', '.m4a', '.ogg', '.opus', '.wav'))
        ctype = get_content_type(filename, is_audio)

        with open(filepath, 'rb') as f:
            s3.put_object(Bucket='foto-mix', Key=s3_key, Body=f, ContentType=ctype)

        s3_url = f'https://storage.yandexcloud.net/foto-mix/{s3_key}'

        cur.execute(
            '''INSERT INTO t_p28211681_photo_secure_web.photo_bank
               (user_id, folder_id, file_name, s3_key, s3_url, file_size, is_video, content_type)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id''',
            (user_id, folder_id, filename, s3_key, s3_url, fsize, not is_audio, ctype)
        )
        vid = cur.fetchone()['id']
        conn.commit()
        print(f'[{"AUDIO" if is_audio else "VIDEO"}] Uploaded: {filename} ({fsize} bytes) id={vid}')

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


def build_qualities(info):
    fmts = info.get('formats') or []

    combined = [
        f for f in fmts
        if f.get('vcodec', 'none') != 'none'
        and f.get('acodec', 'none') != 'none'
        and f.get('url')
    ]

    candidates = combined[:]

    if not candidates:
        candidates = [
            f for f in fmts
            if f.get('vcodec', 'none') != 'none' and f.get('url')
        ]

    seen = {}
    for f in candidates:
        h = f.get('height') or 0
        if h < 144:
            continue
        fsize = f.get('filesize') or f.get('filesize_approx') or 0
        key = h
        existing = seen.get(key)
        if not existing or (f.get('ext') == 'mp4' and existing.get('ext') != 'mp4') or fsize > (existing.get('filesize') or 0):
            seen[key] = {
                'format_id': f.get('format_id', ''),
                'height': h,
                'ext': f.get('ext', 'mp4'),
                'filesize': fsize,
                'label': f'{h}p',
                'url': f.get('url', ''),
                'has_audio': f.get('acodec', 'none') != 'none',
            }

    qualities = sorted(seen.values(), key=lambda q: q['height'])

    for q in qualities:
        h = q['height']
        if h <= 360:
            q['label'] = f'{h}p · SD'
        elif h <= 480:
            q['label'] = f'{h}p · SD'
        elif h <= 720:
            q['label'] = f'{h}p · HD'
        elif h <= 1080:
            q['label'] = f'{h}p · Full HD'
        elif h <= 1440:
            q['label'] = f'{h}p · 2K'
        else:
            q['label'] = f'{h}p · 4K'
        if q['filesize']:
            size_mb = q['filesize'] / 1048576
            if size_mb >= 1024:
                q['label'] += f' ({size_mb / 1024:.1f} ГБ)'
            else:
                q['label'] += f' ({size_mb:.0f} МБ)'

    return qualities


def build_audio_info(info):
    fmts = info.get('formats') or []
    audio_fmts = [
        f for f in fmts
        if f.get('acodec', 'none') != 'none'
        and f.get('vcodec', 'none') == 'none'
        and f.get('url')
    ]

    if not audio_fmts:
        combined = [
            f for f in fmts
            if f.get('acodec', 'none') != 'none' and f.get('url')
        ]
        if combined:
            best = combined[-1]
            abr = best.get('abr') or best.get('tbr') or 128
            fsize = best.get('filesize') or best.get('filesize_approx') or 0
            label = f'MP3 · {int(abr)} kbps'
            if fsize:
                size_mb = fsize / 1048576
                label += f' ({size_mb:.1f} МБ)'
            return {
                'available': True,
                'format_id': best.get('format_id', ''),
                'ext': 'mp3',
                'filesize': fsize,
                'abr': int(abr),
                'label': label,
            }
        return {'available': False}

    best = max(audio_fmts, key=lambda f: f.get('abr') or f.get('tbr') or 0)
    abr = best.get('abr') or best.get('tbr') or 128
    fsize = best.get('filesize') or best.get('filesize_approx') or 0
    label = f'MP3 · {int(abr)} kbps'
    if fsize:
        size_mb = fsize / 1048576
        label += f' ({size_mb:.1f} МБ)'
    return {
        'available': True,
        'format_id': best.get('format_id', ''),
        'ext': 'mp3',
        'filesize': fsize,
        'abr': int(abr),
        'label': label,
    }


def ytdlp_extract(url, audio_only=False):
    opts = {
        'quiet': True,
        'no_warnings': True,
        'noplaylist': True,
        'socket_timeout': 15,
        'nocheckcertificate': True,
        'cachedir': False,
        'no_color': True,
    }

    if is_youtube_url(url):
        proxy = get_proxy()
        if proxy:
            opts['proxy'] = proxy
            print(f'[EXTRACT] Using proxy for YouTube')

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)

    qualities = build_qualities(info)
    audio_info = build_audio_info(info)

    best_url = info.get('url', '')
    best_filesize = info.get('filesize') or info.get('filesize_approx') or 0

    if not best_url and info.get('requested_formats'):
        best_url = info['requested_formats'][0].get('url', '')

    if not best_url and info.get('formats'):
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
            best_url = best.get('url', '')
            best_filesize = best.get('filesize') or best.get('filesize_approx') or best_filesize
        elif fmts:
            best_url = fmts[-1].get('url', '')

    if not best_url and not qualities:
        raise Exception('Не удалось извлечь ссылку на видео')

    if not best_url and qualities:
        best_q = qualities[-1]
        best_url = best_q.get('url', '')
        best_filesize = best_q.get('filesize') or best_filesize

    title = info.get('title', 'video')
    title = re.sub(r'[^\w\s\-]', '', title).strip()[:100] or 'video'

    result = {
        'success': True,
        'title': title,
        'download_url': best_url,
        'thumbnail': info.get('thumbnail', ''),
        'duration': info.get('duration', 0),
        'filesize': best_filesize,
        'ext': info.get('ext', 'mp4'),
    }

    if qualities:
        result['qualities'] = qualities

    if audio_info.get('available'):
        result['audio'] = audio_info

    return result


def download_video(url, output_dir, format_id='', audio_only=False):
    if HAS_YTDLP and not is_direct_video_url(url):
        try:
            return ytdlp_download(url, output_dir, format_id, audio_only)
        except Exception as e:
            print(f'[DL] yt-dlp failed, trying fallback: {e}')

    if '.m3u8' in url.lower():
        path = download_m3u8(url, output_dir)
        return path, os.path.basename(path)

    if is_direct_video_url(url):
        path = download_direct(url, output_dir)
        return path, os.path.basename(path)

    if HAS_YTDLP:
        return ytdlp_download(url, output_dir, format_id, audio_only)

    raise Exception('Не удалось скачать видео. Попробуйте прямую ссылку на файл.')


def ytdlp_download(url, output_dir, format_id='', audio_only=False):
    template = os.path.join(output_dir, '%(title).80s.%(ext)s')

    if audio_only:
        fmt_str = 'bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio/best'
        opts = {
            'format': fmt_str,
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
    else:
        if format_id:
            fmt_str = (
                f'{format_id}'
                '/best[vcodec!=none][acodec!=none][ext=mp4][filesize<500M]'
                '/best[vcodec!=none][acodec!=none][ext=mp4]'
                '/best[vcodec!=none][acodec!=none]'
                '/best[ext=mp4]/best'
            )
        else:
            fmt_str = (
                'best[vcodec!=none][acodec!=none][ext=mp4][filesize<500M]'
                '/best[vcodec!=none][acodec!=none][ext=mp4]'
                '/best[vcodec!=none][acodec!=none]'
                '/best[ext=mp4]/best'
            )

        opts = {
            'format': fmt_str,
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

    if is_youtube_url(url):
        proxy = get_proxy()
        if proxy:
            opts['proxy'] = proxy
            print(f'[DOWNLOAD] Using proxy for YouTube')

    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filepath = ydl.prepare_filename(info)

    if audio_only:
        mp3_path = os.path.splitext(filepath)[0] + '.mp3'
        if os.path.exists(mp3_path):
            filepath = mp3_path

    if not os.path.exists(filepath):
        exts = ('.mp3', '.m4a', '.ogg', '.opus', '.wav') if audio_only else ('.mp4', '.webm', '.mkv', '.ts', '.mov')
        for f in os.listdir(output_dir):
            full = os.path.join(output_dir, f)
            if os.path.isfile(full) and f.endswith(exts):
                filepath = full
                break

    if not os.path.exists(filepath):
        raise Exception('Файл не найден после скачивания')

    basename = os.path.basename(filepath)
    safe = re.sub(r'[^\w\s\-\.]', '_', basename).strip()
    if not safe or safe.replace('_', '') == '':
        ext = 'mp3' if audio_only else 'mp4'
        safe = f'audio_{int(datetime.now().timestamp())}.{ext}' if audio_only else f'video_{int(datetime.now().timestamp())}.{ext}'

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
    if 'timeout' in msg.lower() or 'timed out' in msg.lower():
        return 'Превышено время ожидания — видео слишком большое или сервис недоступен'
    if 'Unsupported URL' in msg:
        return 'Ссылка не поддерживается — попробуйте прямую ссылку на видео'
    if 'age' in msg.lower() and ('restrict' in msg.lower() or 'gate' in msg.lower()):
        return 'Видео с возрастным ограничением — требуется авторизация'
    if 'connection' in msg.lower() and ('refused' in msg.lower() or 'reset' in msg.lower() or 'abort' in msg.lower()):
        return 'Не удалось подключиться к видеосервису — возможно, он заблокирован'
    if 'urlopen error' in msg.lower() or 'getaddrinfo' in msg.lower():
        return 'Не удалось подключиться к видеосервису — проверьте настройки прокси'
    return msg[:200]