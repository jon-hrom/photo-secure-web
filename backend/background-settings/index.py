"""
Управление настройками фонового видео/изображения страницы входа.
Сохраняет настройки в БД, чтобы они работали на всех устройствах и аккаунтах.
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

    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': headers, 'body': ''}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        if method == 'GET':
            cursor.execute("""
                SELECT setting_key, setting_value
                FROM t_p28211681_photo_secure_web.app_settings
                WHERE setting_key IN (
                    'login_background_video_id',
                    'login_background_video_url',
                    'login_mobile_background_url',
                    'login_background_image_id',
                    'login_background_image_url',
                    'login_background_opacity',
                    'login_desktop_images',
                    'login_desktop_selected_id',
                    'login_card_images',
                    'login_card_selected_id',
                    'login_card_opacity',
                    'login_card_transition_time'
                )
            """)

            rows = cursor.fetchall()
            settings = {key: value for key, value in rows}

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'success': True, 'settings': settings}),
                'isBase64Encoded': False
            }

        elif method == 'POST':
            body_str = event.get('body', '{}')
            body = json.loads(body_str)

            updates = []
            values = []

            field_map = {
                'videoId': 'login_background_video_id',
                'videoUrl': 'login_background_video_url',
                'mobileUrl': 'login_mobile_background_url',
                'imageId': 'login_background_image_id',
                'imageUrl': 'login_background_image_url',
                'opacity': 'login_background_opacity',
                'desktopImages': 'login_desktop_images',
                'desktopSelectedId': 'login_desktop_selected_id',
                'cardImages': 'login_card_images',
                'cardSelectedId': 'login_card_selected_id',
                'cardOpacity': 'login_card_opacity',
                'cardTransitionTime': 'login_card_transition_time',
            }

            for field, db_key in field_map.items():
                if field in body:
                    val = body[field]
                    if isinstance(val, (dict, list)):
                        val = json.dumps(val, ensure_ascii=False)
                    else:
                        val = str(val)
                    updates.append(f"('{db_key}', %s, NOW())")
                    values.append(val)

            if updates:
                cursor.execute(f"""
                    INSERT INTO t_p28211681_photo_secure_web.app_settings
                    (setting_key, setting_value, updated_at)
                    VALUES {', '.join(updates)}
                    ON CONFLICT (setting_key)
                    DO UPDATE SET
                        setting_value = EXCLUDED.setting_value,
                        updated_at = NOW()
                """, values)

            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'success': True, 'message': 'Settings saved'}),
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
        print(f'[BG_SETTINGS] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }

    finally:
        cursor.close()
        conn.close()
