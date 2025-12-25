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
    """Создание или обновление VK пользователя"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            full_name = f"{first_name} {last_name}".strip()
            
            # Проверяем существование в vk_users
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
                
                return vk_user['user_id']
            
            # Проверяем существование в users по vk_id
            cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE vk_id = {escape_sql(vk_user_id)}")
            existing_user = cur.fetchone()
            
            if existing_user:
                user_id = existing_user['id']
                
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.vk_users 
                    (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login)
                    VALUES ({escape_sql(vk_user_id)}, {user_id}, {escape_sql(full_name)}, {escape_sql(avatar_url)}, 
                            {escape_sql(is_verified)}, {escape_sql(email)}, {escape_sql(phone)}, TRUE, CURRENT_TIMESTAMP)
                """)
                conn.commit()
                return user_id
            
            # Создаём нового пользователя
            cur.execute(f"""
                INSERT INTO {SCHEMA}.users 
                (vk_id, email, phone, display_name, is_active, source, registered_at, created_at, updated_at, last_login, 
                 ip_address, user_agent, role)
                VALUES ({escape_sql(vk_user_id)}, {escape_sql(email)}, {escape_sql(phone)}, {escape_sql(full_name)}, 
                        TRUE, 'vk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 
                        {escape_sql(ip_address)}, {escape_sql(user_agent)}, 'user')
                RETURNING id
            """)
            new_user = cur.fetchone()
            new_user_id = new_user['id']
            
            cur.execute(f"""
                INSERT INTO {SCHEMA}.vk_users 
                (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login, 
                 ip_address, user_agent)
                VALUES ({escape_sql(vk_user_id)}, {new_user_id}, {escape_sql(full_name)}, {escape_sql(avatar_url)}, 
                        {escape_sql(is_verified)}, {escape_sql(email)}, {escape_sql(phone)}, TRUE, CURRENT_TIMESTAMP, 
                        {escape_sql(ip_address)}, {escape_sql(user_agent)})
            """)
            conn.commit()
            return new_user_id
    finally:
        conn.close()


def generate_jwt_token(user_id: int) -> str:
    """Генерация JWT токена (упрощённая версия)"""
    import hmac
    payload = f"{user_id}:{datetime.now().timestamp()}"
    signature = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}:{signature}"


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Главный обработчик VK OAuth"""
    method = event.get('httpMethod', 'GET')
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
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
    
    # Инициализация OAuth flow
    if method == 'GET' and not query_params.get('code') and not query_params.get('state'):
        state = generate_state()
        code_verifier = generate_code_verifier()
        code_challenge = generate_code_challenge(code_verifier)
        device_id = generate_state()  # Генерируем уникальный device_id
        
        save_session(state, code_verifier, device_id)
        
        auth_params = {
            'client_id': VK_CLIENT_ID,
            'redirect_uri': 'https://foto-mix.ru/vk-callback',
            'response_type': 'code',
            'scope': 'email phone',
            'state': state,
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256'
        }
        
        redirect_url = f"{VK_AUTH_URL}?{urlencode(auth_params)}"
        
        return {
            'statusCode': 302,
            'headers': {**cors_headers, 'Location': redirect_url},
            'body': '',
            'isBase64Encoded': False
        }
    
    # Обработка callback
    code = query_params.get('code')
    state = query_params.get('state')
    device_id = query_params.get('device_id')  # VK ID возвращает device_id в callback
    payload = query_params.get('payload')  # Альтернативный способ получения данных
    
    print(f"[VK_AUTH] Callback params: code={code}, state={state}, device_id={device_id}, payload={payload[:50] if payload else None}...")
    
    # Если payload передан, декодируем его
    if payload and not device_id:
        try:
            payload_data = json.loads(base64.urlsafe_b64decode(payload + '=='))
            device_id = payload_data.get('device_id')
            print(f"[VK_AUTH] Extracted from payload: device_id={device_id}")
        except Exception as e:
            print(f"[VK_AUTH] Failed to decode payload: {e}")
    
    if not code or not state:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Отсутствуют code или state'}),
            'isBase64Encoded': False
        }
    
    session = get_session(state)
    if not session:
        return {
            'statusCode': 400,
            'headers': cors_headers,
            'body': json.dumps({'success': False, 'error': 'Недействительная сессия'}),
            'isBase64Encoded': False
        }
    
    try:
        # Обмен code на токен
        token_data = {
            'grant_type': 'authorization_code',
            'code': code,
            'code_verifier': session['code_verifier'],
            'client_id': VK_CLIENT_ID,
            'redirect_uri': 'https://foto-mix.ru/vk-callback',
            'state': state
        }
        
        # Добавляем device_id если получили от VK ID
        if device_id:
            token_data['device_id'] = device_id
            print(f"[VK_AUTH] Using device_id from callback: {device_id}")
        else:
            print(f"[VK_AUTH] WARNING: No device_id in callback, trying without it")
        
        token_request = urllib.request.Request(
            VK_TOKEN_URL,
            data=urlencode(token_data).encode(),
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        
        try:
            with urllib.request.urlopen(token_request) as response:
                token_response = json.loads(response.read().decode())
        except urllib.error.HTTPError as http_err:
            error_body = http_err.read().decode() if http_err.fp else 'No error body'
            print(f"[VK_AUTH] Token exchange failed: {http_err.code} - {error_body}")
            raise Exception(f'VK token error: {error_body}')
        
        print(f"[VK_AUTH] Token response: {json.dumps(token_response)}")
        
        user_id = token_response.get('user_id')
        email = token_response.get('email')
        phone = token_response.get('phone')
        
        if not user_id:
            print(f"[VK_AUTH] ERROR: user_id not found in response: {token_response}")
            raise Exception('Не получен user_id от VK')
        
        # Получение дополнительной информации о пользователе
        user_info = fetch_vk_user_info(str(user_id))
        
        if not user_info:
            raise Exception('Не удалось получить информацию о пользователе')
        
        first_name = user_info.get('first_name', '')
        last_name = user_info.get('last_name', '')
        avatar_url = user_info.get('photo_200', '')
        is_verified = user_info.get('verified', False)
        
        # IP и User-Agent
        request_context = event.get('requestContext', {})
        identity = request_context.get('identity', {})
        ip_address = identity.get('sourceIp', 'unknown')
        user_agent = identity.get('userAgent', 'unknown')
        
        # Создание/обновление пользователя
        db_user_id = upsert_vk_user(
            vk_user_id=str(user_id),
            first_name=first_name,
            last_name=last_name,
            avatar_url=avatar_url,
            is_verified=is_verified,
            email=email or '',
            phone=phone or '',
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        delete_session(state)
        
        session_token = generate_jwt_token(db_user_id)
        
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps({
                'success': True,
                'user_id': db_user_id,
                'session_id': session_token,
                'profile': {
                    'vk_id': user_id,
                    'email': email,
                    'phone': phone,
                    'name': f"{first_name} {last_name}".strip(),
                    'avatar': avatar_url,
                    'verified': is_verified
                }
            }),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        error_trace = traceback.format_exc()
        
        print(f"[VK_AUTH] ERROR: {error_msg}")
        print(f"[VK_AUTH] TRACEBACK: {error_trace}")
        
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