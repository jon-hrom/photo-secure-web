"""
Система тикетов техподдержки: создание обращений, переписка, вложения, закрытие.
Действия (query param action): list, get, create, message, close, admin_list, admin_message, admin_status.
Пользователь определяется по заголовку X-User-Id. Админ — по role='admin' в таблице users.
"""
import json
import os
import base64
import uuid
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3

try:
    import notifications as notify
except Exception as _e:
    notify = None
    print(f'[support-tickets] notifications import failed: {_e}')

SCHEMA = 't_p28211681_photo_secure_web'


def _safe_notify(fn_name, *args):
    """Безопасный вызов уведомлений — не должен ломать основной поток."""
    if notify is None:
        return
    try:
        getattr(notify, fn_name)(*args)
    except Exception as e:
        print(f'[support-tickets] notify {fn_name} failed: {e}')

REQUEST_TYPES = {'question', 'problem', 'suggestion'}
PRIORITIES = {'low', 'normal', 'high', 'urgent'}
STATUSES = {'open', 'in_progress', 'closed'}

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def resp(status, body):
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def upload_attachments(attachments):
    """attachments: list of {name, type, data(base64)}. Возвращает список {name, url}."""
    if not attachments:
        return []
    s3 = get_s3()
    key_prefix = os.environ['AWS_ACCESS_KEY_ID']
    result = []
    for att in attachments[:6]:
        data_b64 = att.get('data', '')
        if ',' in data_b64 and data_b64.strip().startswith('data:'):
            data_b64 = data_b64.split(',', 1)[1]
        try:
            raw = base64.b64decode(data_b64)
        except Exception:
            continue
        if len(raw) > 8 * 1024 * 1024:
            continue
        ext = (att.get('name', 'file').rsplit('.', 1)[-1] or 'png')[:8]
        key = f"support/{uuid.uuid4().hex}.{ext}"
        content_type = att.get('type') or 'application/octet-stream'
        s3.put_object(Bucket='files', Key=key, Body=raw, ContentType=content_type)
        url = f"https://cdn.poehali.dev/projects/{key_prefix}/bucket/{key}"
        result.append({'name': att.get('name', 'file'), 'url': url, 'type': content_type})
    return result


def is_admin(cur, user_identifier):
    try:
        cur.execute(
            f"SELECT role FROM {SCHEMA}.users WHERE id = %s",
            (int(user_identifier),),
        )
        row = cur.fetchone()
        return bool(row and row.get('role') == 'admin')
    except Exception:
        return False


def gen_ticket_number(cur):
    cur.execute(
        f"SELECT COALESCE(MAX(id), 0) + 1 AS nxt FROM {SCHEMA}.support_tickets"
    )
    nxt = cur.fetchone()['nxt']
    return f"AB{nxt:06d}"


def ticket_to_dict(row):
    return {
        'id': row['id'],
        'ticket_number': row['ticket_number'],
        'request_type': row['request_type'],
        'priority': row['priority'],
        'subject': row['subject'],
        'status': row['status'],
        'created_at': str(row['created_at']),
        'closed_at': str(row['closed_at']) if row.get('closed_at') else '',
        'last_message_at': str(row['last_message_at']),
        'last_message_preview': row.get('last_message_preview') or '',
        'user_name': row.get('user_name') or '',
        'user_email': row.get('user_email') or '',
        'user_unread_count': row.get('user_unread_count', 0),
        'admin_unread_count': row.get('admin_unread_count', 0),
    }


