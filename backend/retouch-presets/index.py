import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any


CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400'
}


def _response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, default=str),
        'isBase64Encoded': False
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Управление пресетами ретуши — CRUD для pipeline-конфигураций"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return _response(401, {'error': 'Not authenticated'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            user = cur.fetchone()
            if not user or user['role'] not in ('admin', 'owner'):
                return _response(403, {'error': 'Admin access required'})

        if method == 'GET':
            return _handle_list(conn)
        elif method == 'POST':
            return _handle_save(event, conn)
        elif method == 'DELETE':
            return _handle_delete(event, conn)
        else:
            return _response(405, {'error': 'Method not allowed'})
    finally:
        conn.close()


def _handle_list(conn):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('SELECT id, name, pipeline_json, is_default, created_at, updated_at FROM retouch_presets ORDER BY is_default DESC, name')
        presets = cur.fetchall()
    return _response(200, {'presets': presets})


def _handle_save(event, conn):
    body = json.loads(event.get('body', '{}') or '{}')
    name = body.get('name', '').strip()
    pipeline_json = body.get('pipeline_json')
    is_default = body.get('is_default', False)

    if not name:
        return _response(400, {'error': 'name is required'})
    if not isinstance(pipeline_json, list):
        return _response(400, {'error': 'pipeline_json must be a JSON array'})
    for i, op in enumerate(pipeline_json):
        if not isinstance(op, dict) or 'op' not in op:
            return _response(400, {'error': f'pipeline_json[{i}] must have "op" field'})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        if is_default:
            cur.execute("UPDATE retouch_presets SET is_default = FALSE WHERE is_default = TRUE")

        cur.execute(
            '''INSERT INTO retouch_presets (name, pipeline_json, is_default, updated_at)
               VALUES (%s, %s::jsonb, %s, NOW())
               ON CONFLICT (name) DO UPDATE SET
                 pipeline_json = EXCLUDED.pipeline_json,
                 is_default = EXCLUDED.is_default,
                 updated_at = NOW()
               RETURNING id, name, pipeline_json, is_default, created_at, updated_at''',
            (name, json.dumps(pipeline_json), is_default)
        )
        preset = cur.fetchone()
        conn.commit()

    return _response(200, {'preset': preset})


def _handle_delete(event, conn):
    params = event.get('queryStringParameters', {}) or {}
    name = params.get('name', '').strip()
    if not name:
        return _response(400, {'error': 'name query param is required'})
    if name == 'default':
        return _response(400, {'error': 'Cannot delete default preset'})

    with conn.cursor() as cur:
        cur.execute('DELETE FROM retouch_presets WHERE name = %s', (name,))
        deleted = cur.rowcount
        conn.commit()

    if deleted == 0:
        return _response(404, {'error': 'Preset not found'})
    return _response(200, {'deleted': name})
