import json
import os
import base64
import uuid
import re
import urllib.request
import urllib.parse
from typing import Dict, Any
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
import requests
from reminder_checker import check_and_send_reminders


def _extract_vk_username(value: str) -> str:
    if not value:
        return ''
    value = value.strip()
    m = re.search(r'(?:vk\.com/|^@)([A-Za-z0-9_.]+)', value)
    if m:
        return m.group(1)
    return re.sub(r'[^A-Za-z0-9_.]', '', value)


def _upload_avatar_to_s3(data: bytes, ext: str, content_type: str, photographer_id: str, client_id: int) -> str:
    safe_ext = (ext or 'jpg').lower().lstrip('.')
    if safe_ext not in {'jpg', 'jpeg', 'png', 'webp', 'gif'}:
        safe_ext = 'jpg'
    key = f"client-avatars/{photographer_id}/{client_id}/{uuid.uuid4()}.{safe_ext}"
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    s3.put_object(Bucket='files', Key=key, Body=data, ContentType=content_type or 'image/jpeg')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def _fetch_vk_avatar_bytes(vk_input: str):
    token = os.environ.get('VK_SERVICE_TOKEN', '')
    if not token:
        raise RuntimeError('VK не настроен')
    username = _extract_vk_username(vk_input)
    if not username:
        raise RuntimeError('Не указан профиль ВКонтакте')
    params = {
        'user_ids': username,
        'fields': 'photo_400_orig,photo_200,photo_max',
        'access_token': token,
        'v': '5.131',
        'lang': 'ru',
    }
    url = f"https://api.vk.com/method/users.get?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=10) as resp:
        payload = json.loads(resp.read().decode('utf-8'))
    if 'error' in payload:
        raise RuntimeError(payload['error'].get('error_msg', 'VK API error'))
    response_list = payload.get('response') or []
    if not response_list:
        raise RuntimeError('Пользователь VK не найден')
    user = response_list[0]
    photo_url = user.get('photo_400_orig') or user.get('photo_max') or user.get('photo_200')
    if not photo_url:
        raise RuntimeError('У пользователя VK нет аватара')
    with urllib.request.urlopen(photo_url, timeout=10) as img_resp:
        content_type = img_resp.headers.get('Content-Type', 'image/jpeg')
        data = img_resp.read()
    ext = 'jpg'
    if 'png' in content_type:
        ext = 'png'
    elif 'webp' in content_type:
        ext = 'webp'
    return ext, data, content_type

# S3 configuration
S3_BUCKET = 'foto-mix'
S3_ENDPOINT = 'https://storage.yandexcloud.net'

# Database schema
DB_SCHEMA = 't_p28211681_photo_secure_web'

def send_booking_whatsapp_notification(client_name: str, client_phone: str, photographer_phone: str, booking_date: str, booking_time: str, description: str):
    '''Отправить уведомления о новом бронировании через WhatsApp'''
    try:
        instance_id = os.environ.get('MAX_INSTANCE_ID', '')
        token = os.environ.get('MAX_TOKEN', '')
        
        if not instance_id or not token:
            print('[BOOKING_NOTIF] MAX credentials not configured')
            return False
        
        media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
        url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"
        
        # Форматируем дату в читабельный формат
        try:
            date_obj = datetime.fromisoformat(booking_date.replace('Z', ''))
            months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
            formatted_date = f"{date_obj.day} {months[date_obj.month - 1]} {date_obj.year}"
        except:
            formatted_date = booking_date
        
        # Форматируем время (убираем секунды если есть)
        formatted_time = booking_time
        if ':' in booking_time:
            parts = booking_time.split(':')
            formatted_time = f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"
        
        # Отправляем уведомление клиенту
        if client_phone:
            clean_phone = ''.join(filter(str.isdigit, client_phone))
            if not clean_phone.startswith('7'):
                clean_phone = '7' + clean_phone.lstrip('8')
            
            client_message = f"""📅 Подтверждение бронирования от foto-mix

Здравствуйте, {client_name}!

Ваша встреча успешно забронирована:

📅 Дата: {formatted_date}
🕐 Время: {formatted_time}"""
            
            if description:
                client_message += f"\n📝 Описание: {description}"
            
            client_message += "\n\nМы с нетерпением ждём встречи с вами! 📷"
            client_message += "\n\n———\n🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!"
            
            try:
                response = requests.post(url, json={
                    "chatId": f"{clean_phone}@c.us",
                    "message": client_message
                }, timeout=10)
                print(f'[BOOKING_NOTIF] Client notification sent: {response.status_code}')
            except Exception as e:
                print(f'[BOOKING_NOTIF] Error sending to client: {e}')
        
        # Отправляем уведомление фотографу
        if photographer_phone:
            clean_photographer_phone = ''.join(filter(str.isdigit, photographer_phone))
            if not clean_photographer_phone.startswith('7'):
                clean_photographer_phone = '7' + clean_photographer_phone.lstrip('8')
            
            photographer_message = f"""📸 Новое бронирование от foto-mix

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

📅 Дата: {formatted_date}
🕐 Время: {formatted_time}"""
            
            if description:
                photographer_message += f"\n📝 Описание: {description}"
            
            photographer_message += "\n\nПодготовьте оборудование к съёмке! 📷"
            photographer_message += "\n\n———\n🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!"
            
            try:
                response = requests.post(url, json={
                    "chatId": f"{clean_photographer_phone}@c.us",
                    "message": photographer_message
                }, timeout=10)
                print(f'[BOOKING_NOTIF] Photographer notification sent: {response.status_code}')
            except Exception as e:
                print(f'[BOOKING_NOTIF] Error sending to photographer: {e}')
        
        return True
    except Exception as e:
        print(f'[BOOKING_NOTIF] Unexpected error: {e}')
        return False

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
    '''Управление клиентами и их данными — CRUD операции.'''
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
    photographer_id = headers.get('X-User-Id') or headers.get('x-user-id')
    user_id = photographer_id  # Alias for compatibility
    
    if not photographer_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Photographer ID required'}),
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
        qs = event.get('queryStringParameters') or {}
        action_qs = qs.get('action', '')

        if action_qs == 'drafts':
            allowed_draft_types = {'client', 'project', 'open_card'}
            try:
                photographer_id_int = int(photographer_id)
            except (TypeError, ValueError):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid X-User-Id'}),
                    'isBase64Encoded': False
                }

            if method == 'GET':
                cur.execute(
                    'SELECT draft_type, client_id, payload, updated_at FROM t_p28211681_photo_secure_web.user_drafts WHERE photographer_id = %s',
                    (photographer_id_int,)
                )
                rows = cur.fetchall()
                result = [
                    {
                        'draft_type': r['draft_type'],
                        'client_id': r['client_id'] if r['client_id'] else None,
                        'payload': r['payload'],
                        'updated_at': str(r['updated_at']) if r['updated_at'] else None
                    } for r in rows
                ]
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(result, default=str),
                    'isBase64Encoded': False
                }

            body_str = event.get('body') or '{}'
            try:
                body_data = json.loads(body_str)
            except json.JSONDecodeError:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid JSON'}),
                    'isBase64Encoded': False
                }

            draft_type = body_data.get('draft_type')
            if draft_type not in allowed_draft_types:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid draft_type'}),
                    'isBase64Encoded': False
                }

            client_id_raw = body_data.get('client_id')
            try:
                draft_client_id = int(client_id_raw) if client_id_raw not in (None, '', 0) else 0
            except (TypeError, ValueError):
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Invalid client_id'}),
                    'isBase64Encoded': False
                }

            if method == 'POST':
                payload = body_data.get('payload')
                if payload is None:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'payload required'}),
                        'isBase64Encoded': False
                    }
                cur.execute(
                    '''INSERT INTO t_p28211681_photo_secure_web.user_drafts (photographer_id, draft_type, client_id, payload, updated_at)
                       VALUES (%s, %s, %s, %s::jsonb, NOW())
                       ON CONFLICT (photographer_id, draft_type, client_id)
                       DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()''',
                    (photographer_id_int, draft_type, draft_client_id, json.dumps(payload))
                )
                conn.commit()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }

            if method == 'DELETE':
                cur.execute(
                    'DELETE FROM t_p28211681_photo_secure_web.user_drafts WHERE photographer_id = %s AND draft_type = %s AND client_id = %s',
                    (photographer_id_int, draft_type, draft_client_id)
                )
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
                        'upload_date': str(doc['upload_date']) if doc['upload_date'] else None
                    })
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(docs_with_urls),
                    'isBase64Encoded': False
                }
            
            if action == 'list':
                # Проверяем и отправляем напоминания о предстоящих съёмках
                try:
                    check_and_send_reminders(conn, DB_SCHEMA, photographer_id)
                except Exception as e:
                    print(f'[REMINDER_CHECK_ERROR] {e}')
                    # Продолжаем работу даже если проверка напоминаний упала
                
                # Оптимизированный запрос: сначала получаем всех клиентов
                cur.execute('''
                    SELECT id, user_id, name, phone, email, vk_profile, vk_username, birthdate, telegram_chat_id, avatar_url, reserve_balance, created_at, updated_at
                    FROM t_p28211681_photo_secure_web.clients 
                    WHERE photographer_id = %s
                    ORDER BY created_at DESC
                ''', (photographer_id,))
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
                    SELECT client_id, id, name, status, budget, start_date, end_date, description, shooting_style_id, shooting_time, shooting_duration, shooting_address, add_to_calendar, hourly_rate, photobook_count, photobook_price, photo_items, cancel_reason, studio_hourly_rate
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
                
                # Массовый запрос всех refunds
                cur.execute('''
                    SELECT client_id, id, payment_id, project_id, amount, reason, type, status, method, refund_date, payment_system_id
                    FROM t_p28211681_photo_secure_web.client_refunds 
                    WHERE client_id = ANY(%s)
                    ORDER BY refund_date DESC
                ''', (list(client_ids),))
                all_refunds = cur.fetchall()
                refunds_by_client = {}
                for r in all_refunds:
                    cid = r['client_id']
                    if cid not in refunds_by_client:
                        refunds_by_client[cid] = []
                    refunds_by_client[cid].append(r)
                
                # Массовый запрос всех messages
                cur.execute('''
                    SELECT client_id, id, type, author, content, message_date,
                           delivery_status, delivery_error, external_message_id
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
                
                # Массовый запрос движений финансового резерва
                cur.execute('''
                    SELECT client_id, id, amount, type, source_payment_id, target_project_id, description, created_at
                    FROM t_p28211681_photo_secure_web.reserve_transactions
                    WHERE client_id = ANY(%s)
                    ORDER BY created_at DESC
                ''', (list(client_ids),))
                all_reserve_tx = cur.fetchall()
                reserve_tx_by_client = {}
                for rt in all_reserve_tx:
                    cid = rt['client_id']
                    if cid not in reserve_tx_by_client:
                        reserve_tx_by_client[cid] = []
                    reserve_tx_by_client[cid].append(rt)
                
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
                        'startDate': str(p['start_date']) if p['start_date'] else None,
                        'description': p['description'],
                        'shooting_style_id': p.get('shooting_style_id'),
                        'shooting_time': p.get('shooting_time'),
                        'shooting_duration': p.get('shooting_duration'),
                        'shooting_address': p.get('shooting_address'),
                        'add_to_calendar': p.get('add_to_calendar'),
                        'hourly_rate': float(p['hourly_rate']) if p.get('hourly_rate') is not None else None,
                        'studio_hourly_rate': float(p['studio_hourly_rate']) if p.get('studio_hourly_rate') is not None else None,
                        'photobook_count': int(p['photobook_count']) if p.get('photobook_count') is not None else None,
                        'photobook_price': float(p['photobook_price']) if p.get('photobook_price') is not None else None,
                        'photo_items': p.get('photo_items') if p.get('photo_items') is not None else [],
                        'cancel_reason': p.get('cancel_reason')
                    } for p in raw_projects]
                    
                    # Конвертируем payments
                    payments = [{
                        'id': p['id'],
                        'amount': float(p['amount']),
                        'date': str(p['payment_date']) if p['payment_date'] else None,
                        'status': p['status'],
                        'method': p['method'],
                        'description': p['description'],
                        'projectId': p['project_id']
                    } for p in raw_payments]
                    
                    # Конвертируем refunds
                    raw_refunds = refunds_by_client.get(cid, [])
                    refunds = [{
                        'id': r['id'],
                        'paymentId': r['payment_id'],
                        'projectId': r['project_id'],
                        'amount': float(r['amount']),
                        'reason': r['reason'],
                        'type': r['type'],
                        'status': r['status'],
                        'method': r['method'],
                        'date': str(r['refund_date']) if r['refund_date'] else None,
                        'paymentSystemId': r.get('payment_system_id')
                    } for r in raw_refunds]
                    
                    # Конвертируем messages
                    messages = [{
                        'id': m['id'],
                        'type': m['type'],
                        'author': m['author'],
                        'content': m['content'],
                        'date': str(m['message_date']) if m['message_date'] else None,
                        'delivery_status': m.get('delivery_status'),
                        'delivery_error': m.get('delivery_error'),
                        'external_message_id': m.get('external_message_id'),
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
                    
                    raw_reserve_tx = reserve_tx_by_client.get(cid, [])
                    reserve_transactions = [{
                        'id': rt['id'],
                        'amount': float(rt['amount']),
                        'type': rt['type'],
                        'sourcePaymentId': rt.get('source_payment_id'),
                        'targetProjectId': rt.get('target_project_id'),
                        'description': rt.get('description'),
                        'date': str(rt['created_at']) if rt['created_at'] else None
                    } for rt in raw_reserve_tx]
                    
                    result.append({
                        **dict(client),
                        'vkProfile': client['vk_profile'],
                        'vk_username': client.get('vk_username'),
                        'birthdate': str(client['birthdate']) if client.get('birthdate') else None,
                        'created_at': str(client['created_at']) if client['created_at'] else None,
                        'updated_at': str(client['updated_at']) if client['updated_at'] else None,
                        'reserveBalance': float(client.get('reserve_balance') or 0),
                        'reserveTransactions': reserve_transactions,
                        'bookings': [
                            {
                                'id': b['id'],
                                'date': str(b['booking_date']) if b['booking_date'] else None,
                                'booking_date': str(b['booking_date']) if b['booking_date'] else None,
                                'time': b['booking_time'],
                                'description': b['description'],
                                'notificationEnabled': b['notification_enabled'],
                                'notificationTime': b['notification_time']
                            } for b in bookings
                        ],
                        'projects': projects,
                        'payments': payments,
                        'refunds': refunds,
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
            
            if action in ('upload_avatar', 'import_vk_avatar', 'remove_avatar'):
                client_id = body.get('client_id') or body.get('clientId')
                if not client_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'client_id обязателен'}),
                        'isBase64Encoded': False,
                    }
                try:
                    client_id_int = int(client_id)
                except (TypeError, ValueError):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Некорректный client_id'}),
                        'isBase64Encoded': False,
                    }
                cur.execute(
                    'SELECT id, vk_profile FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND photographer_id = %s',
                    (client_id_int, photographer_id),
                )
                row = cur.fetchone()
                if not row:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Клиент не найден'}),
                        'isBase64Encoded': False,
                    }

                avatar_url = None
                try:
                    if action == 'upload_avatar':
                        file_data = body.get('file_data')
                        if not file_data:
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'file_data обязателен'}),
                                'isBase64Encoded': False,
                            }
                        if ',' in file_data and file_data.startswith('data:'):
                            file_data = file_data.split(',', 1)[1]
                        try:
                            raw = base64.b64decode(file_data)
                        except Exception:
                            return {
                                'statusCode': 400,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                                'body': json.dumps({'error': 'Невозможно декодировать изображение'}),
                                'isBase64Encoded': False,
                            }
                        ext = (body.get('file_name') or '').rsplit('.', 1)[-1] if '.' in (body.get('file_name') or '') else 'jpg'
                        content_type = body.get('content_type') or 'image/jpeg'
                        avatar_url = _upload_avatar_to_s3(raw, ext, content_type, str(photographer_id), client_id_int)
                    elif action == 'import_vk_avatar':
                        vk_input = body.get('vk_profile') or row['vk_profile'] or ''
                        ext, data, content_type = _fetch_vk_avatar_bytes(vk_input)
                        avatar_url = _upload_avatar_to_s3(data, ext, content_type, str(photographer_id), client_id_int)
                    # remove_avatar — оставим avatar_url = None
                except Exception as exc:
                    print(f'[AVATAR_ERROR] {exc}')
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': str(exc)}),
                        'isBase64Encoded': False,
                    }

                cur.execute(
                    'UPDATE t_p28211681_photo_secure_web.clients SET avatar_url = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND photographer_id = %s',
                    (avatar_url, client_id_int, photographer_id),
                )
                conn.commit()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'avatar_url': avatar_url}),
                    'isBase64Encoded': False,
                }

            if action == 'resend_message':
                # Повторная отправка ранее не доставленного автоматического сообщения клиенту
                message_id = body.get('message_id') or body.get('messageId')
                if not message_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'message_id обязателен'}),
                        'isBase64Encoded': False,
                    }
                try:
                    message_id_int = int(message_id)
                except (TypeError, ValueError):
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Некорректный message_id'}),
                        'isBase64Encoded': False,
                    }

                # Загружаем сообщение и проверяем что оно принадлежит клиенту этого фотографа
                cur.execute('''
                    SELECT m.id, m.client_id, m.type, m.content, m.photographer_id,
                           c.phone AS client_phone, c.email AS client_email,
                           c.telegram_chat_id AS client_tg, c.name AS client_name,
                           u.green_api_instance_id, u.green_api_token
                    FROM t_p28211681_photo_secure_web.client_messages m
                    JOIN t_p28211681_photo_secure_web.clients c ON c.id = m.client_id
                    LEFT JOIN t_p28211681_photo_secure_web.users u ON u.id = m.photographer_id
                    WHERE m.id = %s AND m.photographer_id = %s
                ''', (message_id_int, photographer_id))
                msg_row = cur.fetchone()
                if not msg_row:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Сообщение не найдено'}),
                        'isBase64Encoded': False,
                    }

                channel = (msg_row['type'] or '').lower()
                content = msg_row['content'] or ''
                new_status = 'failed'
                new_error = None
                new_external_id = None

                try:
                    if channel == 'whatsapp':
                        client_phone = msg_row['client_phone']
                        if not client_phone:
                            new_status = 'failed'
                            new_error = 'У клиента не указан телефон'
                        else:
                            instance_id = (msg_row['green_api_instance_id'] or os.environ.get('MAX_INSTANCE_ID', ''))
                            token = (msg_row['green_api_token'] or os.environ.get('MAX_TOKEN', ''))
                            if not instance_id or not token:
                                new_status = 'failed'
                                new_error = 'GREEN-API/MAX не настроен'
                            else:
                                clean_phone = ''.join(filter(str.isdigit, client_phone))
                                if not clean_phone.startswith('7'):
                                    clean_phone = '7' + clean_phone.lstrip('8')
                                media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
                                url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"
                                resp = requests.post(url, json={'chatId': f"{clean_phone}@c.us", 'message': content}, timeout=10)
                                if resp.status_code >= 400:
                                    new_status = 'failed'
                                    new_error = f'HTTP {resp.status_code}: {resp.text[:200]}'
                                else:
                                    try:
                                        data = resp.json() or {}
                                    except Exception:
                                        data = {}
                                    new_external_id = data.get('idMessage') or data.get('id')
                                    new_status = 'sent'
                    elif channel == 'telegram':
                        tg_target = msg_row['client_tg']
                        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
                        if not tg_target:
                            new_status = 'failed'
                            new_error = 'У клиента не привязан Telegram'
                        elif not bot_token:
                            new_status = 'failed'
                            new_error = 'TELEGRAM_BOT_TOKEN не настроен'
                        else:
                            try:
                                import telebot
                                bot = telebot.TeleBot(bot_token)
                                # Контент может быть с HTML-тегами или без — пробуем сначала plain, чтобы не падать на разметке
                                sent_msg = bot.send_message(chat_id=tg_target, text=content, disable_web_page_preview=True)
                                new_external_id = str(getattr(sent_msg, 'message_id', '')) or None
                                new_status = 'delivered'
                            except Exception as tg_e:
                                new_status = 'failed'
                                new_error = str(tg_e)[:300]
                    elif channel == 'email':
                        client_email = msg_row['client_email']
                        if not client_email:
                            new_status = 'failed'
                            new_error = 'У клиента не указан email'
                        else:
                            # Email-канал: content у нас короткий заголовок вида "[Email] ...".
                            # Для повторной отправки используем сам content как тело текстом.
                            try:
                                email_api = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0'
                                subj = content.replace('[Email] ', '').strip() or 'Уведомление от фотографа'
                                resp = requests.post(email_api, json={
                                    'action': 'send-booking-notification',
                                    'to_email': client_email,
                                    'client_name': msg_row['client_name'] or '',
                                    'subject': subj,
                                    'html_body': f'<p>{content}</p>'
                                }, headers={'Content-Type': 'application/json'}, timeout=15)
                                if resp.status_code == 200:
                                    new_status = 'sent'
                                else:
                                    new_status = 'failed'
                                    new_error = f'HTTP {resp.status_code}: {resp.text[:200]}'
                            except Exception as em_e:
                                new_status = 'failed'
                                new_error = str(em_e)[:300]
                    else:
                        new_status = 'failed'
                        new_error = f'Канал не поддерживает повторную отправку: {channel}'
                except Exception as send_err:
                    new_status = 'failed'
                    new_error = str(send_err)[:300]

                # Обновляем существующую запись с новым статусом
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.client_messages
                    SET delivery_status = %s,
                        delivery_error = %s,
                        external_message_id = COALESCE(%s, external_message_id),
                        is_delivered = %s,
                        message_date = NOW()
                    WHERE id = %s AND photographer_id = %s
                ''', (
                    new_status,
                    new_error,
                    new_external_id,
                    new_status in ('delivered', 'read'),
                    message_id_int,
                    photographer_id,
                ))
                conn.commit()

                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'success': new_status in ('sent', 'delivered', 'read'),
                        'delivery_status': new_status,
                        'delivery_error': new_error,
                        'external_message_id': new_external_id,
                    }),
                    'isBase64Encoded': False,
                }

            if action == 'create':
                # Логируем данные для отладки
                print(f'[CREATE_CLIENT] photographer_id: {photographer_id}')
                print(f'[CREATE_CLIENT] body: {body}')
                
                # Дополнительная проверка photographer_id
                if not photographer_id or photographer_id == 'null' or photographer_id == 'undefined':
                    print(f'[CREATE_CLIENT] ERROR: Invalid photographer_id: {photographer_id}')
                    return {
                        'statusCode': 401,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Valid Photographer ID required'}),
                        'isBase64Encoded': False
                    }
                
                # Проверяем дубликаты по email или телефону
                email = body.get('email', '').strip()
                phone = body.get('phone', '').strip()
                
                # Ищем существующего клиента по email или телефону
                existing_client = None
                if email and email != '':
                    cur.execute('''
                        SELECT id FROM t_p28211681_photo_secure_web.clients 
                        WHERE photographer_id = %s AND LOWER(email) = LOWER(%s)
                        LIMIT 1
                    ''', (photographer_id, email))
                    existing_client = cur.fetchone()
                
                if not existing_client and phone and phone != '' and phone != '-':
                    cur.execute('''
                        SELECT id FROM t_p28211681_photo_secure_web.clients 
                        WHERE photographer_id = %s AND phone = %s
                        LIMIT 1
                    ''', (photographer_id, phone))
                    existing_client = cur.fetchone()
                
                # Если клиент найден - возвращаем его ID
                if existing_client:
                    print(f'[CREATE_CLIENT] Found duplicate client: {existing_client["id"]}')
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'id': existing_client['id'], 'duplicate': True}),
                        'isBase64Encoded': False
                    }
                
                # Проверка лимита клиентов по тарифу фотографа
                cur.execute('''
                    SELECT sp.max_clients, sp.name AS plan_name
                    FROM t_p28211681_photo_secure_web.users u
                    LEFT JOIN t_p28211681_photo_secure_web.storage_plans sp ON sp.id = u.plan_id
                    WHERE u.id = %s
                ''', (photographer_id,))
                plan_row = cur.fetchone()
                plan_max_clients = plan_row['max_clients'] if plan_row else None
                plan_name = plan_row['plan_name'] if plan_row else None

                if plan_max_clients is not None:
                    cur.execute('''
                        SELECT COUNT(*) AS cnt
                        FROM t_p28211681_photo_secure_web.clients
                        WHERE photographer_id = %s
                    ''', (photographer_id,))
                    current_count = cur.fetchone()['cnt']

                    if current_count >= plan_max_clients:
                        print(f'[CREATE_CLIENT] Limit reached: {current_count}/{plan_max_clients} (plan={plan_name})')
                        return {
                            'statusCode': 403,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({
                                'error': 'CLIENT_LIMIT_REACHED',
                                'limit_reached': True,
                                'max_clients': plan_max_clients,
                                'current_count': current_count,
                                'plan_name': plan_name
                            }),
                            'isBase64Encoded': False
                        }

                # Если дубликата нет - создаём нового клиента
                birthdate_value = body.get('birthdate')
                if birthdate_value == '':
                    birthdate_value = None
                
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.clients (user_id, photographer_id, name, phone, email, vk_profile, vk_username, birthdate)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, user_id, name, phone, email, vk_profile, vk_username, birthdate, created_at, updated_at
                ''', (
                    photographer_id,
                    photographer_id,
                    body.get('name'),
                    body.get('phone'),
                    body.get('email'),
                    body.get('vkProfile'),
                    body.get('vkUsername'),
                    birthdate_value
                ))
                client = cur.fetchone()
                conn.commit()
                
                print(f'[CREATE_CLIENT] Successfully created client: {client["id"]}')
                
                client_dict = dict(client)
                
                # Автоматически подтягиваем аватарку из ВК, если указан профиль
                vk_input = body.get('vkProfile') or body.get('vkUsername')
                if vk_input:
                    try:
                        ext, avatar_data, content_type = _fetch_vk_avatar_bytes(vk_input)
                        avatar_url = _upload_avatar_to_s3(
                            avatar_data, ext, content_type, str(photographer_id), client['id']
                        )
                        cur.execute('''
                            UPDATE t_p28211681_photo_secure_web.clients
                            SET avatar_url = %s, updated_at = NOW()
                            WHERE id = %s
                        ''', (avatar_url, client['id']))
                        conn.commit()
                        client_dict['avatar_url'] = avatar_url
                        print(f'[CREATE_CLIENT] Auto-imported VK avatar for client {client["id"]}')
                    except Exception as avatar_err:
                        print(f'[CREATE_CLIENT] VK avatar auto-import skipped: {avatar_err}')
                
                return {
                    'statusCode': 201,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps(client_dict, default=str),
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
                cur.execute('SELECT name, phone, email FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND photographer_id = %s', (client_id, user_id))
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
                
                # Получаем телефон фотографа для отправки уведомлений
                cur.execute('SELECT phone FROM t_p28211681_photo_secure_web.users WHERE id = %s', (user_id,))
                photographer = cur.fetchone()
                photographer_phone = photographer['phone'] if photographer else None
                
                # Отправляем уведомления о бронировании через WhatsApp
                if notification_enabled:
                    send_booking_whatsapp_notification(
                        client_name=client['name'],
                        client_phone=client['phone'],
                        photographer_phone=photographer_phone,
                        booking_date=booking_date,
                        booking_time=booking_time,
                        description=description or ''
                    )
                
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
            
            elif action == 'get_reminders_log':
                client_id = body.get('clientId')
                if not client_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'clientId required'}),
                        'isBase64Encoded': False
                    }
                cur.execute(f'''
                    SELECT rl.id, rl.project_id, rl.reminder_type, rl.sent_to, rl.sent_at, rl.channel, rl.success, rl.error_message,
                           cp.name as project_name
                    FROM {DB_SCHEMA}.shooting_reminders_log rl
                    JOIN {DB_SCHEMA}.client_projects cp ON rl.project_id = cp.id
                    WHERE cp.client_id = %s
                    ORDER BY rl.sent_at DESC
                    LIMIT 50
                ''', (client_id,))
                reminders = cur.fetchall()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'reminders': [{
                        'id': r['id'],
                        'project_id': r['project_id'],
                        'project_name': r['project_name'],
                        'reminder_type': r['reminder_type'],
                        'sent_to': r['sent_to'],
                        'sent_at': str(r['sent_at']),
                        'channel': r['channel'],
                        'success': r['success'],
                        'error_message': r['error_message']
                    } for r in reminders]}),
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
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.shooting_reminders_log WHERE project_id IN (SELECT id FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s)', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.bookings WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_refunds WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.telegram_invites WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.telegram_message_queue WHERE client_id = %s', (client_id,))
                cur.execute('DELETE FROM t_p28211681_photo_secure_web.birthday_notifications_log WHERE client_id = %s', (client_id,))
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
                
                print(f'[UPLOAD_DOCUMENT] Received: client_id={client_id}, filename={filename}, file_size={len(file_base64) if file_base64 else 0}, photographer_id={photographer_id}')
                
                if not client_id or not filename or not file_base64:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'clientId, filename, file required'}),
                        'isBase64Encoded': False
                    }
                
                # Проверяем, что клиент принадлежит пользователю
                cur.execute('SELECT id FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND photographer_id = %s', (client_id, photographer_id))
                if not cur.fetchone():
                    print(f'[UPLOAD_DOCUMENT] Access denied: client_id={client_id}, photographer_id={photographer_id}')
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Access denied'}),
                        'isBase64Encoded': False
                    }
                
                # Декодируем и загружаем в S3
                print(f'[UPLOAD_DOCUMENT] Decoding base64 file: {len(file_base64)} chars')
                file_content = base64.b64decode(file_base64)
                print(f'[UPLOAD_DOCUMENT] Decoded to {len(file_content)} bytes, uploading to S3...')
                s3_key = upload_to_s3(file_content, filename)
                print(f'[UPLOAD_DOCUMENT] Uploaded to S3: {s3_key}')
                
                # Сохраняем в БД с S3 key
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.client_documents (client_id, name, s3_key, upload_date)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id, client_id, name, s3_key, upload_date
                ''', (client_id, filename, s3_key, datetime.utcnow()))
                
                document = cur.fetchone()
                conn.commit()
                
                print(f'[UPLOAD_DOCUMENT] Saved to DB: document_id={document["id"]}')
                
                # Генерируем presigned URL для ответа
                presigned_url = generate_presigned_url(document['s3_key'])
                print(f'[UPLOAD_DOCUMENT] Generated presigned URL, length={len(presigned_url)}')
                
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
            
            print(f'[UPDATE_CLIENT] photographer_id: {photographer_id}, client_id: {client_id}')
            print(f'[UPDATE_CLIENT] body: {body}')
            
            if not client_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Client ID required'}),
                    'isBase64Encoded': False
                }
            
            # Проверяем что клиент принадлежит фотографу
            cur.execute('SELECT id FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND photographer_id = %s', (client_id, photographer_id))
            if not cur.fetchone():
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Client not found or access denied'}),
                    'isBase64Encoded': False
                }
            
            # Динамический UPDATE: обновляем ТОЛЬКО те поля, которые явно переданы в body.
            # Это защищает от затирания avatar_url, vk_profile, birthdate и т.д.
            # при PUT-запросах, отправляющих частичные данные (например, только проекты).
            field_map = [
                ('name', 'name'),
                ('phone', 'phone'),
                ('email', 'email'),
                ('vkProfile', 'vk_profile'),
                ('vk_username', 'vk_username'),
                ('birthdate', 'birthdate'),
                ('avatar_url', 'avatar_url'),
            ]
            # Поля, которые НЕ затираются если пришли как None (только удаляются через отдельные action)
            preserve_on_null = {'avatar_url'}
            # Поля типа date/timestamp: пустую строку нужно превращать в NULL,
            # иначе PostgreSQL падает с "invalid input syntax for type date".
            nullable_date_fields = {'birthdate'}
            set_clauses = []
            set_values = []
            for body_key, db_col in field_map:
                if body_key in body:
                    value = body.get(body_key)
                    if value is None and body_key in preserve_on_null:
                        continue
                    # Нормализуем пустые строки для date-полей в NULL
                    if body_key in nullable_date_fields and (value == '' or value is None):
                        value = None
                    set_clauses.append(f'{db_col} = %s')
                    set_values.append(value)
            
            if set_clauses:
                set_clauses.append('updated_at = CURRENT_TIMESTAMP')
                sql = (
                    'UPDATE t_p28211681_photo_secure_web.clients SET '
                    + ', '.join(set_clauses)
                    + ' WHERE id = %s AND photographer_id = %s '
                    + 'RETURNING id, user_id, name, phone, email, vk_profile, vk_username, birthdate, telegram_chat_id, avatar_url, created_at, updated_at'
                )
                set_values.extend([client_id, photographer_id])
                cur.execute(sql, tuple(set_values))
                client = cur.fetchone()
            else:
                # Нечего обновлять в самой таблице clients — просто возвращаем текущие данные
                cur.execute(
                    'SELECT id, user_id, name, phone, email, vk_profile, vk_username, birthdate, telegram_chat_id, avatar_url, created_at, updated_at '
                    'FROM t_p28211681_photo_secure_web.clients WHERE id = %s AND photographer_id = %s',
                    (client_id, photographer_id)
                )
                client = cur.fetchone()
            
            if not client:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Failed to update client'}),
                    'isBase64Encoded': False
                }
            
            # Автоподтяжка аватара из ВК если avatar_url пустой, но vk_profile/vk_username указан.
            # Срабатывает при любом PUT, чтобы старые клиенты тоже получили аватарку автоматически.
            try:
                current_avatar = client.get('avatar_url') if isinstance(client, dict) else client['avatar_url']
                current_vk = client.get('vk_profile') if isinstance(client, dict) else client['vk_profile']
                current_vk_username = client.get('vk_username') if isinstance(client, dict) else None
                vk_for_fetch = current_vk or current_vk_username
                if not current_avatar and vk_for_fetch:
                    try:
                        ext, avatar_data, content_type = _fetch_vk_avatar_bytes(vk_for_fetch)
                        new_avatar_url = _upload_avatar_to_s3(
                            avatar_data, ext, content_type, str(photographer_id), client_id
                        )
                        cur.execute(
                            'UPDATE t_p28211681_photo_secure_web.clients SET avatar_url = %s, updated_at = NOW() WHERE id = %s',
                            (new_avatar_url, client_id)
                        )
                        if isinstance(client, dict):
                            client['avatar_url'] = new_avatar_url
                        print(f'[PUT_CLIENT] Auto-imported VK avatar for client {client_id}')
                    except Exception as avatar_err:
                        print(f'[PUT_CLIENT] VK avatar auto-import skipped: {avatar_err}')
            except Exception as outer_err:
                print(f'[PUT_CLIENT] Avatar autocheck failed: {outer_err}')
            
            # Обновляем проекты (upsert - вставляем новые или обновляем существующие)
            if 'projects' in body:
                # Получаем текущие ID проектов
                cur.execute('SELECT id FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                incoming_ids = {p.get('id') for p in body.get('projects', []) if p.get('id')}
                
                # Удаляем проекты, которых нет в новом списке
                ids_to_delete = existing_ids - incoming_ids
                if ids_to_delete:
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.shooting_reminders_log WHERE project_id = ANY(%s)', (list(ids_to_delete),))
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE project_id = ANY(%s)', (list(ids_to_delete),))
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Вставляем или обновляем проекты
                for project in body.get('projects', []):
                    start_date_str = project.get('startDate')
                    # Защита от строки "None", приходящей от старых клиентов
                    if start_date_str in ('None', 'null', ''):
                        start_date_str = None
                    # Парсим дату из ISO строки или YYYY-MM-DD формата
                    if start_date_str:
                        try:
                            if 'T' in start_date_str:
                                start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
                            elif ' ' in start_date_str:
                                start_date = datetime.strptime(start_date_str.split(' ')[0], '%Y-%m-%d')
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
                    
                    project_id = project.get('id')
                    is_new_project = project_id not in existing_ids
                    
                    hourly_rate_raw = project.get('hourly_rate')
                    try:
                        hourly_rate_val = float(str(hourly_rate_raw).replace(',', '.')) if hourly_rate_raw not in (None, '') else None
                    except (ValueError, TypeError):
                        hourly_rate_val = None

                    studio_hourly_rate_raw = project.get('studio_hourly_rate')
                    try:
                        studio_hourly_rate_val = float(str(studio_hourly_rate_raw).replace(',', '.')) if studio_hourly_rate_raw not in (None, '') else None
                    except (ValueError, TypeError):
                        studio_hourly_rate_val = None

                    photobook_count_raw = project.get('photobook_count')
                    try:
                        photobook_count_val = int(float(str(photobook_count_raw).replace(',', '.'))) if photobook_count_raw not in (None, '') else None
                    except (ValueError, TypeError):
                        photobook_count_val = None

                    photobook_price_raw = project.get('photobook_price')
                    try:
                        photobook_price_val = float(str(photobook_price_raw).replace(',', '.')) if photobook_price_raw not in (None, '') else None
                    except (ValueError, TypeError):
                        photobook_price_val = None

                    photo_items_raw = project.get('photo_items')
                    photo_items_val = None
                    if isinstance(photo_items_raw, list):
                        cleaned_items = []
                        for it in photo_items_raw:
                            if not isinstance(it, dict):
                                continue
                            fmt = str(it.get('format', '')).strip()
                            try:
                                qty = int(float(str(it.get('qty', 0)).replace(',', '.')))
                            except (ValueError, TypeError):
                                qty = 0
                            try:
                                price = float(str(it.get('price', 0)).replace(',', '.'))
                            except (ValueError, TypeError):
                                price = 0.0
                            if fmt and (qty > 0 or price > 0):
                                cleaned_items.append({'format': fmt, 'qty': qty, 'price': price})
                        photo_items_val = json.dumps(cleaned_items)

                    cancel_reason_val = project.get('cancel_reason')
                    if isinstance(cancel_reason_val, str):
                        cancel_reason_val = cancel_reason_val.strip() or None

                    cur.execute('''
                        INSERT INTO t_p28211681_photo_secure_web.client_projects 
                        (id, client_id, name, status, budget, start_date, end_date, description, shooting_style_id, shooting_time, shooting_duration, shooting_address, add_to_calendar, hourly_rate, photobook_count, photobook_price, photo_items, cancel_reason, studio_hourly_rate)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
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
                            add_to_calendar = EXCLUDED.add_to_calendar,
                            hourly_rate = COALESCE(EXCLUDED.hourly_rate, t_p28211681_photo_secure_web.client_projects.hourly_rate),
                            photobook_count = COALESCE(EXCLUDED.photobook_count, t_p28211681_photo_secure_web.client_projects.photobook_count),
                            photobook_price = COALESCE(EXCLUDED.photobook_price, t_p28211681_photo_secure_web.client_projects.photobook_price),
                            photo_items = COALESCE(EXCLUDED.photo_items, t_p28211681_photo_secure_web.client_projects.photo_items),
                            cancel_reason = EXCLUDED.cancel_reason,
                            studio_hourly_rate = COALESCE(EXCLUDED.studio_hourly_rate, t_p28211681_photo_secure_web.client_projects.studio_hourly_rate)
                    ''', (
                        project_id,
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
                        project.get('add_to_calendar'),
                        hourly_rate_val,
                        photobook_count_val,
                        photobook_price_val,
                        photo_items_val,
                        cancel_reason_val,
                        studio_hourly_rate_val
                    ))

                    # При отмене проекта переводим оплаченную предоплату в резерв клиента.
                    # reserve_moved_at защищает от повторного перевода при повторных сохранениях.
                    if project_status == 'cancelled' and project_id:
                        try:
                            cur.execute(
                                'SELECT reserve_moved_at FROM t_p28211681_photo_secure_web.client_projects WHERE id = %s',
                                (project_id,)
                            )
                            row = cur.fetchone()
                            already_moved = bool(row and row.get('reserve_moved_at'))
                            if not already_moved:
                                cur.execute(
                                    "SELECT COALESCE(SUM(amount), 0) AS paid FROM t_p28211681_photo_secure_web.client_payments WHERE project_id = %s AND status = 'completed'",
                                    (project_id,)
                                )
                                paid_row = cur.fetchone()
                                paid_sum = float(paid_row['paid']) if paid_row and paid_row.get('paid') is not None else 0.0
                                if paid_sum > 0:
                                    cur.execute(
                                        'UPDATE t_p28211681_photo_secure_web.clients SET reserve_balance = COALESCE(reserve_balance, 0) + %s WHERE id = %s',
                                        (paid_sum, client_id)
                                    )
                                    reason_text = (cancel_reason_val or '').strip()
                                    desc = f'Отмена съёмки «{project_name}»'
                                    if reason_text:
                                        desc += f': {reason_text}'
                                    cur.execute(
                                        '''INSERT INTO t_p28211681_photo_secure_web.reserve_transactions
                                           (client_id, user_id, amount, type, source_payment_id, target_project_id, description)
                                           VALUES (%s, %s, %s, %s, %s, %s, %s)''',
                                        (client_id, str(photographer_id), paid_sum, 'added', None, project_id, desc)
                                    )
                                # Помечаем, что перевод выполнен (даже если 0 — чтобы не пересчитывать)
                                cur.execute(
                                    'UPDATE t_p28211681_photo_secure_web.client_projects SET reserve_moved_at = CURRENT_TIMESTAMP WHERE id = %s',
                                    (project_id,)
                                )
                                print(f'[CANCEL_RESERVE] Project {project_id}: moved {paid_sum} to reserve of client {client_id}')
                        except Exception as e:
                            print(f'[CANCEL_RESERVE] Error: {e}')

                    # Если проект вернули из отмены в активный статус — сбрасываем флаг,
                    # чтобы при повторной отмене предоплата снова ушла в резерв.
                    if project_status != 'cancelled' and project_id:
                        try:
                            cur.execute(
                                'UPDATE t_p28211681_photo_secure_web.client_projects SET reserve_moved_at = NULL WHERE id = %s AND reserve_moved_at IS NOT NULL',
                                (project_id,)
                            )
                        except Exception as e:
                            print(f'[CANCEL_RESERVE] Reset flag error: {e}')
                    
                    if is_new_project and start_date and project.get('shooting_time'):
                        # Уведомления о новом заказе отправляются из фронтенда через NotificationService.ts
                        # (WhatsApp + Telegram + Email в расширенном формате)
                        # Здесь только срочное напоминание если до съёмки < 24 часов
                        try:
                            from datetime import time as time_type
                            shooting_time_str = project.get('shooting_time', '12:00')
                            if isinstance(shooting_time_str, str) and ':' in shooting_time_str:
                                parts = shooting_time_str.split(':')
                                st = time_type(int(parts[0]), int(parts[1]))
                            else:
                                st = time_type(12, 0)
                            shooting_dt = datetime.combine(start_date.date() if hasattr(start_date, 'date') else start_date, st)
                            hours_until = (shooting_dt - datetime.now()).total_seconds() / 3600
                            if 0 < hours_until < 24:
                                reminders_cron_url = 'https://functions.poehali.dev/de28f751-d390-4a12-9abd-23d70a40b40c'
                                try:
                                    requests.post(reminders_cron_url, json={
                                        'immediate_project_id': project_id,
                                        'delay_seconds': 30
                                    }, headers={'Content-Type': 'application/json'}, timeout=1)
                                except requests.exceptions.ReadTimeout:
                                    pass
                                print(f'[URGENT_REMINDER] Triggered immediate reminder for project {project_id}, {hours_until:.1f}h until shooting')
                        except Exception as e:
                            print(f'[URGENT_REMINDER] Error: {e}')
            
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
                
                new_payment_ids = []
                for payment in body.get('payments', []):
                    payment_date_str = payment.get('date')
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
                    
                    if payment.get('id') not in existing_ids:
                        new_payment_ids.append(payment)

                for new_pay in new_payment_ids:
                    try:
                        pay_amount = float(new_pay.get('amount', 0))
                        pay_method = new_pay.get('method', 'cash')
                        pay_project_id = new_pay.get('projectId')
                        if pay_project_id and pay_amount > 0:
                            payments_url = 'https://functions.poehali.dev/dfa7acb6-e4ef-43d5-a1be-47ffcb09760f'
                            requests.post(payments_url, json={
                                'userId': photographer_id,
                                'projectId': pay_project_id,
                                'amount': pay_amount,
                                'method': pay_method,
                                'date': new_pay.get('date'),
                                'skipInsert': True
                            }, headers={'Content-Type': 'application/json'}, timeout=15)
                            print(f'[PAYMENT_NOTIF] Triggered notifications for new payment: amount={pay_amount}, project={pay_project_id}')
                    except Exception as e:
                        print(f'[PAYMENT_NOTIF] Error triggering notifications: {e}')
            
            # Обновляем возвраты (upsert) — временные ID от фронта (> 10^12 — это Date.now()) заменяем автогенерацией
            if 'refunds' in body:
                cur.execute('SELECT id FROM t_p28211681_photo_secure_web.client_refunds WHERE client_id = %s', (client_id,))
                existing_ids = {row['id'] for row in cur.fetchall()}
                # Только реальные DB-id (< 10^12) считаем "пришедшими"
                incoming_real_ids = {int(r.get('id')) for r in body.get('refunds', []) 
                                     if r.get('id') is not None and int(r.get('id')) < 1000000000000}
                
                ids_to_delete = existing_ids - incoming_real_ids
                if ids_to_delete:
                    cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_refunds WHERE id = ANY(%s)', (list(ids_to_delete),))
                
                # Собираем новые возвраты (для уведомлений и истории)
                new_refunds_created: list = []
                
                for refund in body.get('refunds', []):
                    refund_date_str = refund.get('date')
                    if refund_date_str:
                        try:
                            if 'T' in refund_date_str:
                                refund_date = datetime.fromisoformat(refund_date_str.replace('Z', '+00:00'))
                            else:
                                refund_date = datetime.strptime(refund_date_str, '%Y-%m-%d')
                        except (ValueError, AttributeError):
                            refund_date = datetime.now()
                    else:
                        refund_date = datetime.now()
                    
                    refund_id_raw = refund.get('id')
                    try:
                        refund_id_int = int(refund_id_raw) if refund_id_raw is not None else None
                    except (ValueError, TypeError):
                        refund_id_int = None
                    
                    is_new = refund_id_int is None or refund_id_int >= 1000000000000 or refund_id_int not in existing_ids
                    
                    if is_new:
                        # Новый возврат — INSERT с автогенерацией id
                        cur.execute('''
                            INSERT INTO t_p28211681_photo_secure_web.client_refunds 
                                (client_id, payment_id, project_id, amount, reason, type, status, method, refund_date, payment_system_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            RETURNING id
                        ''', (
                            client_id,
                            refund.get('paymentId'),
                            refund.get('projectId'),
                            refund.get('amount'),
                            refund.get('reason', ''),
                            refund.get('type', 'refund'),
                            refund.get('status', 'completed'),
                            refund.get('method'),
                            refund_date,
                            refund.get('paymentSystemId')
                        ))
                        created_id = cur.fetchone()['id']
                        new_refunds_created.append({
                            'id': created_id,
                            'amount': float(refund.get('amount') or 0),
                            'projectId': refund.get('projectId'),
                            'paymentId': refund.get('paymentId'),
                            'reason': refund.get('reason', ''),
                            'type': refund.get('type', 'refund'),
                            'date': refund_date,
                        })
                    else:
                        # Существующий — UPDATE
                        cur.execute('''
                            UPDATE t_p28211681_photo_secure_web.client_refunds SET
                                payment_id = %s, project_id = %s, amount = %s, reason = %s,
                                type = %s, status = %s, method = %s, refund_date = %s, payment_system_id = %s
                            WHERE id = %s AND client_id = %s
                        ''', (
                            refund.get('paymentId'),
                            refund.get('projectId'),
                            refund.get('amount'),
                            refund.get('reason', ''),
                            refund.get('type', 'refund'),
                            refund.get('status', 'completed'),
                            refund.get('method'),
                            refund_date,
                            refund.get('paymentSystemId'),
                            refund_id_int,
                            client_id,
                        ))
                
                # Сохраняем для последующих уведомлений / истории (после commit)
                if new_refunds_created:
                    body['_created_refunds'] = new_refunds_created
                    # Запись в Историю (client_messages) — системное сообщение
                    for nr in new_refunds_created:
                        try:
                            history_text = f"Оформлен возврат: {nr['amount']:,.0f} ₽".replace(',', ' ')
                            if nr.get('reason'):
                                history_text += f". Причина: {nr['reason']}"
                            cur.execute('''
                                INSERT INTO t_p28211681_photo_secure_web.client_messages 
                                    (client_id, type, author, content, message_date)
                                VALUES (%s, %s, %s, %s, %s)
                            ''', (client_id, 'system', 'Система', history_text, nr['date']))
                        except Exception as e:
                            print(f'[REFUND_HISTORY] Error writing history: {e}')
            
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
            
            # Отправка уведомлений о возвратах (после commit, чтобы транзакция не зависела от внешних запросов)
            created_refunds = body.get('_created_refunds', [])
            for nr in created_refunds:
                pay_project_id = nr.get('projectId')
                amount = float(nr.get('amount') or 0)
                if pay_project_id and amount > 0:
                    try:
                        payments_url = 'https://functions.poehali.dev/dfa7acb6-e4ef-43d5-a1be-47ffcb09760f'
                        requests.post(payments_url, json={
                            'action': 'notify_refund',
                            'userId': photographer_id,
                            'clientId': client_id,
                            'projectId': pay_project_id,
                            'amount': amount,
                        }, headers={'Content-Type': 'application/json'}, timeout=15)
                        print(f'[REFUND_NOTIF] Triggered: amount={amount}, project={pay_project_id}')
                    except Exception as e:
                        print(f'[REFUND_NOTIF] Error: {e}')
            
            # Подгружаем свежие refunds, чтобы фронт сразу увидел корректные DB-id
            client_response = dict(client)
            try:
                cur.execute('''
                    SELECT id, payment_id, project_id, amount, reason, type, status, method, refund_date, payment_system_id
                    FROM t_p28211681_photo_secure_web.client_refunds
                    WHERE client_id = %s
                    ORDER BY refund_date DESC
                ''', (client_id,))
                fresh_refunds = []
                for r in cur.fetchall():
                    fresh_refunds.append({
                        'id': r['id'],
                        'paymentId': r['payment_id'],
                        'projectId': r['project_id'],
                        'amount': float(r['amount']) if r['amount'] is not None else 0,
                        'reason': r['reason'],
                        'type': r['type'],
                        'status': r['status'],
                        'method': r['method'],
                        'date': str(r['refund_date']) if r['refund_date'] else None,
                        'paymentSystemId': r.get('payment_system_id'),
                    })
                client_response['refunds'] = fresh_refunds
            except Exception as e:
                print(f'[CLIENT_PUT_RESPONSE] Error loading fresh refunds: {e}')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps(client_response, default=str),
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
                    vk_username = %s,
                    birthdate = %s,
                    avatar_url = %s,
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
                body.get('vk_username'),
                body.get('birthdate'),
                body.get('avatar_url'),
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
            
            if action == 'delete_all_messages':
                client_id = params.get('clientId')
                print(f'[DELETE_ALL_MESSAGES] client_id={client_id}, user_id={user_id}')
                
                if not client_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'clientId required'}),
                        'isBase64Encoded': False
                    }
                
                # Проверяем, что клиент принадлежит пользователю
                cur.execute('''
                    SELECT id FROM t_p28211681_photo_secure_web.clients 
                    WHERE id = %s AND user_id = %s
                ''', (client_id, user_id))
                
                if not cur.fetchone():
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Client not found or access denied'}),
                        'isBase64Encoded': False
                    }
                
                # Удаляем все сообщения клиента
                cur.execute('''
                    DELETE FROM t_p28211681_photo_secure_web.client_messages 
                    WHERE client_id = %s
                ''', (client_id,))
                
                deleted_count = cur.rowcount
                conn.commit()
                
                print(f'[DELETE_ALL_MESSAGES] Deleted {deleted_count} messages for client {client_id}')
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True, 'deleted_count': deleted_count}),
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
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.shooting_reminders_log WHERE project_id IN (SELECT id FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s)', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.bookings WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_refunds WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_payments WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_projects WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_documents WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_comments WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.client_messages WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.telegram_invites WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.telegram_message_queue WHERE client_id = %s', (client_id,))
            cur.execute('DELETE FROM t_p28211681_photo_secure_web.birthday_notifications_log WHERE client_id = %s', (client_id,))
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