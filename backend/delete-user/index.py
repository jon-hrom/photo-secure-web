import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Delete user and all associated data
    Args: event with httpMethod, body (user_id)
    Returns: HTTP response with success status
    '''
    method: str = event.get('httpMethod', 'DELETE')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'DELETE':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    body_str = event.get('body') or '{}'
    body_data = json.loads(body_str)
    user_id = body_data.get('user_id')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'user_id is required'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database connection not configured'}),
            'isBase64Encoded': False
        }
    
    conn = psycopg2.connect(dsn)
    cursor = conn.cursor()
    
    cursor.execute(f"DELETE FROM t_p28211681_photo_secure_web.vk_users WHERE user_id = {user_id}")
    cursor.execute(f"DELETE FROM t_p28211681_photo_secure_web.user_profiles WHERE user_id = {user_id}")
    cursor.execute(f"DELETE FROM t_p28211681_photo_secure_web.oauth_sessions WHERE user_id = {user_id}")
    cursor.execute(f"DELETE FROM t_p28211681_photo_secure_web.email_verifications WHERE user_id = {user_id}")
    cursor.execute(f"DELETE FROM t_p28211681_photo_secure_web.login_attempts WHERE user_id = {user_id}")
    cursor.execute(f"DELETE FROM t_p28211681_photo_secure_web.two_factor_codes WHERE user_id = {user_id}")
    cursor.execute(f"DELETE FROM t_p28211681_photo_secure_web.users WHERE id = {user_id}")
    
    conn.commit()
    cursor.close()
    conn.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'isBase64Encoded': False,
        'body': json.dumps({'success': True, 'message': 'User deleted successfully'})
    }