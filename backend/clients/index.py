import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление клиентами и их данными (CRUD операции)
    Args: event с httpMethod, headers (X-User-Id), body, queryStringParameters
          context с request_id
    Returns: HTTP response с данными клиентов
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
    
    conn = psycopg2.connect(dsn)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'list')
            
            if action == 'list':
                cur.execute('''
                    SELECT id, user_id, name, phone, email, address, vk_profile, created_at, updated_at
                    FROM clients 
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                ''', (user_id,))
                clients = cur.fetchall()
                
                result = []
                for client in clients:
                    cur.execute('''
                        SELECT id, booking_date, booking_time, description, notification_enabled
                        FROM bookings 
                        WHERE client_id = %s
                        ORDER BY booking_date DESC
                    ''', (client['id'],))
                    bookings = cur.fetchall()
                    
                    cur.execute('''
                        SELECT id, name, status, budget, start_date, description
                        FROM client_projects 
                        WHERE client_id = %s
                        ORDER BY created_at DESC
                    ''', (client['id'],))
                    projects = cur.fetchall()
                    
                    cur.execute('''
                        SELECT id, amount, payment_date, status, method, description
                        FROM client_payments 
                        WHERE client_id = %s
                        ORDER BY payment_date DESC
                    ''', (client['id'],))
                    payments = cur.fetchall()
                    
                    cur.execute('''
                        SELECT id, name, file_url, upload_date
                        FROM client_documents 
                        WHERE client_id = %s
                        ORDER BY upload_date DESC
                    ''', (client['id'],))
                    documents = cur.fetchall()
                    
                    cur.execute('''
                        SELECT id, author, text, comment_date
                        FROM client_comments 
                        WHERE client_id = %s
                        ORDER BY comment_date DESC
                    ''', (client['id'],))
                    comments = cur.fetchall()
                    
                    cur.execute('''
                        SELECT id, type, author, content, message_date
                        FROM client_messages 
                        WHERE client_id = %s
                        ORDER BY message_date DESC
                    ''', (client['id'],))
                    messages = cur.fetchall()
                    
                    result.append({
                        **dict(client),
                        'bookings': [dict(b) for b in bookings],
                        'projects': [dict(p) for p in projects],
                        'payments': [dict(pay) for pay in payments],
                        'documents': [dict(d) for d in documents],
                        'comments': [dict(c) for c in comments],
                        'messages': [dict(m) for m in messages]
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(result, default=str),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action', 'create')
            
            if action == 'create':
                cur.execute('''
                    INSERT INTO clients (user_id, name, phone, email, address, vk_profile)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, user_id, name, phone, email, address, vk_profile, created_at, updated_at
                ''', (
                    user_id,
                    body.get('name'),
                    body.get('phone'),
                    body.get('email'),
                    body.get('address'),
                    body.get('vkProfile')
                ))
                client = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(dict(client), default=str),
                    'isBase64Encoded': False
                }
            
            elif action == 'add_booking':
                cur.execute('''
                    INSERT INTO bookings (client_id, booking_date, booking_time, description, notification_enabled)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id, client_id, booking_date, booking_time, description, notification_enabled
                ''', (
                    body.get('clientId'),
                    body.get('date'),
                    body.get('time'),
                    body.get('description'),
                    body.get('notificationEnabled', True)
                ))
                booking = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(dict(booking), default=str),
                    'isBase64Encoded': False
                }
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            client_id = body.get('id')
            
            cur.execute('''
                UPDATE clients 
                SET name = %s, phone = %s, email = %s, address = %s, vk_profile = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND user_id = %s
                RETURNING id, user_id, name, phone, email, address, vk_profile, created_at, updated_at
            ''', (
                body.get('name'),
                body.get('phone'),
                body.get('email'),
                body.get('address'),
                body.get('vkProfile'),
                client_id,
                user_id
            ))
            client = cur.fetchone()
            
            if not client:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Client not found'}),
                    'isBase64Encoded': False
                }
            
            # Обновляем проекты
            if 'projects' in body:
                cur.execute('DELETE FROM client_projects WHERE client_id = %s', (client_id,))
                for project in body.get('projects', []):
                    cur.execute('''
                        INSERT INTO client_projects (client_id, name, status, budget, start_date, description)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    ''', (
                        client_id,
                        project.get('name'),
                        project.get('status'),
                        project.get('budget'),
                        project.get('startDate'),
                        project.get('description')
                    ))
            
            # Обновляем платежи
            if 'payments' in body:
                cur.execute('DELETE FROM client_payments WHERE client_id = %s', (client_id,))
                for payment in body.get('payments', []):
                    cur.execute('''
                        INSERT INTO client_payments (client_id, amount, payment_date, status, method, description, project_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        client_id,
                        payment.get('amount'),
                        payment.get('date'),
                        payment.get('status'),
                        payment.get('method'),
                        payment.get('description'),
                        payment.get('projectId')
                    ))
            
            # Обновляем комментарии
            if 'comments' in body:
                cur.execute('DELETE FROM client_comments WHERE client_id = %s', (client_id,))
                for comment in body.get('comments', []):
                    cur.execute('''
                        INSERT INTO client_comments (client_id, author, text, comment_date)
                        VALUES (%s, %s, %s, %s)
                    ''', (
                        client_id,
                        comment.get('author'),
                        comment.get('text'),
                        comment.get('date')
                    ))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(dict(client), default=str),
                'isBase64Encoded': False
            }
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {})
            action = params.get('action')
            
            if action == 'delete_booking':
                booking_id = params.get('bookingId')
                cur.execute('DELETE FROM bookings WHERE id = %s', (booking_id,))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            client_id = params.get('clientId')
            
            cur.execute('''
                SELECT id FROM clients WHERE id = %s AND user_id = %s
            ''', (client_id, user_id))
            
            if not cur.fetchone():
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Client not found'}),
                    'isBase64Encoded': False
                }
            
            cur.execute('DELETE FROM bookings WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM client_projects WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM client_payments WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM client_documents WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM client_comments WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM client_messages WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM clients WHERE id = %s', (client_id,))
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
        cur.close()
        conn.close()