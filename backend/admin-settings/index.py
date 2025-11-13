import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Dict, Any

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление настройками админ-панели (получение и сохранение)
    Args: event - dict with httpMethod (GET/POST), body with settings data
          context - object with request_id and other metadata
    Returns: HTTP response with settings data or save confirmation
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            cur.execute("""
                SELECT setting_key, setting_value, setting_type 
                FROM t_p28211681_photo_secure_web.site_settings
            """)
            settings_rows = cur.fetchall()
            
            cur.execute("""
                SELECT color_key, color_value 
                FROM t_p28211681_photo_secure_web.color_scheme
            """)
            colors_rows = cur.fetchall()
            
            cur.execute("""
                SELECT widget_name, enabled, display_order, config_data 
                FROM t_p28211681_photo_secure_web.widget_config 
                ORDER BY display_order
            """)
            widgets_rows = cur.fetchall()
            
            settings = {}
            for row in settings_rows:
                key = row['setting_key']
                value = row['setting_value']
                if row['setting_type'] == 'boolean':
                    settings[key] = value.lower() == 'true'
                elif row['setting_type'] == 'number':
                    settings[key] = float(value) if '.' in value else int(value)
                else:
                    settings[key] = value
            
            colors = {row['color_key']: row['color_value'] for row in colors_rows}
            widgets = [dict(row) for row in widgets_rows]
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'settings': settings,
                    'colors': colors,
                    'widgets': widgets
                })
            }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            user_email = event.get('headers', {}).get('x-user-id', 'unknown')
            
            change_data = {
                'settings': body_data.get('settings', {}),
                'colors': body_data.get('colors', {}),
                'widgets': body_data.get('widgets', [])
            }
            
            description_parts = []
            if 'settings' in body_data:
                description_parts.append(f"изменено {len(body_data['settings'])} настроек")
            if 'colors' in body_data:
                description_parts.append(f"обновлено {len(body_data['colors'])} цветов")
            if 'widgets' in body_data:
                description_parts.append(f"обновлено {len(body_data['widgets'])} виджетов")
            
            description = ', '.join(description_parts)
            
            cur.execute("""
                INSERT INTO t_p28211681_photo_secure_web.settings_history 
                (change_type, change_data, changed_by, description)
                VALUES (%s, %s, %s, %s)
            """, ('update', json.dumps(change_data), user_email, description))
            
            if 'settings' in body_data:
                for key, value in body_data['settings'].items():
                    if isinstance(value, bool):
                        str_value = 'true' if value else 'false'
                    else:
                        str_value = str(value)
                    
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.site_settings 
                        SET setting_value = %s, updated_at = CURRENT_TIMESTAMP, updated_by = %s 
                        WHERE setting_key = %s
                    """, (str_value, user_email, key))
            
            if 'colors' in body_data:
                for key, value in body_data['colors'].items():
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.color_scheme 
                        SET color_value = %s, updated_at = CURRENT_TIMESTAMP, updated_by = %s 
                        WHERE color_key = %s
                    """, (value, user_email, key))
            
            if 'widgets' in body_data:
                for widget in body_data['widgets']:
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.widget_config 
                        SET enabled = %s, display_order = %s, config_data = %s, updated_at = CURRENT_TIMESTAMP 
                        WHERE widget_name = %s
                    """, (
                        widget.get('enabled', True),
                        widget.get('display_order', 0),
                        json.dumps(widget.get('config_data', {})),
                        widget['widget_name']
                    ))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': True, 'message': 'Настройки сохранены'})
            }
    
    finally:
        cur.close()
        conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }