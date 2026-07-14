"""Портфолио фотографа: управление настройками, категориями, фото, отзывами и публичная выдача по slug."""

import json
import os
import re
import base64
import uuid
from typing import Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def esc(value: Any) -> str:
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def resp(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {'statusCode': status, 'headers': CORS_HEADERS, 'body': json.dumps(body, default=str), 'isBase64Encoded': False}


def slugify(text: str) -> str:
    translit = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
    }
    text = (text or '').lower().strip()
    out = ''.join(translit.get(ch, ch) for ch in text)
    out = re.sub(r'[^a-z0-9]+', '-', out)
    out = re.sub(r'-+', '-', out).strip('-')
    return out[:100]


def upload_to_s3(base64_data: str, ext: str = 'jpg') -> str:
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    if ',' in base64_data:
        base64_data = base64_data.split(',', 1)[1]
    data = base64.b64decode(base64_data)
    key = f"portfolio/{uuid.uuid4().hex}.{ext}"
    content_type = 'image/png' if ext == 'png' else 'image/jpeg'
    s3.put_object(Bucket='files', Key=key, Body=data, ContentType=content_type)
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def get_or_create_portfolio(cur, user_id: int) -> Dict[str, Any]:
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolios WHERE user_id = {esc(user_id)} LIMIT 1")
    row = cur.fetchone()
    if row:
        return dict(row)
    base = slugify(f"portfolio-{user_id}") or f"portfolio-{user_id}"
    slug = base
    n = 1
    while True:
        cur.execute(f"SELECT 1 FROM {SCHEMA}.portfolios WHERE slug = {esc(slug)}")
        if not cur.fetchone():
            break
        n += 1
        slug = f"{base}-{n}"
    cur.execute(f"""
        INSERT INTO {SCHEMA}.portfolios (user_id, slug, title)
        VALUES ({esc(user_id)}, {esc(slug)}, {esc('Моё портфолио')})
        RETURNING *
    """)
    return dict(cur.fetchone())


def load_full(cur, portfolio_id: int) -> Dict[str, Any]:
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolios WHERE id = {esc(portfolio_id)}")
    p = dict(cur.fetchone())
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolio_categories WHERE portfolio_id = {esc(portfolio_id)} ORDER BY sort_order, id")
    p['categories'] = [dict(r) for r in cur.fetchall()]
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(portfolio_id)} ORDER BY sort_order, id")
    p['photos'] = [dict(r) for r in cur.fetchall()]
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolio_reviews WHERE portfolio_id = {esc(portfolio_id)} ORDER BY sort_order, id")
    p['reviews'] = [dict(r) for r in cur.fetchall()]
    return p


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Управление портфолио фотографа и публичная выдача по slug."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    # ── ПУБЛИЧНАЯ выдача по slug (без авторизации) ──
    if action == 'public':
        slug = params.get('slug', '')
        if not slug:
            return resp(400, {'error': 'slug required'})
        conn = db()
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT * FROM {SCHEMA}.portfolios WHERE slug = {esc(slug)} AND is_published = TRUE")
                row = cur.fetchone()
                if not row:
                    return resp(404, {'error': 'not_found'})
                p = load_full(cur, row['id'])
                cur.execute(f"UPDATE {SCHEMA}.portfolios SET views_count = views_count + 1 WHERE id = {esc(row['id'])}")
                conn.commit()
                p.pop('user_id', None)
                return resp(200, {'portfolio': p})
        finally:
            conn.close()

    if action == 'check_slug':
        slug = slugify(params.get('slug', ''))
        exclude = params.get('exclude_user', '')
        if not slug:
            return resp(200, {'available': False, 'slug': ''})
        conn = db()
        try:
            with conn.cursor() as cur:
                q = f"SELECT user_id FROM {SCHEMA}.portfolios WHERE slug = {esc(slug)}"
                cur.execute(q)
                r = cur.fetchone()
                available = (r is None) or (exclude and str(r['user_id']) == str(exclude))
                return resp(200, {'available': bool(available), 'slug': slug})
        finally:
            conn.close()

    # ── ПРИВАТНЫЕ действия (нужен X-User-Id) ──
    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return resp(401, {'error': 'unauthorized'})
    try:
        user_id = int(user_id)
    except (ValueError, TypeError):
        return resp(401, {'error': 'unauthorized'})

    conn = db()
    try:
        with conn.cursor() as cur:
            portfolio = get_or_create_portfolio(cur, user_id)
            pid = portfolio['id']
            conn.commit()

            if method == 'GET':
                # подтягиваем имя/город из профиля для подсказок slug
                cur.execute(f"SELECT name, display_name, city, phone, email, avatar_url FROM {SCHEMA}.users WHERE id = {esc(user_id)}")
                u = cur.fetchone() or {}
                data = load_full(cur, pid)
                data['user_profile'] = dict(u)
                return resp(200, {'portfolio': data})

            body = json.loads(event.get('body') or '{}')
            act = body.get('action', 'save_settings')

            if act == 'save_settings':
                fields = ['title', 'subtitle', 'about', 'phone', 'email', 'instagram',
                          'telegram', 'vk', 'whatsapp', 'accent_color', 'menu_position', 'logo_text']
                sets = [f"{f} = {esc(body.get(f, portfolio.get(f, '')))}" for f in fields if f in body]
                for bf in ['show_reviews', 'show_about', 'slideshow_enabled', 'is_published']:
                    if bf in body:
                        sets.append(f"{bf} = {esc(bool(body[bf]))}")
                if 'slug' in body:
                    new_slug = slugify(body['slug'])
                    if new_slug:
                        cur.execute(f"SELECT id FROM {SCHEMA}.portfolios WHERE slug = {esc(new_slug)} AND id <> {esc(pid)}")
                        if cur.fetchone():
                            return resp(409, {'error': 'slug_taken'})
                        sets.append(f"slug = {esc(new_slug)}")
                if 'avatar_base64' in body and body['avatar_base64']:
                    url = upload_to_s3(body['avatar_base64'], body.get('avatar_ext', 'jpg'))
                    sets.append(f"avatar_url = {esc(url)}")
                if 'cover_base64' in body and body['cover_base64']:
                    url = upload_to_s3(body['cover_base64'], body.get('cover_ext', 'jpg'))
                    sets.append(f"cover_url = {esc(url)}")
                if sets:
                    sets.append("updated_at = NOW()")
                    cur.execute(f"UPDATE {SCHEMA}.portfolios SET {', '.join(sets)} WHERE id = {esc(pid)}")
                    conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'add_category':
                title = body.get('title', '').strip()
                if not title:
                    return resp(400, {'error': 'title required'})
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.portfolio_categories (portfolio_id, title, slug, sort_order)
                    VALUES ({esc(pid)}, {esc(title)}, {esc(slugify(title))},
                        COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_categories WHERE portfolio_id = {esc(pid)}), 0))
                """)
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'update_category':
                cid = int(body.get('id'))
                title = body.get('title', '').strip()
                cur.execute(f"UPDATE {SCHEMA}.portfolio_categories SET title = {esc(title)}, slug = {esc(slugify(title))} WHERE id = {esc(cid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'delete_category':
                cid = int(body.get('id'))
                cur.execute(f"UPDATE {SCHEMA}.portfolio_photos SET category_id = NULL WHERE category_id = {esc(cid)} AND portfolio_id = {esc(pid)}")
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_categories WHERE id = {esc(cid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'add_photos':
                # из фотобанка: список {photo_url, thumbnail_url, grid_thumbnail_url}
                photos = body.get('photos', [])
                cat_id = body.get('category_id')
                cat_sql = esc(int(cat_id)) if cat_id else 'NULL'
                for ph in photos:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.portfolio_photos (portfolio_id, category_id, photo_url, thumbnail_url, grid_thumbnail_url, source, sort_order)
                        VALUES ({esc(pid)}, {cat_sql}, {esc(ph.get('photo_url', ''))}, {esc(ph.get('thumbnail_url', ''))}, {esc(ph.get('grid_thumbnail_url', ''))}, {esc(ph.get('source', 'photobank'))},
                            COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(pid)}), 0))
                    """)
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'upload_photo':
                # с устройства: base64
                url = upload_to_s3(body['image_base64'], body.get('ext', 'jpg'))
                cat_id = body.get('category_id')
                cat_sql = esc(int(cat_id)) if cat_id else 'NULL'
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.portfolio_photos (portfolio_id, category_id, photo_url, thumbnail_url, grid_thumbnail_url, source, sort_order)
                    VALUES ({esc(pid)}, {cat_sql}, {esc(url)}, {esc(url)}, {esc(url)}, 'device',
                        COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(pid)}), 0))
                    RETURNING id
                """)
                conn.commit()
                return resp(200, {'photo_url': url, 'portfolio': load_full(cur, pid)})

            if act == 'delete_photo':
                phid = int(body.get('id'))
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_photos WHERE id = {esc(phid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'set_photo_category':
                phid = int(body.get('id'))
                cat_id = body.get('category_id')
                cat_sql = esc(int(cat_id)) if cat_id else 'NULL'
                cur.execute(f"UPDATE {SCHEMA}.portfolio_photos SET category_id = {cat_sql} WHERE id = {esc(phid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'add_review':
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.portfolio_reviews (portfolio_id, author_name, text, rating, sort_order)
                    VALUES ({esc(pid)}, {esc(body.get('author_name', ''))}, {esc(body.get('text', ''))}, {esc(int(body.get('rating', 5)))},
                        COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_reviews WHERE portfolio_id = {esc(pid)}), 0))
                """)
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'update_review':
                rid = int(body.get('id'))
                cur.execute(f"UPDATE {SCHEMA}.portfolio_reviews SET author_name = {esc(body.get('author_name', ''))}, text = {esc(body.get('text', ''))}, rating = {esc(int(body.get('rating', 5)))} WHERE id = {esc(rid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'delete_review':
                rid = int(body.get('id'))
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_reviews WHERE id = {esc(rid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            return resp(400, {'error': 'unknown_action'})
    finally:
        conn.close()