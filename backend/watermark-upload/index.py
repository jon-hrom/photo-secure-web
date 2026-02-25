"""
Управление логотипами водяного знака: загрузка, список, удаление.
Хранит до 3 логотипов на пользователя в S3 + запись в БД.
"""
import json
import boto3
import os
import base64
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
}

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')
MAX_LOGOS = 3

s3 = boto3.client(
    's3',
    endpoint_url='https://bucket.poehali.dev',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
)

def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def handler(event: dict, context) -> dict:
    """Управление логотипами водяного знака пользователя (до 3 штук)"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**CORS_HEADERS, 'Access-Control-Max-Age': '86400'}, 'body': ''}

    user_id = (event.get('headers') or {}).get('x-user-id') or (event.get('headers') or {}).get('X-User-Id')
    if not user_id:
        return {'statusCode': 401, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Unauthorized'})}
    user_id = int(user_id)

    # GET — список логотипов пользователя
    if method == 'GET':
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'SELECT id, url, created_at FROM {SCHEMA}.watermark_logos WHERE user_id = %s ORDER BY created_at DESC',
            (user_id,)
        )
        logos = cur.fetchall()
        conn.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'logos': [dict(r) for r in logos]}, default=str),
        }

    # POST — загрузка нового логотипа
    if method == 'POST':
        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f'SELECT COUNT(*) as cnt FROM {SCHEMA}.watermark_logos WHERE user_id = %s', (user_id,))
        count = cur.fetchone()['cnt']
        if count >= MAX_LOGOS:
            conn.close()
            return {
                'statusCode': 400,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': f'Максимум {MAX_LOGOS} логотипа. Удалите один чтобы загрузить новый.'}),
            }

        body = json.loads(event.get('body') or '{}')
        file_data = body.get('file_data')
        content_type = body.get('content_type', 'image/png')
        if not file_data:
            conn.close()
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'file_data required'})}

        ext_map = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/svg+xml': 'svg', 'image/webp': 'webp'}
        ext = ext_map.get(content_type, 'png')
        file_bytes = base64.b64decode(file_data)
        key = f'watermarks/{user_id}/{uuid.uuid4().hex}.{ext}'

        s3.put_object(Bucket='files', Key=key, Body=file_bytes, ContentType=content_type, CacheControl='public, max-age=31536000')
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

        cur.execute(
            f'INSERT INTO {SCHEMA}.watermark_logos (user_id, url, s3_key) VALUES (%s, %s, %s) RETURNING id, url, created_at',
            (user_id, cdn_url, key)
        )
        logo = dict(cur.fetchone())
        conn.commit()
        conn.close()
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
            'body': json.dumps({'logo': logo}, default=str),
        }

    # DELETE — удаление логотипа по id
    if method == 'DELETE':
        body = json.loads(event.get('body') or '{}')
        logo_id = body.get('id')
        if not logo_id:
            return {'statusCode': 400, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'id required'})}

        conn = get_db()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f'DELETE FROM {SCHEMA}.watermark_logos WHERE id = %s AND user_id = %s RETURNING s3_key',
            (logo_id, user_id)
        )
        deleted = cur.fetchone()
        conn.commit()
        conn.close()

        if deleted:
            try:
                s3.delete_object(Bucket='files', Key=deleted['s3_key'])
            except Exception:
                pass

        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps({'ok': True})}

    return {'statusCode': 405, 'headers': CORS_HEADERS, 'body': json.dumps({'error': 'Method not allowed'})}
