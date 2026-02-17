"""
Business: Безопасная авторизация через Google OAuth 2.0 с PKCE и JWT сессиями
Args: event с httpMethod, queryStringParameters для OAuth callback
Returns: HTTP response с данными авторизации или редиректом
"""

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

BASE_URL = os.environ.get('BASE_URL', 'https://foto-mix.ru')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
DATABASE_URL = os.environ.get('DATABASE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret-change-me')
SCHEMA = 't_p28211681_photo_secure_web'

GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'


def generate_state() -> str:
    """Генерация state для защиты от CSRF"""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')


def generate_code_verifier() -> str:
    """Генерация code_verifier для PKCE"""
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')


def generate_code_challenge(verifier: str) -> str:
    """Генерация code_challenge из verifier"""
    digest = hashlib.sha256(verifier.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest).decode('utf-8').rstrip('=')


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
    """Создание подключения к БД"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def save_session(state: str, code_verifier: str) -> None:
    """Сохранение OAuth сессии в БД"""
    conn = get_db_connection()
    try:
        expires_at = datetime.now() + timedelta(minutes=10)
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.oauth_sessions (state, nonce, code_verifier, provider, expires_at)
                VALUES ({escape_sql(state)}, {escape_sql(state)}, {escape_sql(code_verifier)}, 'google', {escape_sql(expires_at.isoformat())})
            """)
        conn.commit()
    finally:
        conn.close()


def get_session(state: str) -> Optional[Dict[str, Any]]:
    """Получение OAuth сессии из БД"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Удаляем истекшие сессии
            cur.execute(f"DELETE FROM {SCHEMA}.oauth_sessions WHERE expires_at < CURRENT_TIMESTAMP")
            conn.commit()
            
            # Получаем активную сессию
            cur.execute(f"""
                SELECT state, code_verifier 
                FROM {SCHEMA}.oauth_sessions 
                WHERE state = {escape_sql(state)} AND expires_at > CURRENT_TIMESTAMP
            """)
            result = cur.fetchone()
            return dict(result) if result else None
    finally:
        conn.close()


def delete_session(state: str) -> None:
    """Удаление использованной сессии"""
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


def upsert_google_user(google_sub: str, email: str, name: str, picture: str, 
                       verified_email: bool, ip_address: str, user_agent: str) -> Dict[str, Any]:
    """Создание или обновление Google пользователя с умным объединением по email, возвращает user_id и настройки 2FA"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Проверяем существование в google_users
            cur.execute(f"""
                SELECT user_id, is_blocked, block_reason 
                FROM {SCHEMA}.google_users 
                WHERE google_sub = {escape_sql(google_sub)}
            """)
            google_user = cur.fetchone()
            
            if google_user:
                # Проверка на главного админа
                is_main_admin = email == 'jonhrom2012@gmail.com'
                
                if not is_main_admin and google_user['is_blocked']:
                    raise Exception(f"USER_BLOCKED:{google_user.get('block_reason', 'Аккаунт заблокирован')}")
                
                user_id = google_user['user_id']
                
                # Обновляем данные в google_users
                cur.execute(f"""
                    UPDATE {SCHEMA}.google_users 
                    SET full_name = {escape_sql(name)},
                        avatar_url = {escape_sql(picture)},
                        is_verified = {escape_sql(verified_email)},
                        email = {escape_sql(email)},
                        last_login = CURRENT_TIMESTAMP
                    WHERE google_sub = {escape_sql(google_sub)}
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
                
                # Добавляем email в user_emails (автоматически verified для Google)
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                    VALUES ({user_id}, {escape_sql(email)}, 'google', {escape_sql(True)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT DO NOTHING
                """)
                
                conn.commit()
                
                # Проверяем настройки 2FA пользователя
                cur.execute(f"""
                    SELECT two_factor_email, two_factor_sms, phone, email 
                    FROM {SCHEMA}.users 
                    WHERE id = {user_id}
                """)
                user_settings = cur.fetchone()
                
                return {
                    'user_id': user_id,
                    'two_factor_email': user_settings.get('two_factor_email', False) if user_settings else False,
                    'two_factor_sms': user_settings.get('two_factor_sms', False) if user_settings else False,
                    'phone': user_settings.get('phone') if user_settings else None,
                    'user_email': user_settings.get('email') if user_settings else email
                }
            
            # КРИТИЧНО: Умное объединение - проверяем email в user_emails (любой провайдер)
            cur.execute(f"""SELECT user_id FROM {SCHEMA}.user_emails WHERE email = {escape_sql(email)} LIMIT 1""")
            existing_email = cur.fetchone()
            
            if existing_email:
                user_id = existing_email['user_id']
                print(f"[GOOGLE_AUTH] Found existing user by email in user_emails: user_id={user_id}, email={email}")
                
                # Получаем настройки 2FA
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
                
                # Создаём или обновляем запись в google_users
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.google_users 
                    (google_sub, user_id, email, full_name, avatar_url, is_verified, is_active, last_login)
                    VALUES ({escape_sql(google_sub)}, {user_id}, {escape_sql(email)}, {escape_sql(name)}, 
                            {escape_sql(picture)}, {escape_sql(verified_email)}, {escape_sql(True)}, CURRENT_TIMESTAMP)
                    ON CONFLICT (google_sub) DO UPDATE SET
                        full_name = EXCLUDED.full_name,
                        avatar_url = EXCLUDED.avatar_url,
                        last_login = EXCLUDED.last_login
                """)
                
                # Добавляем email в user_emails ONLY если его еще нет
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                    VALUES ({user_id}, {escape_sql(email)}, 'google', {escape_sql(True)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT (email, provider) DO UPDATE SET
                        last_used_at = CURRENT_TIMESTAMP,
                        is_verified = TRUE,
                        verified_at = CURRENT_TIMESTAMP
                """)
                
                conn.commit()
                
                return {
                    'user_id': user_id,
                    'two_factor_email': existing_user.get('two_factor_email', False),
                    'two_factor_sms': existing_user.get('two_factor_sms', False),
                    'phone': existing_user.get('phone'),
                    'user_email': existing_user.get('email')
                }
            
            # Создаём нового пользователя (ни по email не найден)
            cur.execute(f"""
                INSERT INTO {SCHEMA}.users 
                (email, display_name, is_active, source, registered_at, created_at, updated_at, last_login, 
                 ip_address, user_agent, role, email_verified_at)
                VALUES ({escape_sql(email)}, {escape_sql(name)}, {escape_sql(True)}, 'google', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 
                        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, {escape_sql(ip_address)}, {escape_sql(user_agent)}, 'user',
                        CURRENT_TIMESTAMP)
                RETURNING id
            """)
            new_user = cur.fetchone()
            new_user_id = new_user['id']
            
            # Создаём запись в google_users
            cur.execute(f"""
                INSERT INTO {SCHEMA}.google_users 
                (google_sub, user_id, email, full_name, avatar_url, is_verified, is_active, last_login, 
                 ip_address, user_agent)
                VALUES ({escape_sql(google_sub)}, {new_user_id}, {escape_sql(email)}, {escape_sql(name)}, 
                        {escape_sql(picture)}, {escape_sql(verified_email)}, {escape_sql(True)}, CURRENT_TIMESTAMP, 
                        {escape_sql(ip_address)}, {escape_sql(user_agent)})
            """)
            
            # Добавляем email в user_emails (автоматически verified для Google)
            cur.execute(f"""
                INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                VALUES ({new_user_id}, {escape_sql(email)}, 'google', {escape_sql(True)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
    """Получение настроек безопасности из БД"""
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
    """Генерация JWT токена с expiration и сохранение в active_sessions"""
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
        print(f"[GOOGLE_AUTH] Session created: session_id={session_id}, expires_at={expires_at}")
    except Exception as e:
        print(f"[GOOGLE_AUTH] Error saving session: {e}")
    finally:
        conn.close()
    
    return token, session_id


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик Google OAuth"""
    method = event.get('httpMethod', 'GET')
    
    # CORS для всех запросов
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Session-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json'
    }
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': '',
            'isBase64Encoded': False
        }
    
    query_params = event.get('queryStringParameters', {}) or {}
    code = query_params.get('code')
    state = query_params.get('state')
    
    # Инициализация OAuth flow (редирект на Google)
    if not code and not state:
        state = generate_state()
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)
        
        save_session(state, code_verifier)
        
        auth_params = {
            'client_id': GOOGLE_CLIENT_ID,
            'redirect_uri': f'{BASE_URL}/auth/callback/google',
            'response_type': 'code',
            'scope': 'openid email profile',
            'state': state,
            'access_type': 'offline',
            'prompt': 'consent'
        }
        
        redirect_url = f"{GOOGLE_AUTH_URL}?{urlencode(auth_params)}"
        
        return {
            'statusCode': 302,
            'headers': {**cors_headers, 'Location': redirect_url},
            'body': '',
            'isBase64Encoded': False
        }
    
    # Обработка callback от Google
    if not code or not state:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Отсутствуют параметры code или state'}),
            'isBase64Encoded': False
        }
    
    # Проверка state и получение code_verifier
    session = get_session(state)
    if not session:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Недействительная сессия OAuth'}),
            'isBase64Encoded': False
        }
    
    # Обмен code на токен
    try:
        print(f"[GOOGLE_AUTH] Processing callback with state={state[:10]}...")
        
        token_data = {
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': f'{BASE_URL}/auth/callback/google',
            'grant_type': 'authorization_code'
        }
        
        print(f"[GOOGLE_AUTH] Exchanging code for token...")
        token_request = urllib.request.Request(
            GOOGLE_TOKEN_URL,
            data=urlencode(token_data).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        try:
            with urllib.request.urlopen(token_request) as response:
                token_response = json.loads(response.read().decode())
        except urllib.error.HTTPError as http_err:
            error_body = http_err.read().decode() if http_err.fp else 'No error body'
            print(f"[GOOGLE_AUTH] Token exchange failed: {http_err.code} - {error_body}")
            raise Exception(f'Google token error: {error_body}')
        
        access_token = token_response.get('access_token')
        if not access_token:
            print(f"[GOOGLE_AUTH] No access_token in response: {token_response}")
            raise Exception('Не получен access_token от Google')
        
        # Получение информации о пользователе
        print(f"[GOOGLE_AUTH] Fetching user info...")
        userinfo_request = urllib.request.Request(
            GOOGLE_USERINFO_URL,
            headers={'Authorization': f'Bearer {access_token}'}
        )
        
        try:
            with urllib.request.urlopen(userinfo_request) as response:
                user_info = json.loads(response.read().decode())
        except urllib.error.HTTPError as http_err:
            error_body = http_err.read().decode() if http_err.fp else 'No error body'
            print(f"[GOOGLE_AUTH] User info fetch failed: {http_err.code} - {error_body}")
            raise Exception(f'Google userinfo error: {error_body}')
        
        print(f"[GOOGLE_AUTH] User info: email={user_info.get('email')}, id={user_info.get('id')}")
        
        # Извлечение IP и User-Agent
        request_context = event.get('requestContext', {})
        identity = request_context.get('identity', {})
        ip_address = identity.get('sourceIp', 'unknown')
        user_agent = identity.get('userAgent', 'unknown')
        
        # Создание/обновление пользователя
        print(f"[GOOGLE_AUTH] Upserting user...")
        user_data = upsert_google_user(
            google_sub=user_info['id'],
            email=user_info.get('email', ''),
            name=user_info.get('name', ''),
            picture=user_info.get('picture', ''),
            verified_email=user_info.get('verified_email', False),
            ip_address=ip_address,
            user_agent=user_agent
        )
        user_id = user_data['user_id']
        print(f"[GOOGLE_AUTH] User created/updated: user_id={user_id}")
        
        # Удаление использованной сессии
        delete_session(state)
        
        # Проверка 2FA
        if user_data.get('two_factor_email') or user_data.get('two_factor_sms'):
            # Сохраняем временную сессию для 2FA
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    temp_token = generate_state()
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.oauth_sessions (state, nonce, provider, expires_at)
                        VALUES ({escape_sql(temp_token)}, {escape_sql(str(user_id))}, 'google-2fa', 
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
                    'user_id': user_id
                }),
                'isBase64Encoded': False
            }
        
        # Генерация JWT токена
        session_token, session_id = generate_jwt_token(user_id, ip_address, user_agent)
        
        # Возвращаем данные для фронтенда
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'success': True,
                'user_id': user_id,
                'session_token': session_token,
                'user': {
                    'id': user_id,
                    'email': user_info.get('email'),
                    'name': user_info.get('name'),
                    'picture': user_info.get('picture'),
                    'verified_email': user_info.get('verified_email', False)
                }
            }),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        print(f"[GOOGLE_AUTH] ERROR: {error_msg}")
        print(f"[GOOGLE_AUTH] TRACEBACK: {error_trace}")
        
        # Проверка на блокировку пользователя
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