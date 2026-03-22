'''Просмотр и управление фотобанком любого пользователя из админ-панели — папки, фото, удаление, загрузка файлов'''

import json
import os
import base64
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
}
SCHEMA = 't_p28211681_photo_secure_web'


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Admin-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters') or {}
    
    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        params = {**params, **body}
    
    action = params.get('action', 'folders')
    target_user_id = params.get('user_id')
    
    if not target_user_id:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'user_id is required'}),
            'isBase64Encoded': False
        }
    
    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)
    
    yc_s3_client = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )
    yc_bucket = 'foto-mix'
    
    try:
        if action == 'folders':
            return handle_list_folders(conn, target_user_id)
        
        elif action == 'photos':
            folder_id = params.get('folder_id')
            if not folder_id:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'folder_id is required'}),
                    'isBase64Encoded': False
                }
            return handle_list_photos(conn, target_user_id, folder_id, yc_s3_client, yc_bucket)
        
        elif action == 'delete_folder':
            folder_id = params.get('folder_id')
            if not folder_id:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'folder_id is required'}),
                    'isBase64Encoded': False
                }
            return handle_delete_folder(conn, target_user_id, int(folder_id), yc_s3_client, yc_bucket)
        
        elif action == 'delete_photos':
            photo_ids = params.get('photo_ids', [])
            if not photo_ids:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'photo_ids is required'}),
                    'isBase64Encoded': False
                }
            if isinstance(photo_ids, str):
                photo_ids = [int(x) for x in photo_ids.split(',')]
            return handle_delete_photos(conn, target_user_id, photo_ids, yc_s3_client, yc_bucket)
        
        elif action == 's3_move_photos':
            photo_ids = params.get('photo_ids', [])
            if isinstance(photo_ids, str):
                photo_ids = [int(x) for x in photo_ids.split(',')]
            return handle_s3_move_photos(conn, target_user_id, photo_ids, yc_s3_client, yc_bucket)
        
        elif action == 's3_browse':
            prefix = params.get('prefix', f'photobank/{target_user_id}/')
            return handle_s3_browse(yc_s3_client, yc_bucket, prefix)
        
        elif action == 's3_upload_init':
            s3_key = params.get('s3_key')
            content_type = params.get('content_type', 'application/octet-stream')
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 's3_key is required'}),
                    'isBase64Encoded': False
                }
            resp = yc_s3_client.create_multipart_upload(
                Bucket=yc_bucket, Key=s3_key, ContentType=content_type
            )
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'ok': True, 'upload_id': resp['UploadId'], 's3_key': s3_key}),
                'isBase64Encoded': False
            }
        
        elif action == 's3_upload_part':
            s3_key = params.get('s3_key')
            upload_id = params.get('upload_id')
            part_number = int(params.get('part_number', 0))
            chunk_data = params.get('chunk_data')
            if not all([s3_key, upload_id, part_number, chunk_data]):
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 's3_key, upload_id, part_number, chunk_data required'}),
                    'isBase64Encoded': False
                }
            raw = base64.b64decode(chunk_data)
            resp = yc_s3_client.upload_part(
                Bucket=yc_bucket, Key=s3_key, UploadId=upload_id,
                PartNumber=part_number, Body=raw
            )
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'ok': True, 'etag': resp['ETag'], 'part_number': part_number}),
                'isBase64Encoded': False
            }
        
        elif action == 's3_upload_complete':
            s3_key = params.get('s3_key')
            upload_id = params.get('upload_id')
            parts = params.get('parts', [])
            if not all([s3_key, upload_id, parts]):
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 's3_key, upload_id, parts required'}),
                    'isBase64Encoded': False
                }
            yc_s3_client.complete_multipart_upload(
                Bucket=yc_bucket, Key=s3_key, UploadId=upload_id,
                MultipartUpload={'Parts': [{'PartNumber': p['part_number'], 'ETag': p['etag']} for p in parts]}
            )
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'ok': True, 'key': s3_key}),
                'isBase64Encoded': False
            }
        
        elif action == 's3_delete':
            keys = params.get('keys', [])
            if isinstance(keys, str):
                keys = [keys]
            if not keys:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'keys is required'}),
                    'isBase64Encoded': False
                }
            deleted = []
            errors = []
            for key in keys:
                try:
                    yc_s3_client.delete_object(Bucket=yc_bucket, Key=key)
                    deleted.append(key)
                except Exception as e:
                    errors.append({'key': key, 'error': str(e)})
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'ok': True, 'deleted': deleted, 'errors': errors}),
                'isBase64Encoded': False
            }
        
        elif action == 's3_set_cors':
            yc_s3_client.put_bucket_cors(
                Bucket=yc_bucket,
                CORSConfiguration={
                    'CORSRules': [{
                        'AllowedOrigins': ['*'],
                        'AllowedMethods': ['GET', 'PUT', 'POST', 'HEAD'],
                        'AllowedHeaders': ['*'],
                        'ExposeHeaders': ['ETag', 'Content-Length'],
                        'MaxAgeSeconds': 86400
                    }]
                }
            )
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'ok': True, 'message': 'CORS configured'}),
                'isBase64Encoded': False
            }
        
        elif action == 's3_presign':
            s3_key = params.get('key')
            if not s3_key:
                return {
                    'statusCode': 400,
                    'headers': CORS_HEADERS,
                    'body': json.dumps({'error': 'key is required'}),
                    'isBase64Encoded': False
                }
            url = yc_s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': yc_bucket, 'Key': s3_key},
                ExpiresIn=3600
            )
            return {
                'statusCode': 200,
                'headers': CORS_HEADERS,
                'body': json.dumps({'url': url, 'key': s3_key}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'Unknown action: {action}'}),
            'isBase64Encoded': False
        }
    
    finally:
        conn.close()


