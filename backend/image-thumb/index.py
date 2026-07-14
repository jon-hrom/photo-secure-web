import base64
import json
from io import BytesIO
from urllib.request import urlopen, Request

from PIL import Image, ImageOps, ImageFilter

ALLOWED_HOSTS = ('storage.yandexcloud.net', 'cdn.poehali.dev')
CACHE_HEADER = 'public, max-age=2592000, immutable'  # 30 дней


def handler(event: dict, context) -> dict:
    '''Отдаёт лёгкое JPEG-превью из тяжёлого фото (ресайз на лету). Для быстрой галереи выбора обложки.'''

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
            'isBase64Encoded': False,
        }

    if method != 'GET':
        return _err(405, 'Method not allowed')

    params = event.get('queryStringParameters') or {}
    file_url = params.get('url')
    if not file_url:
        return _err(400, 'Missing url parameter')

    if not any(host in file_url for host in ALLOWED_HOSTS):
        return _err(400, 'URL host not allowed')

    try:
        width = int(params.get('w', 400))
    except (TypeError, ValueError):
        width = 400
    width = max(64, min(width, 2400))

    try:
        quality = int(params.get('q', 78))
    except (TypeError, ValueError):
        quality = 78
    quality = max(40, min(quality, 95))

    # Лёгкое повышение резкости (unsharp mask). Убирает "мыло" после ресайза.
    # sharpen=1 (по умолчанию для крупных превью) — мягко, sharpen=0 — выкл.
    sharpen = params.get('sharpen', '1') != '0'

    try:
        req = Request(file_url, headers={'User-Agent': 'image-thumb/1.0'})
        with urlopen(req, timeout=25) as resp:
            raw = resp.read()
    except Exception as e:
        return _err(502, f'Fetch failed: {e}')

    try:
        img = Image.open(BytesIO(raw))
        img = ImageOps.exif_transpose(img)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
        img.thumbnail((width, width * 4), Image.Resampling.LANCZOS)

        if sharpen:
            # radius/percent подобраны так, чтобы вернуть детализацию
            # после LANCZOS-ресайза, но не создать "хруст" по краям.
            img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=90, threshold=2))

        out = BytesIO()
        img.save(out, format='JPEG', quality=quality, optimize=True, progressive=True)
        data = out.getvalue()
    except Exception as e:
        return _err(500, f'Resize failed: {e}')

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'image/jpeg',
            'Cache-Control': CACHE_HEADER,
            'Access-Control-Allow-Origin': '*',
        },
        'body': base64.b64encode(data).decode('utf-8'),
        'isBase64Encoded': True,
    }


def _err(code: int, msg: str) -> dict:
    return {
        'statusCode': code,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': msg}),
        'isBase64Encoded': False,
    }