'''
Business: Управление корзиной фотобанка - восстановление и очистка
Args: event with httpMethod, body, queryStringParameters, headers (X-User-Id)
Returns: HTTP response with trash operations status
'''

import json
import os
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
        aws_access_key_id=s3_key_id,
        aws_secret_access_key=s3_secret,
        region_name='ru-central1',
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
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'list')
            
            if action == 'list':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT 
                            id, 
                            folder_name, 
                            s3_prefix,
                            trashed_at,
                            (SELECT COUNT(*) FROM photo_bank 
                             WHERE folder_id = photo_folders.id AND is_trashed = TRUE) as photo_count
                        FROM photo_folders
                        WHERE user_id = %s AND is_trashed = TRUE
                        ORDER BY trashed_at DESC
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
                        FROM photo_folders 
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
                        UPDATE photo_folders
                        SET is_trashed = FALSE, trashed_at = NULL
                        WHERE id = %s
                    ''', (folder_id,))
                    
                    cur.execute('''
                        UPDATE photo_bank
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
            
            elif action == 'empty':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT id, s3_prefix 
                        FROM photo_folders 
                        WHERE user_id = %s AND is_trashed = TRUE
                    ''', (user_id,))
                    folders = cur.fetchall()
                    
                    folder_ids = [f['id'] for f in folders]
                    
                    if folder_ids:
                        cur.execute('''
                            DELETE FROM photo_bank 
                            WHERE folder_id = ANY(%s) AND is_trashed = TRUE
                        ''', (folder_ids,))
                        
                        cur.execute('''
                            DELETE FROM photo_folders 
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
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'[ERROR] {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        if conn:
            conn.close()
