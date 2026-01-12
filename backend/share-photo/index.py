import json
import os
import psycopg2
import random
import string
from datetime import datetime, timedelta

def generate_short_code(length=8):
    """Генерирует короткий уникальный код для ссылки"""
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(length))

def handler(event: dict, context) -> dict:
    """
    API для создания коротких ссылок на фото
    POST /share-photo - создать короткую ссылку
    GET /share-photo?code=xxx - получить оригинальную ссылку
    """
    method = event.get('httpMethod', 'GET')
    
    # CORS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    # Подключение к БД
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database not configured'})
        }
    
    try:
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        if method == 'POST':
            # Создание короткой ссылки
            data = json.loads(event.get('body', '{}'))
            photo_path = data.get('photo_path', '')
            photo_name = data.get('photo_name', '')
            
            if not photo_path or not photo_name:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'photo_path and photo_name required'})
                }
            
            # Генерируем уникальный код
            max_attempts = 10
            short_code = None
            for _ in range(max_attempts):
                code = generate_short_code()
                cur.execute(
                    "SELECT id FROM t_p28211681_photo_secure_web.photo_short_links WHERE short_code = %s",
                    (code,)
                )
                if cur.fetchone() is None:
                    short_code = code
                    break
            
            if not short_code:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Failed to generate unique code'})
                }
            
            # Сохраняем в БД (ссылка действительна 30 дней)
            expires_at = datetime.now() + timedelta(days=30)
            cur.execute(
                """
                INSERT INTO t_p28211681_photo_secure_web.photo_short_links 
                (short_code, photo_path, photo_name, expires_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id
                """,
                (short_code, photo_path, photo_name, expires_at)
            )
            conn.commit()
            
            # Формируем короткую ссылку
            short_url = f"https://foto-mix.ru/s/{short_code}"
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'short_url': short_url,
                    'short_code': short_code,
                    'expires_at': expires_at.isoformat()
                })
            }
        
        elif method == 'GET':
            # Получение оригинальной ссылки по коду
            params = event.get('queryStringParameters', {}) or {}
            short_code = params.get('code', '')
            
            if not short_code:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'code parameter required'})
                }
            
            # Получаем данные из БД
            cur.execute(
                """
                SELECT photo_path, photo_name, expires_at, access_count
                FROM t_p28211681_photo_secure_web.photo_short_links
                WHERE short_code = %s
                """,
                (short_code,)
            )
            result = cur.fetchone()
            
            if not result:
                cur.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Link not found'})
                }
            
            photo_path, photo_name, expires_at, access_count = result
            
            # Проверяем срок действия
            if expires_at and datetime.now() > expires_at:
                cur.close()
                conn.close()
                return {
                    'statusCode': 410,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Link expired'})
                }
            
            # Увеличиваем счётчик доступов
            cur.execute(
                """
                UPDATE t_p28211681_photo_secure_web.photo_short_links
                SET access_count = access_count + 1
                WHERE short_code = %s
                """,
                (short_code,)
            )
            conn.commit()
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'photo_path': photo_path,
                    'photo_name': photo_name,
                    'access_count': access_count + 1
                })
            }
        
        else:
            cur.close()
            conn.close()
            return {
                'statusCode': 405,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }
