"""
Business: VK OAuth авторизация с JWT сессиями
Args: event с httpMethod, queryStringParameters для OAuth callback
Returns: HTTP response с редиректом или JWT токеном
"""

import json
import os
import hashlib
import secrets
import base64
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from urllib.parse import urlencode, parse_qs
import psycopg2
from psycopg2.extras import RealDictCursor

BASE_URL = os.environ.get('BASE_URL', 'https://foto-mix.ru')
VK_CLIENT_ID = os.environ.get('VK_CLIENT_ID', '')
VK_CLIENT_SECRET = os.environ.get('VK_CLIENT_SECRET', '')
VK_SERVICE_TOKEN = os.environ.get('VK_SERVICE_TOKEN', '')
DATABASE_URL = os.environ.get('DATABASE_URL', '')
JWT_SECRET = os.environ.get('JWT_SECRET', 'fallback-secret-change-me')
SCHEMA = 't_p28211681_photo_secure_web'

VK_AUTH_URL = 'https://id.vk.com/authorize'
VK_TOKEN_URL = 'https://id.vk.com/oauth2/auth'


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


def save_session(state: str, code_verifier: str, device_id: str) -> None:
    """Сохранение OAuth сессии в БД"""
    conn = get_db_connection()
    try:
        expires_at = datetime.now() + timedelta(minutes=10)
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.oauth_sessions (state, nonce, code_verifier, provider, expires_at, device_id)
                VALUES ({escape_sql(state)}, {escape_sql(state)}, {escape_sql(code_verifier)}, 'vkid', {escape_sql(expires_at.isoformat())}, {escape_sql(device_id)})
            """)
        conn.commit()
    finally:
        conn.close()


def get_session(state: str) -> Optional[Dict[str, Any]]:
    """Получение OAuth сессии из БД"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {SCHEMA}.oauth_sessions WHERE expires_at < CURRENT_TIMESTAMP")
            conn.commit()
            
            cur.execute(f"""
                SELECT state, code_verifier, device_id 
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


def fetch_vk_user_info(user_id: str) -> Optional[Dict[str, Any]]:
    """Получение информации о пользователе VK через API"""
    try:
        params = {
            'user_ids': user_id,
            'fields': 'photo_200,photo_max,screen_name,verified',
            'access_token': VK_SERVICE_TOKEN,
            'v': '5.131',
            'lang': 'ru'
        }
        
        url = f"https://api.vk.com/method/users.get?{urlencode(params)}"
        req = urllib.request.Request(url)
        
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
        
        if 'error' in data:
            print(f'[VK_API] Error: {data["error"]}')
            return None
        
        return data.get('response', [None])[0]
    except Exception as e:
        print(f'[VK_API] Failed to fetch user info: {str(e)}')
        return None


def upsert_vk_user(vk_user_id: str, first_name: str, last_name: str, avatar_url: str, 
                   is_verified: bool, email: str, phone: str, ip_address: str, user_agent: str) -> int:
    """Создание или обновление VK пользователя с умным объединением по email И телефону"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            full_name = f"{first_name} {last_name}".strip()
            
            cur.execute(f"""
                SELECT user_id, is_blocked, blocked_reason 
                FROM {SCHEMA}.vk_users 
                WHERE vk_sub = {escape_sql(vk_user_id)}
            """)
            vk_user = cur.fetchone()
            
            if vk_user:
                is_main_admin = vk_user_id == '74713477' or email == 'jonhrom2012@gmail.com'
                
                if not is_main_admin and vk_user['is_blocked']:
                    raise Exception(f"USER_BLOCKED:{vk_user.get('blocked_reason', 'Аккаунт заблокирован')}")
                
                user_id = vk_user['user_id']
                
                cur.execute(f"""
                    UPDATE {SCHEMA}.vk_users 
                    SET full_name = {escape_sql(full_name)},
                        avatar_url = {escape_sql(avatar_url)},
                        is_verified = {escape_sql(is_verified)},
                        email = {escape_sql(email)},
                        phone_number = {escape_sql(phone)},
                        last_login = CURRENT_TIMESTAMP
                    WHERE vk_sub = {escape_sql(vk_user_id)}
                """)
                
                if email:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                        VALUES ({user_id}, {escape_sql(email)}, 'vk', {escape_sql(False)}, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT DO NOTHING
                    """)
                
                conn.commit()
                return user_id
            
            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE vk_id = {escape_sql(vk_user_id)}")
            existing_user = cur.fetchone()
            
            if existing_user:
                user_id = existing_user['id']
                
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.vk_users 
                    (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login)
                    VALUES ({escape_sql(vk_user_id)}, {user_id}, {escape_sql(full_name)}, {escape_sql(avatar_url)}, 
                            {escape_sql(is_verified)}, {escape_sql(email)}, {escape_sql(phone)}, {escape_sql(True)}, CURRENT_TIMESTAMP)
                """)
                
                if email:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                        VALUES ({user_id}, {escape_sql(email)}, 'vk', {escape_sql(False)}, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT DO NOTHING
                    """)
                
                conn.commit()
                return user_id
            
            user_id = None
            
            if email:
                cur.execute(f"""
                    SELECT user_id FROM {SCHEMA}.user_emails 
                    WHERE LOWER(email) = LOWER({escape_sql(email)})
                    ORDER BY added_at ASC
                    LIMIT 1
                """)
                email_match = cur.fetchone()
                if email_match:
                    user_id = email_match['user_id']
                    print(f'[VK_AUTH] Found existing user by email: user_id={user_id}, email={email}')
            
            if not user_id and phone:
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.users 
                    WHERE phone_number = {escape_sql(phone)}
                    ORDER BY created_at ASC
                    LIMIT 1
                """)
                phone_match = cur.fetchone()
                if phone_match:
                    user_id = phone_match['id']
                    print(f'[VK_AUTH] Found existing user by phone: user_id={user_id}, phone={phone}')
            
            if user_id:
                cur.execute(f"""
                    UPDATE {SCHEMA}.users 
                    SET vk_id = {escape_sql(vk_user_id)},
                        email = COALESCE(NULLIF({escape_sql(email)}, ''), email),
                        phone_number = COALESCE(NULLIF({escape_sql(phone)}, ''), phone_number),
                        full_name = COALESCE(NULLIF({escape_sql(full_name)}, ''), full_name),
                        avatar_url = COALESCE(NULLIF({escape_sql(avatar_url)}, ''), avatar_url),
                        last_login = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = {user_id}
                """)
                
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.vk_users 
                    (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login)
                    VALUES ({escape_sql(vk_user_id)}, {user_id}, {escape_sql(full_name)}, {escape_sql(avatar_url)}, 
                            {escape_sql(is_verified)}, {escape_sql(email)}, {escape_sql(phone)}, {escape_sql(True)}, CURRENT_TIMESTAMP)
                """)
                
                if email:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                        VALUES ({user_id}, {escape_sql(email)}, 'vk', {escape_sql(False)}, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id, email) DO UPDATE SET last_used_at = CURRENT_TIMESTAMP
                    """)
                
                conn.commit()
                print(f'[VK_AUTH] Merged VK account with existing user: user_id={user_id}')
                return user_id
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.users (vk_id, email, phone_number, full_name, avatar_url, role, is_active, created_at, last_login, ip_address, user_agent)
                VALUES ({escape_sql(vk_user_id)}, {escape_sql(email)}, {escape_sql(phone)}, {escape_sql(full_name)}, 
                        {escape_sql(avatar_url)}, 'client', {escape_sql(True)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 
                        {escape_sql(ip_address)}, {escape_sql(user_agent)})
                RETURNING id
            """)
            new_user = cur.fetchone()
            user_id = new_user['id']
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.vk_users 
                (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login)
                VALUES ({escape_sql(vk_user_id)}, {user_id}, {escape_sql(full_name)}, {escape_sql(avatar_url)}, 
                        {escape_sql(is_verified)}, {escape_sql(email)}, {escape_sql(phone)}, {escape_sql(True)}, CURRENT_TIMESTAMP)
            """)
            
            if email:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.user_emails (user_id, email, provider, is_verified, verified_at, added_at, last_used_at)
                    VALUES ({user_id}, {escape_sql(email)}, 'vk', {escape_sql(False)}, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)
            
            conn.commit()
            print(f'[VK_AUTH] Created new user: user_id={user_id}, vk_id={vk_user_id}')
            return user_id
    finally:
        conn.close()


def create_jwt(user_id: int, device_id: str) -> str:
    """Создание JWT токена с уникальным session_id"""
    import hmac
    
    session_id = str(secrets.randbits(128))
    issued_at = int(datetime.now().timestamp())
    expires_at = issued_at + (30 * 24 * 60 * 60)
    
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode()).decode().rstrip('=')
    payload_data = {
        'user_id': user_id,
        'session_id': session_id,
        'device_id': device_id,
        'iat': issued_at,
        'exp': expires_at
    }
    payload = base64.urlsafe_b64encode(json.dumps(payload_data).encode()).decode().rstrip('=')
    
    message = f'{header}.{payload}'
    signature = base64.urlsafe_b64encode(
        hmac.new(JWT_SECRET.encode(), message.encode(), hashlib.sha256).digest()
    ).decode().rstrip('=')
    
    jwt_token = f'{header}.{payload}.{signature}'
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.user_sessions 
                (session_id, user_id, device_id, jwt_token, issued_at, expires_at, is_active)
                VALUES ({escape_sql(session_id)}, {user_id}, {escape_sql(device_id)}, {escape_sql(jwt_token)}, 
                        TO_TIMESTAMP({issued_at}), TO_TIMESTAMP({expires_at}), {escape_sql(True)})
            """)
        conn.commit()
    finally:
        conn.close()
    
    return jwt_token


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        action = params.get('action', 'start')
        
        if action == 'start':
            device_id = str(uuid.uuid4())
            
            state = generate_state()
            code_verifier = generate_code_verifier()
            code_challenge = generate_code_challenge(code_verifier)
            
            save_session(state, code_verifier, device_id)
            
            redirect_uri = f'{BASE_URL}/auth/callback/vkid'
            auth_params = {
                'response_type': 'code',
                'client_id': VK_CLIENT_ID,
                'redirect_uri': redirect_uri,
                'state': state,
                'code_challenge': code_challenge,
                'code_challenge_method': 'S256',
                'scope': 'email phone',
                'device_id': device_id
            }
            
            print(f'[VK_AUTH] Starting auth flow with params: {auth_params}')
            auth_url = f'{VK_AUTH_URL}?{urlencode(auth_params)}'
            print(f'[VK_AUTH] Redirecting to: {auth_url}')
            
            return {
                'statusCode': 302,
                'headers': {
                    'Location': auth_url,
                    'Access-Control-Allow-Origin': '*'
                },
                'body': '',
                'isBase64Encoded': False
            }
        
        elif action == 'callback':
            code = params.get('code')
            state = params.get('state')
            
            if not code or not state:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Missing code or state'}),
                    'isBase64Encoded': False
                }
            
            session = get_session(state)
            if not session:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid or expired state'}),
                    'isBase64Encoded': False
                }
            
            device_id = session.get('device_id') or str(uuid.uuid4())
            delete_session(state)
            
            redirect_uri = f'{BASE_URL}/auth/callback/vkid'
            token_params = {
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': redirect_uri,
                'code_verifier': session['code_verifier'],
                'client_id': VK_CLIENT_ID,
                'client_secret': VK_CLIENT_SECRET,
                'device_id': device_id
            }
            
            print(f'[VK_AUTH] Token request params: {token_params}')
            
            try:
                req = urllib.request.Request(
                    VK_TOKEN_URL,
                    data=urlencode(token_params).encode(),
                    headers={'Content-Type': 'application/x-www-form-urlencoded'}
                )
                
                with urllib.request.urlopen(req) as response:
                    token_data = json.loads(response.read().decode())
                    print(f'[VK_AUTH] Token response: {token_data}')
            except urllib.error.HTTPError as e:
                error_body = e.read().decode()
                print(f'[VK_AUTH] VK API HTTPError {e.code}: {error_body}')
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': f'VK API error: {error_body}'}),
                    'isBase64Encoded': False
                }
            except Exception as e:
                print(f'[VK_AUTH] Token exchange exception: {str(e)}')
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': f'Token exchange failed: {str(e)}'}),
                    'isBase64Encoded': False
                }
            
            if 'error' in token_data:
                print(f'[VK_AUTH] VK API error in response: {token_data}')
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': token_data.get('error_description', 'VK auth failed')}),
                    'isBase64Encoded': False
                }
            
            vk_user_id = str(token_data.get('user_id', ''))
            email = token_data.get('email', '')
            phone = token_data.get('phone', '')
            first_name = token_data.get('first_name', '')
            last_name = token_data.get('last_name', '')
            avatar = token_data.get('avatar', '')
            
            vk_info = fetch_vk_user_info(vk_user_id)
            if vk_info:
                avatar = vk_info.get('photo_200') or vk_info.get('photo_max') or avatar
                is_verified = vk_info.get('verified', 0) == 1
            else:
                is_verified = False
            
            request_context = event.get('requestContext', {})
            identity = request_context.get('identity', {})
            ip_address = identity.get('sourceIp', '0.0.0.0')
            user_agent = identity.get('userAgent', 'Unknown')
            
            try:
                user_id = upsert_vk_user(
                    vk_user_id, first_name, last_name, avatar,
                    is_verified, email, phone, ip_address, user_agent
                )
            except Exception as e:
                error_msg = str(e)
                if error_msg.startswith('USER_BLOCKED:'):
                    reason = error_msg.split(':', 1)[1]
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'user_blocked', 'reason': reason}),
                        'isBase64Encoded': False
                    }
                raise
            
            jwt_token = create_jwt(user_id, device_id)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'token': jwt_token,
                    'user_id': user_id,
                    'device_id': device_id
                }),
                'isBase64Encoded': False
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }