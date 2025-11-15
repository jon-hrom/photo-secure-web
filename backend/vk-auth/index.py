"""
Business: Безопасная авторизация через VK ID с PKCE и OpenID Connect
Args: event - dict с httpMethod, queryStringParameters для OAuth callback
      context - object с request_id и другими атрибутами
Returns: HTTP response dict с редиректом на VK или JSON профилем пользователя
"""

import json
import os
import hashlib
import base64
import secrets
import time
from typing import Dict, Any, Optional
from urllib.parse import urlencode, parse_qs
import requests

BASE_URL = os.environ.get('BASE_URL', 'https://foto-mix.ru')
VK_CLIENT_ID = os.environ.get('VK_CLIENT_ID')
VK_CLIENT_SECRET = os.environ.get('VK_CLIENT_SECRET')

sessions_storage: Dict[str, Dict[str, Any]] = {}

def generate_code_verifier() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode('utf-8').rstrip('=')

def generate_code_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest).decode('utf-8').rstrip('=')

def generate_state() -> str:
    return secrets.token_urlsafe(32)

def generate_nonce() -> str:
    return secrets.token_urlsafe(32)

def clean_old_sessions() -> None:
    now = time.time()
    max_age = 600
    expired = [k for k, v in sessions_storage.items() if now - v.get('timestamp', 0) > max_age]
    for key in expired:
        del sessions_storage[key]

def discover_vk_issuer() -> Dict[str, str]:
    candidates = ['https://id.vk.com', 'https://id.vk.ru']
    for base_url in candidates:
        try:
            resp = requests.get(f'{base_url}/.well-known/openid-configuration', timeout=10)
            if resp.status_code == 200:
                return resp.json()
        except:
            continue
    raise Exception('VK ID OIDC discovery failed')

def fetch_vk_user_info(access_token: str, user_id: str) -> Optional[Dict[str, Any]]:
    try:
        params = {
            'user_ids': user_id,
            'fields': 'photo_200,photo_max,screen_name,is_verified',
            'access_token': access_token,
            'v': '5.131',
            'lang': 'ru'
        }
        resp = requests.get('https://api.vk.com/method/users.get', params=params, timeout=10)
        data = resp.json()
        return data.get('response', [None])[0]
    except:
        return None

def normalize_profile(id_token_claims: Dict, userinfo: Dict, vk_users_get: Optional[Dict], token_data: Dict) -> Dict[str, Any]:
    first_name = vk_users_get.get('first_name', '') if vk_users_get else ''
    last_name = vk_users_get.get('last_name', '') if vk_users_get else ''
    vk_name = f'{first_name} {last_name}'.strip() if first_name or last_name else None
    
    return {
        'provider': 'vkid',
        'sub': str(id_token_claims.get('sub') or userinfo.get('sub') or (vk_users_get.get('id') if vk_users_get else '')),
        'email': id_token_claims.get('email') or userinfo.get('email'),
        'phone_number': id_token_claims.get('phone_number') or userinfo.get('phone_number'),
        'name': id_token_claims.get('name') or userinfo.get('name') or vk_name,
        'picture': id_token_claims.get('picture') or userinfo.get('picture') or 
                   (vk_users_get.get('photo_max') if vk_users_get else None) or 
                   (vk_users_get.get('photo_200') if vk_users_get else None),
        'is_verified': vk_users_get.get('is_verified') in [True, 1] if vk_users_get else False,
        'raw': {
            'id_token_claims': id_token_claims,
            'userinfo': userinfo,
            'users_get': vk_users_get,
            'token_info': {
                'has_access_token': bool(token_data.get('access_token')),
                'has_refresh_token': bool(token_data.get('refresh_token')),
                'token_type': token_data.get('token_type'),
                'expires_in': token_data.get('expires_in'),
                'scope': token_data.get('scope')
            }
        }
    }

def decode_id_token_simple(id_token: str) -> Dict[str, Any]:
    try:
        parts = id_token.split('.')
        if len(parts) != 3:
            return {}
        payload = parts[1]
        padding = 4 - (len(payload) % 4)
        if padding != 4:
            payload += '=' * padding
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except:
        return {}

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    try:
        clean_old_sessions()
        
        if not VK_CLIENT_ID or not VK_CLIENT_SECRET:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'VK credentials not configured'})
            }
        
        query_params = event.get('queryStringParameters') or {}
        code = query_params.get('code')
        
        if method == 'GET' and not code:
            oidc_config = discover_vk_issuer()
            auth_endpoint = oidc_config.get('authorization_endpoint')
            
            if not auth_endpoint:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'VK authorization endpoint not found'})
                }
            
            state = generate_state()
            nonce = generate_nonce()
            code_verifier = generate_code_verifier()
            code_challenge = generate_code_challenge(code_verifier)
            
            sessions_storage[state] = {
                'state': state,
                'nonce': nonce,
                'code_verifier': code_verifier,
                'provider': 'vkid',
                'timestamp': time.time()
            }
            
            auth_params = {
                'client_id': VK_CLIENT_ID,
                'redirect_uri': f'{BASE_URL}/auth/callback/vkid',
                'response_type': 'code',
                'scope': 'openid email phone offline_access',
                'state': state,
                'nonce': nonce,
                'code_challenge': code_challenge,
                'code_challenge_method': 'S256'
            }
            
            auth_url = f'{auth_endpoint}?{urlencode(auth_params)}'
            
            return {
                'statusCode': 302,
                'headers': {
                    'Location': auth_url,
                    'Access-Control-Allow-Origin': '*'
                },
                'body': ''
            }
        
        if method == 'GET' and code:
            state = query_params.get('state')
            
            if not state or state not in sessions_storage:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid or expired state'})
                }
            
            session_data = sessions_storage.pop(state)
            
            oidc_config = discover_vk_issuer()
            token_endpoint = oidc_config.get('token_endpoint')
            userinfo_endpoint = oidc_config.get('userinfo_endpoint')
            
            token_params = {
                'client_id': VK_CLIENT_ID,
                'client_secret': VK_CLIENT_SECRET,
                'code': code,
                'redirect_uri': f'{BASE_URL}/auth/callback/vkid',
                'grant_type': 'authorization_code',
                'code_verifier': session_data['code_verifier']
            }
            
            token_resp = requests.post(token_endpoint, data=token_params, timeout=15)
            token_data = token_resp.json()
            
            if 'error' in token_data:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Token exchange failed', 'details': token_data})
                }
            
            access_token = token_data.get('access_token')
            id_token = token_data.get('id_token', '')
            
            id_token_claims = decode_id_token_simple(id_token)
            
            userinfo = {}
            if access_token and userinfo_endpoint:
                try:
                    userinfo_resp = requests.get(
                        userinfo_endpoint,
                        headers={'Authorization': f'Bearer {access_token}'},
                        timeout=10
                    )
                    if userinfo_resp.status_code == 200:
                        userinfo = userinfo_resp.json()
                except:
                    pass
            
            vk_users_get = None
            if access_token and (id_token_claims.get('sub') or userinfo.get('sub')):
                user_id = str(id_token_claims.get('sub') or userinfo.get('sub'))
                vk_users_get = fetch_vk_user_info(access_token, user_id)
            
            profile = normalize_profile(id_token_claims, userinfo, vk_users_get, token_data)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'profile': profile,
                    'session_id': secrets.token_urlsafe(32)
                })
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Authentication failed', 'message': str(e)})
        }
