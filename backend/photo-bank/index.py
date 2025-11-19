import json
import os
import base64
from datetime import datetime
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Управление фото-банком пользователя с хранилищем в PostgreSQL (bytea)
    Args: event - dict with httpMethod, body, headers (X-User-Id)
    Returns: HTTP response dict with photos/folders data and base64 data URLs
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
            'body': json.dumps({'error': 'User not authenticated'}),
            'isBase64Encoded': False
        }
    
    db_url = os.environ.get('DATABASE_URL')
    
    try:
        conn = psycopg2.connect(db_url)
    except Exception as e:
        print(f'[ERROR] DB connection failed: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Database connection failed: {str(e)}'}),
            'isBase64Encoded': False
        }
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT email_verified_at FROM users WHERE id = %s', (user_id,))
            user_check = cur.fetchone()
            if not user_check or not user_check['email_verified_at']:
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Email not verified', 'requireEmailVerification': True}),
                    'isBase64Encoded': False
                }
        
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'list_folders')
            
            if action == 'list_folders':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT id, folder_name, created_at, updated_at,
                               (SELECT COUNT(*) FROM photo_bank WHERE folder_id = photo_folders.id) as photo_count
                        FROM photo_folders
                        WHERE user_id = %s
                        ORDER BY created_at DESC
                    ''', (user_id,))
                    folders = cur.fetchall()
                    
                    for folder in folders:
                        if folder['created_at']:
                            folder['created_at'] = folder['created_at'].isoformat()
                        if folder['updated_at']:
                            folder['updated_at'] = folder['updated_at'].isoformat()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'folders': folders}),
                    'isBase64Encoded': False
                }
            
            elif action == 'list_photos':
                folder_id = event.get('queryStringParameters', {}).get('folder_id')
                if not folder_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        SELECT id, file_name, file_data, file_size, width, height, created_at
                        FROM photo_bank
                        WHERE folder_id = %s AND user_id = %s
                        ORDER BY created_at DESC
                    ''', (folder_id, user_id))
                    photos = cur.fetchall()
                    
                    for photo in photos:
                        if photo['created_at']:
                            photo['created_at'] = photo['created_at'].isoformat()
                        # Convert binary data to data URL
                        if photo.get('file_data'):
                            photo['data_url'] = f'data:image/jpeg;base64,{base64.b64encode(photo["file_data"]).decode()}'
                            del photo['file_data']  # Don't send raw binary in JSON
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'photos': photos}),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'create_folder':
                folder_name = body_data.get('folder_name')
                if not folder_name:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_name required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute('''
                        INSERT INTO photo_folders (user_id, folder_name)
                        VALUES (%s, %s)
                        RETURNING id, folder_name, created_at
                    ''', (user_id, folder_name))
                    conn.commit()
                    folder = cur.fetchone()
                    
                    if folder and folder['created_at']:
                        folder['created_at'] = folder['created_at'].isoformat()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'folder': folder}),
                    'isBase64Encoded': False
                }
            
            elif action == 'upload_photo':
                folder_id = body_data.get('folder_id')
                file_name = body_data.get('file_name')
                file_data = body_data.get('file_data')
                width = body_data.get('width')
                height = body_data.get('height')
                
                print(f'[UPLOAD] folder_id={folder_id}, file_name={file_name}, user_id={user_id}')
                
                if not all([folder_id, file_name, file_data]):
                    print(f'[ERROR] Missing required fields')
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id, file_name, and file_data required'}),
                        'isBase64Encoded': False
                    }
                
                try:
                    file_bytes = base64.b64decode(file_data)
                except Exception as e:
                    print(f'[ERROR] Base64 decode failed: {e}')
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': f'Invalid base64 data: {str(e)}'}),
                        'isBase64Encoded': False
                    }
                file_size = len(file_bytes)
                print(f'[UPLOAD] Decoded file size: {file_size} bytes')
                
                # Store directly in database (much faster than slow REG.Cloud S3)
                print(f'[DB] Saving file to database, size={file_size} bytes')
                upload_start = datetime.now()
                
                try:
                    with conn.cursor(cursor_factory=RealDictCursor) as cur:
                        cur.execute('''
                            INSERT INTO photo_bank (folder_id, user_id, file_name, file_data, file_size, width, height)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            RETURNING id, file_name, file_size, created_at
                        ''', (folder_id, user_id, file_name, psycopg2.Binary(file_bytes), file_size, width, height))
                        conn.commit()
                        photo = cur.fetchone()
                        
                        if photo and photo['created_at']:
                            photo['created_at'] = photo['created_at'].isoformat()
                    
                    upload_time = (datetime.now() - upload_start).total_seconds()
                    print(f'[DB] Photo saved with id={photo["id"]} in {upload_time:.3f}s')
                    
                    # Return photo with data URL for immediate display
                    photo['data_url'] = f'data:image/jpeg;base64,{file_data}'
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'photo': photo}),
                        'isBase64Encoded': False
                    }
                except Exception as e:
                    print(f'[ERROR] DB insert failed: {e}')
                    conn.rollback()
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': f'Database error: {str(e)}'}),
                        'isBase64Encoded': False
                    }
        
        elif method == 'DELETE':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'delete_photo':
                photo_id = body_data.get('photo_id')
                if not photo_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'photo_id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Data stored in DB, no S3 cleanup needed
                    cur.execute('DELETE FROM photo_bank WHERE id = %s AND user_id = %s', (photo_id, user_id))
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'delete_folder':
                folder_id = body_data.get('folder_id')
                if not folder_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'folder_id required'}),
                        'isBase64Encoded': False
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Data stored in DB, no S3 cleanup needed
                    cur.execute('DELETE FROM photo_bank WHERE folder_id = %s AND user_id = %s', (folder_id, user_id))
                    cur.execute('DELETE FROM photo_folders WHERE id = %s AND user_id = %s', (folder_id, user_id))
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
            
            elif action == 'clear_all':
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Data stored in DB, no S3 cleanup needed
                    cur.execute('DELETE FROM photo_bank WHERE user_id = %s', (user_id,))
                    cur.execute('DELETE FROM photo_folders WHERE user_id = %s', (user_id,))
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
    except Exception as e:
        print(f'[ERROR] Unexpected error: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()