def handler(event: dict, context) -> dict:
    """Тикеты техподдержки: список, создание, переписка, вложения, закрытие; админ-операции"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'list')
    headers = event.get('headers') or {}
    user_id_str = headers.get('X-User-Id') or headers.get('x-user-id') or ''

    if not user_id_str:
        return resp(401, {'error': 'Требуется авторизация'})

    user_identifier = str(user_id_str)
    body = {}
    if method == 'POST':
        try:
            body = json.loads(event.get('body') or '{}')
        except Exception:
            body = {}

    conn = get_conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # ---------- USER: список своих обращений ----------
        if method == 'GET' and action == 'list':
            status_filter = params.get('status')
            q = (
                f"SELECT * FROM {SCHEMA}.support_tickets WHERE user_identifier = %s"
            )
            args = [user_identifier]
            if status_filter == 'open':
                q += " AND status != 'closed'"
            elif status_filter == 'closed':
                q += " AND status = 'closed'"
            q += " ORDER BY last_message_at DESC"
            cur.execute(q, args)
            rows = cur.fetchall()
            return resp(200, {'tickets': [ticket_to_dict(r) for r in rows]})

        # ---------- USER: получить тикет + сообщения ----------
        if method == 'GET' and action == 'get':
            ticket_id = params.get('ticket_id')
            cur.execute(
                f"SELECT * FROM {SCHEMA}.support_tickets WHERE id = %s AND user_identifier = %s",
                (ticket_id, user_identifier),
            )
            ticket = cur.fetchone()
            if not ticket:
                return resp(404, {'error': 'Обращение не найдено'})
            cur.execute(
                f"SELECT * FROM {SCHEMA}.support_ticket_messages WHERE ticket_id = %s ORDER BY created_at ASC",
                (ticket_id,),
            )
            msgs = cur.fetchall()
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET user_unread_count = 0 WHERE id = %s",
                (ticket_id,),
            )
            conn.commit()
            return resp(200, {
                'ticket': ticket_to_dict(ticket),
                'messages': [{
                    'id': m['id'],
                    'sender': m['sender'],
                    'sender_name': m.get('sender_name') or '',
                    'body': m.get('body') or '',
                    'attachments': m.get('attachments') or [],
                    'created_at': str(m['created_at']),
                } for m in msgs],
            })

        # ---------- USER: количество непрочитанных по всем тикетам ----------
        if method == 'GET' and action == 'unread':
            cur.execute(
                f"SELECT COALESCE(SUM(user_unread_count), 0) AS cnt FROM {SCHEMA}.support_tickets WHERE user_identifier = %s",
                (user_identifier,),
            )
            return resp(200, {'unread_count': cur.fetchone()['cnt']})

        # ---------- USER: создать обращение ----------
        if method == 'POST' and action == 'create':
            request_type = body.get('request_type', 'question')
            priority = body.get('priority', 'normal')
            subject = (body.get('subject') or '').strip()
            message_body = (body.get('message') or '').strip()
            user_name = body.get('user_name') or ''
            user_email = body.get('user_email') or ''
            if request_type not in REQUEST_TYPES:
                request_type = 'question'
            if priority not in PRIORITIES:
                priority = 'normal'
            if not subject:
                return resp(400, {'error': 'Укажите тему обращения'})
            if not message_body and not body.get('attachments'):
                return resp(400, {'error': 'Опишите ваш вопрос'})

            attachments = upload_attachments(body.get('attachments') or [])
            ticket_number = gen_ticket_number(cur)
            preview = (message_body or 'Вложение')[:200]
            cur.execute(
                f"INSERT INTO {SCHEMA}.support_tickets "
                f"(ticket_number, user_identifier, user_name, user_email, request_type, priority, subject, status, last_message_preview, admin_unread_count) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s, 'open', %s, 1) RETURNING *",
                (ticket_number, user_identifier, user_name, user_email, request_type, priority, subject, preview),
            )
            ticket = cur.fetchone()
            cur.execute(
                f"INSERT INTO {SCHEMA}.support_ticket_messages (ticket_id, sender, sender_name, body, attachments) "
                f"VALUES (%s, 'user', %s, %s, %s)",
                (ticket['id'], user_name, message_body, json.dumps(attachments)),
            )
            conn.commit()
            _safe_notify('notify_new_ticket', cur, ticket_number, subject, user_name)
            conn.commit()
            return resp(200, {'success': True, 'ticket': ticket_to_dict(ticket)})

        # ---------- USER: отправить сообщение в тикет ----------
        if method == 'POST' and action == 'message':
            ticket_id = body.get('ticket_id')
            message_body = (body.get('message') or '').strip()
            user_name = body.get('user_name') or ''
            cur.execute(
                f"SELECT * FROM {SCHEMA}.support_tickets WHERE id = %s AND user_identifier = %s",
                (ticket_id, user_identifier),
            )
            ticket = cur.fetchone()
            if not ticket:
                return resp(404, {'error': 'Обращение не найдено'})
            if ticket['status'] == 'closed':
                return resp(400, {'error': 'Обращение закрыто'})
            if not message_body and not body.get('attachments'):
                return resp(400, {'error': 'Пустое сообщение'})
            attachments = upload_attachments(body.get('attachments') or [])
            cur.execute(
                f"INSERT INTO {SCHEMA}.support_ticket_messages (ticket_id, sender, sender_name, body, attachments) "
                f"VALUES (%s, 'user', %s, %s, %s) RETURNING *",
                (ticket_id, user_name, message_body, json.dumps(attachments)),
            )
            msg = cur.fetchone()
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET last_message_at = NOW(), updated_at = NOW(), "
                f"last_message_preview = %s, admin_unread_count = admin_unread_count + 1 WHERE id = %s",
                ((message_body or 'Вложение')[:200], ticket_id),
            )
            conn.commit()
            _safe_notify('notify_user_reply', cur, user_identifier, ticket['ticket_number'], ticket['subject'])
            conn.commit()
            return resp(200, {'success': True, 'message': {
                'id': msg['id'], 'sender': 'user', 'sender_name': user_name,
                'body': msg.get('body') or '', 'attachments': msg.get('attachments') or [],
                'created_at': str(msg['created_at']),
            }})

        # ---------- USER: закрыть обращение ----------
        if method == 'POST' and action == 'close':
            ticket_id = body.get('ticket_id')
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET status = 'closed', closed_at = NOW(), updated_at = NOW() "
                f"WHERE id = %s AND user_identifier = %s RETURNING *",
                (ticket_id, user_identifier),
            )
            ticket = cur.fetchone()
            if not ticket:
                return resp(404, {'error': 'Обращение не найдено'})
            conn.commit()
            return resp(200, {'success': True, 'ticket': ticket_to_dict(ticket)})

        # ---------- USER: переоткрыть обращение ----------
        if method == 'POST' and action == 'reopen':
            ticket_id = body.get('ticket_id')
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET status = 'open', closed_at = NULL, "
                f"updated_at = NOW(), last_message_at = NOW(), admin_unread_count = admin_unread_count + 1 "
                f"WHERE id = %s AND user_identifier = %s RETURNING *",
                (ticket_id, user_identifier),
            )
            ticket = cur.fetchone()
            if not ticket:
                return resp(404, {'error': 'Обращение не найдено'})
            conn.commit()
            return resp(200, {'success': True, 'ticket': ticket_to_dict(ticket)})

        # ---------- ADMIN ----------
        admin = is_admin(cur, user_identifier)

        if method == 'GET' and action == 'admin_list':
            if not admin:
                return resp(403, {'error': 'Нет доступа'})
            status_filter = params.get('status')
            q = f"SELECT * FROM {SCHEMA}.support_tickets"
            if status_filter == 'open':
                q += " WHERE status != 'closed'"
            elif status_filter == 'closed':
                q += " WHERE status = 'closed'"
            q += " ORDER BY admin_unread_count DESC, last_message_at DESC"
            cur.execute(q)
            rows = cur.fetchall()
            return resp(200, {'tickets': [ticket_to_dict(r) for r in rows]})

        if method == 'GET' and action == 'admin_get':
            if not admin:
                return resp(403, {'error': 'Нет доступа'})
            ticket_id = params.get('ticket_id')
            cur.execute(f"SELECT * FROM {SCHEMA}.support_tickets WHERE id = %s", (ticket_id,))
            ticket = cur.fetchone()
            if not ticket:
                return resp(404, {'error': 'Обращение не найдено'})
            cur.execute(
                f"SELECT * FROM {SCHEMA}.support_ticket_messages WHERE ticket_id = %s ORDER BY created_at ASC",
                (ticket_id,),
            )
            msgs = cur.fetchall()
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET admin_unread_count = 0 WHERE id = %s",
                (ticket_id,),
            )
            conn.commit()
            return resp(200, {
                'ticket': ticket_to_dict(ticket),
                'messages': [{
                    'id': m['id'], 'sender': m['sender'], 'sender_name': m.get('sender_name') or '',
                    'body': m.get('body') or '', 'attachments': m.get('attachments') or [],
                    'created_at': str(m['created_at']),
                } for m in msgs],
            })

        if method == 'GET' and action == 'admin_unread':
            if not admin:
                return resp(403, {'error': 'Нет доступа'})
            cur.execute(
                f"SELECT COALESCE(SUM(admin_unread_count), 0) AS cnt FROM {SCHEMA}.support_tickets"
            )
            return resp(200, {'unread_count': cur.fetchone()['cnt']})

        if method == 'POST' and action == 'admin_message':
            if not admin:
                return resp(403, {'error': 'Нет доступа'})
            ticket_id = body.get('ticket_id')
            message_body = (body.get('message') or '').strip()
            attachments = upload_attachments(body.get('attachments') or [])
            if not message_body and not attachments:
                return resp(400, {'error': 'Пустое сообщение'})
            cur.execute(
                f"INSERT INTO {SCHEMA}.support_ticket_messages (ticket_id, sender, sender_name, body, attachments) "
                f"VALUES (%s, 'admin', 'Поддержка', %s, %s) RETURNING *",
                (ticket_id, message_body, json.dumps(attachments)),
            )
            msg = cur.fetchone()
            new_status = 'in_progress'
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET last_message_at = NOW(), updated_at = NOW(), "
                f"last_message_preview = %s, user_unread_count = user_unread_count + 1, "
                f"status = CASE WHEN status = 'closed' THEN status ELSE %s END WHERE id = %s",
                ((message_body or 'Вложение')[:200], new_status, ticket_id),
            )
            conn.commit()
            cur.execute(
                f"SELECT user_identifier, ticket_number, subject FROM {SCHEMA}.support_tickets WHERE id = %s",
                (ticket_id,),
            )
            trow = cur.fetchone()
            if trow:
                _safe_notify('notify_admin_reply', cur, trow['user_identifier'],
                             trow['ticket_number'], trow['subject'], message_body)
                conn.commit()
            return resp(200, {'success': True, 'message': {
                'id': msg['id'], 'sender': 'admin', 'sender_name': 'Поддержка',
                'body': msg.get('body') or '', 'attachments': msg.get('attachments') or [],
                'created_at': str(msg['created_at']),
            }})

        if method == 'POST' and action == 'admin_status':
            if not admin:
                return resp(403, {'error': 'Нет доступа'})
            ticket_id = body.get('ticket_id')
            new_status = body.get('status')
            if new_status not in STATUSES:
                return resp(400, {'error': 'Неверный статус'})
            cur.execute(
                f"UPDATE {SCHEMA}.support_tickets SET status = %s, updated_at = NOW(), "
                f"closed_at = CASE WHEN %s = 'closed' THEN NOW() ELSE NULL END WHERE id = %s RETURNING *",
                (new_status, new_status, ticket_id),
            )
            ticket = cur.fetchone()
            if not ticket:
                return resp(404, {'error': 'Обращение не найдено'})
            conn.commit()
            return resp(200, {'success': True, 'ticket': ticket_to_dict(ticket)})

        return resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()