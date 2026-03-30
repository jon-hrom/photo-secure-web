import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor


def _cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
        'Access-Control-Max-Age': '86400'
    }


def _response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body, default=str),
        'isBase64Encoded': False
    }


def handler(event, context):
    """Управление настройками ретуши — чтение и обновление параметров (ldm_steps и др.)"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return _response(401, {'error': 'User not authenticated'})

    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            if not user or user['role'] not in ('admin', 'owner'):
                return _response(403, {'error': 'Admin access required'})

        if method == 'GET':
            return _handle_get(conn)
        elif method == 'POST':
            return _handle_update(event, conn)
        else:
            return _response(405, {'error': 'Method not allowed'})
    finally:
        conn.close()


def _handle_get(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT key, value, description, updated_at FROM retouch_settings ORDER BY key")
        rows = cur.fetchall()

    settings = {}
    for row in rows:
        settings[row['key']] = {
            'value': row['value'],
            'description': row['description'],
            'updated_at': row['updated_at'],
        }

    return _response(200, {'settings': settings})


def _handle_update(event, conn):
    body = json.loads(event.get('body', '{}') or '{}')
    key = body.get('key')
    value = body.get('value')

    if not key or value is None:
        return _response(400, {'error': 'key and value are required'})

    ALLOWED_KEYS = {
        'ldm_steps': {'min': 1, 'max': 50, 'type': 'int'},
    }

    if key not in ALLOWED_KEYS:
        return _response(400, {'error': f'Unknown setting: {key}'})

    rule = ALLOWED_KEYS[key]
    if rule['type'] == 'int':
        try:
            int_val = int(value)
            if int_val < rule['min'] or int_val > rule['max']:
                return _response(400, {'error': f'{key} must be between {rule["min"]} and {rule["max"]}'})
            value = str(int_val)
        except (ValueError, TypeError):
            return _response(400, {'error': f'{key} must be a number'})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "UPDATE retouch_settings SET value = %s, updated_at = NOW() WHERE key = %s RETURNING key, value, description, updated_at",
            (value, key)
        )
        row = cur.fetchone()
        if not row:
            cur.execute(
                "INSERT INTO retouch_settings (key, value) VALUES (%s, %s) RETURNING key, value, description, updated_at",
                (key, value)
            )
            row = cur.fetchone()
        conn.commit()

    return _response(200, {'success': True, 'setting': row})
