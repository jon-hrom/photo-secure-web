'''
Business: Управление корзиной фотобанка - восстановление и очистка
Args: event with httpMethod, body, queryStringParameters, headers (X-User-Id)
Returns: HTTP response with trash operations status
'''

import json
import os
import traceback
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

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
    
    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'User not authenticated'}),
            'isBase64Encoded': False
        }
    
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
    
    try:
        conn = psycopg2.connect(db_url)
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Database connection failed: {str(e)}'}),
            'isBase64Encoded': False
        }
    
    try:
        # Auto-cleanup: delete trashed items older than 7 days
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Clean up expired folders first (including their photos)
                cur.execute('''
                    SELECT id, s3_prefix
                    FROM t_p28211681_photo_secure_web.photo_folders
                    WHERE is_trashed = TRUE 
                      AND trashed_at < NOW() - INTERVAL '7 days'
                ''')
                expired_folders = cur.fetchall()
                
                for folder in expired_folders:
                    if folder['s3_prefix']:
                        trash_prefix = f'trash/{folder["s3_prefix"]}'
                        paginator = s3_client.get_paginator('list_objects_v2')
                        pages = paginator.paginate(Bucket=bucket, Prefix=trash_prefix)
                        
                        for page in pages:
                            for obj in page.get('Contents', []):
                                try:
                                    s3_client.delete_object(Bucket=bucket, Key=obj['Key'])
                                except Exception as e:
                                    print(f'Failed to delete {obj["Key"]} from S3: {e}')
                
                if expired_folders:
                    expired_folder_ids = [f['id'] for f in expired_folders]
                    # Delete all trashed photos from these folders first
                    cur.execute(f'''
                        DELETE FROM t_p28211681_photo_secure_web.photo_bank 
                        WHERE folder_id IN ({','.join(map(str, expired_folder_ids))})
                          AND is_trashed = TRUE
                    ''')
                    # Then delete folders
                    cur.execute(f'''
                        DELETE FROM t_p28211681_photo_secure_web.photo_folders 
                        WHERE id IN ({','.join(map(str, expired_folder_ids))})
                    ''')
                    conn.commit()
                    print(f'Auto-deleted {len(expired_folders)} expired folders from trash')
                
                # Clean up expired standalone photos (not in trashed folders)
                cur.execute('''
                    SELECT pb.id, pb.s3_key, pb.folder_id
                    FROM t_p28211681_photo_secure_web.photo_bank pb
                    LEFT JOIN t_p28211681_photo_secure_web.photo_folders pf ON pb.folder_id = pf.id
                    WHERE pb.is_trashed = TRUE 
                      AND pb.trashed_at < NOW() - INTERVAL '7 days'
                      AND (pf.is_trashed = FALSE OR pf.is_trashed IS NULL)
                ''')
                expired_photos = cur.fetchall()
                
                for photo in expired_photos:
                    if photo['s3_key']:
                        trash_key = f'trash/{photo["s3_key"]}'
                        try:
                            s3_client.delete_object(Bucket=bucket, Key=trash_key)
                        except Exception as e:
                            print(f'Failed to delete {trash_key} from S3: {e}')
                
                if expired_photos:
                    expired_ids = [p['id'] for p in expired_photos]
                    cur.execute(f'''
                        DELETE FROM t_p28211681_photo_secure_web.photo_bank 
                        WHERE id IN ({','.join(map(str, expired_ids))})
                    ''')
                    conn.commit()
                    print(f'Auto-deleted {len(expired_photos)} expired standalone photos from trash')
        except Exception as cleanup_error:
            print(f'Auto-cleanup failed (non-critical): {cleanup_error}')
            import traceback
            print(f'Traceback: {traceback.format_exc()}')
            # Don't fail the request if cleanup fails
        
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
                    
                    folder_ids = [f['id'] for f in folders]
                    
                    if folder_ids:
                        # Сначала удаляем ВСЕ фото из удалённых папок (включая неудалённые фото)
                        cur.execute('''
                            DELETE FROM t_p28211681_photo_secure_web.photo_bank 
                            WHERE folder_id = ANY(%s)
                        ''', (folder_ids,))
                        
                        # Теперь можно безопасно удалить папки
                        cur.execute('''
                            DELETE FROM t_p28211681_photo_secure_web.photo_folders 
                            WHERE id = ANY(%s) AND is_trashed = TRUE
                        ''', (folder_ids,))
                        
                        conn.commit()
                
                deleted_count = 0
                for folder in folders:
                    trash_prefix = f'trash/{folder["s3_prefix"]}'
                    paginator = s3_client.get_paginator('list_objects_v2')
                    pages = paginator.paginate(Bucket=bucket, Prefix=trash_prefix)
                    
                    for page in pages:
                        for obj in page.get('Contents', []):
                            try:
                                s3_client.delete_object(Bucket=bucket, Key=obj['Key'])
                                deleted_count += 1
                            except Exception as e:
                                print(f'Failed to delete {obj["Key"]}: {e}')
                
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