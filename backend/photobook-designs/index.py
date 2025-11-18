import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление сохраненными дизайнами фотокниг пользователя
    Args: event - dict with httpMethod, body, headers (X-User-Id)
    Returns: HTTP response dict with designs data
    '''
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'User not authenticated'}),
            'isBase64Encoded': False
        }
    
    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)
    
    try:
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'list')
            
            if action == 'list':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT 
                            pd.id,
                            pd.title,
                            pd.config,
                            pd.method,
                            pd.fill_method,
                            pd.template,
                            pd.spreads,
                            pd.enable_client_link,
                            pd.client_link_id,
                            pd.created_at,
                            pd.updated_at,
                            COALESCE(
                                json_agg(
                                    json_build_object(
                                        'id', pdp.id,
                                        'url', pdp.photo_url,
                                        'order', pdp.photo_order
                                    ) ORDER BY pdp.photo_order
                                ) FILTER (WHERE pdp.id IS NOT NULL),
                                '[]'
                            ) as photos
                        FROM photobook_designs pd
                        LEFT JOIN photobook_design_photos pdp ON pd.id = pdp.design_id
                        WHERE pd.user_id = %s
                        GROUP BY pd.id
                        ORDER BY pd.created_at DESC
                    ''', (user_id,))
                    designs = cur.fetchall()
                    
                    for design in designs:
                        if design['created_at']:
                            design['created_at'] = design['created_at'].isoformat()
                        if design['updated_at']:
                            design['updated_at'] = design['updated_at'].isoformat()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'designs': designs}),
                    'isBase64Encoded': False
                }
            
            elif action == 'get':
                design_id = event.get('queryStringParameters', {}).get('id')
                if not design_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'design id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT 
                            pd.id,
                            pd.title,
                            pd.config,
                            pd.method,
                            pd.fill_method,
                            pd.template,
                            pd.spreads,
                            pd.enable_client_link,
                            pd.client_link_id,
                            pd.created_at,
                            pd.updated_at,
                            COALESCE(
                                json_agg(
                                    json_build_object(
                                        'id', pdp.id,
                                        'url', pdp.photo_url,
                                        'order', pdp.photo_order
                                    ) ORDER BY pdp.photo_order
                                ) FILTER (WHERE pdp.id IS NOT NULL),
                                '[]'
                            ) as photos
                        FROM photobook_designs pd
                        LEFT JOIN photobook_design_photos pdp ON pd.id = pdp.design_id
                        WHERE pd.id = %s AND pd.user_id = %s
                        GROUP BY pd.id
                    ''', (design_id, user_id))
                    design = cur.fetchone()
                    
                    if not design:
                        return {
                            'statusCode': 404,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Design not found'}),
                            'isBase64Encoded': False
                        }
                    
                    if design['created_at']:
                        design['created_at'] = design['created_at'].isoformat()
                    if design['updated_at']:
                        design['updated_at'] = design['updated_at'].isoformat()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'design': design}),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            
            title = body_data.get('title')
            config = body_data.get('config')
            method_type = body_data.get('method')
            fill_method = body_data.get('fillMethod')
            template = body_data.get('template')
            spreads = body_data.get('spreads')
            photos = body_data.get('photos', [])
            enable_client_link = body_data.get('enableClientLink', False)
            
            if not all([title, config, method_type, spreads]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'title, config, method, and spreads required'}),
                    'isBase64Encoded': False
                }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    INSERT INTO photobook_designs 
                    (user_id, title, config, method, fill_method, template, spreads, enable_client_link)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                ''', (
                    user_id,
                    title,
                    json.dumps(config),
                    method_type,
                    fill_method,
                    json.dumps(template) if template else None,
                    json.dumps(spreads),
                    enable_client_link
                ))
                result = cur.fetchone()
                design_id = result['id']
                
                for idx, photo in enumerate(photos):
                    cur.execute('''
                        INSERT INTO photobook_design_photos 
                        (design_id, photo_url, photo_order)
                        VALUES (%s, %s, %s)
                    ''', (design_id, photo.get('url'), idx))
                
                conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'id': design_id, 'success': True}),
                'isBase64Encoded': False
            }
        
        elif method == 'PUT':
            body_data = json.loads(event.get('body', '{}'))
            design_id = body_data.get('id')
            
            if not design_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'design id required'}),
                    'isBase64Encoded': False
                }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                update_fields = []
                update_values = []
                
                if 'title' in body_data:
                    update_fields.append('title = %s')
                    update_values.append(body_data['title'])
                
                if 'config' in body_data:
                    update_fields.append('config = %s')
                    update_values.append(json.dumps(body_data['config']))
                
                if 'spreads' in body_data:
                    update_fields.append('spreads = %s')
                    update_values.append(json.dumps(body_data['spreads']))
                
                if 'enableClientLink' in body_data:
                    update_fields.append('enable_client_link = %s')
                    update_values.append(body_data['enableClientLink'])
                
                if update_fields:
                    update_fields.append('updated_at = CURRENT_TIMESTAMP')
                    update_values.extend([design_id, user_id])
                    
                    query = f'''
                        UPDATE photobook_designs
                        SET {', '.join(update_fields)}
                        WHERE id = %s AND user_id = %s
                    '''
                    cur.execute(query, update_values)
                    conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        elif method == 'DELETE':
            body_data = json.loads(event.get('body', '{}'))
            design_id = body_data.get('id')
            
            if not design_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'design id required'}),
                    'isBase64Encoded': False
                }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    UPDATE photobook_designs
                    SET title = title
                    WHERE id = %s AND user_id = %s
                ''', (design_id, user_id))
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
    
    finally:
        conn.close()
