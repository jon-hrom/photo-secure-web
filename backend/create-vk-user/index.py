"""
Business: Create VK user in database with proper permissions
Args: event with vk_id, name, email, phone in POST body
Returns: HTTP response with user_id
"""

import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise Exception('DATABASE_URL not configured')
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': headers,
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': headers,
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        vk_id = body.get('vk_id')
        full_name = body.get('full_name', '')
        email = body.get('email', '')
        phone = body.get('phone', '')
        avatar_url = body.get('avatar_url', '')
        is_verified = body.get('is_verified', False)
        
        print(f"[VK_USER] Request data: vk_id={vk_id}, email={email}, phone={phone}, name={full_name}")
        
        if not vk_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'vk_id is required'}),
                'isBase64Encoded': False
            }
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if user already exists by vk_id in users table
        cursor.execute(
            f"SELECT id FROM {SCHEMA}.users WHERE vk_id = %s",
            (vk_id,)
        )
        existing_by_vk = cursor.fetchone()
        
        # Check if vk_users record exists
        cursor.execute(
            f"SELECT user_id FROM {SCHEMA}.vk_users WHERE vk_sub = %s",
            (vk_id,)
        )
        existing_vk_user = cursor.fetchone()
        
        print(f"[VK_USER] Existing check: users.vk_id={existing_by_vk}, vk_users.vk_sub={existing_vk_user}")
        
        # Determine which user_id to use
        if existing_by_vk and existing_vk_user:
            # Both exist - use the one from users table and ensure consistency
            user_id = existing_by_vk['id']
            vk_user_id = existing_vk_user['user_id']
            
            if user_id != vk_user_id:
                # Data inconsistency - delete old vk_users record and create new one
                print(f"[VK_USER] Data inconsistency detected: users.id={user_id} != vk_users.user_id={vk_user_id}")
                cursor.execute("DELETE FROM vk_users WHERE vk_sub = %s", (vk_id,))
                existing_vk_user = None
        elif existing_by_vk:
            user_id = existing_by_vk['id']
        elif existing_vk_user:
            user_id = existing_vk_user['user_id']
        else:
            user_id = None
        
        if user_id:
            print(f"[VK_USER] Updating existing user: user_id={user_id}, vk_email={email}, vk_phone={phone}")
            
            # Get current email/phone from database
            cursor.execute(
                f"SELECT email, phone FROM {SCHEMA}.users WHERE id = %s",
                (user_id,)
            )
            current_data = cursor.fetchone()
            current_email = current_data['email'] if current_data else None
            current_phone = current_data['phone'] if current_data else None
            
            print(f"[VK_USER] Current DB data: email={current_email}, phone={current_phone}")
            
            # Only update email/phone if VK provides non-empty values OR if current value is NULL
            final_email = email if email else current_email
            final_phone = phone if phone else current_phone
            
            print(f"[VK_USER] Final values: email={final_email}, phone={final_phone}")
            
            # Update existing user
            cursor.execute(
                f"UPDATE {SCHEMA}.users SET vk_id = %s, email = %s, phone = %s, display_name = COALESCE(display_name, %s), source = 'vk', is_active = TRUE, last_login = CURRENT_TIMESTAMP WHERE id = %s",
                (vk_id, final_email, final_phone, full_name, user_id)
            )
            
            # Check if vk_users record exists for this user_id
            cursor.execute(
                f"SELECT user_id FROM {SCHEMA}.vk_users WHERE user_id = %s",
                (user_id,)
            )
            vk_user_record_exists = cursor.fetchone()
            
            if vk_user_record_exists:
                # Get current vk_users email/phone
                cursor.execute(
                    f"SELECT email, phone_number FROM {SCHEMA}.vk_users WHERE user_id = %s",
                    (user_id,)
                )
                vk_current = cursor.fetchone()
                vk_current_email = vk_current['email'] if vk_current else None
                vk_current_phone = vk_current['phone_number'] if vk_current else None
                
                # Preserve existing email/phone if VK doesn't provide new values
                vk_final_email = email if email else vk_current_email
                vk_final_phone = phone if phone else vk_current_phone
                
                print(f"[VK_USER] Updating vk_users: email={vk_final_email}, phone={vk_final_phone}")
                
                cursor.execute(
                    f"UPDATE {SCHEMA}.vk_users SET vk_sub = %s, full_name = %s, avatar_url = %s, is_verified = %s, email = %s, phone_number = %s, is_active = TRUE, last_login = CURRENT_TIMESTAMP WHERE user_id = %s",
                    (vk_id, full_name, avatar_url, is_verified, vk_final_email, vk_final_phone, user_id)
                )
            else:
                cursor.execute(
                    f"INSERT INTO {SCHEMA}.vk_users (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login) VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)",
                    (vk_id, user_id, full_name, avatar_url, is_verified, email if email else None, phone if phone else None)
                )
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({'user_id': user_id, 'created': False}),
                'isBase64Encoded': False
            }
        
        # Create new user
        cursor.execute(
            f"INSERT INTO {SCHEMA}.users (vk_id, email, phone, display_name, is_active, source, registered_at, created_at, updated_at, last_login, role) VALUES (%s, %s, %s, %s, TRUE, 'vk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'user') RETURNING id",
            (vk_id, email if email else None, phone if phone else None, full_name)
        )
        user_id = cursor.fetchone()['id']
        
        # Create vk_users record
        cursor.execute(
            f"INSERT INTO {SCHEMA}.vk_users (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login) VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)",
            (vk_id, user_id, full_name, avatar_url, is_verified, email if email else None, phone if phone else None)
        )
        
        conn.commit()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'user_id': user_id, 'created': True}),
            'isBase64Encoded': False
        }
        
    except psycopg2.IntegrityError as e:
        error_msg = str(e)
        print(f"[VK_USER_ERROR] IntegrityError: {error_msg}")
        
        if conn:
            conn.rollback()
            conn.close()
        
        if 'unique constraint' in error_msg.lower():
            return {
                'statusCode': 409,
                'headers': headers,
                'body': json.dumps({
                    'error': 'User already exists',
                    'details': f'Unique constraint violation: {error_msg}'
                }),
                'isBase64Encoded': False
            }
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Database integrity error', 'details': str(e)}),
            'isBase64Encoded': False
        }
    except Exception as e:
        print(f"[VK_USER_ERROR] Exception: {str(e)}")
        
        if conn:
            try:
                conn.rollback()
                conn.close()
            except:
                pass
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to create user', 'details': str(e)}),
            'isBase64Encoded': False
        }