def handle_list_folders(conn, target_user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'''
            SELECT 
                pf.id,
                pf.folder_name,
                pf.s3_prefix,
                pf.folder_type,
                pf.parent_folder_id,
                pf.created_at,
                pf.updated_at,
                pf.archive_download_count,
                COALESCE(pf.is_hidden, FALSE) as is_hidden,
                CASE WHEN pf.password_hash IS NOT NULL THEN TRUE ELSE FALSE END as has_password,
                COALESCE(pf.sort_order, 0) as sort_order,
                (SELECT COUNT(*) FROM {SCHEMA}.photo_bank 
                 WHERE folder_id = pf.id AND is_trashed = FALSE) as photo_count
            FROM {SCHEMA}.photo_folders pf
            WHERE pf.user_id = %s AND pf.is_trashed = FALSE
            ORDER BY pf.parent_folder_id NULLS FIRST, pf.sort_order ASC, pf.created_at DESC
        ''', (target_user_id,))
        folders = cur.fetchall()
        
        for folder in folders:
            if folder['created_at']:
                folder['created_at'] = folder['created_at'].isoformat()
            if folder['updated_at']:
                folder['updated_at'] = folder['updated_at'].isoformat()
    
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'folders': folders}),
        'isBase64Encoded': False
    }


def handle_list_photos(conn, target_user_id, folder_id, yc_s3_client, yc_bucket):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'''
            SELECT 
                pb.id,
                pb.file_name,
                pb.s3_key,
                pb.s3_url,
                pb.thumbnail_s3_key,
                pb.thumbnail_s3_url,
                pb.is_raw,
                pb.is_video,
                pb.content_type,
                pb.file_size,
                pb.width,
                pb.height,
                pb.tech_reject_reason,
                pb.tech_analyzed,
                pb.created_at,
                COALESCE(
                    (SELECT COUNT(*) 
                     FROM {SCHEMA}.download_logs dl 
                     WHERE dl.photo_id = pb.id AND dl.download_type = 'photo'),
                    0
                ) as photo_download_count
            FROM {SCHEMA}.photo_bank pb
            WHERE pb.folder_id = %s 
              AND pb.user_id = %s 
              AND pb.is_trashed = FALSE
            ORDER BY pb.created_at DESC
        ''', (folder_id, target_user_id))
        photos = cur.fetchall()
        
        for photo in photos:
            if photo['created_at']:
                photo['created_at'] = photo['created_at'].isoformat()
            
            if photo.get('s3_url') and 'cdn.poehali.dev' in photo['s3_url']:
                pass
            elif photo.get('s3_key'):
                try:
                    photo['s3_url'] = yc_s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': yc_bucket, 'Key': photo['s3_key']},
                        ExpiresIn=3600
                    )
                except Exception as e:
                    print(f'Failed to generate presigned URL for {photo["s3_key"]}: {e}')
                    photo['s3_url'] = None
            else:
                photo['s3_url'] = None
            
            if photo.get('thumbnail_s3_url') and 'cdn.poehali.dev' in photo['thumbnail_s3_url']:
                pass
            elif photo.get('thumbnail_s3_key'):
                try:
                    photo['thumbnail_s3_url'] = yc_s3_client.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': yc_bucket, 'Key': photo['thumbnail_s3_key']},
                        ExpiresIn=3600
                    )
                except Exception as e:
                    print(f'Failed to generate thumbnail URL: {e}')
                    photo['thumbnail_s3_url'] = None
            else:
                photo['thumbnail_s3_url'] = photo.get('thumbnail_s3_url')
    
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'photos': photos}),
        'isBase64Encoded': False
    }


def handle_delete_folder(conn, target_user_id, folder_id, yc_s3_client, yc_bucket):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f'''
            SELECT id, s3_prefix, folder_name
            FROM {SCHEMA}.photo_folders
            WHERE id = %s AND user_id = %s AND is_trashed = FALSE
        ''', (folder_id, target_user_id))
        folder = cur.fetchone()
        
        if not folder:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Folder not found'}),
                'isBase64Encoded': False
            }
        
        cur.execute(f'''
            SELECT id FROM {SCHEMA}.photo_folders
            WHERE parent_folder_id = %s AND is_trashed = FALSE
        ''', (folder_id,))
        child_folders = cur.fetchall()
        child_folder_ids = [f['id'] for f in child_folders]
        
        all_folder_ids = [folder_id] + child_folder_ids
        ids_str = ','.join(map(str, all_folder_ids))
        
        cur.execute(f'''
            UPDATE {SCHEMA}.photo_folders
            SET is_trashed = TRUE, trashed_at = NOW()
            WHERE id IN ({ids_str})
        ''')
        
        cur.execute(f'''
            UPDATE {SCHEMA}.photo_bank
            SET is_trashed = TRUE, trashed_at = NOW()
            WHERE folder_id IN ({ids_str}) AND is_trashed = FALSE
        ''')
        
        cur.execute(f'''
            UPDATE {SCHEMA}.folder_short_links
            SET is_blocked = TRUE, blocked_at = NOW()
            WHERE folder_id IN ({ids_str})
        ''')
        
        conn.commit()
    
    moved_count = 0
    prefixes_to_move = [folder['s3_prefix']] if folder['s3_prefix'] else []
    
    if child_folder_ids:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT s3_prefix FROM {SCHEMA}.photo_folders
                WHERE id IN ({','.join(map(str, child_folder_ids))})
            ''')
            for row in cur.fetchall():
                if row['s3_prefix']:
                    prefixes_to_move.append(row['s3_prefix'])
    
    for prefix in prefixes_to_move:
        try:
            paginator = yc_s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=yc_bucket, Prefix=prefix)
            for page in pages:
                for obj in page.get('Contents', []):
                    src_key = obj['Key']
                    dst_key = f'trash/{src_key}'
                    try:
                        yc_s3_client.copy_object(
                            Bucket=yc_bucket,
                            CopySource={'Bucket': yc_bucket, 'Key': src_key},
                            Key=dst_key
                        )
                        yc_s3_client.delete_object(Bucket=yc_bucket, Key=src_key)
                        moved_count += 1
                    except Exception as e:
                        print(f'Failed to move {src_key} to trash: {e}')
        except Exception as e:
            print(f'Failed to list objects for prefix {prefix}: {e}')
    
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'ok': True,
            'folder_name': folder['folder_name'],
            'moved_files': moved_count
        }),
        'isBase64Encoded': False
    }


def handle_delete_photos(conn, target_user_id, photo_ids, yc_s3_client, yc_bucket):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        ids_str = ','.join(map(str, photo_ids))
        cur.execute(f'''
            SELECT id, s3_key, thumbnail_s3_key, file_name
            FROM {SCHEMA}.photo_bank
            WHERE id IN ({ids_str}) AND user_id = %s AND is_trashed = FALSE
        ''', (target_user_id,))
        photos = cur.fetchall()
        
        if not photos:
            return {
                'statusCode': 404,
                'headers': CORS_HEADERS,
                'body': json.dumps({'error': 'Photos not found'}),
                'isBase64Encoded': False
            }
        
        found_ids = [p['id'] for p in photos]
        found_str = ','.join(map(str, found_ids))
        
        cur.execute(f'''
            UPDATE {SCHEMA}.photo_bank
            SET is_trashed = TRUE, trashed_at = NOW()
            WHERE id IN ({found_str})
        ''')
        conn.commit()
    
    moved_count = 0
    for photo in photos:
        for key_field in ['s3_key', 'thumbnail_s3_key']:
            s3_key = photo.get(key_field)
            if not s3_key:
                continue
            dst_key = f'trash/{s3_key}'
            try:
                yc_s3_client.copy_object(
                    Bucket=yc_bucket,
                    CopySource={'Bucket': yc_bucket, 'Key': s3_key},
                    Key=dst_key
                )
                yc_s3_client.delete_object(Bucket=yc_bucket, Key=s3_key)
                moved_count += 1
            except Exception as e:
                print(f'Failed to move {s3_key} to trash: {e}')
    
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'ok': True,
            'deleted_count': len(photos),
            'moved_files': moved_count
        }),
        'isBase64Encoded': False
    }


def handle_s3_browse(yc_s3_client, yc_bucket, prefix):
    folders = []
    files = []
    
    try:
        response = yc_s3_client.list_objects_v2(
            Bucket=yc_bucket,
            Prefix=prefix,
            Delimiter='/'
        )
        
        for cp in response.get('CommonPrefixes', []):
            folder_prefix = cp['Prefix']
            folder_name = folder_prefix[len(prefix):].rstrip('/')
            if folder_name:
                folders.append({
                    'name': folder_name,
                    'prefix': folder_prefix
                })
        
        for obj in response.get('Contents', []):
            key = obj['Key']
            if key == prefix:
                continue
            file_name = key[len(prefix):]
            if not file_name:
                continue
            files.append({
                'name': file_name,
                'key': key,
                'size': obj['Size'],
                'last_modified': obj['LastModified'].isoformat(),
                'storage_class': obj.get('StorageClass', 'STANDARD')
            })
        
        while response.get('IsTruncated'):
            response = yc_s3_client.list_objects_v2(
                Bucket=yc_bucket,
                Prefix=prefix,
                Delimiter='/',
                ContinuationToken=response['NextContinuationToken']
            )
            for cp in response.get('CommonPrefixes', []):
                folder_prefix = cp['Prefix']
                folder_name = folder_prefix[len(prefix):].rstrip('/')
                if folder_name:
                    folders.append({
                        'name': folder_name,
                        'prefix': folder_prefix
                    })
            for obj in response.get('Contents', []):
                key = obj['Key']
                if key == prefix:
                    continue
                file_name = key[len(prefix):]
                if not file_name:
                    continue
                files.append({
                    'name': file_name,
                    'key': key,
                    'size': obj['Size'],
                    'last_modified': obj['LastModified'].isoformat(),
                    'storage_class': obj.get('StorageClass', 'STANDARD')
                })
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': f'S3 error: {str(e)}'}),
            'isBase64Encoded': False
        }
    
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({
            'prefix': prefix,
            'bucket': yc_bucket,
            'folders': folders,
            'files': files
        }),
        'isBase64Encoded': False
    }


def handle_s3_move_photos(conn, target_user_id, photo_ids, s3_client, bucket):
    import uuid
    if not photo_ids:
        return {
            'statusCode': 400,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'photo_ids required'}),
            'isBase64Encoded': False
        }
    
    moved = []
    errors = []
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        for photo_id in photo_ids:
            cur.execute(f'''
                SELECT pb.id, pb.s3_key, pb.file_name, pb.folder_id, pf.s3_prefix
                FROM {SCHEMA}.photo_bank pb
                JOIN {SCHEMA}.photo_folders pf ON pf.id = pb.folder_id
                WHERE pb.id = %s AND pb.user_id = %s
            ''', (photo_id, target_user_id))
            row = cur.fetchone()
            
            if not row:
                errors.append({'photo_id': photo_id, 'error': 'not found'})
                continue
            
            old_key = row['s3_key']
            folder_prefix = row['s3_prefix']
            
            if old_key.startswith(folder_prefix):
                moved.append({'photo_id': photo_id, 'status': 'already_correct'})
                continue
            
            ext = row['file_name'].split('.')[-1] if '.' in row['file_name'] else 'bin'
            new_key = f'{folder_prefix}{uuid.uuid4()}.{ext}'
            
            try:
                s3_client.copy_object(
                    Bucket=bucket,
                    CopySource={'Bucket': bucket, 'Key': old_key},
                    Key=new_key,
                    MetadataDirective='COPY'
                )
                s3_client.delete_object(Bucket=bucket, Key=old_key)
                
                new_url = f'https://storage.yandexcloud.net/{bucket}/{new_key}'
                cur.execute(f'''
                    UPDATE {SCHEMA}.photo_bank 
                    SET s3_key = %s, s3_url = %s 
                    WHERE id = %s
                ''', (new_key, new_url, photo_id))
                conn.commit()
                
                moved.append({'photo_id': photo_id, 'old_key': old_key, 'new_key': new_key})
            except Exception as e:
                errors.append({'photo_id': photo_id, 'error': str(e)})
    
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps({'moved': moved, 'errors': errors}),
        'isBase64Encoded': False
    }