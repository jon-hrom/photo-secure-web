"""
Business: Удаление аккаунта пользователя с подтверждением кодом на email и очисткой фото из S3
Args: event - dict с httpMethod, body (action, user_id, code), headers
      context - object с request_id
Returns: HTTP response dict со статусом операции
"""

import json
import os
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.exceptions import ClientError

SCHEMA = 't_p28211681_photo_secure_web'

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
}


def resp(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body),
        'isBase64Encoded': False,
    }


def get_conn():
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        raise Exception('DATABASE_URL not configured')
    return psycopg2.connect(dsn, cursor_factory=RealDictCursor)


def esc(value) -> str:
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, datetime):
        return "'" + value.isoformat() + "'"
    return "'" + str(value).replace("'", "''") + "'"


def generate_code() -> str:
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])


def send_email(to_email: str, subject: str, html_body: str) -> bool:
    try:
        access_key_id = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        secret_access_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        if not access_key_id or not secret_access_key:
            print('Error: POSTBOX credentials not set')
            return False
        client = boto3.client(
            'sesv2',
            region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )
        client.send_email(
            FromEmailAddress='FotoMix <info@foto-mix.ru>',
            Destination={'ToAddresses': [to_email]},
            Content={'Simple': {
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}},
            }},
        )
        return True
    except Exception as e:
        print(f'Email error: {str(e)}')
        return False


def send_removal_code_email(to_email: str, code: str) -> bool:
    subject = 'Удаление аккаунта — foto-mix.ru'
    html = f'''<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #dc2626; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
        <h1 style="color: white; margin: 0; font-size: 26px;">Удаление аккаунта</h1>
    </div>
    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
        <p style="font-size: 16px;">Вы запросили <strong style="color:#dc2626;">безвозвратное удаление</strong> вашего аккаунта на foto-mix.ru.</p>
        <p style="font-size: 15px;">Будут удалены все данные, включая все фотографии в фотобанке. Восстановление будет невозможно.</p>
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; border: 2px dashed #dc2626; margin: 20px 0;">
            <p style="color: #666; margin-bottom: 10px; font-size: 14px;">Код подтверждения:</p>
            <p style="font-size: 32px; font-weight: bold; color: #dc2626; letter-spacing: 8px; margin: 0;">{code}</p>
        </div>
        <p style="font-size: 13px; color: #999;">Код действует 10 минут. Если вы не запрашивали удаление — просто проигнорируйте это письмо, аккаунт останется в безопасности.</p>
    </div>
</body></html>'''
    return send_email(to_email, subject, html)


def get_user(cur, user_id: int):
    cur.execute(
        f"SELECT id, email, phone, source, registered_at FROM {SCHEMA}.users WHERE id = {int(user_id)}"
    )
    return cur.fetchone()


def delete_s3_objects(keys: List[str]) -> int:
    if not keys:
        return 0
    access = os.environ.get('AWS_ACCESS_KEY_ID')
    secret = os.environ.get('AWS_SECRET_ACCESS_KEY')
    if not access or not secret:
        return 0
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=access,
        aws_secret_access_key=secret,
    )
    deleted = 0
    for i in range(0, len(keys), 1000):
        batch = keys[i:i + 1000]
        objects = [{'Key': k} for k in batch if k]
        if not objects:
            continue
        try:
            s3.delete_objects(Bucket='files', Delete={'Objects': objects})
            deleted += len(objects)
        except ClientError as e:
            print(f'S3 delete error: {str(e)}')
    return deleted


def delete_audit_log(user_id: int) -> int:
    """Удаляет папку самописца uploads/{user_id}/audit/ из S3 (bucket foto-mix)."""
    key_id = os.environ.get('YC_S3_KEY_ID')
    secret = os.environ.get('YC_S3_SECRET')
    if not key_id or not secret:
        return 0
    try:
        from botocore.client import Config
        s3 = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            region_name='ru-central1',
            aws_access_key_id=key_id,
            aws_secret_access_key=secret,
            config=Config(signature_version='s3v4'),
        )
        prefix = f'uploads/{int(user_id)}/audit/'
        keys: List[str] = []
        token = None
        while True:
            kwargs = {'Bucket': 'foto-mix', 'Prefix': prefix}
            if token:
                kwargs['ContinuationToken'] = token
            resp = s3.list_objects_v2(**kwargs)
            for obj in resp.get('Contents', []):
                keys.append(obj['Key'])
            if resp.get('IsTruncated'):
                token = resp.get('NextContinuationToken')
            else:
                break
        if not keys:
            return 0
        s3.delete_objects(Bucket='foto-mix', Delete={'Objects': [{'Key': k} for k in keys]})
        print(f'Deleted {len(keys)} audit objects for user {user_id}')
        return len(keys)
    except Exception as e:
        print(f'audit delete error: {str(e)}')
        return 0


def purge_user_data(cur, user_id: int) -> Dict[str, int]:
    uid = int(user_id)

    cur.execute(
        f"SELECT s3_key, thumbnail_s3_key, grid_thumbnail_s3_key, file_size "
        f"FROM {SCHEMA}.photo_bank WHERE user_id = {uid}"
    )
    rows = cur.fetchall()
    s3_keys: List[str] = []
    storage_bytes = 0
    for r in rows:
        for col in ('s3_key', 'thumbnail_s3_key', 'grid_thumbnail_s3_key'):
            if r.get(col):
                s3_keys.append(r[col])
        storage_bytes += int(r.get('file_size') or 0)
    photos_count = len(rows)

    deleted_s3 = delete_s3_objects(s3_keys)
    print(f'Deleted {deleted_s3} S3 objects for user {uid}')

    # Удаляем "самописец" (аудит-лог) пользователя из S3-папки с его фото
    delete_audit_log(uid)

    # Дополнительная очистка таблиц, ссылающихся на пользователя НЕ через FK
    # (например, по email или другим логическим связям)
    extra_tables = [
        ('photo_short_links', 'user_id'),
        ('favorite_photos', 'user_id'),
        ('favorite_clients', 'user_id'),
        ('favorite_lists', 'user_id'),
        ('gallery_view_logs', 'user_id'),
        ('client_upload_folders', 'user_id'),
        ('active_sessions', 'user_id'),
        ('user_sessions', 'user_id'),
        ('refresh_tokens', 'user_id'),
        ('phone_verification_codes', 'user_id'),
        ('password_reset_codes', 'user_id'),
        ('email_verifications', 'user_id'),
        ('login_attempts', 'user_id'),
        ('user_settings', 'user_id'),
        ('push_subscriptions', 'user_id'),
        ('watermark_logos', 'user_id'),
        ('retouch_settings', 'user_id'),
        ('retouch_presets', 'user_id'),
        ('retouch_tasks', 'user_id'),
        ('vk_users', 'user_id'),
        ('account_removal_codes', 'user_id'),
    ]
    for table, col in extra_tables:
        try:
            cur.execute(f"DELETE FROM {SCHEMA}.{table} WHERE {col} = {uid}")
        except Exception as e:
            print(f'skip {table}: {str(e)}')

    # Автоматически находим ВСЕ таблицы, ссылающиеся на users через FK,
    # и удаляем связанные записи. Это гарантирует, что финальный DELETE
    # не упадёт по foreign key constraint при любых новых таблицах.
    cur.execute(
        "SELECT tc.table_name, kcu.column_name "
        "FROM information_schema.table_constraints tc "
        "JOIN information_schema.key_column_usage kcu "
        "  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema "
        "JOIN information_schema.constraint_column_usage ccu "
        "  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema "
        "WHERE tc.constraint_type = 'FOREIGN KEY' "
        f"  AND tc.table_schema = '{SCHEMA}' "
        "  AND ccu.table_name = 'users'"
    )
    fk_refs = cur.fetchall()
    for ref in fk_refs:
        table = ref['table_name'] if isinstance(ref, dict) else ref[0]
        col = ref['column_name'] if isinstance(ref, dict) else ref[1]
        try:
            cur.execute(f"DELETE FROM {SCHEMA}.{table} WHERE {col} = {uid}")
        except Exception as e:
            print(f'skip FK {table}.{col}: {str(e)}')

    cur.execute(f"DELETE FROM {SCHEMA}.users WHERE id = {uid}")

    return {'photos_count': photos_count, 'storage_bytes': storage_bytes}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    ip_address = event.get('requestContext', {}).get('identity', {}).get('sourceIp', '')

    if method == 'GET':
        # Admin: список удалённых + статистика
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f"SELECT id, user_id, email, phone, source, registered_at, removed_at, "
            f"removed_by, photos_count, storage_freed_bytes, ip_address, reason "
            f"FROM {SCHEMA}.removed_users_log ORDER BY removed_at DESC LIMIT 500"
        )
        items = cur.fetchall()
        cur.execute(
            f"SELECT COUNT(*) AS total, "
            f"COALESCE(SUM(photos_count),0) AS photos, "
            f"COALESCE(SUM(storage_freed_bytes),0) AS storage, "
            f"COUNT(*) FILTER (WHERE removed_at > NOW() - INTERVAL '30 days') AS last_30d "
            f"FROM {SCHEMA}.removed_users_log"
        )
        stats = cur.fetchone()
        cur.close()
        conn.close()
        result = []
        for it in items:
            it = dict(it)
            for k in ('registered_at', 'removed_at'):
                if it.get(k) is not None:
                    it[k] = it[k].isoformat()
            result.append(it)
        st = dict(stats)
        return resp(200, {
            'success': True,
            'deleted_users': result,
            'stats': {
                'total': int(st.get('total') or 0),
                'photos': int(st.get('photos') or 0),
                'storage_freed_bytes': int(st.get('storage') or 0),
                'last_30d': int(st.get('last_30d') or 0),
            },
        })

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', '')
    user_id = body.get('user_id')

    if not user_id:
        return resp(400, {'error': 'user_id обязателен'})

    conn = get_conn()
    cur = conn.cursor()

    try:
        if action == 'request_code':
            user = get_user(cur, user_id)
            if not user:
                return resp(404, {'error': 'Пользователь не найден'})
            email = user.get('email')
            if not email:
                return resp(400, {'error': 'У аккаунта не указан email. Удаление невозможно — обратитесь в поддержку.'})

            code = generate_code()
            expires_at = datetime.now() + timedelta(minutes=10)
            reason_val = (body.get('reason') or '').strip() or None
            cur.execute(
                f"INSERT INTO {SCHEMA}.account_removal_codes (user_id, code, email, expires_at, attempts, reason) "
                f"VALUES ({int(user_id)}, {esc(code)}, {esc(email)}, {esc(expires_at)}, 0, {esc(reason_val)}) "
                f"ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code, "
                f"email = EXCLUDED.email, expires_at = EXCLUDED.expires_at, attempts = 0, "
                f"reason = EXCLUDED.reason, created_at = NOW()"
            )
            conn.commit()

            if not send_removal_code_email(email, code):
                return resp(500, {'error': 'Не удалось отправить код на email. Попробуйте позже.'})

            masked = email[0] + '***' + email[email.index('@'):] if '@' in email else email
            return resp(200, {'success': True, 'email': masked})

        elif action == 'confirm':
            code = str(body.get('code', '')).strip()
            if not code:
                return resp(400, {'error': 'Код обязателен'})

            cur.execute(
                f"SELECT code, expires_at, attempts, reason FROM {SCHEMA}.account_removal_codes "
                f"WHERE user_id = {int(user_id)}"
            )
            rec = cur.fetchone()
            if not rec:
                return resp(400, {'error': 'Код не найден. Запросите удаление заново.'})
            if rec['attempts'] >= 5:
                return resp(429, {'error': 'Слишком много попыток. Запросите код заново.'})
            if rec['expires_at'] < datetime.now():
                return resp(400, {'error': 'Код истёк. Запросите удаление заново.'})
            if rec['code'] != code:
                cur.execute(
                    f"UPDATE {SCHEMA}.account_removal_codes SET attempts = attempts + 1 "
                    f"WHERE user_id = {int(user_id)}"
                )
                conn.commit()
                return resp(400, {'error': 'Неверный код подтверждения'})

            user = get_user(cur, user_id)
            if not user:
                return resp(404, {'error': 'Пользователь не найден'})

            saved_reason = rec.get('reason') or body.get('reason')
            purge = purge_user_data(cur, user_id)

            cur.execute(
                f"INSERT INTO {SCHEMA}.removed_users_log "
                f"(user_id, email, phone, source, registered_at, removed_by, photos_count, storage_freed_bytes, ip_address, reason) "
                f"VALUES ({int(user_id)}, {esc(user.get('email'))}, {esc(user.get('phone'))}, "
                f"{esc(user.get('source'))}, {esc(user.get('registered_at'))}, 'user', "
                f"{purge['photos_count']}, {purge['storage_bytes']}, {esc(ip_address)}, "
                f"{esc(saved_reason)})"
            )
            conn.commit()

            return resp(200, {
                'success': True,
                'message': 'Аккаунт удалён',
                'photos_deleted': purge['photos_count'],
            })

        elif action == 'admin_delete':
            user = get_user(cur, user_id)
            if not user:
                return resp(404, {'error': 'Пользователь не найден'})

            purge = purge_user_data(cur, user_id)

            cur.execute(
                f"INSERT INTO {SCHEMA}.removed_users_log "
                f"(user_id, email, phone, source, registered_at, removed_by, photos_count, storage_freed_bytes, ip_address, reason) "
                f"VALUES ({int(user_id)}, {esc(user.get('email'))}, {esc(user.get('phone'))}, "
                f"{esc(user.get('source'))}, {esc(user.get('registered_at'))}, 'admin', "
                f"{purge['photos_count']}, {purge['storage_bytes']}, {esc(ip_address)}, "
                f"{esc(body.get('reason'))})"
            )
            conn.commit()

            return resp(200, {
                'success': True,
                'message': 'Аккаунт удалён администратором',
                'photos_deleted': purge['photos_count'],
            })

        else:
            return resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()