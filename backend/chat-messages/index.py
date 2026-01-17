import json
import os
import psycopg2
import boto3
import base64
import uuid
import re
from datetime import datetime

def handler(event: dict, context) -> dict:
    '''API для работы с сообщениями между клиентом и фотографом'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Client-Id'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        if method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            action = params.get('action', 'list')
            client_id = params.get('client_id')
            photographer_id = params.get('photographer_id')
            
            if not client_id or not photographer_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id and photographer_id required'}),
                    'isBase64Encoded': False
                }
            
            # Обработка action=mark_read
            if action == 'mark_read':
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.client_messages 
                    SET is_read = TRUE
                    WHERE client_id = %s AND photographer_id = %s AND sender_type = 'client'
                ''', (client_id, photographer_id))
                conn.commit()
                cur.close()
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            # Обработка action=mark_delivered
            if action == 'mark_delivered':
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.client_messages 
                    SET is_delivered = TRUE
                    WHERE client_id = %s AND photographer_id = %s
                ''', (client_id, photographer_id))
                conn.commit()
                cur.close()
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            # Обработка action=send (отправка через GET с параметрами)
            if action == 'send':
                message = params.get('message', '')
                sender_type = params.get('sender_type')
                
                if not sender_type or sender_type not in ['client', 'photographer']:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Invalid sender_type'}),
                        'isBase64Encoded': False
                    }
                
                if not message:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'message required'}),
                        'isBase64Encoded': False
                    }
                
                # Получаем имя клиента - сначала из clients, потом из favorite_clients
                cur.execute('''
                    SELECT name FROM t_p28211681_photo_secure_web.clients 
                    WHERE id = %s
                ''', (client_id,))
                client_row = cur.fetchone()
                
                if not client_row:
                    # Если не нашли в clients, ищем в favorite_clients
                    cur.execute('''
                        SELECT full_name FROM t_p28211681_photo_secure_web.favorite_clients 
                        WHERE id = %s
                    ''', (client_id,))
                    client_row = cur.fetchone()
                
                author_name = client_row[0] if client_row else 'Клиент'
                
                # Ищем упоминания номеров фото в сообщении (#123, фото 123, photo 123)
                photo_ids = re.findall(r'(?:#|фото\s*|photo\s*)(\d+)', message, re.IGNORECASE)
                photo_url = None
                
                if photo_ids:
                    photo_id = photo_ids[0]  # Берём первое упоминание
                    cur.execute('''
                        SELECT thumbnail_s3_url, s3_url 
                        FROM t_p28211681_photo_secure_web.photo_bank
                        WHERE id = %s AND photographer_id = %s
                    ''', (photo_id, photographer_id))
                    photo_row = cur.fetchone()
                    if photo_row:
                        photo_url = photo_row[0] if photo_row[0] else photo_row[1]
                
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.client_messages 
                    (client_id, photographer_id, content, sender_type, is_read, is_delivered, created_at, type, author, image_url)
                    VALUES (%s, %s, %s, %s, FALSE, FALSE, NOW(), 'chat', %s, %s)
                    RETURNING id, created_at
                ''', (client_id, photographer_id, message, sender_type, author_name, photo_url))
                
                result = cur.fetchone()
                message_id = result[0]
                created_at = result[1]
                conn.commit()
                cur.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'id': message_id, 'created_at': created_at.isoformat()}),
                    'isBase64Encoded': False
                }
            
            # action=list (по умолчанию) - список сообщений
            
            # Помечаем сообщения как доставленные при загрузке чата
            cur.execute('''
                UPDATE t_p28211681_photo_secure_web.client_messages 
                SET is_delivered = TRUE
                WHERE client_id = %s AND photographer_id = %s AND is_delivered = FALSE
            ''', (client_id, photographer_id))
            conn.commit()
            
            cur.execute('''
                SELECT id, client_id, photographer_id, content as message, 
                       sender_type, is_read, created_at, image_url, is_delivered
                FROM t_p28211681_photo_secure_web.client_messages
                WHERE client_id = %s AND photographer_id = %s
                ORDER BY created_at ASC
            ''', (client_id, photographer_id))
            
            messages = []
            for row in cur.fetchall():
                messages.append({
                    'id': row[0],
                    'client_id': row[1],
                    'photographer_id': row[2],
                    'message': row[3],
                    'sender_type': row[4],
                    'is_read': row[5],
                    'created_at': row[6].isoformat() if row[6] else None,
                    'image_url': row[7],
                    'is_delivered': row[8]
                })
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'messages': messages}),
                'isBase64Encoded': False
            }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            client_id = body.get('client_id')
            photographer_id = body.get('photographer_id')
            message = body.get('message', '')
            sender_type = body.get('sender_type')
            image_base64 = body.get('image_base64') or body.get('image')
            
            if not all([client_id, photographer_id, sender_type]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id, photographer_id and sender_type required'}),
                    'isBase64Encoded': False
                }
            
            if not message and not image_base64:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'message or image required'}),
                    'isBase64Encoded': False
                }
            
            if sender_type not in ['client', 'photographer']:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid sender_type'}),
                    'isBase64Encoded': False
                }
            
            # Получаем имя клиента - сначала из clients, потом из favorite_clients
            cur.execute('SELECT name FROM t_p28211681_photo_secure_web.clients WHERE id = %s', (client_id,))
            client_row = cur.fetchone()
            
            if not client_row:
                # Если не нашли в clients, ищем в favorite_clients
                cur.execute('SELECT full_name FROM t_p28211681_photo_secure_web.favorite_clients WHERE id = %s', (client_id,))
                client_row = cur.fetchone()
                
                if not client_row:
                    cur.close()
                    conn.close()
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Client not found'}),
                        'isBase64Encoded': False
                    }
            
            author_name = client_row[0] if client_row else 'Клиент'
            
            cur.execute('SELECT id FROM t_p28211681_photo_secure_web.users WHERE id = %s', (photographer_id,))
            if not cur.fetchone():
                cur.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Photographer not found'}),
                    'isBase64Encoded': False
                }
            
            # Загружаем изображение в S3 если есть
            image_url = None
            if image_base64:
                try:
                    s3 = boto3.client('s3',
                        endpoint_url='https://bucket.poehali.dev',
                        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
                    )
                    
                    # Убираем data:image/...;base64, если есть
                    if 'base64,' in image_base64:
                        image_base64 = image_base64.split('base64,')[1]
                    
                    image_data = base64.b64decode(image_base64)
                    file_name = f"chat/{photographer_id}/{uuid.uuid4()}.jpg"
                    
                    s3.put_object(
                        Bucket='files',
                        Key=file_name,
                        Body=image_data,
                        ContentType='image/jpeg'
                    )
                    
                    image_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{file_name}"
                except Exception as e:
                    print(f'Error uploading image: {str(e)}')
            
            # Ищем упоминания номеров фото в сообщении (#123, фото 123, photo 123)
            if not image_url and message:
                photo_ids = re.findall(r'(?:#|фото\s*|photo\s*)(\d+)', message, re.IGNORECASE)
                if photo_ids:
                    photo_id = photo_ids[0]  # Берём первое упоминание
                    cur.execute('''
                        SELECT thumbnail_s3_url, s3_url 
                        FROM t_p28211681_photo_secure_web.photo_bank
                        WHERE id = %s AND user_id = %s
                    ''', (photo_id, photographer_id))
                    photo_row = cur.fetchone()
                    if photo_row:
                        image_url = photo_row[0] if photo_row[0] else photo_row[1]
            
            cur.execute('''
                INSERT INTO t_p28211681_photo_secure_web.client_messages 
                (client_id, photographer_id, content, sender_type, is_read, is_delivered, created_at, type, author, image_url)
                VALUES (%s, %s, %s, %s, FALSE, FALSE, NOW(), 'chat', %s, %s)
                RETURNING id, created_at
            ''', (client_id, photographer_id, message, sender_type, author_name, image_url))
            
            result = cur.fetchone()
            message_id = result[0]
            created_at = result[1]
            
            # Отправляем email фотографу если сообщение от клиента
            if sender_type == 'client':
                try:
                    # Получаем данные фотографа
                    cur.execute('''
                        SELECT email, username 
                        FROM t_p28211681_photo_secure_web.users
                        WHERE id = %s
                    ''', (photographer_id,))
                    
                    photographer_data = cur.fetchone()
                    if photographer_data and photographer_data[0]:
                        photographer_email = photographer_data[0]
                        photographer_name = photographer_data[1] or 'Фотограф'
                        # Используем уже полученное имя клиента из author_name
                        client_name = author_name
                        
                        # Формируем текст для email
                        message_preview = message[:100] if message else '[Изображение]'
                        
                        # Импортируем shared_email
                        import sys
                        sys.path.insert(0, '/function/code/..')
                        from shared_email import send_email
                        
                        html_body = f'''
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Новое сообщение от {client_name}</h2>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">{message_preview}</p>
        </div>
        <p>Войдите в админ-панель чтобы ответить.</p>
    </div>
</body>
</html>
                        '''
                        
                        send_email(photographer_email, f'Новое сообщение от {client_name}', html_body, 'FotoMix Chat')
                except Exception as e:
                    print(f'Email notification error: {str(e)}')
            
            conn.commit()
            cur.close()
            conn.close()
            
            return {
                'statusCode': 201,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'id': message_id,
                    'created_at': created_at.isoformat() if created_at else None
                }),
                'isBase64Encoded': False
            }
        
        elif method == 'PUT':
            body = json.loads(event.get('body', '{}'))
            client_id = body.get('client_id')
            photographer_id = body.get('photographer_id')
            mark_as_read = body.get('mark_as_read', False)
            
            if not client_id or not photographer_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id and photographer_id required'}),
                    'isBase64Encoded': False
                }
            
            if mark_as_read:
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.client_messages 
                    SET is_read = TRUE
                    WHERE client_id = %s AND photographer_id = %s AND is_read = FALSE
                ''', (client_id, photographer_id))
                conn.commit()
            
            cur.close()
            conn.close()
            
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
        print(f'Error in messages handler: {str(e)}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }