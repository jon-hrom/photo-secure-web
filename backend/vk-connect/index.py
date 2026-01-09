"""
Business: OAuth подключение ВКонтакте для получения токена отправки сообщений
Args: event с httpMethod, queryStringParameters для callback
Returns: Редирект на страницу настроек с токеном
"""

import json
import os
import urllib.request
import urllib.parse
import psycopg2
from psycopg2.extras import RealDictCursor

VK_CLIENT_ID = os.environ.get('VK_CLIENT_ID', '')
VK_CLIENT_SECRET = os.environ.get('VK_CLIENT_SECRET', '')
DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'

VK_OAUTH_URL = 'https://oauth.vk.com/authorize'
VK_TOKEN_URL = 'https://oauth.vk.com/access_token'


def handler(event: dict, context) -> dict:
    '''Подключение ВКонтакте для отправки сообщений через OAuth'''
    
    method = event.get('httpMethod', 'GET')
    query_params = event.get('queryStringParameters', {}) or {}
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'GET':
        code = query_params.get('code')
        user_id = query_params.get('userId')
        redirect_uri = query_params.get('redirect')
        
        if not code:
            if not user_id or not redirect_uri:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*'},
                    'body': '<h1>Ошибка: userId и redirect обязательны</h1>',
                    'isBase64Encoded': False
                }
            
            callback_url = f'https://functions.poehali.dev/{context.function_name}'
            state = f'{user_id}:{redirect_uri}'
            
            oauth_params = {
                'client_id': VK_CLIENT_ID,
                'redirect_uri': callback_url,
                'display': 'page',
                'scope': 'messages,offline',
                'response_type': 'code',
                'state': state,
                'v': '5.131'
            }
            
            oauth_url = f'{VK_OAUTH_URL}?{urllib.parse.urlencode(oauth_params)}'
            
            return {
                'statusCode': 302,
                'headers': {
                    'Location': oauth_url,
                    'Access-Control-Allow-Origin': '*'
                },
                'body': '',
                'isBase64Encoded': False
            }
        
        state = query_params.get('state', '')
        if ':' not in state:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'text/html'},
                'body': '<h1>Ошибка: некорректный state</h1>',
                'isBase64Encoded': False
            }
        
        user_id, redirect_uri = state.split(':', 1)
        
        try:
            callback_url = f'https://functions.poehali.dev/{context.function_name}'
            
            token_params = {
                'client_id': VK_CLIENT_ID,
                'client_secret': VK_CLIENT_SECRET,
                'redirect_uri': callback_url,
                'code': code
            }
            
            token_url = f'{VK_TOKEN_URL}?{urllib.parse.urlencode(token_params)}'
            
            with urllib.request.urlopen(token_url) as response:
                token_data = json.loads(response.read().decode())
            
            if 'error' in token_data:
                error_msg = token_data.get('error_description', token_data['error'])
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'text/html'},
                    'body': f'<h1>Ошибка VK: {error_msg}</h1>',
                    'isBase64Encoded': False
                }
            
            access_token = token_data.get('access_token')
            vk_user_id = token_data.get('user_id')
            
            if not access_token:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'text/html'},
                    'body': '<h1>Ошибка: не получен токен</h1>',
                    'isBase64Encoded': False
                }
            
            user_info = get_vk_user_info(access_token)
            user_name = f"{user_info.get('first_name', '')} {user_info.get('last_name', '')}".strip()
            
            save_vk_token(user_id, access_token, vk_user_id, user_name)
            
            return {
                'statusCode': 302,
                'headers': {
                    'Location': redirect_uri,
                    'Access-Control-Allow-Origin': '*'
                },
                'body': '',
                'isBase64Encoded': False
            }
            
        except Exception as e:
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'text/html'},
                'body': f'<h1>Ошибка сервера: {str(e)}</h1>',
                'isBase64Encoded': False
            }
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }


def get_vk_user_info(access_token: str) -> dict:
    '''Получить информацию о пользователе ВК'''
    try:
        url = f'https://api.vk.com/method/users.get?access_token={access_token}&v=5.131'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
        
        if 'error' in data:
            return {}
        
        users = data.get('response', [])
        return users[0] if users else {}
    except Exception as e:
        print(f'Error fetching VK user info: {e}')
        return {}


def save_vk_token(user_id: str, token: str, vk_user_id: str, vk_user_name: str) -> None:
    '''Сохранить токен ВК в настройках пользователя'''
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        with conn.cursor() as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA}.vk_settings 
                (user_id, vk_user_token, vk_user_id, vk_user_name, updated_at)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    vk_user_token = EXCLUDED.vk_user_token,
                    vk_user_id = EXCLUDED.vk_user_id,
                    vk_user_name = EXCLUDED.vk_user_name,
                    updated_at = CURRENT_TIMESTAMP
            """, (user_id, token, str(vk_user_id), vk_user_name))
        conn.commit()
    finally:
        conn.close()
