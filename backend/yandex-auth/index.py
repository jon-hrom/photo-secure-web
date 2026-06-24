"""Yandex OAuth авторизация с state-защитой и JWT сессиями (идентично google-auth)."""

import json
import os
import hashlib
import secrets
import base64
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from urllib.parse import urlencode
import psycopg2
from psycopg2.extras import RealDictCursor

BASE_URL = os.environ.get('SITE_URL', 'https://foto-mix.ru').rstrip('/')
YANDEX_CLIENT_ID = os.environ.get('YANDEX_CLIENT_ID', '')
YANDEX_CLIENT_SECRET = os.environ.get('YANDEX_CLIENT_SECRET', '')
YANDEX_REDIRECT_URI = os.environ.get('YANDEX_REDIRECT_URI', f'{BASE_URL}/auth/callback/yandex')
DATABASE_URL = os.environ.get('DATABASE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret-change-me')
SCHEMA = 't_p28211681_photo_secure_web'

YANDEX_AUTH_URL = 'https://oauth.yandex.ru/authorize'
YANDEX_TOKEN_URL = 'https://oauth.yandex.ru/token'
YANDEX_USERINFO_URL = 'https://login.yandex.ru/info'

MAIN_ADMIN_EMAIL = 'jonhrom2012@gmail.com'


def generate_state() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')


def escape_sql(value: Any) -> str:
    """Безопасное экранирование для Simple Query Protocol"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def get_db_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def is_registration_enabled() -> bool:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"SELECT setting_value FROM {SCHEMA}.app_settings WHERE setting_key = 'registration_enabled' LIMIT 1")
            row = cur.fetchone()
            if not row:
                return True
            return str(row['setting_value']).strip().lower() in ('true', '1', 'yes', 'on')
    except Exception as e:
        print(f"[REGISTRATION] check error: {e}")
        return True
    finally:
        conn.close()


def save_session(state: str) -> None:
    conn = get_db_connection()
    try:
        expires_at = datetime.now() + timedelta(minutes=10)
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.oauth_sessions (state, nonce, provider, expires_at)
                VALUES ({escape_sql(state)}, {escape_sql(state)}, 'yandex', {escape_sql(expires_at.isoformat())})
            """)
        conn.commit()
    finally:
        conn.close()


