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
            images_base64 = body.get('images_base64', [])
            print(f'[POST] Received: client_id={client_id}, photographer_id={photographer_id}, sender_type={sender_type}, message_len={len(message)}')
            
            if not all([client_id, photographer_id, sender_type]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id, photographer_id and sender_type required'}),
                    'isBase64Encoded': False
                }
            
            if not message and not images_base64:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'message or images required'}),
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
            
            # Загружаем изображения в S3 если есть
            image_urls = []
            if images_base64:
                print(f'[CHAT] Uploading {len(images_base64)} images')
                try:
                    s3 = boto3.client('s3',
                        endpoint_url='https://bucket.poehali.dev',
                        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
                    )
                    
                    for idx, img_base64 in enumerate(images_base64):
                        # Убираем data:image/...;base64, если есть
                        if 'base64,' in img_base64:
                            img_base64 = img_base64.split('base64,')[1]
                        
                        print(f'[CHAT] Image {idx+1}: base64 length = {len(img_base64)}')
                        image_data = base64.b64decode(img_base64)
                        print(f'[CHAT] Image {idx+1}: decoded size = {len(image_data)} bytes')
                        
                        file_name = f"chat/{photographer_id}/{uuid.uuid4()}.jpg"
                        
                        s3.put_object(
                            Bucket='files',
                            Key=file_name,
                            Body=image_data,
                            ContentType='image/jpeg'
                        )
                        
                        image_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{file_name}"
                        image_urls.append(image_url)
                        print(f'[CHAT] Image {idx+1}: uploaded to {image_url}')
                except Exception as e:
                    print(f'[CHAT] Error uploading images: {str(e)}')
            
            # Ищем упоминания номеров фото в сообщении (#123, фото 123, photo 123)
            if not image_urls and message:
                photo_ids = re.findall(r'(?:#|фото\s*|photo\s*)(\d+)', message, re.IGNORECASE)
                if photo_ids:
                    photo_id = photo_ids[0]
                    cur.execute('''
                        SELECT thumbnail_s3_url, s3_url 
                        FROM t_p28211681_photo_secure_web.photo_bank
                        WHERE id = %s AND user_id = %s
                    ''', (photo_id, photographer_id))
                    photo_row = cur.fetchone()
                    if photo_row:
                        photo_url = photo_row[0] if photo_row[0] else photo_row[1]
                        image_urls.append(photo_url)
            
            # Создаём сообщения: одно с текстом (если есть) и по одному на каждое изображение
            message_ids = []
            created_timestamps = []
            
            if message or not image_urls:
                # Основное текстовое сообщение (или пустое если только текст без изображений)
                first_image = image_urls[0] if image_urls else None
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.client_messages 
                    (client_id, photographer_id, content, sender_type, is_read, is_delivered, created_at, type, author, image_url)
                    VALUES (%s, %s, %s, %s, FALSE, FALSE, NOW(), 'chat', %s, %s)
                    RETURNING id, created_at
                ''', (client_id, photographer_id, message, sender_type, author_name, first_image))
                result = cur.fetchone()
                message_ids.append(result[0])
                created_timestamps.append(result[1])
                
                # Остальные изображения как отдельные сообщения
                for img_url in image_urls[1:]:
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.client_messages 
                        (client_id, photographer_id, content, sender_type, is_read, is_delivered, created_at, type, author, image_url)
                        VALUES (%s, %s, %s, %s, FALSE, FALSE, NOW(), 'chat', %s, %s)
                        RETURNING id, created_at
                    ''', (client_id, photographer_id, '', sender_type, author_name, img_url))
                    result = cur.fetchone()
                    message_ids.append(result[0])
                    created_timestamps.append(result[1])
            
            message_id = message_ids[0] if message_ids else None
            created_at = created_timestamps[0] if created_timestamps else None
            
            # Отправляем уведомления фотографу если сообщение от клиента
            if sender_type == 'client':
                print(f'[NOTIFICATION] Client message detected, sender_type={sender_type}')
                try:
                    # Получаем данные фотографа и название папки проекта
                    cur.execute('''
                        SELECT u.email, u.username, u.phone
                        FROM t_p28211681_photo_secure_web.users u
                        WHERE u.id = %s
                    ''', (photographer_id,))
                    
                    photographer_data = cur.fetchone()
                    print(f'[NOTIFICATION] Photographer data: {photographer_data}')
                    if photographer_data:
                        photographer_email = photographer_data[0]
                        photographer_name = photographer_data[1] or 'Фотограф'
                        photographer_phone = photographer_data[2]
                        client_name = author_name
                        
                        # Находим название папки проекта через которую клиент связался
                        folder_name = 'Проект'
                        try:
                            # Ищем папку по client_id (если клиент добавлен через интеграцию)
                            cur.execute('''
                                SELECT f.folder_name
                                FROM t_p28211681_photo_secure_web.photobank_folders f
                                WHERE f.user_id = %s AND f.client_id = %s
                                LIMIT 1
                            ''', (photographer_id, client_id))
                            folder_row = cur.fetchone()
                            if folder_row:
                                folder_name = folder_row[0]
                            else:
                                # Если не нашли по client_id, берём последнюю папку фотографа
                                cur.execute('''
                                    SELECT folder_name
                                    FROM t_p28211681_photo_secure_web.photobank_folders
                                    WHERE user_id = %s
                                    ORDER BY created_at DESC
                                    LIMIT 1
                                ''', (photographer_id,))
                                folder_row = cur.fetchone()
                                if folder_row:
                                    folder_name = folder_row[0]
                        except Exception as e:
                            print(f'[CHAT] Error finding folder name: {str(e)}')
                        
                        # Формируем текст для уведомлений
                        if message:
                            message_preview = message[:150] + ('...' if len(message) > 150 else '')
                        elif len(image_urls) > 1:
                            message_preview = f'Отправил(а) {len(image_urls)} изображений'
                        else:
                            message_preview = 'Отправил(а) изображение'
                        
                        # Email уведомление
                        if photographer_email:
                            print(f'[NOTIFICATION] Sending email to {photographer_email}')
                            import sys
                            sys.path.insert(0, '/function/code/..')
                            from shared_email import send_email
                            
                            html_body = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">📬 Новое сообщение</h1>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">От клиента</p>
                <p style="margin: 0; color: #111827; font-size: 20px; font-weight: 600;">{client_name}</p>
            </div>
            
            <div style="margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Проект</p>
                <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 500;">{folder_name}</p>
            </div>
            
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Сообщение</p>
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">{message_preview}</p>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <a href="https://foto-mix.ru" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                    Открыть Foto-Mix
                </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #9ca3af; font-size: 13px; text-align: center;">
                    Войдите в свой аккаунт на foto-mix.ru, чтобы ответить клиенту
                </p>
            </div>
        </div>
    </div>
