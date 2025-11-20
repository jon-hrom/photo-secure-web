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
        
        if not vk_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'vk_id is required'}),
                'isBase64Encoded': False
            }
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Check if user already exists by vk_id, email, or phone
        cursor.execute(
            "SELECT id, vk_id, email, phone FROM users WHERE vk_id = %s OR (email IS NOT NULL AND email != '' AND email = %s) OR (phone IS NOT NULL AND phone != '' AND phone = %s)",
            (vk_id, email if email else None, phone if phone else None)
        )
        existing_user = cursor.fetchone()
        
        if existing_user:
            user_id = existing_user['id']
            
            # Update existing user (ensure vk_id is set if it wasn't before)
            cursor.execute(
                "UPDATE users SET vk_id = %s, email = %s, phone = %s, source = 'vk', is_active = TRUE, last_login = CURRENT_TIMESTAMP WHERE id = %s",
                (vk_id, email, phone, user_id)
            )
            
            # Check if vk_users record exists
            cursor.execute(
                "SELECT user_id FROM vk_users WHERE user_id = %s",
                (user_id,)
            )
            vk_user_exists = cursor.fetchone()
            
            if vk_user_exists:
                cursor.execute(
                    "UPDATE vk_users SET vk_sub = %s, full_name = %s, avatar_url = %s, is_verified = %s, email = %s, phone_number = %s, is_active = TRUE, last_login = CURRENT_TIMESTAMP WHERE user_id = %s",
                    (vk_id, full_name, avatar_url, is_verified, email, phone, user_id)
                )
            else:
                cursor.execute(
                    "INSERT INTO vk_users (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login) VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)",
                    (vk_id, user_id, full_name, avatar_url, is_verified, email, phone)
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
            "INSERT INTO users (vk_id, email, phone, is_active, source, registered_at, created_at, updated_at, last_login) VALUES (%s, %s, %s, TRUE, 'vk', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id",
            (vk_id, email, phone)
        )
        user_id = cursor.fetchone()['id']
        
        # Create vk_users record
        cursor.execute(
            "INSERT INTO vk_users (vk_sub, user_id, full_name, avatar_url, is_verified, email, phone_number, is_active, last_login) VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, CURRENT_TIMESTAMP)",
            (vk_id, user_id, full_name, avatar_url, is_verified, email, phone)
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
        if 'unique constraint' in error_msg.lower():
            return {
                'statusCode': 409,
                'headers': headers,
                'body': json.dumps({
                    'error': 'User already exists',
                    'details': 'A user with this VK ID, email, or phone already exists in the system'
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
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'Failed to create user', 'details': str(e)}),
            'isBase64Encoded': False
        }