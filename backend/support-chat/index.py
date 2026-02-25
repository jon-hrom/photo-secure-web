"""
Чат технической поддержки: пользователи пишут администратору, используя таблицу blocked_user_appeals с флагом is_support=true
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

SCHEMA = 't_p28211681_photo_secure_web'
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
}

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])

def resp(status, body):
    return {'statusCode': status, 'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'}, 'body': json.dumps(body, ensure_ascii=False, default=str)}

def handler(event: dict, context) -> dict:
    """Чат техподдержки: отправка и получение сообщений между пользователем и администратором"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    user_id_str = (event.get('headers') or {}).get('X-User-Id', '')

    if not user_id_str:
        return resp(401, {'error': 'Требуется авторизация'})

    user_identifier = str(user_id_str)

    # GET — получить историю сообщений пользователя в тех.поддержку
    if method == 'GET':
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f"SELECT id, message, admin_response, is_read, created_at, responded_at, user_name "
            f"FROM {SCHEMA}.blocked_user_appeals "
            f"WHERE user_identifier = %s AND is_support = true "
            f"ORDER BY created_at ASC",
            (user_identifier,)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        messages = []
        for r in rows:
            messages.append({
                'id': r['id'],
                'message': r['message'],
                'sender': 'user',
                'created_at': str(r['created_at']),
            })
            if r['admin_response']:
                messages.append({
                    'id': f"resp_{r['id']}",
                    'message': r['admin_response'],
                    'sender': 'admin',
                    'created_at': str(r['responded_at'] or r['created_at']),
                })
        return resp(200, {'messages': messages})

    # POST — отправить новое сообщение в тех.поддержку
    if method == 'POST':
        body = {}
        if event.get('body'):
            body = json.loads(event['body'])
        message = (body.get('message') or '').strip()
        user_name = (body.get('user_name') or '').strip()
        user_email = (body.get('user_email') or '').strip() or None

        if not message:
            return resp(400, {'error': 'Сообщение не может быть пустым'})

        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f"INSERT INTO {SCHEMA}.blocked_user_appeals "
            f"(user_identifier, user_email, user_name, message, is_support, is_blocked, is_read, is_archived) "
            f"VALUES (%s, %s, %s, %s, true, false, false, false) RETURNING id, created_at",
            (user_identifier, user_email, user_name or None, message)
        )
        row = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {
            'success': True,
            'message': {
                'id': row['id'],
                'message': message,
                'sender': 'user',
                'created_at': str(row['created_at']),
            }
        })

    return resp(405, {'error': 'Метод не поддерживается'})
