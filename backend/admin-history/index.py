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
    Business: История изменений настроек с возможностью отката
    Args: event - dict with httpMethod (GET for history, POST for rollback), body with history_id
          context - object with request_id
    Returns: HTTP response with history list or rollback confirmation
    '''
    method: str = event.get('httpMethod', 'GET')
    
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
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            cur.execute("""
                SELECT id, change_type, change_data, changed_by, created_at, description
                FROM t_p28211681_photo_secure_web.settings_history
                ORDER BY created_at DESC
                LIMIT 50
            """)
            history_rows = cur.fetchall()
            
            history = []
            for row in history_rows:
                history.append({
                    'id': row['id'],
                    'type': row['change_type'],
                    'data': row['change_data'],
                    'changedBy': row['changed_by'],
                    'createdAt': row['created_at'].isoformat() if row['created_at'] else None,
                    'description': row['description']
                })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'history': history})
            }
        
        elif method == 'POST':
            body_str = event.get('body') or '{}'
            try:
                body_data = json.loads(body_str) if body_str else {}
            except json.JSONDecodeError:
                body_data = {}
            
            history_id = body_data.get('historyId')
            user_email = event.get('headers', {}).get('x-user-id', 'unknown')
            
            if not history_id:
                return {
                    'statusCode': 400,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'historyId required'})
                }
            
            cur.execute("""
                SELECT change_data 
                FROM t_p28211681_photo_secure_web.settings_history 
                WHERE id = %s
            """, (history_id,))
            
            history_row = cur.fetchone()
            if not history_row:
                return {
                    'statusCode': 404,
                    'headers': {'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'History not found'})
                }
            
            change_data = history_row['change_data']
            
            if 'settings' in change_data:
                for key, value in change_data['settings'].items():
                    if isinstance(value, bool):
                        str_value = 'true' if value else 'false'
                    else:
                        str_value = str(value)
                    
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.site_settings 
                        SET setting_value = %s, updated_at = CURRENT_TIMESTAMP, updated_by = %s 
                        WHERE setting_key = %s
                    """, (str_value, user_email, key))
            
            if 'colors' in change_data:
                for key, value in change_data['colors'].items():
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.color_scheme 
                        SET color_value = %s, updated_at = CURRENT_TIMESTAMP, updated_by = %s 
                        WHERE color_key = %s
                    """, (value, user_email, key))
            
            if 'widgets' in change_data:
                for widget in change_data['widgets']:
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
            
            cur.execute("""
                INSERT INTO t_p28211681_photo_secure_web.settings_history 
                (change_type, change_data, changed_by, description)
                VALUES (%s, %s, %s, %s)
            """, ('rollback', change_data, user_email, f'Откат к версии #{history_id}'))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': True, 'message': 'Откат выполнен успешно'})
            }
    
    finally:
        cur.close()
        conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }