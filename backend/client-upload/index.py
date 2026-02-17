import json
import os
import psycopg2
import boto3
import base64
import uuid
from datetime import datetime

SCHEMA = 't_p28211681_photo_secure_web'

def handler(event: dict, context) -> dict:
    """API для загрузки фото клиентом через общую ссылку на галерею"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return error_response(500, 'Database not configured')
    
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    try:
        if method == 'POST':
            data = json.loads(event.get('body', '{}'))
            action = data.get('action', 'upload')
            
            if action == 'create_folder':
                return create_client_folder(cur, conn, data)
            elif action == 'upload_photo':
                return upload_client_photo(cur, conn, data)
            elif action == 'list_folders':
                return list_client_folders(cur, conn, data)
            else:
                return error_response(400, 'Unknown action')
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            action = params.get('action', 'list_folders')
            short_code = params.get('code')
            
            if not short_code:
                return error_response(400, 'code required')
            
            link = get_link_with_upload_check(cur, short_code)
            if not link:
                return error_response(404, 'Gallery not found or upload disabled')
            
            link_id, folder_id = link
            
            cur.execute(
                f"""
                SELECT id, folder_name, client_name, photo_count, created_at
                FROM {SCHEMA}.client_upload_folders
                WHERE parent_folder_id = %s AND short_link_id = %s
                ORDER BY created_at DESC
                """,
                (folder_id, link_id)
            )
            folders = []
            for row in cur.fetchall():
                folders.append({
                    'id': row[0],
                    'folder_name': row[1],
                    'client_name': row[2],
                    'photo_count': row[3],
                    'created_at': row[4].isoformat() if row[4] else None
                })
            
            cur.close()
            conn.close()
            return success_response({'folders': folders})
        
        else:
            cur.close()
            conn.close()
            return error_response(405, 'Method not allowed')
    
    except Exception as e:
        try:
            cur.close()
            conn.close()
        except:
            pass
        return error_response(500, str(e))


def get_link_with_upload_check(cur, short_code):
    cur.execute(
        f"""
        SELECT fsl.id, fsl.folder_id
        FROM {SCHEMA}.folder_short_links fsl
        WHERE fsl.short_code = %s AND COALESCE(fsl.client_upload_enabled, FALSE) = TRUE
          AND COALESCE(fsl.is_blocked, FALSE) = FALSE
          AND (fsl.expires_at IS NULL OR fsl.expires_at > NOW())
        """,
        (short_code,)
    )
    return cur.fetchone()


def create_client_folder(cur, conn, data):
    short_code = data.get('short_code')
    folder_name = data.get('folder_name', '').strip()
    client_name = data.get('client_name', '').strip()
    
    if not short_code or not folder_name:
        return error_response(400, 'short_code and folder_name required')
    
    link = get_link_with_upload_check(cur, short_code)
    if not link:
        return error_response(403, 'Upload not allowed')
    
    link_id, parent_folder_id = link
    
    cur.execute(
        f"SELECT user_id FROM {SCHEMA}.photo_folders WHERE id = %s",
        (parent_folder_id,)
    )
    folder_row = cur.fetchone()
    if not folder_row:
        return error_response(404, 'Parent folder not found')
    
    user_id = folder_row[0]
    s3_prefix = f"client-uploads/{user_id}/{parent_folder_id}/{uuid.uuid4().hex}/"
    
    cur.execute(
        f"""
        INSERT INTO {SCHEMA}.client_upload_folders
        (parent_folder_id, short_link_id, folder_name, client_name, s3_prefix)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        (parent_folder_id, link_id, folder_name, client_name or None, s3_prefix)
    )
    folder_id = cur.fetchone()[0]
    conn.commit()
    
    cur.close()
    conn.close()
    
    return success_response({
        'folder_id': folder_id,
        'folder_name': folder_name,
        's3_prefix': s3_prefix
    })


def upload_client_photo(cur, conn, data):
    short_code = data.get('short_code')
    upload_folder_id = data.get('upload_folder_id')
    file_name = data.get('file_name', '')
    file_data = data.get('file_data')
    content_type = data.get('content_type', 'image/jpeg')
    
    if not short_code or not upload_folder_id or not file_data:
        return error_response(400, 'short_code, upload_folder_id and file_data required')
    
    link = get_link_with_upload_check(cur, short_code)
    if not link:
        return error_response(403, 'Upload not allowed')
    
    link_id, parent_folder_id = link
    
    cur.execute(
        f"""
        SELECT id, s3_prefix FROM {SCHEMA}.client_upload_folders
        WHERE id = %s AND short_link_id = %s
        """,
        (upload_folder_id, link_id)
    )
    folder_row = cur.fetchone()
    if not folder_row:
        return error_response(404, 'Upload folder not found')
    
    s3_prefix = folder_row[1]
    
    img_bytes = base64.b64decode(file_data)
    file_size = len(img_bytes)
    
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'jpg'
    s3_key = f"{s3_prefix}{uuid.uuid4().hex}.{ext}"
    
    s3 = boto3.client('s3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'))
    
    s3.put_object(Bucket='files', Key=s3_key, Body=img_bytes, ContentType=content_type)
    
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ.get('AWS_ACCESS_KEY_ID')}/bucket/{s3_key}"
    
    cur.execute(
        f"""
        INSERT INTO {SCHEMA}.client_upload_photos
        (upload_folder_id, file_name, s3_key, s3_url, content_type, file_size)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (upload_folder_id, file_name, s3_key, cdn_url, content_type, file_size)
    )
    photo_id = cur.fetchone()[0]
    
    cur.execute(
        f"""
        UPDATE {SCHEMA}.client_upload_folders
        SET photo_count = photo_count + 1
        WHERE id = %s
        """,
        (upload_folder_id,)
    )
    conn.commit()
    
    cur.close()
    conn.close()
    
    return success_response({
        'photo_id': photo_id,
        's3_url': cdn_url,
        'file_name': file_name
    })


def list_client_folders(cur, conn, data):
    short_code = data.get('short_code')
    if not short_code:
        return error_response(400, 'short_code required')
    
    link = get_link_with_upload_check(cur, short_code)
    if not link:
        return error_response(404, 'Gallery not found or upload disabled')
    
    link_id, folder_id = link
    
    cur.execute(
        f"""
        SELECT cuf.id, cuf.folder_name, cuf.client_name, cuf.photo_count, cuf.created_at
        FROM {SCHEMA}.client_upload_folders cuf
        WHERE cuf.parent_folder_id = %s AND cuf.short_link_id = %s
        ORDER BY cuf.created_at DESC
        """,
        (folder_id, link_id)
    )
    folders = []
    for row in cur.fetchall():
        folders.append({
            'id': row[0],
            'folder_name': row[1],
            'client_name': row[2],
            'photo_count': row[3],
            'created_at': row[4].isoformat() if row[4] else None
        })
    
    cur.close()
    conn.close()
    return success_response({'folders': folders})


def error_response(status, message):
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': message})
    }


def success_response(data):
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(data)
    }
