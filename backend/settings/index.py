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
    print(f"[SETTINGS] Handler called: method={method}")
    
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
        # Check if user settings are requested
        query_params = event.get('queryStringParameters') or {}
        user_id = query_params.get('userId')
        
        if user_id:
            # Get user settings - check both users and vk_users tables
            try:
                print(f"[SETTINGS] Loading settings for userId={user_id}")
                
                # First check users table
                cursor.execute("""
                    SELECT email, phone, two_factor_email, email_verified_at, source
                    FROM t_p28211681_photo_secure_web.users
                    WHERE id = %s
                """, (int(user_id),))
                row = cursor.fetchone()
                
                if row:
                    print(f"[SETTINGS] Found in users table: email={row[0]}, source={row[4]}")
                    user_settings = {
                        'email': row[0] or '',
                        'phone': row[1] or '',
                        'two_factor_email': row[2] or False,
                        'email_verified_at': row[3].isoformat() if row[3] else None,
                        'source': row[4] or 'email'
                    }
                else:
                    # Check vk_users table
                    cursor.execute("""
                        SELECT email, phone_number, full_name
                        FROM t_p28211681_photo_secure_web.vk_users
                        WHERE user_id = %s
                    """, (int(user_id),))
                    vk_row = cursor.fetchone()
                    
                    if not vk_row:
                        print(f"[SETTINGS] User not found in both tables")
                        cursor.close()
                        conn.close()
                        return {
                            'statusCode': 404,
                            'headers': {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            'body': json.dumps({'error': 'User not found'}),
                            'isBase64Encoded': False
                        }
                    
                    print(f"[SETTINGS] Found in vk_users table: email={vk_row[0]}")
                    
                    # Get 2FA settings from users table for VK user
                    cursor.execute("""
                        SELECT two_factor_email
                        FROM t_p28211681_photo_secure_web.users
                        WHERE id = %s
                    """, (int(user_id),))
                    fa_row = cursor.fetchone()
                    
                    user_settings = {
                        'email': vk_row[0] or '',
                        'phone': vk_row[1] or '',
                        'two_factor_email': fa_row[0] if fa_row else False,
                        'email_verified_at': None,
                        'source': 'vk'
                    }
                
                cursor.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps(user_settings),
                    'isBase64Encoded': False
                }
            except Exception as e:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': f'Error loading user settings: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        # Check if specific key is requested
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
        # Update a setting or user settings
        body_data = json.loads(event.get('body', '{}'))
        action = body_data.get('action')
        
        # Handle user settings actions
        if action == 'update-contact':
            user_id = body_data.get('userId')
            field = body_data.get('field')
            value = body_data.get('value')
            
            print(f"[SETTINGS] update-contact: userId={user_id}, field={field}, value={value}")
            
            if not user_id or not field or field not in ('email', 'phone'):
                print(f"[SETTINGS] Validation error: userId={user_id}, field={field}")
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'userId, field, and value are required'}),
                    'isBase64Encoded': False
                }
            
            try:
                print(f"[SETTINGS] Updating {field} for user {user_id}")
                
                # Update both users and vk_users tables
                cursor.execute(f"""
                    UPDATE t_p28211681_photo_secure_web.users
                    SET {field} = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (value, int(user_id)))
                
                # Also update vk_users if exists
                vk_field = 'phone_number' if field == 'phone' else field
                cursor.execute(f"""
                    UPDATE t_p28211681_photo_secure_web.vk_users
                    SET {vk_field} = %s
                    WHERE user_id = %s
                """, (value, int(user_id)))
                
                print(f"[SETTINGS] Updated {cursor.rowcount} rows in vk_users")
                
                conn.commit()
                cursor.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'success': True, 'field': field, 'value': value}),
                    'isBase64Encoded': False
                }
            except Exception as e:
                conn.rollback()
                cursor.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': f'Failed to update contact: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        if action == 'toggle-2fa':
            user_id = body_data.get('userId')
            fa_type = body_data.get('type')
            enabled = body_data.get('enabled', False)
            
            print(f"[SETTINGS] toggle-2fa: userId={user_id}, type={fa_type}, enabled={enabled}")
            
            if not user_id or not fa_type:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'userId and type are required'}),
                    'isBase64Encoded': False
                }
            
            try:
                # Check if user has email when enabling 2FA
                if enabled and fa_type == 'email':
                    cursor.execute("""
                        SELECT email FROM t_p28211681_photo_secure_web.users WHERE id = %s
                    """, (int(user_id),))
                    user_row = cursor.fetchone()
                    
                    if not user_row or not user_row[0] or not user_row[0].strip():
                        # Check vk_users table
                        cursor.execute("""
                            SELECT email FROM t_p28211681_photo_secure_web.vk_users WHERE user_id = %s
                        """, (int(user_id),))
                        vk_row = cursor.fetchone()
                        
                        if not vk_row or not vk_row[0] or not vk_row[0].strip():
                            print(f"[SETTINGS] Cannot enable 2FA - no email for userId={user_id}")
                            cursor.close()
                            conn.close()
                            return {
                                'statusCode': 400,
                                'headers': {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                },
                                'body': json.dumps({'error': 'Невозможно включить 2FA: сначала добавьте email в контактную информацию'}),
                                'isBase64Encoded': False
                            }
                
                cursor.execute(f"""
                    UPDATE t_p28211681_photo_secure_web.users
                    SET two_factor_{fa_type} = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (enabled, int(user_id)))
                
                conn.commit()
                cursor.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            except Exception as e:
                conn.rollback()
                cursor.close()
                conn.close()
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': f'Failed to toggle 2FA: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        # Update a global setting
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