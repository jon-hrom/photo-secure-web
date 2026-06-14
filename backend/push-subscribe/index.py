import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body),
    }


def handler(event: dict, context) -> dict:
    '''Сохраняет и удаляет подписки браузера на push-уведомления, отдаёт публичный VAPID ключ.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return _resp(200, {})

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id') or ''

    # Публичный VAPID ключ для фронтенда (без авторизации)
    qs = event.get('queryStringParameters') or {}
    if method == 'GET' and qs.get('action') == 'vapid':
        return _resp(200, {'public_key': os.environ.get('VAPID_PUBLIC_KEY', '')})

    if not user_id:
        return _resp(401, {'error': 'Не авторизован'})

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            body = {}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    if method == 'POST':
        sub = body.get('subscription') or {}
        endpoint = sub.get('endpoint')
        keys = sub.get('keys') or {}
        p256dh = keys.get('p256dh')
        auth = keys.get('auth')
        ua = (headers.get('User-Agent') or headers.get('user-agent') or '')[:500]
        if not endpoint or not p256dh or not auth:
            cur.close()
            conn.close()
            return _resp(400, {'error': 'Неполные данные подписки'})
        cur.execute(
            f"INSERT INTO {SCHEMA}.push_subscriptions (user_identifier, endpoint, p256dh, auth, user_agent, last_used_at) "
            f"VALUES (%s, %s, %s, %s, %s, NOW()) "
            f"ON CONFLICT (endpoint) DO UPDATE SET user_identifier = EXCLUDED.user_identifier, "
            f"p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, last_used_at = NOW()",
            (str(user_id), endpoint, p256dh, auth, ua),
        )
        conn.commit()
        cur.close()
        conn.close()
        return _resp(200, {'success': True})

    if method == 'DELETE':
        endpoint = body.get('endpoint')
        if endpoint:
            cur.execute(
                f"DELETE FROM {SCHEMA}.push_subscriptions WHERE endpoint = %s",
                (endpoint,),
            )
            conn.commit()
        cur.close()
        conn.close()
        return _resp(200, {'success': True})

    cur.close()
    conn.close()
    return _resp(405, {'error': 'Метод не поддерживается'})
