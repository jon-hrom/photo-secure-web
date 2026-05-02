import json
import os
import psycopg2
import boto3
import base64
import uuid
import re
from datetime import datetime, timedelta

def handler(event: dict, context) -> dict:
    '''API для работы с сообщениями между клиентом и фотографом. Включает отправку уведомлений на email и WhatsApp.'''
    method = event.get('httpMethod', 'GET')
    print(f'[CHAT_HANDLER] ===== NEW REQUEST =====', flush=True)
    print(f'[CHAT_HANDLER] Method={method}', flush=True)
    print(f'[CHAT_HANDLER] Body length={len(event.get("body", ""))} bytes', flush=True)
    print(f'[CHAT_HANDLER] Query params={event.get("queryStringParameters")}', flush=True)
    
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
            
            # action=get_upload_url - получить presigned URL для загрузки файла
            if action == 'get_upload_url':
                if not photographer_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'photographer_id required'}),
                        'isBase64Encoded': False
                    }
                
                file_name = params.get('file_name', f'{uuid.uuid4()}.jpg')
                content_type = params.get('content_type', 'image/jpeg')
                
                from botocore.client import Config as BotoConfig
                s3 = boto3.client('s3',
                    endpoint_url='https://storage.yandexcloud.net',
                    region_name='ru-central1',
                    aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
                    aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
                    config=BotoConfig(signature_version='s3v4')
                )
                chat_bucket = 'foto-mix'
                
                s3_key = f"chat/{photographer_id}/{uuid.uuid4()}_{file_name}"
                
                # ВАЖНО: НЕ включаем ACL в подпись — иначе фронт обязан
                # слать заголовок x-amz-acl, который бакет должен явно
                # разрешить в CORS. Чтобы избежать CORS-преград, оставляем
                # только Content-Type. Доступ public-read настроен на
                # самом бакете (bucket policy).
                presigned_url = s3.generate_presigned_url(
                    'put_object',
                    Params={
                        'Bucket': chat_bucket,
                        'Key': s3_key,
                        'ContentType': content_type,
                    },
                    ExpiresIn=300
                )
                
                cdn_url = f"https://storage.yandexcloud.net/{chat_bucket}/{s3_key}"
                
                cur.close()
                conn.close()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'upload_url': presigned_url,
                        'cdn_url': cdn_url,
                        's3_key': s3_key
                    }),
                    'isBase64Encoded': False
                }
            
            if not client_id or not photographer_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id and photographer_id required'}),
                    'isBase64Encoded': False
                }
            
            # Обработка action=mark_read
            if action == 'mark_read':
                sender_param = params.get('sender_type')
                
                # Если указан sender_type, помечаем как прочитанные только сообщения от этого типа отправителя
                if sender_param and sender_param in ['client', 'photographer']:
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.client_messages 
                        SET is_read = TRUE
                        WHERE client_id = %s AND photographer_id = %s AND sender_type = %s AND is_read = FALSE
                    ''', (client_id, photographer_id, sender_param))
                else:
                    # По умолчанию помечаем сообщения от клиента (старая логика)
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.client_messages 
                        SET is_read = TRUE
                        WHERE client_id = %s AND photographer_id = %s AND sender_type = 'client' AND is_read = FALSE
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
            
            # Обработка action=typing - обновление статуса печати
            if action == 'typing':
                sender_type = params.get('sender_type')
                is_typing = params.get('is_typing', 'false').lower() == 'true'
                
                if not sender_type or sender_type not in ['client', 'photographer']:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Invalid sender_type'}),
                        'isBase64Encoded': False
                    }
                
                # Upsert статуса печати
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.typing_status 
                    (client_id, photographer_id, sender_type, is_typing, updated_at)
                    VALUES (%s, %s, %s, %s, NOW())
                    ON CONFLICT (client_id, photographer_id, sender_type)
                    DO UPDATE SET is_typing = EXCLUDED.is_typing, updated_at = NOW()
                ''', (client_id, photographer_id, sender_type, is_typing))
                conn.commit()
                cur.close()
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            # Обработка action=check_typing - проверка статуса печати собеседника
            if action == 'check_typing':
                sender_type = params.get('sender_type')
                if not sender_type or sender_type not in ['client', 'photographer']:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Invalid sender_type'}),
                        'isBase64Encoded': False
                    }
                
                # Проверяем статус печати противоположной стороны
                opposite_type = 'photographer' if sender_type == 'client' else 'client'
                cur.execute('''
                    SELECT is_typing, updated_at 
                    FROM t_p28211681_photo_secure_web.typing_status
                    WHERE client_id = %s AND photographer_id = %s AND sender_type = %s
                    AND updated_at > NOW() - INTERVAL '10 seconds'
                ''', (client_id, photographer_id, opposite_type))
                
                row = cur.fetchone()
                is_typing = row[0] if row else False
                
                cur.close()
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'is_typing': is_typing}),
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
            
            # action=edit_message - редактирование текста сообщения
            if action == 'edit_message':
                message_id = params.get('message_id')
                new_text = params.get('new_text', '').strip()
                viewer_type = params.get('viewer_type') or params.get('sender_type')
                if not message_id or not new_text:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'message_id and new_text required'}),
                        'isBase64Encoded': False
                    }
                cur.execute('''
                    SELECT sender_type, client_id, photographer_id FROM t_p28211681_photo_secure_web.client_messages
                    WHERE id = %s
                ''', (message_id,))
                row = cur.fetchone()
                if not row:
                    cur.close(); conn.close()
                    return {'statusCode': 404, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'not found'}), 'isBase64Encoded': False}
                if str(row[1]) != str(client_id) or str(row[2]) != str(photographer_id):
                    cur.close(); conn.close()
                    return {'statusCode': 403, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'forbidden'}), 'isBase64Encoded': False}
                if viewer_type and row[0] != viewer_type:
                    cur.close(); conn.close()
                    return {'statusCode': 403, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'can edit only own messages'}), 'isBase64Encoded': False}
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.client_messages
                    SET content = %s, is_edited = TRUE, edited_at = NOW()
                    WHERE id = %s
                ''', (new_text, message_id))
                conn.commit()
                cur.close(); conn.close()
                return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'success': True}), 'isBase64Encoded': False}

            # action=remove_for_me - скрыть сообщение только у себя
            if action == 'remove_for_me':
                message_id = params.get('message_id')
                message_ids_param = params.get('message_ids')
                viewer_type = params.get('viewer_type') or params.get('sender_type')
                if viewer_type not in ('client', 'photographer'):
                    return {'statusCode': 400, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'viewer_type required'}), 'isBase64Encoded': False}
                ids_list = []
                if message_ids_param:
                    ids_list = [int(x) for x in message_ids_param.split(',') if x.strip().isdigit()]
                elif message_id:
                    ids_list = [int(message_id)]
                if not ids_list:
                    return {'statusCode': 400, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'message_id required'}), 'isBase64Encoded': False}
                col = 'hidden_for_client' if viewer_type == 'client' else 'hidden_for_photographer'
                ids_csv = ','.join(str(i) for i in ids_list)
                cur.execute(f'''
                    UPDATE t_p28211681_photo_secure_web.client_messages
                    SET {col} = TRUE
                    WHERE id IN ({ids_csv}) AND client_id = %s AND photographer_id = %s
                ''', (client_id, photographer_id))
                conn.commit()
                cur.close(); conn.close()
                return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'success': True}), 'isBase64Encoded': False}

            # action=remove_for_all - удалить сообщение у всех (только автор)
            if action == 'remove_for_all':
                message_id = params.get('message_id')
                message_ids_param = params.get('message_ids')
                viewer_type = params.get('viewer_type') or params.get('sender_type')
                if viewer_type not in ('client', 'photographer'):
                    return {'statusCode': 400, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'viewer_type required'}), 'isBase64Encoded': False}
                ids_list = []
                if message_ids_param:
                    ids_list = [int(x) for x in message_ids_param.split(',') if x.strip().isdigit()]
                elif message_id:
                    ids_list = [int(message_id)]
                if not ids_list:
                    return {'statusCode': 400, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'error': 'message_id required'}), 'isBase64Encoded': False}
                ids_csv = ','.join(str(i) for i in ids_list)
                cur.execute(f'''
                    UPDATE t_p28211681_photo_secure_web.client_messages
                    SET removed_for_all = TRUE, removed_at = NOW()
                    WHERE id IN ({ids_csv}) AND client_id = %s AND photographer_id = %s AND sender_type = %s
                ''', (client_id, photographer_id, viewer_type))
                conn.commit()
                cur.close(); conn.close()
                return {'statusCode': 200, 'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}, 'body': json.dumps({'success': True}), 'isBase64Encoded': False}

            # action=list (по умолчанию) - список сообщений
            
            viewer_type = params.get('viewer_type') or params.get('sender_type') or 'client'
            
            # Помечаем сообщения как доставленные при загрузке чата
            cur.execute('''
                UPDATE t_p28211681_photo_secure_web.client_messages 
                SET is_delivered = TRUE
                WHERE client_id = %s AND photographer_id = %s AND is_delivered = FALSE
            ''', (client_id, photographer_id))
            conn.commit()
            
            # Фильтр скрытия для текущего зрителя
            hidden_col = 'hidden_for_client' if viewer_type == 'client' else 'hidden_for_photographer'
            cur.execute(f'''
                SELECT m.id, m.client_id, m.photographer_id, m.content as message, 
                       m.sender_type, m.is_read, m.created_at, m.image_url, m.is_delivered, m.video_url,
                       m.is_edited, m.edited_at, m.reply_to_id, m.removed_for_all,
                       r.content, r.sender_type, r.image_url, r.video_url
                FROM t_p28211681_photo_secure_web.client_messages m
                LEFT JOIN t_p28211681_photo_secure_web.client_messages r ON r.id = m.reply_to_id
                WHERE m.client_id = %s AND m.photographer_id = %s AND m.{hidden_col} = FALSE
                ORDER BY m.created_at ASC
            ''', (client_id, photographer_id))
            
            messages = []
            for row in cur.fetchall():
                removed = row[13]
                reply_payload = None
                if row[12] is not None:
                    reply_text = row[14] or ''
                    reply_sender = row[15]
                    reply_img = row[16]
                    reply_vid = row[17]
                    reply_payload = {
                        'id': row[12],
                        'message': '' if not reply_text else (reply_text[:120] + ('…' if len(reply_text) > 120 else '')),
                        'sender_type': reply_sender,
                        'image_url': reply_img,
                        'video_url': reply_vid,
                    }
                messages.append({
                    'id': row[0],
                    'client_id': row[1],
                    'photographer_id': row[2],
                    'message': '' if removed else row[3],
                    'sender_type': row[4],
                    'is_read': row[5],
                    'created_at': row[6].isoformat() if row[6] else None,
                    'image_url': None if removed else row[7],
                    'is_delivered': row[8],
                    'video_url': None if removed else row[9],
                    'is_edited': bool(row[10]) and not removed,
                    'edited_at': row[11].isoformat() if row[11] else None,
                    'reply_to_id': row[12],
                    'reply_to': None if removed else reply_payload,
                    'removed_for_all': bool(removed),
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
            raw_body = event.get('body', '{}')
            if not raw_body or raw_body.strip() == '':
                raw_body = '{}'
            body = json.loads(raw_body)
            client_id = body.get('client_id')
            photographer_id = body.get('photographer_id')
            message = body.get('message', '')
            sender_type = body.get('sender_type')
            images_base64 = body.get('images_base64', [])
            file_names = body.get('file_names', [])
            image_urls = body.get('image_urls', [])  # Новый формат: готовые CDN URLs
            reply_to_id = body.get('reply_to_id')
            try:
                reply_to_id = int(reply_to_id) if reply_to_id else None
            except (TypeError, ValueError):
                reply_to_id = None
            print(f'[POST] Received: client_id={client_id}, photographer_id={photographer_id}, sender_type={sender_type}, message_len={len(message)}, images_base64={len(images_base64)}, image_urls={len(image_urls)}, file_names={file_names}', flush=True)
            
            if not all([client_id, photographer_id, sender_type]):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'client_id, photographer_id and sender_type required'}),
                    'isBase64Encoded': False
                }
            
            if not message and not images_base64 and not image_urls:
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
            
            # Загружаем изображения в S3 если есть или ищем миниатюры в фотобанке
            final_image_urls = []
            
            # Если пришли готовые URL (новый формат) — используем их
            if image_urls:
                print(f'[CHAT] Using pre-uploaded image URLs: {image_urls}', flush=True)
                final_image_urls = image_urls
            elif images_base64:
                print(f'[CHAT] Processing {len(images_base64)} images')
                try:
                    from botocore.client import Config as BotoConfig
                    s3 = boto3.client('s3',
                        endpoint_url='https://storage.yandexcloud.net',
                        region_name='ru-central1',
                        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
                        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
                        config=BotoConfig(signature_version='s3v4')
                    )
                    chat_bucket = 'foto-mix'
                    
                    for idx, img_base64 in enumerate(images_base64):
                        original_file_name = file_names[idx] if idx < len(file_names) else None
                        print(f'[CHAT] Image {idx+1}: original_file_name={original_file_name}')
                        
                        # Проверяем, есть ли фото с таким именем в фотобанке.
                        # Автоподмена работает ТОЛЬКО для медиа-расширений (фото/видео).
                        # Иначе любой документ.jpg-однофамилец из фотобанка подменит вложение.
                        thumbnail_url = None
                        is_media_ext = bool(original_file_name and re.search(
                            r'\.(cr2|nef|arw|dng|raw|jpg|jpeg|png|heic|heif|webp|mp4|mov|avi|mkv|webm)$',
                            original_file_name, flags=re.IGNORECASE
                        ))
                        if original_file_name and is_media_ext:
                            # Убираем расширение и получаем базовое имя (поддерживаем фото и видео)
                            base_name = re.sub(r'\.(cr2|nef|arw|dng|raw|jpg|jpeg|png|heic|heif|webp|mp4|mov|avi|mkv|webm)$', '', original_file_name, flags=re.IGNORECASE)
                            print(f'[CHAT] Searching for thumbnail with base name: {base_name}')
                            
                            # Ищем фото по имени файла (without extension)
                            cur.execute('''
                                SELECT thumbnail_s3_url, s3_url, file_name, is_video, content_type
                                FROM t_p28211681_photo_secure_web.photo_bank
                                WHERE user_id = %s 
                                  AND (file_name ILIKE %s OR file_name ILIKE %s OR file_name ILIKE %s)
                                  AND is_trashed = FALSE
                                ORDER BY created_at DESC
                                LIMIT 1
                            ''', (photographer_id, f'{base_name}.%', f'%/{base_name}.%', f'{base_name}'))
                            
                            photo_row = cur.fetchone()
                            if photo_row:
                                is_video = photo_row[3] if len(photo_row) > 3 else False
                                content_type = photo_row[4] if len(photo_row) > 4 else None
                                
                                if is_video:
                                    # Для видео: thumbnail как image_url, s3_url как video_url
                                    video_url = photo_row[1]  # s3_url
                                    thumbnail_url = photo_row[0]  # thumbnail_s3_url
                                    image_urls.append({'image_url': thumbnail_url, 'video_url': video_url})
                                    print(f'[CHAT] Found VIDEO in photobank: file={photo_row[2]}, video_url={video_url}, thumbnail={thumbnail_url}', flush=True)
                                else:
                                    thumbnail_url = photo_row[0] if photo_row[0] else photo_row[1]
                                    print(f'[CHAT] Found thumbnail in photobank: file={photo_row[2]}, thumbnail_url={thumbnail_url}', flush=True)
                            else:
                                print(f'[CHAT] No thumbnail found for base_name={base_name}', flush=True)
                        
                        # Если нашли миниатюру или видео, используем её
                        if thumbnail_url:
                            if isinstance(thumbnail_url, dict):
                                final_image_urls.append(thumbnail_url)  # Словарь с video_url
                            else:
                                final_image_urls.append(thumbnail_url)  # Обычный URL
                            print(f'[CHAT] Image {idx+1}: using photobank thumbnail')
                        else:
                            if 'base64,' in img_base64:
                                header_part = img_base64.split('base64,')[0]
                                img_base64 = img_base64.split('base64,')[1]
                            else:
                                header_part = ''
                            
                            image_data = base64.b64decode(img_base64)
                            
                            ct = 'image/jpeg'
                            ext = '.jpg'
                            if 'image/png' in header_part:
                                ct = 'image/png'
                                ext = '.png'
                            elif 'image/webp' in header_part:
                                ct = 'image/webp'
                                ext = '.webp'
                            elif 'image/gif' in header_part:
                                ct = 'image/gif'
                                ext = '.gif'
                            elif 'image/heic' in header_part or 'image/heif' in header_part:
                                ct = 'image/heic'
                                ext = '.heic'
                            elif original_file_name:
                                lower_name = original_file_name.lower()
                                if lower_name.endswith('.png'):
                                    ct = 'image/png'
                                    ext = '.png'
                                elif lower_name.endswith('.webp'):
                                    ct = 'image/webp'
                                    ext = '.webp'
                            
                            s3_file_key = f"chat/{photographer_id}/{uuid.uuid4()}{ext}"
                            
                            s3.put_object(
                                Bucket=chat_bucket,
                                Key=s3_file_key,
                                Body=image_data,
                                ContentType=ct,
                                ACL='public-read'
                            )
                            
                            image_url = f"https://storage.yandexcloud.net/{chat_bucket}/{s3_file_key}"
                            final_image_urls.append(image_url)
                            print(f'[CHAT] Image {idx+1}: uploaded to S3: {image_url}')
                except Exception as e:
                    print(f'[CHAT] Error processing images: {str(e)}')
            
            # Ищем упоминания номеров фото в сообщении (#123, фото 123, photo 123)
            if not final_image_urls and message:
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
                        final_image_urls.append(photo_url)
            
            # Создаём сообщения: одно с текстом (если есть) и по одному на каждое изображение
            message_ids = []
            created_timestamps = []
            
            if message or not final_image_urls:
                # Основное текстовое сообщение (или пустое если только текст без изображений)
                first_media = final_image_urls[0] if final_image_urls else None
                first_image = first_media if first_media and not isinstance(first_media, dict) else (first_media.get('image_url') if isinstance(first_media, dict) else None)
                first_video = first_media.get('video_url') if isinstance(first_media, dict) else None
                
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.client_messages 
                    (client_id, photographer_id, content, sender_type, is_read, is_delivered, created_at, type, author, image_url, video_url, reply_to_id)
                    VALUES (%s, %s, %s, %s, FALSE, FALSE, NOW(), 'chat', %s, %s, %s, %s)
                    RETURNING id, created_at
                ''', (client_id, photographer_id, message, sender_type, author_name, first_image, first_video, reply_to_id))
                result = cur.fetchone()
                message_ids.append(result[0])
                created_timestamps.append(result[1])
                
                # Остальные изображения как отдельные сообщения
                for media in final_image_urls[1:]:
                    media_image = media if not isinstance(media, dict) else media.get('image_url')
                    media_video = media.get('video_url') if isinstance(media, dict) else None
                    
                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.client_messages 
                        (client_id, photographer_id, content, sender_type, is_read, is_delivered, created_at, type, author, image_url, video_url)
                        VALUES (%s, %s, %s, %s, FALSE, FALSE, NOW(), 'chat', %s, %s, %s)
                        RETURNING id, created_at
                    ''', (client_id, photographer_id, '', sender_type, author_name, media_image, media_video))
                    result = cur.fetchone()
                    message_ids.append(result[0])
                    created_timestamps.append(result[1])
            
            message_id = message_ids[0] if message_ids else None
            created_at = created_timestamps[0] if created_timestamps else None
            
            # Отправляем уведомления фотографу если сообщение от клиента
            if sender_type == 'client':
                print(f'===NOTIF=== START msg_id={message_id} client={client_id} photographer={photographer_id}', flush=True)
                try:
                    from datetime import timezone as tz
                    
                    # Получаем данные фотографа (включая last_seen_at и GREEN-API credentials)
                    cur.execute('''
                        SELECT u.email, u.display_name, u.phone, u.last_seen_at,
                               u.green_api_instance_id, u.green_api_token, u.max_connected,
                               u.region
                        FROM t_p28211681_photo_secure_web.users u
                        WHERE u.id = %s
                    ''', (photographer_id,))
                    
                    photographer_data = cur.fetchone()
                    print(f'===NOTIF=== photographer_data={photographer_data}', flush=True)
                    if photographer_data:
                        photographer_email = photographer_data[0]
                        photographer_name = photographer_data[1] or 'Фотограф'
                        photographer_phone = photographer_data[2]
                        photographer_last_seen = photographer_data[3]
                        green_api_instance_id = photographer_data[4]
                        green_api_token = photographer_data[5]
                        max_connected = photographer_data[6]
                        photographer_region = photographer_data[7] or ''
                        client_name = author_name
                        
                        # Проверяем онлайн-статус фотографа по активным сессиям
                        # Онлайн = есть хотя бы одна валидная незакрытая сессия с активностью < 5 мин
                        photographer_is_online = False
                        try:
                            cur.execute('''
                                SELECT COUNT(*) FROM t_p28211681_photo_secure_web.active_sessions
                                WHERE user_id = %s
                                    AND is_valid = TRUE
                                    AND expires_at > CURRENT_TIMESTAMP
                                    AND last_activity > CURRENT_TIMESTAMP - INTERVAL '5 minutes'
                            ''', (photographer_id,))
                            active_count = cur.fetchone()[0]
                            photographer_is_online = active_count > 0
                            print(f'===NOTIF=== active_sessions={active_count}, online={photographer_is_online}', flush=True)
                        except Exception as sess_err:
                            print(f'===NOTIF=== session check error: {str(sess_err)}, fallback to last_seen', flush=True)
                            if photographer_last_seen:
                                now_utc = datetime.utcnow()
                                diff_seconds = (now_utc - photographer_last_seen).total_seconds()
                                photographer_is_online = diff_seconds < 300
                                print(f'===NOTIF=== fallback last_seen={photographer_last_seen}, diff={diff_seconds:.0f}s, online={photographer_is_online}', flush=True)
                        
                        # Получаем данные клиента для полного описания в уведомлении
                        client_phone = None
                        client_email = None
                        try:
                            cur.execute('''
                                SELECT phone, email FROM t_p28211681_photo_secure_web.clients WHERE id = %s
                            ''', (client_id,))
                            client_info = cur.fetchone()
                            if client_info:
                                client_phone = client_info[0]
                                client_email = client_info[1]
                            else:
                                cur.execute('''
                                    SELECT phone, email FROM t_p28211681_photo_secure_web.favorite_clients WHERE id = %s
                                ''', (client_id,))
                                client_info = cur.fetchone()
                                if client_info:
                                    client_phone = client_info[0]
                                    client_email = client_info[1]
                        except Exception as e:
                            print(f'[NOTIFICATION] Error getting client details: {str(e)}', flush=True)
                        
                        # Находим название папки проекта через которую клиент связался
                        folder_name = 'Проект'
                        try:
                            cur.execute('''
                                SELECT f.folder_name
                                FROM t_p28211681_photo_secure_web.photo_folders f
                                WHERE f.user_id = %s AND f.client_id = %s
                                LIMIT 1
                            ''', (photographer_id, client_id))
                            folder_row = cur.fetchone()
                            if folder_row:
                                folder_name = folder_row[0]
                            else:
                                cur.execute('''
                                    SELECT folder_name
                                    FROM t_p28211681_photo_secure_web.photo_folders
                                    WHERE user_id = %s
                                    ORDER BY created_at DESC
                                    LIMIT 1
                                ''', (photographer_id,))
                                folder_row = cur.fetchone()
                                if folder_row:
                                    folder_name = folder_row[0]
                        except Exception as e:
                            print(f'[CHAT] Error finding folder name: {str(e)}', flush=True)
                        
                        # Формируем текст для уведомлений
                        if message:
                            message_preview = message[:150] + ('...' if len(message) > 150 else '')
                        elif len(final_image_urls) > 1:
                            message_preview = f'Отправил(а) {len(final_image_urls)} изображений'
                        else:
                            message_preview = 'Отправил(а) изображение'
                        
                        # Формируем блок с данными клиента
                        now_str = datetime.utcnow().strftime('%d.%m.%Y %H:%M') + ' UTC'
                        client_info_lines = [f'👤 *Клиент:* {client_name}']
                        if client_phone:
                            client_info_lines.append(f'📞 *Телефон:* {client_phone}')
                        if client_email:
                            client_info_lines.append(f'📧 *Email:* {client_email}')
                        client_info_str = '\n'.join(client_info_lines)
                        
                        # Email уведомление (отправляем всегда)
                        if photographer_email:
                            print(f'[NOTIFICATION] Sending email to {photographer_email}', flush=True)
                            try:
                                from shared_email import send_email
                                
                                client_details_html = f'<p style="margin: 0; color: #111827; font-size: 20px; font-weight: 600;">{client_name}</p>'
                                if client_phone:
                                    client_details_html += f'<p style="margin: 4px 0 0 0; color: #6b7280; font-size: 14px;">📞 {client_phone}</p>'
                                if client_email:
                                    client_details_html += f'<p style="margin: 2px 0 0 0; color: #6b7280; font-size: 14px;">📧 {client_email}</p>'
                                
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
            <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">{now_str}</p>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="margin-bottom: 25px;">
                <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">От клиента</p>
                {client_details_html}
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
                    Открыть Foto-Mix и ответить
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
                                
                                result = send_email(photographer_email, f'💬 Сообщение от {client_name} | {folder_name}', html_body, 'Foto-Mix')
                                if result:
                                    print(f'[NOTIFICATION] Email sent successfully', flush=True)
                                else:
                                    print(f'[NOTIFICATION] Email failed: SMTP not configured or disabled', flush=True)
                            except Exception as email_err:
                                print(f'[NOTIFICATION] Email error: {str(email_err)}', flush=True)
                        
                        # MAX/WhatsApp уведомление через admin credentials — только если фотограф НЕ онлайн
                        max_instance_id = os.environ.get('MAX_INSTANCE_ID', '')
                        max_token = os.environ.get('MAX_TOKEN', '')
                        
                        if photographer_is_online:
                            print(f'===NOTIF=== ONLINE — skip MAX', flush=True)
                        elif not photographer_phone:
                            print(f'===NOTIF=== NO PHONE — skip MAX', flush=True)
                        elif not max_instance_id or not max_token:
                            print(f'===NOTIF=== NO MAX CREDS instance={bool(max_instance_id)} token={bool(max_token)}', flush=True)
                        else:
                            print(f'===NOTIF=== OFFLINE — sending MAX to phone={photographer_phone}', flush=True)
                            try:
                                import requests as req
                                
                                REGION_TIMEZONE = {
                                    "Калининградская область": 2,
                                    "Самарская область": 4, "Астраханская область": 4, "Саратовская область": 4, "Удмуртия": 4, "Удмуртская Республика": 4, "Ульяновская область": 4,
                                    "Башкортостан": 5, "Республика Башкортостан": 5, "Курганская область": 5, "Оренбургская область": 5, "Пермский край": 5, "Свердловская область": 5, "Тюменская область": 5, "Челябинская область": 5, "Ханты-Мансийский автономный округ": 5, "Ямало-Ненецкий автономный округ": 5,
                                    "Омская область": 6,
                                    "Алтайский край": 7, "Республика Алтай": 7, "Кемеровская область": 7, "Новосибирская область": 7, "Томская область": 7, "Красноярский край": 7, "Тыва": 7, "Республика Тыва": 7, "Хакасия": 7, "Республика Хакасия": 7,
                                    "Иркутская область": 8, "Бурятия": 8, "Республика Бурятия": 8,
                                    "Забайкальский край": 9, "Амурская область": 9, "Саха (Якутия)": 9, "Республика Саха (Якутия)": 9,
                                    "Еврейская автономная область": 10, "Приморский край": 10, "Хабаровский край": 10,
                                    "Магаданская область": 11, "Сахалинская область": 11,
                                    "Камчатский край": 12, "Чукотский автономный округ": 12,
                                }
                                offset_hours = REGION_TIMEZONE.get(photographer_region, 3)
                                local_time = datetime.utcnow() + timedelta(hours=offset_hours)
                                tz_label = f"UTC+{offset_hours}" if offset_hours != 3 else "МСК"
                                time_str = local_time.strftime('%d.%m.%Y %H:%M') + f' ({tz_label})'
                                
                                whatsapp_text = f'📬 *Новое сообщение в Foto-Mix*\n🕐 *Время:* {time_str}\n\n{client_info_str}\n📁 *Проект:* {folder_name}\n\n💬 *Сообщение:*\n{message_preview}\n\n➡️ Войдите на foto-mix.ru чтобы ответить клиенту'
                                
                                media_server = max_instance_id[:4] if len(max_instance_id) >= 4 else '7103'
                                green_url = f"https://{media_server}.api.green-api.com/v3/waInstance{max_instance_id}/sendMessage/{max_token}"
                                
                                clean_phone = ''.join(filter(str.isdigit, photographer_phone))
                                if not clean_phone.startswith('7'):
                                    clean_phone = '7' + clean_phone.lstrip('8')
                                
                                green_payload = {
                                    "chatId": f"{clean_phone}@c.us",
                                    "message": whatsapp_text
                                }
                                print(f'===NOTIF=== GREEN-API URL={green_url} chatId={clean_phone}@c.us', flush=True)
                                
                                green_response = req.post(green_url, json=green_payload, timeout=15)
                                print(f'===NOTIF=== GREEN-API status={green_response.status_code} body={green_response.text[:300]}', flush=True)
                                
                                if green_response.status_code == 200:
                                    print(f'===NOTIF=== MAX OK sent to {photographer_phone}', flush=True)
                                else:
                                    print(f'===NOTIF=== MAX FAIL {green_response.status_code} {green_response.text[:300]}', flush=True)
                            except Exception as e:
                                print(f'[NOTIFICATION] MAX error: {str(e)}', flush=True)
                        
                except Exception as e:
                    print(f'[CHAT] Notification error: {str(e)}', flush=True)
                    import traceback
                    traceback.print_exc()
            
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
        print(f'Error in messages handler: {str(e)}', flush=True)
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }