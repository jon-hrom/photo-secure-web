"""
API для подключения Google Calendar с OAuth2
"""

import json
import os
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL', '')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')
BASE_URL = os.environ.get('BASE_URL', 'https://p28211681.poehali.work')

SCHEMA = 't_p28211681_photo_secure_web'

CALENDAR_SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
]

# Redirect URI — прямой URL функции (не /api/)
REDIRECT_URI = "https://functions.poehali.dev/3d87d4f5-3bb5-4b17-a2c6-45d61cd21992"


def escape_sql(value):
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


def handler(event, context):
    """
    OAuth2 flow для подключения Google Calendar
    """
    method = event.get('httpMethod', 'GET')
    
    # CORS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id')
    query_params = event.get('queryStringParameters') or {}
    
    # Step 1: Generate OAuth URL
    if method == 'GET' and not query_params.get('code'):
        if not user_id:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing X-User-Id header'})
            }
        
        redirect_uri = REDIRECT_URI
        
        params = {
            'client_id': GOOGLE_CLIENT_ID,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(CALENDAR_SCOPES),
            'access_type': 'offline',
            'prompt': 'consent',
            'state': user_id
        }
        
        auth_url = 'https://accounts.google.com/o/oauth2/v2/auth?' + urllib.parse.urlencode(params)
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'auth_url': auth_url})
        }
    
    # Step 2: Handle OAuth callback
    if method == 'GET' and query_params.get('code'):
        code = query_params.get('code')
        state_user_id = query_params.get('state')
        
        if not state_user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*'},
                'body': '<h1>❌ Ошибка: отсутствует user_id</h1><script>setTimeout(() => window.close(), 3000)</script>'
            }
        
        redirect_uri = REDIRECT_URI
        
        # Exchange code for tokens
        token_url = 'https://oauth2.googleapis.com/token'
        token_data = {
            'code': code,
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'grant_type': 'authorization_code'
        }
        
        try:
            req = urllib.request.Request(
                token_url,
                data=urllib.parse.urlencode(token_data).encode('utf-8'),
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            
            with urllib.request.urlopen(req) as response:
                tokens = json.loads(response.read().decode('utf-8'))
            
            access_token = tokens.get('access_token')
            refresh_token = tokens.get('refresh_token')
            expires_in = tokens.get('expires_in', 3600)
            scopes = tokens.get('scope', '')
            
            if not access_token:
                raise ValueError('No access_token in response')
            
            # Calculate expiration time
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            # Save tokens to database
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    cur.execute(f"""
                        UPDATE {SCHEMA}.google_users
                        SET access_token = {escape_sql(access_token)},
                            refresh_token = {escape_sql(refresh_token)},
                            token_expires_at = {escape_sql(expires_at.isoformat())},
                            calendar_enabled = TRUE,
                            calendar_scopes = {escape_sql(scopes)}
                        WHERE user_id = {escape_sql(state_user_id)}
                    """)
                conn.commit()
            finally:
                conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*'},
                'body': '''
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <title>✅ Google Calendar подключен</title>
                        <style>
                            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                            h1 { color: #10b981; }
                        </style>
                    </head>
                    <body>
                        <h1>✅ Google Calendar успешно подключен!</h1>
                        <p>Теперь ваши съёмки будут автоматически синхронизироваться с календарём.</p>
                        <p>Это окно закроется автоматически через 3 секунды...</p>
                        <script>
                            setTimeout(() => {
                                window.opener.postMessage({ type: 'GOOGLE_CALENDAR_CONNECTED' }, '*');
                                window.close();
                            }, 3000);
                        </script>
                    </body>
                    </html>
                '''
            }
        except Exception as e:
            print(f'[ERROR] OAuth error: {str(e)}')
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*'},
                'body': f'<h1>❌ Ошибка OAuth</h1><p>{str(e)}</p><script>setTimeout(() => window.close(), 5000)</script>'
            }
    
    # Step 3: Check connection status
    if method == 'POST':
        if not user_id:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Missing X-User-Id header'})
            }
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT calendar_enabled, token_expires_at
                    FROM {SCHEMA}.google_users
                    WHERE user_id = {escape_sql(user_id)}
                """)
                result = cur.fetchone()
                
                if not result:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'connected': False})
                    }
                
                expires_at = None
                if result.get('token_expires_at'):
                    try:
                        expires_at = result['token_expires_at'].isoformat() if hasattr(result['token_expires_at'], 'isoformat') else str(result['token_expires_at'])
                    except:
                        expires_at = None
                
                is_connected = bool(result['calendar_enabled'] and expires_at)
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'connected': is_connected,
                        'expires_at': expires_at
                    }),
                    'isBase64Encoded': False
                }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }