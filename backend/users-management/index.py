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
            params = event.get('queryStringParameters') or {}
            check_user_id = params.get('checkUserId')
            
            # Check single user block status
            if check_user_id:
                # Check in vk_users table
                cur.execute("""
                    SELECT is_blocked, blocked_reason, email 
                    FROM t_p28211681_photo_secure_web.vk_users 
                    WHERE user_id = %s
                """, (int(check_user_id),))
                
                vk_result = cur.fetchone()
                
                if vk_result:
                    is_blocked, blocked_reason, email = vk_result
                    
                    if is_blocked:
                        return {
                            'statusCode': 200,
                            'headers': {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            'body': json.dumps({
                                'blocked': True,
                                'error': 'User is blocked',
                                'message': blocked_reason or 'Ваш аккаунт заблокирован администратором',
                                'user_id': int(check_user_id),
                                'user_email': email,
                                'auth_method': 'vk'
                            }),
                            'isBase64Encoded': False
                        }
                    else:
                        return {
                            'statusCode': 200,
                            'headers': {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            'body': json.dumps({'blocked': False}),
                            'isBase64Encoded': False
                        }
                
                # Check in users table
                cur.execute("""
                    SELECT is_blocked, blocked_reason, email 
                    FROM t_p28211681_photo_secure_web.users 
                    WHERE id = %s
                """, (int(check_user_id),))
                
                user_result = cur.fetchone()
                
                if user_result:
                    is_blocked, blocked_reason, email = user_result
                    
                    if is_blocked:
                        return {
                            'statusCode': 200,
                            'headers': {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            'body': json.dumps({
                                'blocked': True,
                                'error': 'User is blocked',
                                'message': blocked_reason or 'Ваш аккаунт заблокирован администратором',
                                'user_id': int(check_user_id),
                                'user_email': email,
                                'auth_method': 'email'
                            }),
                            'isBase64Encoded': False
                        }
                    else:
                        return {
                            'statusCode': 200,
                            'headers': {
                                'Content-Type': 'application/json',
                                'Access-Control-Allow-Origin': '*'
                            },
                            'body': json.dumps({'blocked': False}),
                            'isBase64Encoded': False
                        }
                
                # User not found
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'User not found', 'blocked': False}),
                    'isBase64Encoded': False
                }
            
            # Return all users (existing logic)
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
                    'user_id': int(row[1]),
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
                    'user_id': int(row[1]),
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
            user_id_str = str(body_data.get('user_id'))
            action = body_data.get('action')
            reason = body_data.get('reason', '')
            
            # Определяем источник пользователя и блокируем в ОБЕИХ таблицах
            if user_id_str.startswith('vk_'):
                vk_id = user_id_str.replace('vk_', '')
                user_id = int(vk_id)
                
                if action == 'block':
                    # Блокируем в vk_users
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.vk_users
                        SET is_blocked = true, blocked_at = CURRENT_TIMESTAMP, blocked_reason = %s
                        WHERE user_id = %s
                    """, (reason, user_id))
                    
                    # Синхронизируем в users
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.users
                        SET is_blocked = true, blocked_at = CURRENT_TIMESTAMP, blocked_reason = %s
                        WHERE id = %s AND (source = 'vk' OR vk_id IS NOT NULL)
                    """, (reason, user_id))
                    
                elif action == 'unblock':
                    # Разблокируем в vk_users
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.vk_users
                        SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
                        WHERE user_id = %s
                    """, (user_id,))
                    
                    # Синхронизируем в users
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.users
                        SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
                        WHERE id = %s AND (source = 'vk' OR vk_id IS NOT NULL)
                    """, (user_id,))
            else:
                user_id = int(user_id_str)
                
                if action == 'block':
                    # Блокируем в users
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.users
                        SET is_blocked = true, blocked_at = CURRENT_TIMESTAMP, blocked_reason = %s
                        WHERE id = %s
                    """, (reason, user_id))
                    
                    # Синхронизируем в vk_users (если это VK пользователь)
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.vk_users
                        SET is_blocked = true, blocked_at = CURRENT_TIMESTAMP, blocked_reason = %s
                        WHERE user_id = %s
                    """, (reason, user_id))
                    
                elif action == 'unblock':
                    # Разблокируем в users
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.users
                        SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
                        WHERE id = %s
                    """, (user_id,))
                    
                    # Синхронизируем в vk_users (если это VK пользователь)
                    cur.execute("""
                        UPDATE t_p28211681_photo_secure_web.vk_users
                        SET is_blocked = false, blocked_at = NULL, blocked_reason = NULL
                        WHERE user_id = %s
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
            user_id_str = str(body_data.get('user_id'))
            
            # Определяем источник пользователя
            if user_id_str.startswith('vk_'):
                vk_id = user_id_str.replace('vk_', '')
                user_id_int = int(vk_id)
                
                # Удаляем все связанные данные VK пользователя (с обработкой ошибок)
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.user_emails WHERE user_id = %s AND provider = 'VK'", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.vk_temp_sessions WHERE vk_user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.oauth_sessions WHERE user_id = %s AND auth_provider = 'vk'", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_objects WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_invoices WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.photo_bank WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # Удаляем VK пользователя
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.vk_users WHERE user_id = %s", (user_id_int,))
            
            elif user_id_str.startswith('google_'):
                google_id = user_id_str.replace('google_', '')
                user_id_int = int(google_id)
                
                # Удаляем все связанные данные Google пользователя
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.user_emails WHERE user_id = %s AND provider = 'Google'", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.oauth_sessions WHERE user_id = %s AND auth_provider = 'google'", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_objects WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_invoices WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.photo_bank WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # Удаляем Google пользователя
                cur.execute("DELETE FROM t_p28211681_photo_secure_web.google_users WHERE user_id = %s", (user_id_int,))
            else:
                user_id_int = int(user_id_str)
                
                # Получаем email пользователя для удаления связанных записей
                cur.execute("SELECT email FROM t_p28211681_photo_secure_web.users WHERE id = %s", (user_id_int,))
                user_row = cur.fetchone()
                user_email = user_row[0] if user_row else None
                
                # Удаляем все связанные данные обычного пользователя (с обработкой ошибок прав доступа)
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.email_verification_logs WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                if user_email:
                    try:
                        cur.execute("DELETE FROM t_p28211681_photo_secure_web.email_verifications WHERE email = %s", (user_email,))
                    except:
                        pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.oauth_sessions WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.two_factor_codes WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.two_factor_disable_requests WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.user_profiles WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_objects WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_invoices WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # Каскадное удаление в правильном порядке (от зависимых к основным)
                
                # 1. user_emails
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.user_emails WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 2. two_factor_disable_requests
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.two_factor_disable_requests WHERE user_id = %s OR requested_by_admin_id = %s", (user_id_int, user_id_int))
                except:
                    pass
                
                # 3. whatsapp_notification_settings
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.whatsapp_notification_settings WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 4. whatsapp_messages (через chat_id из whatsapp_chats)
                try:
                    cur.execute("""
                        DELETE FROM t_p28211681_photo_secure_web.whatsapp_messages 
                        WHERE chat_id IN (SELECT id FROM t_p28211681_photo_secure_web.whatsapp_chats WHERE user_id = %s)
                    """, (user_id_int,))
                except:
                    pass
                
                # 5. whatsapp_chats
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.whatsapp_chats WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 6. photobook_design_photos (через design_id)
                try:
                    cur.execute("""
                        DELETE FROM t_p28211681_photo_secure_web.photobook_design_photos 
                        WHERE design_id IN (SELECT id FROM t_p28211681_photo_secure_web.photobook_designs WHERE user_id = %s)
                    """, (user_id_int,))
                except:
                    pass
                
                # 7. photobook_designs
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.photobook_designs WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 8. photo_bank
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.photo_bank WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 9. photo_folders
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.photo_folders WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 10. meeting_participants
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.meeting_participants WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 11. meetings
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.meetings WHERE creator_id = %s", (user_id_int,))
                except:
                    pass
                
                # 12. two_factor_codes
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.two_factor_codes WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 13. user_profiles
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.user_profiles WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 14. oauth_accounts
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.oauth_accounts WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 15. oauth_identities
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.oauth_identities WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 16. storage_usage_daily
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.storage_usage_daily WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 17. user_subscriptions
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.user_subscriptions WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 18. user_files
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.user_files WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 19. clients
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.clients WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 20. email_verification_logs
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.email_verification_logs WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 21. login_attempts
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.login_attempts WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 22. password_reset_codes
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.password_reset_codes WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # 23. blocked_user_appeals
                try:
                    cur.execute("DELETE FROM t_p28211681_photo_secure_web.blocked_user_appeals WHERE user_id = %s", (user_id_int,))
                except:
                    pass
                
                # Наконец, удаляем самого пользователя
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