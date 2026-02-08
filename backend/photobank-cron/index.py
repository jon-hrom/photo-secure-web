'''
Business: Cron задача для автоудаления файлов из корзины старше 7 дней
Args: event with httpMethod, headers (X-Cron-Token for security)
Returns: HTTP response with cleanup status
'''

import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config

SCHEMA = 't_p28211681_photo_secure_web'

def list_trash_folders(event: Dict[str, Any]) -> Dict[str, Any]:
    db_url = os.environ.get('DATABASE_URL')
    
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
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT 
                    pf.id,
                    pf.user_id,
                    pf.folder_name,
                    pf.s3_prefix,
                    pf.trashed_at,
                    COALESCE(
                        (SELECT COUNT(*) FROM {SCHEMA}.photo_bank pb
                         WHERE pb.folder_id = pf.id AND pb.is_trashed = TRUE), 
                        0
                    ) as photos_count,
                    COALESCE(
                        (SELECT SUM(pb.file_size) FROM {SCHEMA}.photo_bank pb
                         WHERE pb.folder_id = pf.id AND pb.is_trashed = TRUE), 
                        0
                    ) as total_size_bytes
                FROM {SCHEMA}.photo_folders pf
                WHERE pf.is_trashed = TRUE
                ORDER BY pf.trashed_at DESC
            ''')
            folders = cur.fetchall()
            
            result_folders = []
            for folder in folders:
                result_folders.append({
                    'id': folder['id'],
                    'user_id': folder['user_id'],
                    'folder_name': folder['folder_name'],
                    's3_prefix': folder['s3_prefix'],
                    'trashed_at': folder['trashed_at'].isoformat() if folder['trashed_at'] else None,
                    'photos_count': folder['photos_count'],
                    'total_size_mb': round(folder['total_size_bytes'] / 1024 / 1024, 2)
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'folders': result_folders}),
                'isBase64Encoded': False
            }
    finally:
        conn.close()

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Cron-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', '')
    
    if method == 'GET' and action == 'list-trash':
        return list_trash_folders(event)
    
    headers = event.get('headers', {})
    cron_token = headers.get('X-Cron-Token') or headers.get('x-cron-token')
    expected_token = os.environ.get('CRON_TOKEN', 'secure-cron-token-change-me')
    
    if cron_token != expected_token:
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Forbidden: Invalid cron token'}),
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
        cutoff_date = datetime.now() - timedelta(days=7)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('''
                SELECT id, s3_prefix, user_id, folder_name, trashed_at
                FROM photo_folders 
                WHERE is_trashed = TRUE 
                  AND trashed_at < %s
                ORDER BY trashed_at ASC
                LIMIT 100
            ''', (cutoff_date,))
            folders_to_delete = cur.fetchall()
        
        deleted_folders = 0
        deleted_files = 0
        errors = []
        
        for folder in folders_to_delete:
            folder_id = folder['id']
            s3_prefix = folder['s3_prefix']
            trash_prefix = f'trash/{s3_prefix}'
            
            try:
                paginator = s3_client.get_paginator('list_objects_v2')
                pages = paginator.paginate(Bucket=bucket, Prefix=trash_prefix)
                
                file_count = 0
                for page in pages:
                    for obj in page.get('Contents', []):
                        try:
                            s3_client.delete_object(Bucket=bucket, Key=obj['Key'])
                            file_count += 1
                        except Exception as e:
                            errors.append(f'Failed to delete S3 object {obj["Key"]}: {str(e)}')
                
                with conn.cursor() as cur:
                    cur.execute('''
                        DELETE FROM photo_bank 
                        WHERE folder_id = %s AND is_trashed = TRUE
                    ''', (folder_id,))
                    
                    cur.execute('''
                        DELETE FROM photo_folders 
                        WHERE id = %s AND is_trashed = TRUE
                    ''', (folder_id,))
                    
                    conn.commit()
                
                deleted_folders += 1
                deleted_files += file_count
                
                print(f'[CLEANUP] Deleted folder {folder_id} ({folder["folder_name"]}) '
                      f'with {file_count} files (trashed at {folder["trashed_at"]})')
            
            except Exception as e:
                errors.append(f'Failed to cleanup folder {folder_id}: {str(e)}')
                print(f'[ERROR] Cleanup failed for folder {folder_id}: {e}')
        
        result = {
            'ok': True,
            'deleted_folders': deleted_folders,
            'deleted_files': deleted_files,
            'cutoff_date': cutoff_date.isoformat(),
            'processed_at': datetime.now().isoformat()
        }
        
        if errors:
            result['errors'] = errors[:10]
            result['error_count'] = len(errors)
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(result),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'[ERROR] Cron task failed: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'ok': False,
                'error': str(e)
            }),
            'isBase64Encoded': False
        }
    finally:
        if conn:
            conn.close()