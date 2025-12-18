import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

DB_SCHEMA = 't_p28211681_photo_secure_web'

def send_max_message(user_id: int, client_phone: str, template_type: str, variables: Dict[str, str]) -> bool:
    """Отправить MAX сообщение через внутренний API"""
    try:
        import requests
        max_url = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d'
        
        response = requests.post(max_url, json={
            'action': 'send_service_message',
            'client_phone': client_phone,
            'template_type': template_type,
            'variables': variables
        }, headers={
            'Content-Type': 'application/json',
            'X-User-Id': str(user_id)
        }, timeout=10)
        
        result = response.json()
        if result.get('success'):
            print(f"MAX message sent: {template_type} to {client_phone}")
            return True
        else:
            print(f"MAX error: {result.get('error')}")
            return False
    except Exception as e:
        print(f"MAX send error: {str(e)}")
        return False

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Управление платежами: получение, добавление, удаление
    Args: event - dict с httpMethod, queryStringParameters, body
          context - объект с атрибутами request_id, function_name
    Returns: HTTP response dict с платежами или результатом операции
    '''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        user_id = params.get('userId')
        project_id = params.get('projectId')
        
        if not user_id or not project_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId and projectId required'}),
                'isBase64Encoded': False
            }
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'''
                    SELECT pay.id, pay.amount, pay.payment_date as date, pay.method, pay.project_id as "projectId"
                    FROM {DB_SCHEMA}.client_payments pay
                    JOIN {DB_SCHEMA}.client_projects p ON pay.project_id = p.id
                    JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE c.user_id = %s AND pay.project_id = %s
                    ORDER BY pay.payment_date DESC
                ''', (user_id, project_id))
                
                payments = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps([dict(p) for p in payments], default=str),
                    'isBase64Encoded': False
                }
        finally:
            conn.close()
    
    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        user_id = body_data.get('userId')
        project_id = body_data.get('projectId')
        amount = body_data.get('amount')
        method_type = body_data.get('method', 'cash')
        date = body_data.get('date')
        
        if not user_id or not project_id or not amount:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId, projectId and amount required'}),
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
                
                cur.execute(f'''
                    SELECT c.id as client_id
                    FROM {DB_SCHEMA}.client_projects p
                    JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE p.id = %s
                ''', (project_id,))
                
                client_row = cur.fetchone()
                if not client_row:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Project not found'}),
                        'isBase64Encoded': False
                    }
                
                client_id = client_row[0]
                
                cur.execute(f'''
                    INSERT INTO {DB_SCHEMA}.client_payments (project_id, client_id, amount, method, payment_date)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                ''', (project_id, client_id, amount, method_type, date))
                
                payment_id = cur.fetchone()[0]
                conn.commit()
                
                # Отправить уведомление клиенту о получении оплаты
                cur.execute(f'''
                    SELECT 
                        c.phone,
                        p.name as project_name,
                        u.full_name as photographer_name
                    FROM {DB_SCHEMA}.clients c
                    JOIN {DB_SCHEMA}.client_projects p ON p.client_id = c.id
                    JOIN {DB_SCHEMA}.users u ON c.user_id = u.id
                    WHERE c.id = %s AND p.id = %s
                ''', (client_id, project_id))
                
                row = cur.fetchone()
                if row and row[0]:
                    client_phone, project_name, photographer_name = row
                    send_max_message(
                        user_id=int(user_id),
                        client_phone=client_phone,
                        template_type='payment_received',
                        variables={
                            'amount': str(amount),
                            'description': project_name or 'Услуги фотографа',
                            'photographer_name': photographer_name or 'Ваш фотограф'
                        }
                    )
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True, 'id': payment_id}),
                    'isBase64Encoded': False
                }
        finally:
            conn.close()
    
    if method == 'DELETE':
        body_data = json.loads(event.get('body', '{}'))
        user_id = body_data.get('userId')
        payment_id = body_data.get('paymentId')
        
        if not user_id or not payment_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId and paymentId required'}),
                'isBase64Encoded': False
            }
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor() as cur:
                cur.execute(f'''
                    SELECT 1 FROM {DB_SCHEMA}.client_payments pay
                    JOIN {DB_SCHEMA}.client_projects p ON pay.project_id = p.id
                    JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE pay.id = %s AND c.user_id = %s
                ''', (payment_id, user_id))
                
                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Access denied'}),
                        'isBase64Encoded': False
                    }
                
                cur.execute(f'DELETE FROM {DB_SCHEMA}.client_payments WHERE id = %s', (payment_id,))
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