def get_session(state: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {SCHEMA}.oauth_sessions WHERE expires_at < CURRENT_TIMESTAMP")
            conn.commit()
            cur.execute(f"""
                SELECT state FROM {SCHEMA}.oauth_sessions
                WHERE state = {escape_sql(state)} AND expires_at > CURRENT_TIMESTAMP
            """)
            result = cur.fetchone()
            return dict(result) if result else None
    finally:
        conn.close()


def delete_session(state: str) -> None:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                UPDATE {SCHEMA}.oauth_sessions
                SET expires_at = CURRENT_TIMESTAMP
                WHERE state = {escape_sql(state)}
            """)
        conn.commit()
    finally:
        conn.close()


def upsert_yandex_user(yandex_id: str, email: str, name: str, picture: str,
                       verified_email: bool, ip_address: str, user_agent: str) -> Dict[str, Any]:
    """Создание/обновление Yandex пользователя с умным объединением по email."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # 1) Поиск по yandex_id
            cur.execute(f"""
                SELECT user_id, is_blocked, block_reason
                FROM {SCHEMA}.yandex_users
                WHERE yandex_id = {escape_sql(yandex_id)}
            """)
            yandex_user = cur.fetchone()

            if yandex_user:
                is_main_admin = email == MAIN_ADMIN_EMAIL
                if not is_main_admin and yandex_user['is_blocked']:
                    raise Exception(f"USER_BLOCKED:{yandex_user.get('block_reason', 'Аккаунт заблокирован')}")

                user_id = yandex_user['user_id']

                cur.execute(f"""
                    UPDATE {SCHEMA}.yandex_users
                    SET full_name = {escape_sql(name)},
                        avatar_url = {escape_sql(picture)},
                        is_verified = {escape_sql(verified_email)},
                        email = {escape_sql(email)},
                        last_login = CURRENT_TIMESTAMP
                    WHERE yandex_id = {escape_sql(yandex_id)}
                """)
                cur.execute(f"""
                    UPDATE {SCHEMA}.users
                    SET display_name = COALESCE(display_name, {escape_sql(name)}),
                        avatar_url = COALESCE(avatar_url, {escape_sql(picture)}),
                        last_login = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP,
                        email_verified_at = CASE WHEN email_verified_at IS NULL
                                                THEN CURRENT_TIMESTAMP ELSE email_verified_at END
                    WHERE id = {user_id}
                """)
                if email:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                        VALUES ({user_id}, {escape_sql(email)}, 'yandex', {escape_sql(True)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT DO NOTHING
                    """)
                conn.commit()

                cur.execute(f"""SELECT two_factor_email, two_factor_sms, phone, email FROM {SCHEMA}.users WHERE id = {user_id}""")
                user_settings = cur.fetchone()
                return {
                    'user_id': user_id,
                    'two_factor_email': user_settings.get('two_factor_email', False) if user_settings else False,
                    'two_factor_sms': user_settings.get('two_factor_sms', False) if user_settings else False,
                    'phone': user_settings.get('phone') if user_settings else None,
                    'user_email': user_settings.get('email') if user_settings else email
                }

            # 2) Умное объединение по email в user_emails (любой провайдер)
            existing_email = None
            if email:
                cur.execute(f"""SELECT user_id FROM {SCHEMA}.user_emails WHERE email = {escape_sql(email)} LIMIT 1""")
                existing_email = cur.fetchone()

            if existing_email:
                user_id = existing_email['user_id']
                print(f"[YANDEX_AUTH] Found existing user by email: user_id={user_id}, email={email}")

                cur.execute(f"""SELECT two_factor_email, two_factor_sms, phone, email FROM {SCHEMA}.users WHERE id = {escape_sql(user_id)}""")
                existing_user = cur.fetchone()

                cur.execute(f"""
                    UPDATE {SCHEMA}.users
                    SET display_name = COALESCE(display_name, {escape_sql(name)}),
                        avatar_url = COALESCE(avatar_url, {escape_sql(picture)}),
                        last_login = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP,
                        email_verified_at = CASE WHEN email_verified_at IS NULL
                                                THEN CURRENT_TIMESTAMP ELSE email_verified_at END
                    WHERE id = {user_id}
                """)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.yandex_users
                    (yandex_id, user_id, email, full_name, avatar_url, is_verified, is_active, last_login)
                    VALUES ({escape_sql(yandex_id)}, {user_id}, {escape_sql(email)}, {escape_sql(name)},
                            {escape_sql(picture)}, {escape_sql(verified_email)}, {escape_sql(True)}, CURRENT_TIMESTAMP)
                    ON CONFLICT (yandex_id) DO UPDATE SET
                        full_name = EXCLUDED.full_name,
                        avatar_url = EXCLUDED.avatar_url,
                        last_login = EXCLUDED.last_login
                """)
                if email:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                        VALUES ({user_id}, {escape_sql(email)}, 'yandex', {escape_sql(True)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT DO NOTHING
                    """)
                conn.commit()
                return {
                    'user_id': user_id,
                    'two_factor_email': existing_user.get('two_factor_email', False) if existing_user else False,
                    'two_factor_sms': existing_user.get('two_factor_sms', False) if existing_user else False,
                    'phone': existing_user.get('phone') if existing_user else None,
                    'user_email': existing_user.get('email') if existing_user else email
                }

            # 3) Новый пользователь
            if not is_registration_enabled():
                raise Exception("REGISTRATION_DISABLED")

            cur.execute(f"""
                INSERT INTO {SCHEMA}.users
                (email, display_name, is_active, source, registered_at, created_at, updated_at, last_login,
                 ip_address, user_agent, role, plan_id, email_verified_at)
                VALUES ({escape_sql(email)}, {escape_sql(name)}, {escape_sql(True)}, 'yandex', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, {escape_sql(ip_address)}, {escape_sql(user_agent)}, 'user', 1,
                        CURRENT_TIMESTAMP)
                RETURNING id
            """)
            new_user = cur.fetchone()
            new_user_id = new_user['id']

            cur.execute(f"""
                INSERT INTO {SCHEMA}.yandex_users
                (yandex_id, user_id, email, full_name, avatar_url, is_verified, is_active, last_login,
                 ip_address, user_agent)
                VALUES ({escape_sql(yandex_id)}, {new_user_id}, {escape_sql(email)}, {escape_sql(name)},
                        {escape_sql(picture)}, {escape_sql(verified_email)}, {escape_sql(True)}, CURRENT_TIMESTAMP,
                        {escape_sql(ip_address)}, {escape_sql(user_agent)})
            """)
            if email:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                    VALUES ({new_user_id}, {escape_sql(email)}, 'yandex', {escape_sql(True)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT DO NOTHING
                """)
            conn.commit()
            return {
                'user_id': new_user_id,
                'two_factor_email': False,
                'two_factor_sms': False,
                'phone': None,
                'user_email': email
            }
    finally:
        conn.close()


def get_security_settings() -> Dict[str, int]:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT setting_key, setting_value
                FROM {SCHEMA}.app_settings
                WHERE setting_key IN ('jwt_expiration_minutes', 'session_timeout_minutes')
            """)
            rows = cur.fetchall()
            settings = {row['setting_key']: int(row['setting_value']) for row in rows}
            return {
                'jwt_expiration_minutes': settings.get('jwt_expiration_minutes', 30),
                'session_timeout_minutes': settings.get('session_timeout_minutes', 7)
            }
    except Exception as e:
        print(f"[SECURITY] Error loading settings: {e}")
        return {'jwt_expiration_minutes': 30, 'session_timeout_minutes': 7}
    finally:
        conn.close()


def generate_jwt_token(user_id: int, ip_address: str, user_agent: str) -> tuple[str, str]:
    """Генерация JWT и запись в active_sessions (идентично google-auth)."""
    import hmac
    import uuid

    security_settings = get_security_settings()
    jwt_expiration_minutes = security_settings['jwt_expiration_minutes']

    session_id = str(uuid.uuid4())
    issued_at = datetime.now()
    expires_at = issued_at + timedelta(minutes=jwt_expiration_minutes)

    payload = f"{user_id}:{session_id}:{int(issued_at.timestamp())}:{int(expires_at.timestamp())}"
    signature = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token = f"{payload}:{signature}"

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.active_sessions
                (session_id, user_id, token_hash, created_at, expires_at, last_activity, ip_address, user_agent)
                VALUES ({escape_sql(session_id)}, {user_id}, {escape_sql(token_hash)},
                        {escape_sql(issued_at.isoformat())}, {escape_sql(expires_at.isoformat())},
                        {escape_sql(issued_at.isoformat())}, {escape_sql(ip_address)}, {escape_sql(user_agent)})
            """)
        conn.commit()
        print(f"[YANDEX_AUTH] Session created: session_id={session_id}, expires_at={expires_at}")
    except Exception as e:
        print(f"[YANDEX_AUTH] Error saving session: {e}")
    finally:
        conn.close()

    return token, session_id


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Вход через Яндекс. GET без code — редирект на Яндекс. GET с code+state — обработка callback."""
    method = event.get('httpMethod', 'GET')

    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Session-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers, 'body': '', 'isBase64Encoded': False}

    query_params = event.get('queryStringParameters', {}) or {}
    code = query_params.get('code')
    state = query_params.get('state')

    # Инициализация OAuth (редирект на Яндекс)
    if not code and not state:
        state = generate_state()
        save_session(state)

        auth_params = {
            'response_type': 'code',
            'client_id': YANDEX_CLIENT_ID,
            'redirect_uri': YANDEX_REDIRECT_URI,
            'state': state,
            'force_confirm': 'yes'
        }
        redirect_url = f"{YANDEX_AUTH_URL}?{urlencode(auth_params)}"
        return {
            'statusCode': 302,
            'headers': {**cors_headers, 'Location': redirect_url},
            'body': '',
            'isBase64Encoded': False
        }

    if not code or not state:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Отсутствуют параметры code или state'}),
            'isBase64Encoded': False
        }

    session = get_session(state)
    if not session:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Недействительная сессия OAuth'}),
            'isBase64Encoded': False
        }

    try:
        print(f"[YANDEX_AUTH] Processing callback with state={state[:10]}...")

        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'client_id': YANDEX_CLIENT_ID,
            'client_secret': YANDEX_CLIENT_SECRET
        }
        token_request = urllib.request.Request(
            YANDEX_TOKEN_URL,
            data=urlencode(token_data).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        try:
            with urllib.request.urlopen(token_request) as resp:
                token_response = json.loads(resp.read().decode())
        except urllib.error.HTTPError as http_err:
            error_body = http_err.read().decode() if http_err.fp else 'No error body'
            print(f"[YANDEX_AUTH] Token exchange failed: {http_err.code} - {error_body}")
            raise Exception(f'Yandex token error: {error_body}')

        access_token = token_response.get('access_token')
        if not access_token:
            print(f"[YANDEX_AUTH] No access_token in response: {token_response}")
            raise Exception('Не получен access_token от Яндекса')

        userinfo_request = urllib.request.Request(
            YANDEX_USERINFO_URL,
            headers={'Authorization': f'OAuth {access_token}'}
        )
        try:
            with urllib.request.urlopen(userinfo_request) as resp:
                user_info = json.loads(resp.read().decode())
        except urllib.error.HTTPError as http_err:
            error_body = http_err.read().decode() if http_err.fp else 'No error body'
            print(f"[YANDEX_AUTH] User info fetch failed: {http_err.code} - {error_body}")
            raise Exception(f'Yandex userinfo error: {error_body}')

        yandex_id = str(user_info.get('id', ''))
        email = user_info.get('default_email') or ''
        if not email:
            emails = user_info.get('emails') or []
            email = emails[0] if emails else ''
        name = user_info.get('real_name') or user_info.get('display_name') or user_info.get('login') or ''

        avatar = ''
        avatar_id = user_info.get('default_avatar_id')
        if avatar_id and not user_info.get('is_avatar_empty', True) is True:
            avatar = f"https://avatars.yandex.net/get-yapic/{avatar_id}/islands-200"
        elif avatar_id:
            avatar = f"https://avatars.yandex.net/get-yapic/{avatar_id}/islands-200"

        print(f"[YANDEX_AUTH] User info: email={email}, id={yandex_id}")

        request_context = event.get('requestContext', {})
        identity = request_context.get('identity', {})
        ip_address = identity.get('sourceIp', 'unknown')
        user_agent = identity.get('userAgent', 'unknown')

        user_data = upsert_yandex_user(
            yandex_id=yandex_id,
            email=email,
            name=name,
            picture=avatar,
            verified_email=True,
            ip_address=ip_address,
            user_agent=user_agent
        )
        user_id = user_data['user_id']
        print(f"[YANDEX_AUTH] User created/updated: user_id={user_id}")

        delete_session(state)

        # 2FA
        if user_data.get('two_factor_email') or user_data.get('two_factor_sms'):
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    temp_token = generate_state()
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.oauth_sessions (state, nonce, provider, expires_at)
                        VALUES ({escape_sql(temp_token)}, {escape_sql(str(user_id))}, 'yandex-2fa',
                                CURRENT_TIMESTAMP + INTERVAL '10 minutes')
                    """)
                    conn.commit()
            finally:
                conn.close()

            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'requires_2fa': True,
                    'temp_token': temp_token,
                    'two_factor_type': 'sms' if user_data.get('two_factor_sms') else 'email',
                    'user_id': user_id,
                    'user_email': user_data.get('user_email')
                }),
                'isBase64Encoded': False
            }

        session_token, session_id = generate_jwt_token(user_id, ip_address, user_agent)

        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'success': True,
                'user_id': user_id,
                'session_token': session_token,
                'user': {
                    'id': user_id,
                    'email': email,
                    'name': name,
                    'picture': avatar,
                    'verified_email': True
                }
            }),
            'isBase64Encoded': False
        }

    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"[YANDEX_AUTH] ERROR: {error_msg}")
        print(f"[YANDEX_AUTH] TRACEBACK: {traceback.format_exc()}")

        if error_msg == 'REGISTRATION_DISABLED':
            return {
                'statusCode': 403,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'registration_disabled': True,
                    'message': 'Регистрация сейчас временно недоступна, попробуйте позже.'
                }),
                'isBase64Encoded': False
            }

        if error_msg.startswith('USER_BLOCKED:'):
            reason = error_msg.split(':', 1)[1]
            return {
                'statusCode': 403,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'blocked': True,
                    'message': reason
                }),
                'isBase64Encoded': False
            }

        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': f'Ошибка авторизации: {error_msg}'}),
            'isBase64Encoded': False
        }
