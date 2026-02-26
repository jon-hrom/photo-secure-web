"""
Управление настройками фонового видео/изображения страницы входа.
Сохраняет настройки в БД, чтобы они работали на всех доменах.
"""

import json
import os
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    GET - получить текущие настройки фона
    POST - сохранить новые настройки фона
    """
    
    method: str = event.get('httpMethod', 'GET')
    
    # CORS headers
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    # Handle CORS preflight
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}
    
    # Database connection
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cursor = conn.cursor()
    
    try:
        if method == 'GET':
            # Получаем настройки фона
            cursor.execute("""
                SELECT setting_key, setting_value 
                FROM t_p28211681_photo_secure_web.app_settings 
                WHERE setting_key IN (
                    'login_background_video_id',
                    'login_background_video_url',
                    'login_mobile_background_url',
                    'login_background_image_id',
                    'login_background_opacity'
                )
            """)
            
            rows = cursor.fetchall()
            settings = {key: value for key, value in rows}
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'success': True,
                    'settings': settings
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'POST':
            # Сохраняем настройки фона
            body_str = event.get('body', '{}')
            body = json.loads(body_str)
            
            video_id = body.get('videoId', '')
            video_url = body.get('videoUrl', '')
            mobile_url = body.get('mobileUrl', '')
            image_id = body.get('imageId', '')
            opacity = body.get('opacity', '20')
            
            # Обновляем настройки
            cursor.execute("""
                INSERT INTO t_p28211681_photo_secure_web.app_settings 
                (setting_key, setting_value, updated_at)
                VALUES 
                    ('login_background_video_id', %s, NOW()),
                    ('login_background_video_url', %s, NOW()),
                    ('login_mobile_background_url', %s, NOW()),
                    ('login_background_image_id', %s, NOW()),
                    ('login_background_opacity', %s, NOW())
                ON CONFLICT (setting_key) 
                DO UPDATE SET 
                    setting_value = EXCLUDED.setting_value,
                    updated_at = NOW()
            """, (video_id, video_url, mobile_url, image_id, str(opacity)))
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Settings saved'
                }),
                'isBase64Encoded': False
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': headers,
                'body': json.dumps({'error': 'Method not allowed'}),
                'isBase64Encoded': False
            }
    
    except Exception as e:
        print(f'[ERROR] {str(e)}')
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    
    finally:
        cursor.close()
        conn.close()
