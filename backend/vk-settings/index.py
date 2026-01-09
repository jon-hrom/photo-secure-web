import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: dict, context):
    '''Управление настройками ВКонтакте для отправки уведомлений клиентам'''
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    user_id = event.get('headers', {}).get('X-User-Id')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'User ID required'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Database not configured'}),
            'isBase64Encoded': False
        }
    
    schema = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')
    
    conn = psycopg2.connect(dsn)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            cur.execute(f'''
                SELECT vk_user_token, vk_group_token, vk_group_id
                FROM {schema}.vk_settings
                WHERE user_id = %s
            ''', (user_id,))
            
            settings = cur.fetchone()
            
            if settings:
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(dict(settings)),
                    'isBase64Encoded': False
                }
            else:
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'vk_user_token': '',
                        'vk_group_token': '',
                        'vk_group_id': ''
                    }),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            
            vk_user_token = body.get('vk_user_token', '')
            vk_group_token = body.get('vk_group_token', '')
            vk_group_id = body.get('vk_group_id', '')
            
            cur.execute(f'''
                INSERT INTO {schema}.vk_settings 
                (user_id, vk_user_token, vk_group_token, vk_group_id, updated_at)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id)
                DO UPDATE SET
                    vk_user_token = EXCLUDED.vk_user_token,
                    vk_group_token = EXCLUDED.vk_group_token,
                    vk_group_id = EXCLUDED.vk_group_id,
                    updated_at = CURRENT_TIMESTAMP
            ''', (user_id, vk_user_token, vk_group_token, vk_group_id))
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()
