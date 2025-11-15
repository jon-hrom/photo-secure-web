"""
Business: Manage global application settings (registration, maintenance mode, guest access)
Args: event with httpMethod, body, queryStringParameters; context with request_id
Returns: HTTP response with settings data or update confirmation
"""
import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    # Handle CORS OPTIONS request
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    # Get database connection
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Database configuration missing'}),
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(dsn)
    cursor = conn.cursor()
    
    if method == 'GET':
        # Check if specific key is requested
        query_params = event.get('queryStringParameters') or {}
        requested_key = query_params.get('key')
        
        if requested_key:
            # Get specific setting
            cursor.execute("SELECT setting_value FROM app_settings WHERE setting_key = %s", (requested_key,))
            row = cursor.fetchone()
            
            if row:
                value = row[0]
                # Try to parse as JSON first
                try:
                    parsed_value = json.loads(value)
                    result = {'value': parsed_value}
                except (json.JSONDecodeError, ValueError):
                    # If not JSON, check if it's a boolean
                    if value.lower() in ('true', 'false'):
                        result = {'value': value.lower() == 'true'}
                    else:
                        result = {'value': value}
            else:
                result = {'value': None}
            
            cursor.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(result),
                'isBase64Encoded': False
            }
        
        # Get all settings
        cursor.execute("SELECT setting_key, setting_value FROM app_settings")
        rows = cursor.fetchall()
        
        settings = {}
        for row in rows:
            key, value = row
            # Try to parse as JSON first
            try:
                settings[key] = json.loads(value)
            except (json.JSONDecodeError, ValueError):
                # If not JSON, check if it's a boolean
                if value.lower() in ('true', 'false'):
                    settings[key] = value.lower() == 'true'
                else:
                    settings[key] = value
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(settings),
            'isBase64Encoded': False
        }
    
    if method == 'POST':
        # Update a setting
        body_data = json.loads(event.get('body', '{}'))
        setting_key = body_data.get('key')
        setting_value_raw = body_data.get('value')
        
        if not setting_key:
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Setting key is required'}),
                'isBase64Encoded': False
            }
        
        # Convert value to string for storage
        # If it's a dict or list, store as JSON string
        if isinstance(setting_value_raw, (dict, list)):
            setting_value = json.dumps(setting_value_raw)
        elif isinstance(setting_value_raw, bool):
            setting_value = str(setting_value_raw).lower()
        else:
            setting_value = str(setting_value_raw)
        
        # Update or insert setting
        cursor.execute("""
            INSERT INTO app_settings (setting_key, setting_value, updated_at)
            VALUES (%s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (setting_key) 
            DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP
        """, (setting_key, setting_value))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'success': True, 'key': setting_key, 'value': setting_value_raw}),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 405,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }