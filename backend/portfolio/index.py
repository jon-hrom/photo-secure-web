"""Портфолио фотографа: управление настройками, категориями, фото, отзывами и публичная выдача по slug."""

import json
import os
import re
import base64
import uuid
import urllib.request
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


ACCOUNT_NOTIFY_URL = 'https://functions.poehali.dev/144eb550-4428-40c4-bc1a-acd169042a99'


def notify_new_review(photographer_id: Any, author: str, rating: int, text: str) -> None:
    """Шлёт фотографу уведомление о новом отзыве (email / Telegram / MAX). Ошибки не критичны."""
    if not photographer_id:
        return
    try:
        payload = json.dumps({
            'event_type': 'portfolio_review',
            'user_id': int(photographer_id),
            'review_author': author,
            'review_rating': int(rating),
            'review_text': text,
        }).encode('utf-8')
        req = urllib.request.Request(
            ACCOUNT_NOTIFY_URL, data=payload,
            headers={'Content-Type': 'application/json'}, method='POST',
        )
        urllib.request.urlopen(req, timeout=8)
    except Exception as e:
        print(f'[PORTFOLIO-NOTIFY] error: {e}')


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


S3_BUCKET = 'foto-mix'
S3_ENDPOINT = 'https://storage.yandexcloud.net'
PRESIGN_TTL = 604800  # 7 суток


def s3_client():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=os.environ['YC_S3_KEY_ID'],
        aws_secret_access_key=os.environ['YC_S3_SECRET'],
    )


def upload_to_s3(base64_data: str, ext: str = 'jpg', user_id: Any = None):
    """Грузит фото в приватный бакет foto-mix. Возвращает (presigned_url, s3_key)."""
    if ',' in base64_data:
        base64_data = base64_data.split(',', 1)[1]
    data = base64.b64decode(base64_data)
    # Все фото одного фотографа — в его собственной папке portfolio/<user_id>/
    folder = f"portfolio/{user_id}" if user_id is not None else "portfolio"
    key = f"{folder}/{uuid.uuid4().hex}.{ext}"
    content_type = 'image/png' if ext == 'png' else 'image/jpeg'
    s3 = s3_client()
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=data, ContentType=content_type)
    return presign(key, s3), key


def presign(key: str, s3=None) -> str:
    """Подписанная ссылка на приватный объект foto-mix."""
    if not key:
        return ''
    s3 = s3 or s3_client()
    return s3.generate_presigned_url('get_object', Params={'Bucket': S3_BUCKET, 'Key': key}, ExpiresIn=PRESIGN_TTL)


def _key_from_own_url(src_url: str):
    """Если ссылка ведёт на наш бакет foto-mix — извлекаем ключ объекта (без query)."""
    if not src_url:
        return None
    marker = f"/{S3_BUCKET}/"
    idx = src_url.find(marker)
    if idx == -1:
        return None
    key = src_url[idx + len(marker):]
    key = key.split('?', 1)[0]
    return key or None


def copy_key_to_portfolio(src_key: str, user_id: Any = None, s3=None):
    """Копирует объект внутри foto-mix в папку портфолио. Возвращает (presigned_url, new_key) или (None, None)."""
    if not src_key:
        return None, None
    try:
        s3 = s3 or s3_client()
        ext = src_key.rsplit('.', 1)[-1].lower() if '.' in src_key.rsplit('/', 1)[-1] else 'jpg'
        folder = f"portfolio/{user_id}" if user_id is not None else "portfolio"
        new_key = f"{folder}/{uuid.uuid4().hex}.{ext}"
        s3.copy_object(Bucket=S3_BUCKET, CopySource={'Bucket': S3_BUCKET, 'Key': src_key}, Key=new_key)
        return presign(new_key, s3), new_key
    except Exception:
        return None, None


def copy_url_to_s3(src_url: str, user_id: Any = None, s3=None):
    """Скачивает файл по ссылке (CDN/presigned фотобанка) и кладёт в собственную папку
    портфолио portfolio/<user_id>/. Возвращает (presigned_url, s3_key) либо (src_url, None) при ошибке."""
    if not src_url:
        return '', None
    # Если ссылка на наш же бакет — копируем объект напрямую (не зависит от истёкшего presign)
    own_key = _key_from_own_url(src_url)
    if own_key:
        url, new_key = copy_key_to_portfolio(own_key, user_id, s3)
        if new_key:
            return url, new_key
    try:
        req = urllib.request.Request(src_url, headers={'User-Agent': 'portfolio-copy/1.0'})
        with urllib.request.urlopen(req, timeout=25) as r:
            data = r.read()
            content_type = r.headers.get('Content-Type', 'image/jpeg')
        ext = 'png' if 'png' in content_type else ('webp' if 'webp' in content_type else 'jpg')
        folder = f"portfolio/{user_id}" if user_id is not None else "portfolio"
        key = f"{folder}/{uuid.uuid4().hex}.{ext}"
        s3 = s3 or s3_client()
        s3.put_object(Bucket=S3_BUCKET, Key=key, Body=data, ContentType=content_type)
        return presign(key, s3), key
    except Exception:
        # если не смогли скопировать — оставляем исходную ссылку, чтобы не потерять фото
        return src_url, None


def copy_review_photos(urls: List[str], user_id: Any) -> List[str]:
    """Копирует выбранные клиентом фото в постоянное хранилище портфолио.
    Возвращает список постоянных s3_key (чтобы ссылки не протухали)."""
    keys: List[str] = []
    if not urls:
        return keys
    s3 = None
    for u in urls[:6]:
        if not u:
            continue
        try:
            s3 = s3 or s3_client()
            _, key = copy_url_to_s3(u, user_id, s3)
            if key:
                keys.append(key)
        except Exception as e:
            print(f'[REVIEW-PHOTO] copy error: {e}')
    return keys


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


def load_full(cur, portfolio_id: int, only_approved: bool = False) -> Dict[str, Any]:
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolios WHERE id = {esc(portfolio_id)}")
    p = dict(cur.fetchone())
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolio_categories WHERE portfolio_id = {esc(portfolio_id)} ORDER BY sort_order, id")
    p['categories'] = [dict(r) for r in cur.fetchall()]
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolio_shootings WHERE portfolio_id = {esc(portfolio_id)} ORDER BY sort_order, id")
    p['shootings'] = [dict(r) for r in cur.fetchall()]
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(portfolio_id)} ORDER BY sort_order, id")
    all_photos = [dict(r) for r in cur.fetchall()]
    p['photos'] = [ph for ph in all_photos if not ph.get('is_slider')]
    p['slider_photos'] = [ph for ph in all_photos if ph.get('is_slider')]
    review_where = f"portfolio_id = {esc(portfolio_id)}"
    if only_approved:
        review_where += " AND is_approved = TRUE"
    cur.execute(f"SELECT * FROM {SCHEMA}.portfolio_reviews WHERE {review_where} ORDER BY sort_order, id DESC")
    p['reviews'] = [dict(r) for r in cur.fetchall()]
    p['pending_reviews_count'] = 0
    if not only_approved:
        cur.execute(f"SELECT COUNT(*) AS c FROM {SCHEMA}.portfolio_reviews WHERE portfolio_id = {esc(portfolio_id)} AND is_approved = FALSE")
        p['pending_reviews_count'] = cur.fetchone()['c']
    _sign_photos(p)
    return p