</body>
</html>
                            '''
                            
                            send_email(photographer_email, f'💬 Сообщение от {client_name} | {folder_name}', html_body, 'Foto-Mix')
                            print(f'[NOTIFICATION] Email sent successfully')
                        
                        # WhatsApp уведомление через МаКС
                        if photographer_phone:
                            print(f'[NOTIFICATION] Sending WhatsApp to {photographer_phone}')
                            try:
                                whatsapp_text = f'''📬 *Новое сообщение в Foto-Mix*

👤 *От клиента:* {client_name}
📁 *Проект:* {folder_name}

💬 *Сообщение:*
{message_preview}

Войдите на foto-mix.ru чтобы ответить'''
                                
                                # Отправляем через WhatsApp API (МаКС)
                                import requests
                                whatsapp_api_url = 'https://functions.poehali.dev/0a053c97-18f2-42c4-95e3-8f02894ee0c1'
                                whatsapp_response = requests.post(whatsapp_api_url, json={
                                    'phone': photographer_phone,
                                    'message': whatsapp_text
                                }, timeout=10)
                                
                                if whatsapp_response.status_code == 200:
                                    print(f'[CHAT] WhatsApp notification sent to {photographer_phone}')
                                else:
                                    print(f'[CHAT] WhatsApp notification failed: {whatsapp_response.status_code}')
                            except Exception as e:
                                print(f'[CHAT] WhatsApp notification error: {str(e)}')
                        
                except Exception as e:
                    print(f'[CHAT] Notification error: {str(e)}')
            
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