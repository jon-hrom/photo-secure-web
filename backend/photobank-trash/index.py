'''
Business: Управление корзиной фотобанка - восстановление и очистка
Args: event with httpMethod, body, queryStringParameters, headers (X-User-Id)
Returns: HTTP response with trash operations status
'''

import json
import os
import time
import traceback
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

SCHEMA = 't_p28211681_photo_secure_web'


CLEANUP_BUDGET_SEC = 18


def _poehali_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
    )


def _delete_keys_batch(s3_client, bucket, rows):
    """Удаляет файлы пачками по 1000 (один запрос вместо тысячи)."""
    yc_keys, ph_keys = [], []
    for r in rows:
        for k in (r.get('s3_key'), r.get('thumbnail_s3_key')):
            if not k:
                continue
            (ph_keys if k.startswith('uploads/') else yc_keys).append(k)
    targets = [(s3_client, bucket, yc_keys)]
    if ph_keys:
        targets.append((_poehali_s3(), 'files', ph_keys))
    for client, bkt, keys in targets:
        for i in range(0, len(keys), 1000):
            chunk = keys[i:i + 1000]
            try:
                client.delete_objects(Bucket=bkt, Delete={'Objects': [{'Key': k} for k in chunk], 'Quiet': True})
            except Exception as e:
                print(f'[AUTO_CLEANUP] Batch delete failed ({len(chunk)} keys): {e}')


def _auto_cleanup(conn, s3_client, bucket):
    started = time.time()
    stats = {'folders': 0, 'photos': 0}
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT id FROM {SCHEMA}.photo_folders
                WHERE is_trashed = TRUE AND trashed_at < NOW() - INTERVAL '7 days'
                ORDER BY trashed_at LIMIT 20
            ''')
            for folder in cur.fetchall():
                if time.time() - started > CLEANUP_BUDGET_SEC:
                    return stats
                cur.execute(f'SELECT s3_key, thumbnail_s3_key FROM {SCHEMA}.photo_bank WHERE folder_id = %s', (folder['id'],))
                _delete_keys_batch(s3_client, bucket, cur.fetchall())
                _purge_folders_forever(cur, [folder['id']])
                conn.commit()
                stats['folders'] += 1
                print(f'[AUTO_CLEANUP] Purged expired folder {folder["id"]}')
    except Exception as e:
        conn.rollback()
        print(f'[AUTO_CLEANUP] Folders cleanup skipped: {e}')

    if time.time() - started > CLEANUP_BUDGET_SEC:
        return stats
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT pb.id, pb.s3_key, pb.thumbnail_s3_key
                FROM {SCHEMA}.photo_bank pb
                LEFT JOIN {SCHEMA}.photo_folders pf ON pb.folder_id = pf.id
                WHERE pb.is_trashed = TRUE AND pb.trashed_at < NOW() - INTERVAL '7 days'
                  AND (pf.is_trashed = FALSE OR pf.is_trashed IS NULL)
                LIMIT 1000
            ''')
            photos = cur.fetchall()
            if photos:
                _delete_keys_batch(s3_client, bucket, photos)
                ids = tuple(p['id'] for p in photos)
                ph = ','.join(['%s'] * len(ids))
                cur.execute(f'DELETE FROM {SCHEMA}.download_logs WHERE photo_id IN ({ph})', ids)
                cur.execute(f'DELETE FROM {SCHEMA}.photobook_design_photos WHERE photo_bank_id IN ({ph})', ids)
                cur.execute(f'DELETE FROM {SCHEMA}.photo_bank WHERE id IN ({ph})', ids)
                conn.commit()
                stats['photos'] = len(ids)
                print(f'[AUTO_CLEANUP] Deleted {len(ids)} expired photos')
    except Exception as e:
        conn.rollback()
        print(f'[AUTO_CLEANUP] Standalone cleanup skipped: {e}')
    return stats


def _make_yc_client():
    return boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )


def _run_cron_cleanup(event):
    """Фоновая автоочистка корзины — вызывается планировщиком (notifications-tick) ночью."""
    headers = event.get('headers') or {}
    token = headers.get('X-Cron-Token') or headers.get('x-cron-token') or ''
    expected = os.environ.get('CRON_TOKEN', '')
    cors = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
    if expected and token != expected:
        return {'statusCode': 403, 'headers': cors, 'body': json.dumps({'error': 'forbidden'}), 'isBase64Encoded': False}
    conn = psycopg2.connect(os.environ.get('DATABASE_URL'))
    try:
        stats = _auto_cleanup(conn, _make_yc_client(), 'foto-mix')
    finally:
        conn.close()
    return {'statusCode': 200, 'headers': cors, 'body': json.dumps({'success': True, **stats}), 'isBase64Encoded': False}


def _purge_folders_forever(cur, folder_ids):
    """Полностью и безопасно удаляет папки из БД вместе со всеми зависимостями.
    Порядок удаления учитывает все внешние ключи, чтобы не было FK violation.
    """
    if not folder_ids:
        return
    ph = ','.join(['%s'] * len(folder_ids))
    fids = tuple(folder_ids)

    # ID фотографий в этих папках
    cur.execute(f'SELECT id FROM {SCHEMA}.photo_bank WHERE folder_id IN ({ph})', fids)
    photo_ids = [r['id'] for r in cur.fetchall()]

    if photo_ids:
        p_ph = ','.join(['%s'] * len(photo_ids))
        p_t = tuple(photo_ids)
        cur.execute(f'DELETE FROM {SCHEMA}.download_logs WHERE photo_id IN ({p_ph})', p_t)
        cur.execute(f'DELETE FROM {SCHEMA}.photobook_design_photos WHERE photo_bank_id IN ({p_ph})', p_t)
        cur.execute(f'DELETE FROM {SCHEMA}.photo_bank WHERE id IN ({p_ph})', p_t)

    # Логи скачиваний по папке
    cur.execute(f'DELETE FROM {SCHEMA}.download_logs WHERE folder_id IN ({ph})', fids)

    # Короткие ссылки и всё, что от них зависит
    cur.execute(f'SELECT id, short_code FROM {SCHEMA}.folder_short_links WHERE folder_id IN ({ph})', fids)
    links = cur.fetchall()
    short_link_ids = [r['id'] for r in links]
    short_codes = [r['short_code'] for r in links if r['short_code']]

    # Клиенты галереи по short_code
    if short_codes:
        sc_ph = ','.join(['%s'] * len(short_codes))
        cur.execute(f'SELECT id FROM {SCHEMA}.favorite_clients WHERE gallery_code IN ({sc_ph})', tuple(short_codes))
        client_ids = [r['id'] for r in cur.fetchall()]
        if client_ids:
            c_ph = ','.join(['%s'] * len(client_ids))
            c_t = tuple(client_ids)
            cur.execute(f'DELETE FROM {SCHEMA}.client_messages WHERE client_id IN ({c_ph})', c_t)
            cur.execute(f'DELETE FROM {SCHEMA}.favorite_photos WHERE client_id IN ({c_ph})', c_t)
            cur.execute(f'''DELETE FROM {SCHEMA}.favorite_list_photos
                WHERE list_id IN (
                    SELECT id FROM {SCHEMA}.favorite_lists WHERE client_id IN ({c_ph})
                )''', c_t)
            cur.execute(f'DELETE FROM {SCHEMA}.favorite_lists WHERE client_id IN ({c_ph})', c_t)
            cur.execute(f'''DELETE FROM {SCHEMA}.client_upload_photos
                WHERE upload_folder_id IN (
                    SELECT id FROM {SCHEMA}.client_upload_folders WHERE client_id IN ({c_ph})
                )''', c_t)
            cur.execute(f'DELETE FROM {SCHEMA}.client_upload_folders WHERE client_id IN ({c_ph})', c_t)
            cur.execute(f'DELETE FROM {SCHEMA}.favorite_clients WHERE id IN ({c_ph})', c_t)

    # Зависимости от самих коротких ссылок
    if short_link_ids:
        sl_ph = ','.join(['%s'] * len(short_link_ids))
        sl_t = tuple(short_link_ids)
        cur.execute(f'''DELETE FROM {SCHEMA}.client_upload_photos
            WHERE upload_folder_id IN (
                SELECT id FROM {SCHEMA}.client_upload_folders WHERE short_link_id IN ({sl_ph})
            )''', sl_t)
        cur.execute(f'DELETE FROM {SCHEMA}.client_upload_folders WHERE short_link_id IN ({sl_ph})', sl_t)
        cur.execute(f'''DELETE FROM {SCHEMA}.favorite_list_photos
            WHERE list_id IN (
                SELECT id FROM {SCHEMA}.favorite_lists WHERE short_link_id IN ({sl_ph})
            )''', sl_t)
        cur.execute(f'DELETE FROM {SCHEMA}.favorite_lists WHERE short_link_id IN ({sl_ph})', sl_t)
        cur.execute(f'DELETE FROM {SCHEMA}.gallery_view_logs WHERE short_link_id IN ({sl_ph})', sl_t)

    cur.execute(f'DELETE FROM {SCHEMA}.folder_short_links WHERE folder_id IN ({ph})', fids)

    # Прямые зависимости от папок
    cur.execute(f'''DELETE FROM {SCHEMA}.client_upload_photos
        WHERE upload_folder_id IN (
            SELECT id FROM {SCHEMA}.client_upload_folders WHERE parent_folder_id IN ({ph})
        )''', fids)
    cur.execute(f'DELETE FROM {SCHEMA}.client_upload_folders WHERE parent_folder_id IN ({ph})', fids)
    cur.execute(f'''DELETE FROM {SCHEMA}.favorite_list_photos
        WHERE list_id IN (
            SELECT id FROM {SCHEMA}.favorite_lists WHERE parent_folder_id IN ({ph})
        )''', fids)
    cur.execute(f'DELETE FROM {SCHEMA}.favorite_lists WHERE parent_folder_id IN ({ph})', fids)

    cur.execute(f'DELETE FROM {SCHEMA}.photo_folders WHERE id IN ({ph})', fids)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
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
    
    if (event.get('queryStringParameters') or {}).get('action') == 'cron_cleanup':
        return _run_cron_cleanup(event)

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'User not authenticated'}),
            'isBase64Encoded': False
        }
    
    try:
        db_url = os.environ.get('DATABASE_URL')
        s3_key_id = os.environ.get('YC_S3_KEY_ID')
        s3_secret = os.environ.get('YC_S3_SECRET')
        bucket = 'foto-mix'
        
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            region_name='ru-central1',
            aws_access_key_id=s3_key_id,
            aws_secret_access_key=s3_secret,
            config=Config(signature_version='s3v4')
        )
        
        conn = psycopg2.connect(db_url)
        
        
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'list')
            
            if action == 'list':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT 
                            pf.id, 
                            pf.folder_name, 
                            pf.s3_prefix,
                            pf.trashed_at,
                            pf.trashed_at + INTERVAL '7 days' as auto_delete_date,
                            (SELECT COUNT(*) FROM t_p28211681_photo_secure_web.photo_bank pb
                             WHERE pb.folder_id = pf.id AND pb.is_trashed = TRUE) as photo_count
                        FROM t_p28211681_photo_secure_web.photo_folders pf
                        WHERE pf.user_id = %s AND pf.is_trashed = TRUE
                        ORDER BY pf.trashed_at DESC
                    ''', (user_id,))
                    folders = cur.fetchall()
                    
                    for folder in folders:
                        if folder['trashed_at']:
                            folder['trashed_at'] = folder['trashed_at'].isoformat()
                        if folder['auto_delete_date']:
                            folder['auto_delete_date'] = folder['auto_delete_date'].isoformat()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'trashed_folders': folders}),
                    'isBase64Encoded': False
                }
            
            elif action == 'list_photos':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT 
                            pb.id, 
                            pb.file_name, 
                            pb.s3_key,
                            pb.file_size, 
                            pb.width, 
                            pb.height, 
                            pb.trashed_at,
                            pb.trashed_at + INTERVAL '7 days' as auto_delete_date,
                            pf.folder_name
                        FROM t_p28211681_photo_secure_web.photo_bank pb
                        LEFT JOIN t_p28211681_photo_secure_web.photo_folders pf ON pb.folder_id = pf.id
                        WHERE pb.user_id = %s 
                          AND pb.is_trashed = TRUE
                          AND pf.is_trashed = FALSE
                        ORDER BY pb.trashed_at DESC
                    ''', (user_id,))
                    photos = cur.fetchall()
                    
                    result_photos = []
                    for photo in photos:
                        if photo['trashed_at']:
                            photo['trashed_at'] = photo['trashed_at'].isoformat()
                        if photo['auto_delete_date']:
                            photo['auto_delete_date'] = photo['auto_delete_date'].isoformat()
                        
                        if photo['s3_key']:
                            try:
                                trash_key = f'trash/{photo["s3_key"]}'
                                download_url = s3_client.generate_presigned_url(
                                    'get_object',
                                    Params={'Bucket': bucket, 'Key': trash_key},
                                    ExpiresIn=600
                                )
                                photo['s3_url'] = download_url
                            except Exception as e:
                                print(f'Failed to generate presigned URL for {photo["s3_key"]}: {e}')
                                photo['s3_url'] = None
                        
                        result_photos.append(photo)
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'trashed_photos': result_photos}),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'restore':
                folder_id = body_data.get('folder_id')
                
                if not folder_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT s3_prefix 
                        FROM t_p28211681_photo_secure_web.photo_folders 
                        WHERE id = %s AND user_id = %s AND is_trashed = TRUE
                    ''', (folder_id, user_id))
                    folder = cur.fetchone()
                    
                    if not folder:
                        return {
                            'statusCode': 404,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Trashed folder not found'}),
                            'isBase64Encoded': False
                        }
                    
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_folders
                        SET is_trashed = FALSE, trashed_at = NULL
                        WHERE id = %s
                    ''', (folder_id,))
                    
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_bank
                        SET is_trashed = FALSE, trashed_at = NULL
                        WHERE folder_id = %s
                    ''', (folder_id,))
                    
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.folder_short_links
                        SET is_blocked = FALSE, blocked_at = NULL
                        WHERE folder_id = %s
                    ''', (folder_id,))
                    
                    conn.commit()
                
                prefix = folder['s3_prefix']
                trash_prefix = f'trash/{prefix}'
                paginator = s3_client.get_paginator('list_objects_v2')
                pages = paginator.paginate(Bucket=bucket, Prefix=trash_prefix)
                
                restored_count = 0
                for page in pages:
                    for obj in page.get('Contents', []):
                        trash_key = obj['Key']
                        original_key = trash_key.replace('trash/', '', 1)
                        
                        try:
                            s3_client.copy_object(
                                Bucket=bucket,
                                CopySource={'Bucket': bucket, 'Key': trash_key},
                                Key=original_key
                            )
                            s3_client.delete_object(Bucket=bucket, Key=trash_key)
                            restored_count += 1
                        except Exception as e:
                            print(f'Failed to restore {trash_key}: {e}')
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'ok': True,
                        'restored_files': restored_count
                    }),
                    'isBase64Encoded': False
                }
            
            elif action == 'restore_photo':
                photo_id = body_data.get('photo_id')
                
                if not photo_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'photo_id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT s3_key
                        FROM t_p28211681_photo_secure_web.photo_bank
                        WHERE id = %s AND user_id = %s AND is_trashed = TRUE
                    ''', (photo_id, user_id))
                    photo = cur.fetchone()
                    
                    if not photo:
                        return {
                            'statusCode': 404,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Trashed photo not found'}),
                            'isBase64Encoded': False
                        }
                    
                    s3_key = photo['s3_key']
                    trash_key = f'trash/{s3_key}'
                    
                    try:
                        s3_client.copy_object(
                            Bucket=bucket,
                            CopySource={'Bucket': bucket, 'Key': trash_key},
                            Key=s3_key
                        )
                        s3_client.delete_object(Bucket=bucket, Key=trash_key)
                    except Exception as e:
                        print(f'Failed to restore photo: {e}')
                        return {
                            'statusCode': 500,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': f'Failed to restore photo: {str(e)}'}),
                            'isBase64Encoded': False
                        }
                    
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_bank
                        SET is_trashed = FALSE, trashed_at = NULL
                        WHERE id = %s
                    ''', (photo_id,))
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'delete_photo_forever':
                photo_id = body_data.get('photo_id')
                
                if not photo_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'photo_id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT s3_key
                        FROM t_p28211681_photo_secure_web.photo_bank
                        WHERE id = %s AND user_id = %s AND is_trashed = TRUE
                    ''', (photo_id, user_id))
                    photo = cur.fetchone()
                    
                    if not photo:
                        return {
                            'statusCode': 404,
                            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                            'body': json.dumps({'error': 'Trashed photo not found'}),
                            'isBase64Encoded': False
                        }
                    
                    s3_key = photo['s3_key']
                    trash_key = f'trash/{s3_key}'
                    
                    try:
                        s3_client.delete_object(Bucket=bucket, Key=trash_key)
                    except Exception as e:
                        print(f'Failed to delete photo from S3: {e}')
                    
                    cur.execute('''
                        DELETE FROM t_p28211681_photo_secure_web.photo_bank
                        WHERE id = %s
                    ''', (photo_id,))
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'ok': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'empty':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT id, s3_prefix 
                        FROM t_p28211681_photo_secure_web.photo_folders 
                        WHERE user_id = %s AND is_trashed = TRUE
                    ''', (user_id,))
                    folders = cur.fetchall()
                    
                    print(f'[EMPTY_TRASH] Found {len(folders)} trashed folders')
                    folder_ids = [f['id'] for f in folders]
                    
                    # 1. Собираем РЕАЛЬНЫЕ ключи файлов из БД ДО удаления записей
                    s3_keys = []
                    if folder_ids:
                        placeholders = ','.join(['%s'] * len(folder_ids))
                        cur.execute(f'''
                            SELECT s3_key, thumbnail_s3_key
                            FROM t_p28211681_photo_secure_web.photo_bank
                            WHERE folder_id IN ({placeholders})
                        ''', tuple(folder_ids))
                        for row in cur.fetchall():
                            if row['s3_key']:
                                s3_keys.append(row['s3_key'])
                            if row['thumbnail_s3_key']:
                                s3_keys.append(row['thumbnail_s3_key'])
                        print(f'[EMPTY_TRASH] Collected {len(s3_keys)} S3 keys to delete')
                    
                    # 2. Удаляем записи из БД (со всеми зависимостями)
                    if folder_ids:
                        print(f'[EMPTY_TRASH] Processing {len(folder_ids)} folders: {folder_ids}')
                        _purge_folders_forever(cur, folder_ids)
                        conn.commit()
                        print(f'[EMPTY_TRASH] Successfully deleted {len(folder_ids)} folders from DB')
                
                # 3. Удаляем сами файлы из S3 по реальным ключам
                deleted_count = 0
                poehali_client = boto3.client(
                    's3',
                    endpoint_url='https://bucket.poehali.dev',
                    aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
                    aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
                )
                for key in s3_keys:
                    # Определяем хранилище по префиксу ключа
                    if key.startswith('uploads/'):
                        storage_client = poehali_client
                        storage_bucket = 'files'
                    else:
                        storage_client = s3_client
                        storage_bucket = bucket
                    # Удаляем по реальному ключу
                    try:
                        storage_client.delete_object(Bucket=storage_bucket, Key=key)
                        deleted_count += 1
                    except Exception as e:
                        print(f'[EMPTY_TRASH] Failed to delete {key}: {e}')
                    # На случай если файл лежал в trash/ (удалён по одному ранее)
                    try:
                        storage_client.delete_object(Bucket=storage_bucket, Key=f'trash/{key}')
                    except Exception:
                        pass
                
                # 4. Подчищаем возможные остатки по trash-префиксу папок
                for folder in folders:
                    if folder.get('s3_prefix'):
                        for prefix in (folder['s3_prefix'], f'trash/{folder["s3_prefix"]}'):
                            try:
                                paginator = s3_client.get_paginator('list_objects_v2')
                                for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                                    for obj in page.get('Contents', []):
                                        try:
                                            s3_client.delete_object(Bucket=bucket, Key=obj['Key'])
                                            deleted_count += 1
                                        except Exception as e:
                                            print(f'[EMPTY_TRASH] Failed to delete {obj["Key"]}: {e}')
                            except Exception as e:
                                print(f'[EMPTY_TRASH] List error for {prefix}: {e}')
                
                print(f'[EMPTY_TRASH] S3 cleanup done: {deleted_count} files deleted from S3')
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'ok': True,
                        'deleted_files': deleted_count,
                        'deleted_folders': len(folders)
                    }),
                    'isBase64Encoded': False
                }
        
        elif method == 'DELETE':
            query_params = event.get('queryStringParameters', {})
            photo_id = query_params.get('photo_id')
            
            if not photo_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'photo_id required'}),
                    'isBase64Encoded': False
                }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
                    SELECT s3_key, folder_id
                    FROM photo_bank
                    WHERE id = %s AND user_id = %s
                ''', (photo_id, user_id))
                photo = cur.fetchone()
                
                if not photo:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Photo not found'}),
                        'isBase64Encoded': False
                    }
                
                s3_key = photo['s3_key']
                trash_key = f'trash/{s3_key}'
                
                try:
                    s3_client.copy_object(
                        Bucket=bucket,
                        CopySource={'Bucket': bucket, 'Key': s3_key},
                        Key=trash_key
                    )
                    s3_client.delete_object(Bucket=bucket, Key=s3_key)
                except Exception as e:
                    print(f'Failed to move to trash: {e}')
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': f'Failed to move to trash: {str(e)}'}),
                        'isBase64Encoded': False
                    }
                
                cur.execute('''
                    UPDATE photo_bank
                    SET is_trashed = TRUE, trashed_at = NOW()
                    WHERE id = %s
                ''', (photo_id,))
                conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'ok': True}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        error_msg = str(e)
        error_trace = traceback.format_exc()
        print(f'[ERROR] Method: {method}')
        print(f'[ERROR] User ID: {user_id}')
        print(f'[ERROR] Message: {error_msg}')
        print(f'[ERROR] Traceback:\n{error_trace}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': error_msg}),
            'isBase64Encoded': False
        }
    finally:
        if conn:
            conn.close()