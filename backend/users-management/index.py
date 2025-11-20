'''
Business: API для управления пользователями - получение списка, блокировка, разблокировка, удаление
Args: event с httpMethod, body, queryStringParameters
Returns: HTTP response с данными пользователей
'''

import json
import psycopg2
import os
from typing import Dict, Any

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            users = []
            
            # Получить пользователей с обычной регистрацией (email/phone)
            cur.execute("""
                SELECT 
                    'email' as source,
                    id::text as user_id,
                    email, 
                    phone, 
                    created_at, 
                    is_active, 
                    is_blocked, 
                    ip_address, 
                    last_login, 
                    user_agent, 
                    blocked_at, 
                    blocked_reason,
                    registered_at
                FROM t_p28211681_photo_secure_web.users
            """)
            
            for row in cur.fetchall():
                users.append({
                    'id': row[1],
                    'source': row[0],
                    'email': row[2],
                    'phone': row[3],
                    'full_name': None,
                    'avatar_url': None,
                    'created_at': row[4].isoformat() if row[4] else None,
                    'is_active': row[5],
                    'is_blocked': row[6] if row[6] is not None else False,
                    'ip_address': row[7],
                    'last_login': row[8].isoformat() if row[8] else None,
                    'user_agent': row[9],
                    'blocked_at': row[10].isoformat() if row[10] else None,
                    'blocked_reason': row[11],
                    'registered_at': row[12].isoformat() if row[12] else None
                })
            
            # Получить пользователей VK
            cur.execute("""
                SELECT 
                    'vk' as source,
                    user_id::text,
                    email,
                    phone_number,
                    full_name,
                    avatar_url,
                    registered_at,
                    last_login,
                    is_active,
                    is_blocked,
                    blocked_at,
                    blocked_reason,
                    ip_address,
                    user_agent
                FROM t_p28211681_photo_secure_web.vk_users
            """)
            
            for row in cur.fetchall():
                users.append({
                    'id': 'vk_' + row[1],
                    'source': row[0],
                    'email': row[2],
                    'phone': row[3],
                    'full_name': row[4],
                    'avatar_url': row[5],
                    'created_at': row[6].isoformat() if row[6] else None,
                    'is_active': row[8] if row[8] is not None else True,
                    'is_blocked': row[9] if row[9] is not None else False,
                    'ip_address': row[12],
                    'last_login': row[7].isoformat() if row[7] else None,
                    'user_agent': row[13],
                    'blocked_at': row[10].isoformat() if row[10] else None,
                    'blocked_reason': row[11],
                    'registered_at': row[6].isoformat() if row[6] else None
                })
            
            # Сортировка по дате регистрации (новые сверху)
            users.sort(key=lambda x: x.get('registered_at') or x.get('created_at') or '', reverse=True)
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'users': users}),
                'isBase64Encoded': False
            }
        
        elif method == 'PUT':
            body_data = json.loads(event.get('body', '{}'))
            user_id_str = body_data.get('user_id')
            action = body_data.get('action')
            reason = body_data.get('reason', '')
            
            # Определяем источник пользователя и блокируем
            if user_id_str.startswith('vk_'):
                vk_id = user_id_str.replace('vk_', '')
                if action == 'block':
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.vk_users
                        SET is_blocked = true, blocked_at = CURRENT_TIMESTAMP, blocked_reason = %s
                        WHERE user_id = %s
                    """, (reason, int(vk_id)))
                elif action == 'unblock':
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.vk_users
                        SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
                        WHERE user_id = %s
                    """, (int(vk_id),))
            else:
                user_id = int(user_id_str)
                if action == 'block':
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.users
                        SET is_blocked = true, blocked_at = CURRENT_TIMESTAMP, blocked_reason = %s
                        WHERE id = %s
                    """, (reason, user_id))
                elif action == 'unblock':
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.users
                        SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
                        WHERE id = %s
                    """, (user_id,))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        elif method == 'DELETE':
            body_data = json.loads(event.get('body', '{}'))
            user_id_str = body_data.get('user_id')
            
            # Определяем источник пользователя
            if user_id_str.startswith('vk_'):
                vk_id = user_id_str.replace('vk_', '')
                user_id_int = int(vk_id)
                
                # Удаляем все связанные данные VK пользователя
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.vk_temp_sessions WHERE vk_user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.oauth_sessions WHERE user_id = %s AND auth_provider = 'vk'", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_objects WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_invoices WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.photo_bank WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.login_attempts WHERE user_id = %s::text", (user_id_int,))
                
                # Удаляем VK пользователя
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.vk_users WHERE user_id = %s", (user_id_int,))
            else:
                user_id_int = int(user_id_str)
                
                # Удаляем все связанные данные обычного пользователя
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.email_verification_logs WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.email_verifications WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.login_attempts WHERE user_id = %s::text", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.oauth_sessions WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.two_factor_codes WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.two_factor_disable_requests WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.user_profiles WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_objects WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_invoices WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.photo_bank WHERE user_id = %s", (user_id_int,))
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.photobook_designs WHERE user_id = %s", (user_id_int,))
                
                # Удаляем пользователя
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.users WHERE id = %s", (user_id_int,))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
    finally:
        cur.close()
        conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }