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

# Database schema
DB_SCHEMA = 't_p28211681_photo_secure_web'

def get_s3_client():
    '''Возвращает S3 клиент'''
    from botocore.client import Config
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        region_name='ru-central1',
        aws_access_key_id=os.environ['YC_S3_KEY_ID'],
        aws_secret_access_key=os.environ['YC_S3_SECRET'],
        config=Config(signature_version='s3v4')
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

def build_meeting_datetime(date_value: Any, time_value: Any) -> Any:
    '''Возвращает объединённую дату-время встречи для синхронизации с таблицей meetings'''
    if not date_value or not time_value:
        return None
    
    if isinstance(date_value, datetime):
        date_part = date_value.date()
    else:
        raw_date = str(date_value).replace('Z', '').strip()
        date_part_str = raw_date.split('T')[0].split(' ')[0]
        try:
            date_part = datetime.strptime(date_part_str, '%Y-%m-%d').date()
        except ValueError:
            date_part = datetime.fromisoformat(date_part_str).date()
    
    time_str = str(time_value).strip()
    try:
        time_part = datetime.strptime(time_str, '%H:%M').time()
    except ValueError:
        try:
            time_part = datetime.strptime(time_str, '%H:%M:%S').time()
        except ValueError:
            time_part = datetime.fromisoformat(f'2000-01-01T{time_str}').time()
    
    return datetime.combine(date_part, time_part)

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
                    FROM t_p28211681_photo_secure_web.client_documents
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
                # Оптимизированный запрос: сначала получаем всех клиентов
                cur.execute('''
                    SELECT id, user_id, name, phone, email, address, vk_profile, created_at, updated_at
                    FROM t_p28211681_photo_secure_web.clients 
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                ''', (user_id,))
                clients = cur.fetchall()
                
                if not clients:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps([]),
                        'isBase64Encoded': False
                    }
                
                # Получаем ID всех клиентов для массовых запросов
                client_ids = tuple(c['id'] for c in clients)
                
                # Массовый запрос всех bookings
                cur.execute('''
                    SELECT client_id, id, booking_date, booking_time, description, notification_enabled, notification_time
                    FROM t_p28211681_photo_secure_web.bookings 
                    WHERE client_id = ANY(%s)
                    ORDER BY booking_date DESC
                ''', (list(client_ids),))
                all_bookings = cur.fetchall()
                bookings_by_client = {}
                for b in all_bookings:
                    cid = b['client_id']
                    if cid not in bookings_by_client:
                        bookings_by_client[cid] = []
                    bookings_by_client[cid].append(b)
                
                # Массовый запрос всех projects
                cur.execute('''
                    SELECT client_id, id, name, status, budget, start_date, end_date, description, shooting_style_id, shooting_time, shooting_duration, shooting_address, add_to_calendar
                    FROM t_p28211681_photo_secure_web.client_projects 
                    WHERE client_id = ANY(%s)
                    ORDER BY created_at DESC
                ''', (list(client_ids),))
                all_projects = cur.fetchall()
                projects_by_client = {}
                for p in all_projects:
                    cid = p['client_id']
                    if cid not in projects_by_client:
                        projects_by_client[cid] = []
                    projects_by_client[cid].append(p)
                
                # Массовый запрос всех payments
                cur.execute('''
                    SELECT client_id, id, amount, payment_date, status, method, description, project_id
                    FROM t_p28211681_photo_secure_web.client_payments 
                    WHERE client_id = ANY(%s)
                    ORDER BY payment_date DESC
                ''', (list(client_ids),))
                all_payments = cur.fetchall()
                payments_by_client = {}
                for p in all_payments:
                    cid = p['client_id']
                    if cid not in payments_by_client:
                        payments_by_client[cid] = []
                    payments_by_client[cid].append(p)
                
                # Массовый запрос всех messages
                cur.execute('''
                    SELECT client_id, id, type, author, content, message_date
                    FROM t_p28211681_photo_secure_web.client_messages 
                    WHERE client_id = ANY(%s)
                    ORDER BY message_date ASC
                ''', (list(client_ids),))
                all_messages = cur.fetchall()
                messages_by_client = {}
                for m in all_messages:
                    cid = m['client_id']
                    if cid not in messages_by_client:
                        messages_by_client[cid] = []
                    messages_by_client[cid].append(m)
                
                # Массовый запрос всех comments
                cur.execute('''
                    SELECT client_id, id, author, text, comment_date
                    FROM t_p28211681_photo_secure_web.client_comments 
                    WHERE client_id = ANY(%s)
                    ORDER BY comment_date DESC
                ''', (list(client_ids),))
                all_comments = cur.fetchall()
                comments_by_client = {}
                for c in all_comments:
                    cid = c['client_id']
                    if cid not in comments_by_client:
                        comments_by_client[cid] = []
                    comments_by_client[cid].append(c)
                
                # Массовый запрос всех documents
                cur.execute('''
                    SELECT client_id, id, name, s3_key, upload_date
                    FROM t_p28211681_photo_secure_web.client_documents 
                    WHERE client_id = ANY(%s)
                    ORDER BY upload_date DESC
                ''', (list(client_ids),))
                all_documents = cur.fetchall()
                documents_by_client = {}
                for d in all_documents:
                    cid = d['client_id']
                    if cid not in documents_by_client:
                        documents_by_client[cid] = []
                    documents_by_client[cid].append(d)
                
                # Собираем результат
                result = []
                for client in clients:
                    cid = client['id']
                    bookings = bookings_by_client.get(cid, [])
                    raw_projects = projects_by_client.get(cid, [])
                    raw_payments = payments_by_client.get(cid, [])
                    raw_messages = messages_by_client.get(cid, [])
                    raw_comments = comments_by_client.get(cid, [])
                    raw_documents = documents_by_client.get(cid, [])
                    
                    # Конвертируем projects
                    projects = [{
                        'id': p['id'],
                        'name': p['name'],
                        'status': p['status'],
                        'budget': float(p['budget']),
                        'startDate': str(p['start_date']),
                        'description': p['description'],
                        'shooting_style_id': p.get('shooting_style_id')
                    } for p in raw_projects]
                    
                    # Конвертируем payments
                    payments = [{
                        'id': p['id'],
                        'amount': float(p['amount']),
                        'date': str(p['payment_date']),
                        'status': p['status'],
                        'method': p['method'],
                        'description': p['description'],
                        'projectId': p['project_id']
                    } for p in raw_payments]
                    
                    # Конвертируем messages
                    messages = [{
                        'id': m['id'],
                        'type': m['type'],
                        'author': m['author'],
                        'content': m['content'],
                        'date': str(m['message_date']) if m['message_date'] else None
                    } for m in raw_messages]
                    
                    # Конвертируем comments
                    comments = [{
                        'id': c['id'],
                        'author': c['author'],
                        'text': c['text'],
                        'date': str(c['comment_date']) if c['comment_date'] else None
                    } for c in raw_comments]
                    
                    # Конвертируем documents (с presigned URLs)
                    documents = []
                    for d in raw_documents:
                        presigned_url = generate_presigned_url(d['s3_key']) if d['s3_key'] else ''
                        documents.append({
                            'id': d['id'],
                            'name': d['name'],
                            'file_url': presigned_url,
                            'upload_date': str(d['upload_date']) if d['upload_date'] else None
                        })
                    
                    result.append({
                        **dict(client),
                        'vkProfile': client['vk_profile'],
                        'created_at': str(client['created_at']) if client['created_at'] else None,
                        'updated_at': str(client['updated_at']) if client['updated_at'] else None,
                        'bookings': [
                            {
                                'id': b['id'],
                                'date': str(b['booking_date']),
                                'booking_date': str(b['booking_date']),
                                'time': b['booking_time'],
                                'description': b['description'],
                                'notificationEnabled': b['notification_enabled'],
                                'notificationTime': b['notification_time']
                            } for b in bookings
                        ],
                        'projects': projects,
                        'payments': payments,
                        'messages': messages,
                        'comments': comments,
                        'documents': documents
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
                    INSERT INTO t_p28211681_photo_secure_web.clients (user_id, name, phone, email, address, vk_profile)
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
                print(f'[ADD_BOOKING] Received booking request:')
                print(f'[ADD_BOOKING] clientId: {body.get("clientId")}')
                print(f'[ADD_BOOKING] date: {body.get("date")}')
                print(f'[ADD_BOOKING] time: {body.get("time")}')
                print(f'[ADD_BOOKING] description: {body.get("description")}')
                print(f'[ADD_BOOKING] notificationEnabled: {body.get("notificationEnabled")}')
                print(f'[ADD_BOOKING] notificationTime: {body.get("notificationTime")}')
                
                client_id = body.get('clientId')
                booking_date = body.get('date')
                booking_time = body.get('time')
                description = body.get('description')
                notification_enabled = body.get('notificationEnabled', True)
                notification_time = body.get('notificationTime', 24)
                
                # Получаем информацию о клиенте
                cur.execute('SELECT name, phone, email FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND user_id = %s', (client_id, user_id))
                client = cur.fetchone()
                
                if not client:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Client not found'}),
                        'isBase64Encoded': False
                    }
                
                # Создаём запись в таблице bookings
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.bookings (client_id, booking_date, booking_time, description, notification_enabled, notification_time)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, client_id, booking_date, booking_time, description, notification_enabled, notification_time
                ''', (
                    client_id,
                    booking_date,
                    booking_time,
                    description,
                    notification_enabled,
                    notification_time
                ))
                booking = cur.fetchone()
                
                # Комбинируем дату и время для встречи
                meeting_datetime = build_meeting_datetime(booking_date, booking_time)
                
                # Создаём встречу в таблице meetings для отображения в Dashboard
                if meeting_datetime:
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.meetings 
                        (creator_id, title, description, meeting_date, client_name, client_phone, client_email, notification_enabled, status)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        user_id,
                        'Встреча с клиентом',
                        description or 'Бронирование встречи',
                        meeting_datetime,
                        client['name'],
                        client['phone'],
                        client['email'],
                        notification_enabled,
                        'scheduled'
                    ))
                
                conn.commit()
                
                print(f'[ADD_BOOKING] Successfully created booking with id: {booking["id"]} and meeting')
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(dict(booking), default=str),
                    'isBase64Encoded': False
                }
            
            elif action == 'cleanup_test_clients':
                # Удаляем все тестовые клиенты из базы
                cur.execute('''
                    SELECT id FROM t_p28211681_photo_secure_web.clients 
                    WHERE name = 'Тестовый Клиент' OR name = 'Иванов Иван Иванович'
                ''')
                test_clients = cur.fetchall()
                
                deleted_count = 0
                for client in test_clients:
                    client_id = client['id']
                    
                    # Получаем все документы клиента для удаления из S3
                    cur.execute('SELECT s3_key FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
                    documents = cur.fetchall()
                    
                    # Удаляем файлы из S3
                    for doc in documents:
                        if doc['s3_key']:
                            delete_from_s3(doc['s3_key'])
                    
                    # Удаляем в правильном порядке (сначала зависимости, потом родителей)
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.bookings WHERE client_id = %s', (client_id,))
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.clients WHERE id = %s', (client_id,))
                    
                    deleted_count += 1
                
                conn.commit()
                print(f'[CLEANUP] Successfully deleted {deleted_count} test clients')
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True, 'deleted': deleted_count}),
                    'isBase64Encoded': False
                }
            
            elif action == 'delete':
                client_id = body.get('clientId')
                
                if not client_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'clientId required'}),
                        'isBase64Encoded': False
                    }
                
                # Проверяем, что клиент принадлежит пользователю
                cur.execute('SELECT id, name, phone FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND user_id = %s', (client_id, user_id))
                client_info = cur.fetchone()
                
                if not client_info:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Client not found'}),
                        'isBase64Encoded': False
                    }
                
                # Получаем все документы клиента для удаления из S3
                cur.execute('SELECT s3_key FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
                documents = cur.fetchall()
                
                # Удаляем файлы из S3
                for doc in documents:
                    if doc['s3_key']:
                        delete_from_s3(doc['s3_key'])
                
                # Удаляем в правильном порядке (сначала зависимости, потом родителей)
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.bookings WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.clients WHERE id = %s', (client_id,))
                
                # Удаляем все встречи этого клиента из таблицы meetings
                cur.execute('''
                    DELETE FROM t_p28211681_photo_secure_web.meetings 
                    WHERE creator_id = %s 
                    AND client_name = %s 
                    AND client_phone = %s
                ''', (user_id, client_info['name'], client_info['phone']))
                
                conn.commit()
                print(f'[DELETE_CLIENT] Successfully deleted client {client_id} and all related data')
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
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
                cur.execute('SELECT id FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND user_id = %s', (client_id, user_id))
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
                    INSERT INTO t_p28211681_photo_secure_web.client_documents (client_id, name, s3_key, upload_date)
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
                UPDATE t_p28211681_photo_secure_web.clients 
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
                cur.execute('SELECT id FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                incoming_ids = {p.get('id') for p in body.get('projects', []) if p.get('id')}
                
                # Удаляем проекты, которых нет в новом списке
                ids_to_delete = existing_ids - incoming_ids
                if ids_to_delete:
                    # Сначала удаляем все платежи этих проектов
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE project_id = ANY(%s)', (list(ids_to_delete),))
                    # Потом удаляем сами проекты
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Вставляем или обновляем проекты
                for project in body.get('projects', []):
                    start_date_str = project.get('startDate')
                    # Парсим дату из ISO строки или YYYY-MM-DD формата
                    if start_date_str:
                        try:
                            if 'T' in start_date_str:
                                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                            else:
                                start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
                        except (ValueError, AttributeError):
                            start_date = None
                    else:
                        start_date = None
                    
                    # Применяем дефолты для обязательных полей
                    project_name = project.get('name') or 'Услуга'
                    project_status = project.get('status') or 'new'
                    project_budget = project.get('budget') or 0
                    project_description = project.get('description') or ''
                    
                    # Парсим end_date если есть
                    end_date_str = project.get('endDate')
                    end_date = None
                    if end_date_str:
                        try:
                            if 'T' in end_date_str:
                                end_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00'))
                            else:
                                end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
                        except (ValueError, AttributeError):
                            end_date = None
                    
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.client_projects 
                        (id, client_id, name, status, budget, start_date, end_date, description, shooting_style_id, shooting_time, shooting_duration, shooting_address, add_to_calendar)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            status = EXCLUDED.status,
                            budget = EXCLUDED.budget,
                            start_date = EXCLUDED.start_date,
                            end_date = EXCLUDED.end_date,
                            description = EXCLUDED.description,
                            shooting_style_id = EXCLUDED.shooting_style_id,
                            shooting_time = EXCLUDED.shooting_time,
                            shooting_duration = EXCLUDED.shooting_duration,
                            shooting_address = EXCLUDED.shooting_address,
                            add_to_calendar = EXCLUDED.add_to_calendar
                    ''', (
                        project.get('id'),
                        client_id,
                        project_name,
                        project_status,
                        project_budget,
                        start_date,
                        end_date,
                        project_description,
                        project.get('shootingStyleId'),
                        project.get('shooting_time'),
                        project.get('shooting_duration'),
                        project.get('shooting_address'),
                        project.get('add_to_calendar')
                    ))
            
            # Обновляем платежи (upsert)
            if 'payments' in body:
                # Получаем текущие ID платежей
                cur.execute('SELECT id FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                incoming_ids = {p.get('id') for p in body.get('payments', []) if p.get('id')}
                
                # Удаляем платежи, которых нет в новом списке
                ids_to_delete = existing_ids - incoming_ids
                if ids_to_delete:
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Вставляем или обновляем платежи
                for payment in body.get('payments', []):
                    payment_date_str = payment.get('date')
                    # Парсим дату из ISO строки или YYYY-MM-DD формата
                    if payment_date_str:
                        try:
                            if 'T' in payment_date_str:
                                payment_date = datetime.fromisoformat(payment_date_str.replace('Z', '+00:00'))
                            else:
                                payment_date = datetime.strptime(payment_date_str, '%Y-%m-%d')
                        except (ValueError, AttributeError):
                            payment_date = datetime.now()
                    else:
                        payment_date = datetime.now()
                    
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.client_payments (id, client_id, amount, payment_date, status, method, description, project_id)
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
                        payment_date,
                        payment.get('status'),
                        payment.get('method'),
                        payment.get('description'),
                        payment.get('projectId')
                    ))
            
            # Обновляем комментарии (upsert)
            if 'comments' in body:
                # Получаем текущие ID комментариев
                cur.execute('SELECT id FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                incoming_ids = {c.get('id') for c in body.get('comments', []) if c.get('id')}
                
                # Удаляем комментарии, которых нет в новом списке
                ids_to_delete = existing_ids - incoming_ids
                if ids_to_delete:
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_comments WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Вставляем или обновляем комментарии
                for comment in body.get('comments', []):
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.client_comments (id, client_id, author, text, comment_date)
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
            
            # Обновляем сообщения (upsert)
            if 'messages' in body:
                # Получаем текущие ID сообщений
                cur.execute('SELECT id FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                incoming_ids = {m.get('id') for m in body.get('messages', []) if m.get('id') and m.get('id') < 1000000000000}
                
                # Удаляем сообщения, которых нет в новом списке
                ids_to_delete = existing_ids - incoming_ids
                if ids_to_delete:
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_messages WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Вставляем или обновляем сообщения
                for message in body.get('messages', []):
                    msg_id = message.get('id')
                    msg_type = message.get('type') or 'email'
                    msg_author = message.get('author') or 'Клиент'
                    msg_content = message.get('content', '')
                    msg_date = message.get('date') or datetime.utcnow().isoformat()
                    
                    is_new = msg_id and msg_id >= 1000000000000
                    
                    if is_new:
                        cur.execute('''
                            INSERT INTO t_p28211681_photo_secure_web.client_messages (client_id, type, author, content, message_date)
                            VALUES (%s, %s, %s, %s, %s)
                        ''', (client_id, msg_type, msg_author, msg_content, msg_date))
                    else:
                        cur.execute('''
                            INSERT INTO t_p28211681_photo_secure_web.client_messages (id, client_id, type, author, content, message_date)
                            VALUES (%s, %s, %s, %s, %s, %s)
                            ON CONFLICT (id) DO UPDATE SET
                                type = EXCLUDED.type,
                                author = EXCLUDED.author,
                                content = EXCLUDED.content,
                                message_date = EXCLUDED.message_date
                        ''', (msg_id, client_id, msg_type, msg_author, msg_content, msg_date))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(dict(client), default=str),
                'isBase64Encoded': False
            }
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            client_id = body.get('id')
            
            if not client_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id required'}),
                    'isBase64Encoded': False
                }
            
            # Обновляем данные клиента
            cur.execute('''
                UPDATE t_p28211681_photo_secure_web.clients
                SET 
                    name = %s,
                    phone = %s,
                    email = %s,
                    address = %s,
                    vk_profile = %s,
                    shooting_date = %s,
                    shooting_time = %s,
                    shooting_duration = %s,
                    shooting_address = %s,
                    project_price = %s,
                    project_comments = %s,
                    google_event_id = %s,
                    synced_at = %s,
                    updated_at = NOW()
                WHERE id = %s AND user_id = %s
                RETURNING id
            ''', (
                body.get('name'),
                body.get('phone'),
                body.get('email', ''),
                body.get('address', ''),
                body.get('vkProfile', ''),
                body.get('shooting_date'),
                body.get('shooting_time'),
                body.get('shooting_duration'),
                body.get('shooting_address'),
                body.get('project_price'),
                body.get('project_comments'),
                body.get('google_event_id'),
                body.get('synced_at'),
                client_id,
                user_id
            ))
            
            result = cur.fetchone()
            
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Client not found'}),
                    'isBase64Encoded': False
                }
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True}),
                'isBase64Encoded': False
            }
        
        elif method == 'DELETE':
            params = event.get('queryStringParameters', {})
            action = params.get('action')
            
            if action == 'delete_booking':
                booking_id = params.get('bookingId')
                
                # Получаем информацию о бронировании перед удалением
                cur.execute('''
                    SELECT b.booking_date, b.booking_time, c.name, c.phone
                    FROM t_p28211681_photo_secure_web.bookings b
                    JOIN t_p28211681_photo_secure_web.clients c ON b.client_id = c.id
                    WHERE b.id = %s
                ''', (booking_id,))
                
                booking_info = cur.fetchone()
                
                # Удаляем бронирование
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.bookings WHERE id = %s', (booking_id,))
                
                # Если нашли бронирование, удаляем соответствующую встречу из meetings
                if booking_info:
                    meeting_datetime = build_meeting_datetime(booking_info['booking_date'], booking_info['booking_time'])
                    
                    # Удаляем встречу по параметрам (дата, имя клиента, телефон)
                    if meeting_datetime:
                        cur.execute('''
                            DELETE FROM t_p28211681_photo_secure_web.meetings 
                            WHERE creator_id = %s 
                            AND meeting_date = %s 
                            AND client_name = %s
                            AND client_phone = %s
                        ''', (user_id, meeting_datetime, booking_info['name'], booking_info['phone']))
                        print(f'[DELETE_BOOKING] Deleted booking {booking_id} and corresponding meeting')
                
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
                    FROM t_p28211681_photo_secure_web.client_documents cd
                    JOIN t_p28211681_photo_secure_web.clients c ON cd.client_id = c.id
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
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_documents WHERE id = %s', (document_id,))
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            client_id = params.get('clientId')
            
            cur.execute('''
                SELECT id FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND user_id = %s
            ''', (client_id, user_id))
            
            if not cur.fetchone():
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Client not found'}),
                    'isBase64Encoded': False
                }
            
            # Получаем все документы клиента для удаления из S3
            cur.execute('SELECT s3_key FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
            documents = cur.fetchall()
            
            # Удаляем файлы из S3
            for doc in documents:
                if doc['s3_key']:
                    delete_from_s3(doc['s3_key'])
            
            # Получаем информацию о клиенте для удаления встреч
            cur.execute('SELECT name, phone FROM t_p28211681_photo_secure_web.clients WHERE id = %s', (client_id,))
            client_info = cur.fetchone()
            
            # Удаляем в правильном порядке (сначала зависимости, потом родителей)
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.bookings WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))  # Сначала платежи
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))  # Потом проекты
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.clients WHERE id = %s', (client_id,))
            
            # Удаляем все встречи этого клиента из таблицы meetings
            if client_info:
                cur.execute('''
                    DELETE FROM t_p28211681_photo_secure_web.meetings 
                    WHERE creator_id = %s 
                    AND client_name = %s 
                    AND client_phone = %s
                ''', (user_id, client_info['name'], client_info['phone']))
                print(f'[DELETE_CLIENT] Deleted client {client_id} and all related meetings')
            
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