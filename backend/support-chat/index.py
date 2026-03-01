"""
Чат технической поддержки: пользователи пишут администратору, используя таблицу blocked_user_appeals с флагом is_support=true
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

SCHEMA = 't_p28211681_photo_secure_web'

def notify_admin_via_max(cur, conn, user_name, user_email, message):
    """Отправить уведомление админу в MAX если у него нет активной сессии"""
    import requests as req

    cur.execute(
        f"SELECT id, phone, display_name FROM {SCHEMA}.users WHERE role = 'admin' LIMIT 1"
    )
    admin = cur.fetchone()
    if not admin or not admin.get('phone'):
        print('[SUPPORT_CHAT] No admin or no phone', flush=True)
        return

    admin_id = admin['id']
    admin_phone = admin['phone']

    cur.execute(
        f"SELECT COUNT(*) as cnt FROM {SCHEMA}.active_sessions "
        f"WHERE user_id = %s AND is_valid = TRUE "
        f"AND expires_at > CURRENT_TIMESTAMP "
        f"AND last_activity > CURRENT_TIMESTAMP - INTERVAL '5 minutes'",
        (admin_id,)
    )
    session_row = cur.fetchone()
    active_count = session_row['cnt'] if session_row else 0
    print(f'[SUPPORT_CHAT] Admin sessions={active_count}', flush=True)

    if active_count > 0:
        print('[SUPPORT_CHAT] Admin ONLINE — skip MAX', flush=True)
        return

    max_instance_id = os.environ.get('MAX_INSTANCE_ID', '')
    max_token = os.environ.get('MAX_TOKEN', '')
    if not max_instance_id or not max_token:
        print('[SUPPORT_CHAT] No MAX credentials', flush=True)
        return

    now_str = datetime.utcnow().strftime('%d.%m.%Y %H:%M') + ' МСК'
    message_preview = message[:200] + ('...' if len(message) > 200 else '')

    user_info = f'*{user_name}*'
    if user_email:
        user_info += f' ({user_email})'

    whatsapp_text = (
        f'📨 *Новое сообщение в техподдержку*\n'
        f'🕐 {now_str}\n\n'
        f'👤 От: {user_info}\n\n'
        f'💬 {message_preview}\n\n'
        f'➡️ Войдите на foto-mix.ru чтобы ответить'
    )

    clean_phone = ''.join(filter(str.isdigit, admin_phone))
    if not clean_phone.startswith('7'):
        clean_phone = '7' + clean_phone.lstrip('8')

    media_server = max_instance_id[:4] if len(max_instance_id) >= 4 else '7103'
    green_url = f"https://{media_server}.api.green-api.com/v3/waInstance{max_instance_id}/sendMessage/{max_token}"

    green_response = req.post(green_url, json={
        "chatId": f"{clean_phone}@c.us",
        "message": whatsapp_text
    }, timeout=15)

    print(f'[SUPPORT_CHAT] MAX status={green_response.status_code}', flush=True)

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

    # GET ?action=unread — количество непрочитанных ответов от поддержки
    if method == 'GET' and params.get('action') == 'unread':
        conn = get_conn()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            f"SELECT COUNT(*) as cnt FROM {SCHEMA}.blocked_user_appeals "
            f"WHERE user_identifier = %s AND is_support = true "
            f"AND admin_response IS NOT NULL AND user_read_at IS NULL",
            (user_identifier,)
        )
        row = cur.fetchone()
        cur.close()
        conn.close()
        return resp(200, {'unread_count': row['cnt'] if row else 0})

    # GET ?action=mark_read — пользователь открыл чат, отмечаем ответы как прочитанные
    if method == 'GET' and params.get('action') == 'mark_read':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"UPDATE {SCHEMA}.blocked_user_appeals "
            f"SET user_read_at = NOW() "
            f"WHERE user_identifier = %s AND is_support = true "
            f"AND admin_response IS NOT NULL AND user_read_at IS NULL",
            (user_identifier,)
        )
        conn.commit()
        cur.close()
        conn.close()
        return resp(200, {'success': True})

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
        # Помечаем прочитанными при открытии чата
        cur.execute(
            f"UPDATE {SCHEMA}.blocked_user_appeals "
            f"SET user_read_at = NOW() "
            f"WHERE user_identifier = %s AND is_support = true "
            f"AND admin_response IS NOT NULL AND user_read_at IS NULL",
            (user_identifier,)
        )
        conn.commit()
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

        try:
            notify_admin_via_max(cur, conn, user_name or user_identifier, user_email, message)
        except Exception as e:
            print(f'[SUPPORT_CHAT] MAX notify error: {str(e)}', flush=True)

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