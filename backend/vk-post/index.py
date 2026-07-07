import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import requests

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')
VK_API_VERSION = '5.199'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Content-Type': 'application/json',
}


def resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False),
        'isBase64Encoded': False,
    }


def vk_call(method: str, params: dict) -> dict:
    '''Вызов метода VK API. Возвращает содержимое response или бросает исключение с текстом ошибки VK.'''
    params = {**params, 'v': VK_API_VERSION}
    r = requests.post(f'https://api.vk.com/method/{method}', data=params, timeout=30)
    data = r.json()
    if 'error' in data:
        err = data['error']
        raise RuntimeError(err.get('error_msg', 'VK API error'))
    return data.get('response')


def handler(event: dict, context):
    '''Публикация записи с фотографиями на стену ВКонтакте (личную страницу или в сообщество).'''
    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return resp(405, {'error': 'Method not allowed'})

    user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id')
    if not user_id:
        return resp(401, {'error': 'User ID required'})

    raw_body = event.get('body') or '{}'
    try:
        body = json.loads(raw_body) if raw_body.strip() else {}
    except (ValueError, AttributeError):
        body = {}
    message = (body.get('message') or '').strip()
    photo_urls = body.get('photo_urls') or []
    target = body.get('target', 'group')  # 'group' | 'personal'

    if not message and not photo_urls:
        return resp(400, {'error': 'Нужен текст или хотя бы одно фото'})

    if not DATABASE_URL:
        return resp(500, {'error': 'Database not configured'})

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            f'SELECT vk_user_token, vk_group_token, vk_group_id, vk_user_id '
            f'FROM {SCHEMA}.vk_settings WHERE user_id = %s',
            (user_id,)
        )
        settings = cur.fetchone()
    finally:
        cur.close()
        conn.close()

    if not settings:
        return resp(400, {'error': 'ВКонтакте не подключён в настройках'})

    if target == 'group':
        group_id = (settings.get('vk_group_id') or '').strip().lstrip('-')
        group_token = (settings.get('vk_group_token') or '').strip()
        if not group_id or not group_token:
            return resp(400, {'error': 'Не указан ID группы или токен сообщества в настройках'})
        access_token = group_token
        owner_id = -int(group_id)
        from_group = 1
    else:
        user_token = (settings.get('vk_user_token') or '').strip()
        vk_uid = (settings.get('vk_user_id') or '').strip()
        if not user_token or not vk_uid:
            return resp(400, {'error': 'ВКонтакте не подключён (нет токена пользователя)'})
        access_token = user_token
        owner_id = int(vk_uid)
        from_group = 0

    try:
        attachments = []
        # Загружаем фото на стену
        if photo_urls:
            upload = vk_call('photos.getWallUploadServer', {
                'group_id': int(group_id) if target == 'group' else 0,
                'access_token': access_token,
            })
            upload_url = upload['upload_url']

            for url in photo_urls[:10]:
                img = requests.get(url, timeout=30)
                if img.status_code != 200:
                    continue
                files = {'photo': ('photo.jpg', img.content, 'image/jpeg')}
                up = requests.post(upload_url, files=files, timeout=60).json()
                if not up.get('photo') or up.get('photo') == '[]':
                    continue
                saved = vk_call('photos.saveWallPhoto', {
                    'group_id': int(group_id) if target == 'group' else 0,
                    'photo': up['photo'],
                    'server': up['server'],
                    'hash': up['hash'],
                    'access_token': access_token,
                })
                if saved:
                    p = saved[0]
                    attachments.append(f"photo{p['owner_id']}_{p['id']}")

        post_params = {
            'owner_id': owner_id,
            'message': message,
            'access_token': access_token,
        }
        if from_group:
            post_params['from_group'] = 1
        if attachments:
            post_params['attachments'] = ','.join(attachments)

        result = vk_call('wall.post', post_params)
        post_id = result.get('post_id') if isinstance(result, dict) else None

        link = None
        if post_id:
            link = f'https://vk.com/wall{owner_id}_{post_id}'

        return resp(200, {
            'success': True,
            'post_id': post_id,
            'link': link,
            'photos_attached': len(attachments),
        })
    except Exception as e:
        return resp(400, {'error': str(e)})