def _sign_photos(p: Dict[str, Any]) -> None:
    """Для фото, лежащих в приватном foto-mix (есть s3_key), выдаём свежие presigned-ссылки."""
    s3 = None
    for ph in list(p.get('photos', [])) + list(p.get('slider_photos', [])):
        key = ph.get('s3_key')
        if key:
            s3 = s3 or s3_client()
            url = presign(key, s3)
            ph['photo_url'] = url
            thumb_key = ph.get('thumb_s3_key')
            grid_key = ph.get('grid_s3_key')
            ph['thumbnail_url'] = presign(thumb_key, s3) if thumb_key else url
            ph['grid_thumbnail_url'] = presign(grid_key, s3) if grid_key else (ph['thumbnail_url'] or url)
    for rev in p.get('reviews', []):
        keys = list(rev.get('photo_keys') or [])
        if not keys:
            # старые отзывы: ссылки вели на наш бакет — вытащим постоянный ключ и переподпишем
            for u in (rev.get('photos') or []):
                k = _key_from_own_url(u)
                if k:
                    keys.append(k)
        if keys:
            s3 = s3 or s3_client()
            rev['photos'] = [presign(k, s3) for k in keys if k]
        rev.pop('photo_keys', None)
    if p.get('avatar_s3_key'):
        s3 = s3 or s3_client()
        p['avatar_url'] = presign(p['avatar_s3_key'], s3)
    if p.get('cover_s3_key'):
        s3 = s3 or s3_client()
        p['cover_url'] = presign(p['cover_s3_key'], s3)


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
                p = load_full(cur, row['id'], only_approved=True)
                cur.execute(f"UPDATE {SCHEMA}.portfolios SET views_count = views_count + 1 WHERE id = {esc(row['id'])}")
                conn.commit()
                p.pop('user_id', None)
                p.pop('pending_reviews_count', None)
                return resp(200, {'portfolio': p})
        finally:
            conn.close()

    # ── ПУБЛИЧНАЯ отправка отзыва клиентом (без авторизации) ──
    if action == 'submit_review' and method == 'POST':
        body = json.loads(event.get('body') or '{}')
        slug = body.get('slug', '')
        author = (body.get('author_name') or '').strip()[:120]
        text = (body.get('text') or '').strip()
        rating = int(body.get('rating') or 5)
        rating = max(1, min(5, rating))
        style = (body.get('shooting_style') or '').strip()[:200]
        photos = body.get('photos') or []
        if not slug or not author or not text:
            return resp(400, {'error': 'author_name, text, slug required'})
        # оставляем максимум 6 фото-ссылок
        clean_photos = [str(u)[:2000] for u in photos if u][:6]
        conn = db()
        try:
            with conn.cursor() as cur:
                cur.execute(f"SELECT id, user_id FROM {SCHEMA}.portfolios WHERE slug = {esc(slug)} AND is_published = TRUE")
                row = cur.fetchone()
                if not row:
                    return resp(404, {'error': 'not_found'})
                pid = row['id']
                photographer_id = row.get('user_id')
                # Копируем выбранные клиентом фото в постоянное хранилище — иначе presigned-ссылки протухнут
                photo_keys = copy_review_photos(clean_photos, photographer_id)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.portfolio_reviews
                        (portfolio_id, author_name, text, rating, shooting_style, photos, photo_keys, is_approved, source, sort_order)
                    VALUES ({esc(pid)}, {esc(author)}, {esc(text)}, {esc(rating)}, {esc(style)},
                        {esc(json.dumps(clean_photos, ensure_ascii=False))}::jsonb,
                        {esc(json.dumps(photo_keys, ensure_ascii=False))}::jsonb, FALSE, 'client', 0)
                """)
                conn.commit()
                notify_new_review(photographer_id, author, rating, text)
                return resp(200, {'ok': True, 'moderation': True})
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
                          'telegram', 'vk', 'whatsapp', 'max', 'accent_color', 'menu_position', 'logo_text']
                sets = [f"{f} = {esc(body.get(f, portfolio.get(f, '')))}" for f in fields if f in body]
                for bf in ['show_reviews', 'show_about', 'slideshow_enabled', 'is_published', 'show_stories_block']:
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
                    url, key = upload_to_s3(body['avatar_base64'], body.get('avatar_ext', 'jpg'), user_id)
                    sets.append(f"avatar_url = {esc(url)}")
                    sets.append(f"avatar_s3_key = {esc(key)}")
                if 'cover_base64' in body and body['cover_base64']:
                    url, key = upload_to_s3(body['cover_base64'], body.get('cover_ext', 'jpg'), user_id)
                    sets.append(f"cover_url = {esc(url)}")
                    sets.append(f"cover_s3_key = {esc(key)}")
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

            if act == 'set_category_cover':
                cid = int(body.get('id'))
                cover = body.get('cover_url', '')
                cur.execute(f"UPDATE {SCHEMA}.portfolio_categories SET cover_url = {esc(cover)} WHERE id = {esc(cid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'delete_category':
                cid = int(body.get('id'))
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_photos WHERE category_id = {esc(cid)} AND portfolio_id = {esc(pid)}")
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_shootings WHERE category_id = {esc(cid)} AND portfolio_id = {esc(pid)}")
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_categories WHERE id = {esc(cid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'add_shooting':
                cat_id = int(body.get('category_id'))
                title = body.get('title', '').strip()
                if not title:
                    return resp(400, {'error': 'title required'})
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.portfolio_shootings (portfolio_id, category_id, title, slug, sort_order)
                    VALUES ({esc(pid)}, {esc(cat_id)}, {esc(title)}, {esc(slugify(title))},
                        COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_shootings WHERE category_id = {esc(cat_id)}), 0))
                """)
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'update_shooting':
                sid = int(body.get('id'))
                title = body.get('title', '').strip()
                cur.execute(f"UPDATE {SCHEMA}.portfolio_shootings SET title = {esc(title)}, slug = {esc(slugify(title))} WHERE id = {esc(sid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'set_shooting_cover':
                sid = int(body.get('id'))
                cover = body.get('cover_url', '')
                cur.execute(f"UPDATE {SCHEMA}.portfolio_shootings SET cover_url = {esc(cover)} WHERE id = {esc(sid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'delete_shooting':
                sid = int(body.get('id'))
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_photos WHERE shooting_id = {esc(sid)} AND portfolio_id = {esc(pid)}")
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_shootings WHERE id = {esc(sid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'add_photos':
                # из фотобанка: список {photo_url, thumbnail_url, grid_thumbnail_url}.
                # КОПИРУЕМ файлы в собственное хранилище портфолио, чтобы фото жили независимо
                # от фотобанка (не пропадали при удалении папки/фото в фотобанке).
                photos = body.get('photos', [])
                cat_id = body.get('category_id')
                cat_sql = esc(int(cat_id)) if cat_id else 'NULL'
                sh_id = body.get('shooting_id')
                sh_sql = esc(int(sh_id)) if sh_id else 'NULL'
                s3 = s3_client()
                for ph in photos:
                    photo_url, key = copy_url_to_s3(ph.get('photo_url', ''), user_id, s3)
                    thumb_src = ph.get('thumbnail_url') or ph.get('photo_url', '')
                    grid_src = ph.get('grid_thumbnail_url') or thumb_src
                    thumb_url, thumb_key = copy_url_to_s3(thumb_src, user_id, s3)
                    grid_url, grid_key = copy_url_to_s3(grid_src, user_id, s3)
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.portfolio_photos (portfolio_id, category_id, shooting_id, photo_url, thumbnail_url, grid_thumbnail_url, s3_key, thumb_s3_key, grid_s3_key, source, sort_order)
                        VALUES ({esc(pid)}, {cat_sql}, {sh_sql}, {esc(photo_url)}, {esc(thumb_url)}, {esc(grid_url)}, {esc(key)}, {esc(thumb_key)}, {esc(grid_key)}, 'photobank',
                            COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(pid)}), 0))
                    """)
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'upload_photo':
                # с устройства: base64 → приватный foto-mix, в БД храним s3_key
                url, key = upload_to_s3(body['image_base64'], body.get('ext', 'jpg'), user_id)
                cat_id = body.get('category_id')
                cat_sql = esc(int(cat_id)) if cat_id else 'NULL'
                sh_id = body.get('shooting_id')
                sh_sql = esc(int(sh_id)) if sh_id else 'NULL'
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.portfolio_photos (portfolio_id, category_id, shooting_id, photo_url, thumbnail_url, grid_thumbnail_url, s3_key, source, sort_order)
                    VALUES ({esc(pid)}, {cat_sql}, {sh_sql}, {esc(url)}, {esc(url)}, {esc(url)}, {esc(key)}, 'device',
                        COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(pid)}), 0))
                    RETURNING id
                """)
                conn.commit()
                return resp(200, {'photo_url': url, 'portfolio': load_full(cur, pid)})

            if act == 'repair_photobank':
                # Одноразовый ремонт: копирует ранее добавленные из фотобанка фото
                # (которые хранились ссылками) в собственное хранилище портфолио.
                cur.execute(f"""
                    SELECT id, photo_url, thumbnail_url, grid_thumbnail_url FROM {SCHEMA}.portfolio_photos
                    WHERE portfolio_id = {esc(pid)} AND s3_key IS NULL AND source = 'photobank'
                    ORDER BY id LIMIT 10
                """)
                rows = cur.fetchall()
                s3 = s3_client()
                fixed = 0
                for r in rows:
                    photo_url, key = copy_url_to_s3(r.get('photo_url', ''), user_id, s3)
                    if not key:
                        continue
                    thumb_src = r.get('thumbnail_url') or r.get('photo_url', '')
                    grid_src = r.get('grid_thumbnail_url') or thumb_src
                    thumb_url, thumb_key = copy_url_to_s3(thumb_src, user_id, s3)
                    grid_url, grid_key = copy_url_to_s3(grid_src, user_id, s3)
                    cur.execute(f"""
                        UPDATE {SCHEMA}.portfolio_photos
                        SET photo_url = {esc(photo_url)}, thumbnail_url = {esc(thumb_url)}, grid_thumbnail_url = {esc(grid_url)},
                            s3_key = {esc(key)}, thumb_s3_key = {esc(thumb_key)}, grid_s3_key = {esc(grid_key)}
                        WHERE id = {esc(r['id'])} AND portfolio_id = {esc(pid)}
                    """)
                    fixed += 1
                conn.commit()
                cur.execute(f"SELECT COUNT(*) AS c FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(pid)} AND s3_key IS NULL AND source = 'photobank'")
                remaining = cur.fetchone()['c']
                return resp(200, {'fixed': fixed, 'remaining': remaining, 'portfolio': load_full(cur, pid)})

            if act == 'delete_photo':
                phid = int(body.get('id'))
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_photos WHERE id = {esc(phid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'upload_slider_photo':
                # Вертикальное фото для слайдера портфолио (с устройства): base64 → foto-mix
                url, key = upload_to_s3(body['image_base64'], body.get('ext', 'jpg'), user_id)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.portfolio_photos (portfolio_id, category_id, shooting_id, photo_url, thumbnail_url, grid_thumbnail_url, s3_key, source, is_slider, sort_order)
                    VALUES ({esc(pid)}, NULL, NULL, {esc(url)}, {esc(url)}, {esc(url)}, {esc(key)}, 'device', TRUE,
                        COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(pid)} AND is_slider = TRUE), 0))
                    RETURNING id
                """)
                conn.commit()
                return resp(200, {'photo_url': url, 'portfolio': load_full(cur, pid)})

            if act == 'add_slider_photos':
                # Вертикальные фото для слайдера из фотобанка — копируем в своё хранилище
                photos = body.get('photos', [])
                s3 = s3_client()
                for ph in photos:
                    photo_url, key = copy_url_to_s3(ph.get('photo_url', ''), user_id, s3)
                    thumb_src = ph.get('thumbnail_url') or ph.get('photo_url', '')
                    grid_src = ph.get('grid_thumbnail_url') or thumb_src
                    thumb_url, thumb_key = copy_url_to_s3(thumb_src, user_id, s3)
                    grid_url, grid_key = copy_url_to_s3(grid_src, user_id, s3)
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.portfolio_photos (portfolio_id, category_id, shooting_id, photo_url, thumbnail_url, grid_thumbnail_url, s3_key, thumb_s3_key, grid_s3_key, source, is_slider, sort_order)
                        VALUES ({esc(pid)}, NULL, NULL, {esc(photo_url)}, {esc(thumb_url)}, {esc(grid_url)}, {esc(key)}, {esc(thumb_key)}, {esc(grid_key)}, 'photobank', TRUE,
                            COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_photos WHERE portfolio_id = {esc(pid)} AND is_slider = TRUE), 0))
                    """)
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'delete_slider_photo':
                phid = int(body.get('id'))
                cur.execute(f"DELETE FROM {SCHEMA}.portfolio_photos WHERE id = {esc(phid)} AND portfolio_id = {esc(pid)} AND is_slider = TRUE")
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
                photos = body.get('photos') or []
                clean_photos = [str(u)[:2000] for u in photos if u][:6]
                photo_keys = copy_review_photos(clean_photos, user_id)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.portfolio_reviews (portfolio_id, author_name, text, rating, shooting_style, photos, photo_keys, is_approved, source, sort_order)
                    VALUES ({esc(pid)}, {esc(body.get('author_name', ''))}, {esc(body.get('text', ''))}, {esc(int(body.get('rating', 5)))},
                        {esc((body.get('shooting_style') or '')[:200])},
                        {esc(json.dumps(clean_photos, ensure_ascii=False))}::jsonb,
                        {esc(json.dumps(photo_keys, ensure_ascii=False))}::jsonb, TRUE, 'photographer',
                        COALESCE((SELECT MAX(sort_order)+1 FROM {SCHEMA}.portfolio_reviews WHERE portfolio_id = {esc(pid)}), 0))
                """)
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'update_review':
                rid = int(body.get('id'))
                style_sql = ''
                if 'shooting_style' in body:
                    style_sql = f", shooting_style = {esc((body.get('shooting_style') or '')[:200])}"
                cur.execute(f"UPDATE {SCHEMA}.portfolio_reviews SET author_name = {esc(body.get('author_name', ''))}, text = {esc(body.get('text', ''))}, rating = {esc(int(body.get('rating', 5)))}{style_sql} WHERE id = {esc(rid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'approve_review':
                rid = int(body.get('id'))
                cur.execute(f"UPDATE {SCHEMA}.portfolio_reviews SET is_approved = TRUE WHERE id = {esc(rid)} AND portfolio_id = {esc(pid)}")
                conn.commit()
                return resp(200, {'portfolio': load_full(cur, pid)})

            if act == 'unpublish_review':
                rid = int(body.get('id'))
                cur.execute(f"UPDATE {SCHEMA}.portfolio_reviews SET is_approved = FALSE WHERE id = {esc(rid)} AND portfolio_id = {esc(pid)}")
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