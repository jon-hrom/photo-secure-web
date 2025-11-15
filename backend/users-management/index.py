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
            # Получить всех пользователей
            cur.execute("""
                SELECT 
                    id, email, phone, created_at, is_active, is_blocked, 
                    ip_address, last_login, user_agent, blocked_at, blocked_reason,
                    registered_at
                FROM t_p28211681_photo_secure_web.users
                ORDER BY created_at DESC
            """)
            
            users = []
            for row in cur.fetchall():
                users.append({
                    'id': row[0],
                    'email': row[1],
                    'phone': row[2],
                    'created_at': row[3].isoformat() if row[3] else None,
                    'is_active': row[4],
                    'is_blocked': row[5],
                    'ip_address': row[6],
                    'last_login': row[7].isoformat() if row[7] else None,
                    'user_agent': row[8],
                    'blocked_at': row[9].isoformat() if row[9] else None,
                    'blocked_reason': row[10],
                    'registered_at': row[11].isoformat() if row[11] else None
                })
            
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
            # Блокировка/разблокировка пользователя
            body_data = json.loads(event.get('body', '{}'))
            user_id = body_data.get('user_id')
            action = body_data.get('action')  # 'block' или 'unblock'
            reason = body_data.get('reason', '')
            
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
            # Удаление пользователя
            body_data = json.loads(event.get('body', '{}'))
            user_id = body_data.get('user_id')
            
            cur.execute("""
                DELETE FROM t_p28211681_photo_secure_web.users
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
        
    finally:
        cur.close()
        conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }
