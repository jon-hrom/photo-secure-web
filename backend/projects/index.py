import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

DB_SCHEMA = 't_p28211681_photo_secure_web'

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Управление проектами: получение списка, обновление данных проекта
    Args: event - dict с httpMethod, queryStringParameters, body
          context - объект с атрибутами request_id, function_name
    Returns: HTTP response dict с проектами или результатом обновления
    '''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        user_id = params.get('userId')
        
        if not user_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId required'}),
                'isBase64Encoded': False
            }
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'''
                    SELECT 
                        p.id,
                        p.name,
                        p.budget,
                        p.status,
                        p.description,
                        p.start_date as "startDate",
                        c.name as "clientName",
                        c.id as "clientId"
                    FROM {DB_SCHEMA}.client_projects p
                    LEFT JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE c.user_id = %s
                    ORDER BY p.start_date DESC
                ''', (user_id,))
                
                projects = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps([dict(p) for p in projects], default=str),
                    'isBase64Encoded': False
                }
        finally:
            conn.close()
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        user_id = body_data.get('userId')
        project_id = body_data.get('projectId')
        updates = body_data.get('updates', {})
        
        if not user_id or not project_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId and projectId required'}),
                'isBase64Encoded': False
            }
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor() as cur:
                cur.execute(f'''
                    SELECT 1 FROM {DB_SCHEMA}.client_projects p
                    JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE p.id = %s AND c.user_id = %s
                ''', (project_id, user_id))
                
                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Access denied'}),
                        'isBase64Encoded': False
                    }
                
                update_fields = []
                values = []
                
                if 'name' in updates:
                    update_fields.append('name = %s')
                    values.append(updates['name'])
                
                if 'budget' in updates:
                    update_fields.append('budget = %s')
                    values.append(updates['budget'])
                
                if 'startDate' in updates:
                    update_fields.append('start_date = %s')
                    values.append(updates['startDate'])
                
                if 'status' in updates:
                    update_fields.append('status = %s')
                    values.append(updates['status'])
                
                if 'description' in updates:
                    update_fields.append('description = %s')
                    values.append(updates['description'])
                
                if update_fields:
                    values.append(project_id)
                    query = f"UPDATE {DB_SCHEMA}.client_projects SET {', '.join(update_fields)} WHERE id = %s"
                    cur.execute(query, values)
                    conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }