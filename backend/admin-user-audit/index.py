"""
Админ-аудит пользователя: полная история согласий (юридические документы + рекуррентные списания)
и журнал действий пользователя (что открывал, что нажимал). Плюс приём событий активности от фронтенда.
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
}


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': HEADERS,
        'isBase64Encoded': False,
        'body': json.dumps(body, default=str),
    }


def _is_admin(cur, user_id):
    if not user_id:
        return False
    try:
        cur.execute(f"SELECT role FROM {SCHEMA}.users WHERE id = %s", (int(user_id),))
        row = cur.fetchone()
        return bool(row and row['role'] == 'admin')
    except Exception:
        return False


def handler(event: dict, context) -> dict:
    '''Аудит согласий и журнал действий пользователей для админ-панели.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return _resp(200, {})

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id') or ''
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            body = {}
    if not action:
        action = body.get('action', '')

    conn = psycopg2.connect(os.environ['DATABASE_URL'], cursor_factory=RealDictCursor)
    cur = conn.cursor()
    try:
        # -------- ЗАПИСЬ СОБЫТИЯ АКТИВНОСТИ (доступно самому пользователю) --------
        if action == 'log':
            uid = body.get('user_id') or user_id
            if not uid:
                return _resp(200, {'ok': False})
            ip = (event.get('requestContext') or {}).get('identity', {}).get('sourceIp', '')
            ua = headers.get('User-Agent') or headers.get('user-agent') or ''
            cur.execute(
                f"INSERT INTO {SCHEMA}.user_activity_log "
                f"(user_id, event_type, action, page_path, details, ip_address, user_agent) "
                f"VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (
                    int(uid),
                    str(body.get('event_type', 'action'))[:50],
                    str(body.get('act') or body.get('action_name') or '')[:255],
                    (str(body.get('page_path'))[:512] if body.get('page_path') else None),
                    (json.dumps(body.get('details'), ensure_ascii=False) if body.get('details') is not None else None),
                    ip,
                    ua,
                ),
            )
            conn.commit()
            return _resp(200, {'ok': True})

        # Всё остальное — только для админа
        if not _is_admin(cur, user_id):
            return _resp(403, {'error': 'Нет доступа'})

        # -------- СПИСОК ПОЛЬЗОВАТЕЛЕЙ (поиск) --------
        if action == 'users':
            q = (qs.get('q') or '').strip()
            if q:
                like = f'%{q}%'
                cur.execute(
                    f"SELECT id, COALESCE(name, display_name, email, phone, '') AS display, "
                    f"email, phone, role, created_at, last_login "
                    f"FROM {SCHEMA}.users "
                    f"WHERE CAST(id AS TEXT) = %s OR email ILIKE %s OR phone ILIKE %s "
                    f"OR name ILIKE %s OR display_name ILIKE %s "
                    f"ORDER BY id DESC LIMIT 50",
                    (q, like, like, like, like),
                )
            else:
                cur.execute(
                    f"SELECT id, COALESCE(name, display_name, email, phone, '') AS display, "
                    f"email, phone, role, created_at, last_login "
                    f"FROM {SCHEMA}.users ORDER BY id DESC LIMIT 50"
                )
            return _resp(200, {'users': cur.fetchall()})

        # -------- ПОЛНЫЙ АУДИТ ПО ОДНОМУ ПОЛЬЗОВАТЕЛЮ --------
        if action == 'user_audit':
            target = qs.get('target_id') or body.get('target_id')
            if not target:
                return _resp(400, {'error': 'Не указан пользователь'})
            target = int(target)

            cur.execute(
                f"SELECT id, name, display_name, email, phone, role, created_at, registered_at, "
                f"last_login, ip_address, user_agent, is_blocked, blocked_reason, plan_id "
                f"FROM {SCHEMA}.users WHERE id = %s",
                (target,),
            )
            user = cur.fetchone()
            if not user:
                return _resp(404, {'error': 'Пользователь не найден'})

            # Согласия с юридическими документами
            cur.execute(
                f"SELECT lc.slug, lc.version, lc.accepted_at, lc.ip_address, ld.title "
                f"FROM {SCHEMA}.legal_consents lc "
                f"LEFT JOIN {SCHEMA}.legal_documents ld ON ld.slug = lc.slug "
                f"WHERE lc.user_id = %s ORDER BY lc.accepted_at DESC",
                (target,),
            )
            legal_consents = cur.fetchall()

            # Согласия на рекуррентные списания
            cur.execute(
                f"SELECT plan_id, plan_name, amount_rub, duration_months, consent_text, "
                f"ip_address, user_agent, offer_version, created_at "
                f"FROM {SCHEMA}.recurring_consent_log "
                f"WHERE user_id = %s ORDER BY created_at DESC",
                (target,),
            )
            recurring_consents = cur.fetchall()

            # Журнал действий (последние 300 событий)
            limit = int(qs.get('limit') or 300)
            if limit > 1000:
                limit = 1000
            cur.execute(
                f"SELECT event_type, action, page_path, details, ip_address, created_at "
                f"FROM {SCHEMA}.user_activity_log "
                f"WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
                (target, limit),
            )
            activity = cur.fetchall()

            return _resp(200, {
                'user': user,
                'legal_consents': legal_consents,
                'recurring_consents': recurring_consents,
                'activity': activity,
            })

        return _resp(400, {'error': 'Неизвестное действие'})
    except Exception as e:
        conn.rollback()
        print(f'[admin-user-audit] error: {e}')
        return _resp(500, {'error': 'Внутренняя ошибка'})
    finally:
        cur.close()
        conn.close()