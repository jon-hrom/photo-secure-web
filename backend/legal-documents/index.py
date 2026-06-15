"""
Правовые документы (оферта, политика конфиденциальности, согласие на обработку ПД).
Публичное чтение, админ-редактирование с версионированием, журнал согласий пользователей (152-ФЗ).
"""
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
        },
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
    '''Управление правовыми документами и согласиями пользователей.'''
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
        # -------- ПУБЛИЧНО: список документов (для подвала) --------
        if action == 'list':
            cur.execute(
                f"SELECT slug, title, version, sort_order FROM {SCHEMA}.legal_documents ORDER BY sort_order, id"
            )
            return _resp(200, {'documents': cur.fetchall()})

        # -------- ПУБЛИЧНО: один документ с текстом --------
        if action == 'get':
            slug = qs.get('slug') or body.get('slug')
            if not slug:
                return _resp(400, {'error': 'Не указан документ'})
            cur.execute(
                f"SELECT slug, title, content, version, updated_at FROM {SCHEMA}.legal_documents WHERE slug = %s",
                (slug,),
            )
            doc = cur.fetchone()
            if not doc:
                return _resp(404, {'error': 'Документ не найден'})
            return _resp(200, {'document': doc})

        # -------- АВТОРИЗОВАННЫЙ: какие документы пользователь ещё не подписал --------
        if action == 'pending':
            if not user_id:
                return _resp(401, {'error': 'Не авторизован'})
            cur.execute(
                f"SELECT d.id, d.slug, d.title, d.content, d.version "
                f"FROM {SCHEMA}.legal_documents d "
                f"WHERE d.requires_consent = TRUE AND NOT EXISTS ("
                f"  SELECT 1 FROM {SCHEMA}.legal_consents c "
                f"  WHERE c.user_id = %s AND c.slug = d.slug AND c.version = d.version) "
                f"ORDER BY d.sort_order, d.id",
                (int(user_id),),
            )
            return _resp(200, {'pending': cur.fetchall()})

        # -------- АВТОРИЗОВАННЫЙ: записать согласие --------
        if action == 'accept':
            if not user_id:
                return _resp(401, {'error': 'Не авторизован'})
            slugs = body.get('slugs')
            ip = (event.get('requestContext') or {}).get('identity', {}).get('sourceIp')
            if not slugs:
                return _resp(400, {'error': 'Не указаны документы'})
            for slug in slugs:
                cur.execute(
                    f"SELECT id, version FROM {SCHEMA}.legal_documents WHERE slug = %s",
                    (slug,),
                )
                d = cur.fetchone()
                if not d:
                    continue
                cur.execute(
                    f"INSERT INTO {SCHEMA}.legal_consents (user_id, document_id, slug, version, ip_address) "
                    f"VALUES (%s, %s, %s, %s, %s) ON CONFLICT (user_id, slug, version) DO NOTHING",
                    (int(user_id), d['id'], slug, d['version'], ip),
                )
            conn.commit()
            return _resp(200, {'success': True})

        # -------- АДМИН: полный список с контентом --------
        if action == 'admin_list':
            if not _is_admin(cur, user_id):
                return _resp(403, {'error': 'Нет доступа'})
            cur.execute(
                f"SELECT id, slug, title, content, version, sort_order, requires_consent, updated_at "
                f"FROM {SCHEMA}.legal_documents ORDER BY sort_order, id"
            )
            return _resp(200, {'documents': cur.fetchall()})

        # -------- АДМИН: сохранить и опубликовать новую версию --------
        if action == 'admin_publish':
            if not _is_admin(cur, user_id):
                return _resp(403, {'error': 'Нет доступа'})
            slug = body.get('slug')
            content = body.get('content')
            title = body.get('title')
            if not slug or content is None:
                return _resp(400, {'error': 'Не указан документ или текст'})
            cur.execute(
                f"SELECT id, version, title, content FROM {SCHEMA}.legal_documents WHERE slug = %s",
                (slug,),
            )
            doc = cur.fetchone()
            if not doc:
                return _resp(404, {'error': 'Документ не найден'})
            content_changed = content != doc['content']
            new_title = title if title else doc['title']
            new_version = doc['version'] + 1 if content_changed else doc['version']
            cur.execute(
                f"UPDATE {SCHEMA}.legal_documents "
                f"SET content = %s, title = %s, version = %s, published_at = NOW(), updated_at = NOW() "
                f"WHERE slug = %s",
                (content, new_title, new_version, slug),
            )
            if content_changed:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.legal_document_versions "
                    f"(document_id, slug, version, title, content, published_by) "
                    f"VALUES (%s, %s, %s, %s, %s, %s)",
                    (doc['id'], slug, new_version, new_title, content, int(user_id)),
                )
            conn.commit()
            return _resp(200, {'success': True, 'version': new_version, 'changed': content_changed})

        return _resp(400, {'error': 'Неизвестное действие'})
    except Exception as e:
        conn.rollback()
        print(f'[legal-documents] error: {e}')
        return _resp(500, {'error': 'Внутренняя ошибка'})
    finally:
        cur.close()
        conn.close()
