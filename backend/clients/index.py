import json
import os
import base64
import uuid
from typing import Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3

# S3 configuration
S3_BUCKET = 'foto-mix'
S3_ENDPOINT = 'https://storage.yandexcloud.net'
S3_REGION = 'ru-central1'

def get_s3_client():
    '''Возвращает S3 клиент'''
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        aws_access_key_id=os.environ['YC_S3_KEY_ID'],
        aws_secret_access_key=os.environ['YC_S3_SECRET'],
        region_name=S3_REGION
    )

def upload_to_s3(file_content: bytes, filename: str) -> str:
    '''Загружает файл в S3 и возвращает S3 key (не URL!)'''
    s3_client = get_s3_client()
    
    file_ext = filename.split('.')[-1] if '.' in filename else 'bin'
    unique_filename = f'client-documents/{uuid.uuid4()}.{file_ext}'
    
    # Определяем правильный Content-Type
    content_type = 'application/octet-stream'
    if file_ext.lower() in ['jpg', 'jpeg']:
        content_type = 'image/jpeg'
    elif file_ext.lower() == 'png':
        content_type = 'image/png'
    elif file_ext.lower() == 'pdf':
        content_type = 'application/pdf'
    elif file_ext.lower() in ['doc', 'docx']:
        content_type = 'application/msword'
    
    # Загружаем ПРИВАТНО (без ACL)
    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=unique_filename,
        Body=file_content,
        ContentType=content_type
    )
    
    # Возвращаем S3 key, а не URL
    return unique_filename

def generate_presigned_url(s3_key: str, expiration: int = 3600) -> str:
    '''Генерирует подписанный URL для приватного файла'''
    s3_client = get_s3_client()
    
    try:
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': S3_BUCKET,
                'Key': s3_key
            },
            ExpiresIn=expiration  # URL действителен 1 час
        )
        return url
    except Exception as e:
        print(f'[PRESIGNED_URL] Error: {e}')
        return ''

def delete_from_s3(s3_key: str):
    '''Удаляет файл из S3 по ключу'''
    if not s3_key:
        return
    
    s3_client = get_s3_client()
    
    try:
        s3_client.delete_object(Bucket=S3_BUCKET, Key=s3_key)
        print(f'[DELETE_S3] Deleted: {s3_key}')
    except Exception as e:
        print(f'[DELETE_S3] Error deleting {s3_key}: {e}')

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
            
            if action == 'documents':
                client_id = event.get('queryStringParameters', {}).get('clientId')
                if not client_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'clientId required'}),
                        'isBase64Encoded': False
                    }
                
                cur.execute('''
                    SELECT id, name, s3_key, upload_date
                    FROM client_documents
                    WHERE client_id = %s
                    ORDER BY upload_date DESC
                ''', (client_id,))
                documents = cur.fetchall()
                
                # Генерируем presigned URLs для каждого документа
                docs_with_urls = []
                for doc in documents:
                    presigned_url = generate_presigned_url(doc['s3_key'])
                    docs_with_urls.append({
                        'id': doc['id'],
                        'name': doc['name'],
                        'file_url': presigned_url,
                        'upload_date': str(doc['upload_date'])
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(docs_with_urls),
                    'isBase64Encoded': False
                }
            
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
                        SELECT id, name, s3_key, upload_date
                        FROM client_documents 
                        WHERE client_id = %s
                        ORDER BY upload_date DESC
                    ''', (client['id'],))
                    raw_documents = cur.fetchall()
                    
                    # Генерируем presigned URLs для документов
                    documents = []
                    for doc in raw_documents:
                        presigned_url = generate_presigned_url(doc['s3_key'])
                        documents.append({
                            'id': doc['id'],
                            'name': doc['name'],
                            'file_url': presigned_url,
                            'upload_date': doc['upload_date']
                        })
                    
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
            
            elif action == 'upload_document':
                client_id = body.get('clientId')
                filename = body.get('filename')
                file_base64 = body.get('file')
                
                if not client_id or not filename or not file_base64:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'clientId, filename, file required'}),
                        'isBase64Encoded': False
                    }
                
                # Проверяем, что клиент принадлежит пользователю
                cur.execute('SELECT id FROM clients WHERE id = %s AND user_id = %s', (client_id, user_id))
                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Access denied'}),
                        'isBase64Encoded': False
                    }
                
                # Декодируем и загружаем в S3
                file_content = base64.b64decode(file_base64)
                s3_key = upload_to_s3(file_content, filename)
                
                # Сохраняем в БД с S3 key
                cur.execute('''
                    INSERT INTO client_documents (client_id, name, s3_key, upload_date)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, client_id, name, s3_key, upload_date
                ''', (client_id, filename, s3_key, datetime.utcnow()))
                
                document = cur.fetchone()
                conn.commit()
                
                # Генерируем presigned URL для ответа
                presigned_url = generate_presigned_url(document['s3_key'])
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'id': document['id'],
                        'name': document['name'],
                        'file_url': presigned_url,
                        'upload_date': str(document['upload_date'])
                    }),
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
            
            # Обновляем проекты (upsert - вставляем новые или обновляем существующие)
            if 'projects' in body:
                # Получаем текущие ID проектов
                cur.execute('SELECT id FROM client_projects WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                incoming_ids = {p.get('id') for p in body.get('projects', []) if p.get('id')}
                
                # Удаляем проекты, которых нет в новом списке
                ids_to_delete = existing_ids - incoming_ids
                if ids_to_delete:
                    cur.execute('DELETE FROM client_projects WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Вставляем или обновляем проекты
                for project in body.get('projects', []):
                    cur.execute('''
                        INSERT INTO client_projects (id, client_id, name, status, budget, start_date, description)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            status = EXCLUDED.status,
                            budget = EXCLUDED.budget,
                            start_date = EXCLUDED.start_date,
                            description = EXCLUDED.description
                    ''', (
                        project.get('id'),
                        client_id,
                        project.get('name'),
                        project.get('status'),
                        project.get('budget'),
                        project.get('startDate'),
                        project.get('description')
                    ))
            
            # Обновляем платежи (upsert)
            if 'payments' in body:
                # Получаем текущие ID платежей
                cur.execute('SELECT id FROM client_payments WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                incoming_ids = {p.get('id') for p in body.get('payments', []) if p.get('id')}
                
                # Удаляем платежи, которых нет в новом списке
                ids_to_delete = existing_ids - incoming_ids
                if ids_to_delete:
                    cur.execute('DELETE FROM client_payments WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Вставляем или обновляем платежи
                for payment in body.get('payments', []):
                    cur.execute('''
                        INSERT INTO client_payments (id, client_id, amount, payment_date, status, method, description, project_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            amount = EXCLUDED.amount,
                            payment_date = EXCLUDED.payment_date,
                            status = EXCLUDED.status,
                            method = EXCLUDED.method,
                            description = EXCLUDED.description,
                            project_id = EXCLUDED.project_id
                    ''', (
                        payment.get('id'),
                        client_id,
                        payment.get('amount'),
                        payment.get('date'),
                        payment.get('status'),
                        payment.get('method'),
                        payment.get('description'),
                        payment.get('projectId')
                    ))
            
            # Обновляем комментарии (upsert)
            if 'comments' in body:
                # Получаем текущие ID комментариев
                cur.execute('SELECT id FROM client_comments WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                incoming_ids = {c.get('id') for c in body.get('comments', []) if c.get('id')}
                
                # Удаляем комментарии, которых нет в новом списке
                ids_to_delete = existing_ids - incoming_ids
                if ids_to_delete:
                    cur.execute('DELETE FROM client_comments WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Вставляем или обновляем комментарии
                for comment in body.get('comments', []):
                    cur.execute('''
                        INSERT INTO client_comments (id, client_id, author, text, comment_date)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            author = EXCLUDED.author,
                            text = EXCLUDED.text,
                            comment_date = EXCLUDED.comment_date
                    ''', (
                        comment.get('id'),
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
            
            if action == 'delete_document':
                document_id = params.get('documentId')
                print(f'[DELETE_DOCUMENT] document_id={document_id}, user_id={user_id}')
                
                if not document_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'documentId required'}),
                        'isBase64Encoded': False
                    }
                
                # Получаем S3 key и проверяем владельца
                cur.execute('''
                    SELECT cd.s3_key 
                    FROM client_documents cd
                    JOIN clients c ON cd.client_id = c.id
                    WHERE cd.id = %s AND c.user_id = %s
                ''', (document_id, user_id))
                
                doc = cur.fetchone()
                print(f'[DELETE_DOCUMENT] Found document: {doc}')
                
                if not doc:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Document not found', 'document_id': document_id, 'user_id': user_id}),
                        'isBase64Encoded': False
                    }
                
                # Удаляем из S3
                if doc['s3_key']:
                    delete_from_s3(doc['s3_key'])
                
                # Удаляем из БД
                cur.execute('DELETE FROM client_documents WHERE id = %s', (document_id,))
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
            
            # Получаем все документы клиента для удаления из S3
            cur.execute('SELECT s3_key FROM client_documents WHERE client_id = %s', (client_id,))
            documents = cur.fetchall()
            
            # Удаляем файлы из S3
            for doc in documents:
                if doc['s3_key']:
                    delete_from_s3(doc['s3_key'])
            
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