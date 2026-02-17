import json
import os
import psycopg2
import boto3
import base64
import uuid
from datetime import datetime
from botocore.client import Config

SCHEMA = 't_p28211681_photo_secure_web'
S3_ENDPOINT = 'https://storage.yandexcloud.net'
S3_BUCKET = 'foto-mix'

def get_yc_s3_client():
    return boto3.client('s3',
        endpoint_url=S3_ENDPOINT,
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4'))

def generate_presigned_get(s3_key, expiration=3600):
    if not s3_key:
        return ''
    s3 = get_yc_s3_client()
    return s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': S3_BUCKET, 'Key': s3_key},
        ExpiresIn=expiration
    )

def get_cors_headers(event):
    headers = event.get('headers', {})
    origin = headers.get('origin') or headers.get('Origin') or '*'
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400'
    }

def handler(event: dict, context) -> dict:
    """API для загрузки фото клиентом и просмотра фотографом клиентских загрузок"""
    method = event.get('httpMethod', 'GET')
    global _cors_headers
    _cors_headers = get_cors_headers(event)
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': _cors_headers,
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return error_response(500, 'Database not configured')
    
    try:
        body = event.get('body', '{}')
        if body and len(body) > 70 * 1024 * 1024:
            return error_response(413, 'File too large. Maximum size is 50MB')
    except:
        pass
    
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
            elif action == 'get_upload_url':
                return get_presigned_upload_url(cur, conn, data)
            elif action == 'confirm_upload':
                return confirm_client_upload(cur, conn, data)
            elif action == 'client_delete_photo':
                return client_delete_photo(cur, conn, data)
            elif action == 'client_list_photos':
                return client_list_photos(cur, conn, data)
            elif action == 'list_folders':
                return list_client_folders(cur, conn, data)
            else:
                return error_response(400, 'Unknown action')
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {}) or {}
            action = params.get('action', 'list_folders')
            headers = event.get('headers', {})
            user_id = headers.get('x-user-id') or headers.get('X-User-Id')
            
            if action == 'photographer_folders':
                return photographer_list_folders(cur, conn, params, user_id)
            elif action == 'photographer_photos':
                return photographer_list_photos(cur, conn, params, user_id)
            elif action == 'photographer_download':
                return photographer_download_photos(cur, conn, params, user_id)
            else:
                short_code = params.get('code')
                client_id = params.get('client_id')
                if not short_code or not client_id:
                    return error_response(400, 'code and client_id required')
                
                link = get_link_info(cur, short_code)
                if not link:
                    return error_response(404, 'Gallery not found')
                
                if not check_client_upload_allowed(cur, int(client_id), short_code):
                    return error_response(403, 'Upload not allowed for this client')
                
                link_id, folder_id = link
                
                cur.execute(
                    f"""
                    SELECT id, folder_name, client_name, photo_count, created_at
                    FROM {SCHEMA}.client_upload_folders
                    WHERE parent_folder_id = %s AND short_link_id = %s AND client_id = %s
                    ORDER BY created_at DESC
                    """,
                    (folder_id, link_id, client_id)
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
        
        elif method == 'DELETE':
            headers = event.get('headers', {})
            user_id = headers.get('x-user-id') or headers.get('X-User-Id')
            params = event.get('queryStringParameters', {}) or {}
            upload_folder_id = params.get('upload_folder_id')
            photo_id = params.get('photo_id')
            
            if not user_id:
                return error_response(401, 'Unauthorized')
            
            if photo_id:
                return photographer_delete_photo(cur, conn, int(photo_id), int(user_id))
            elif upload_folder_id:
                return photographer_delete_folder(cur, conn, int(upload_folder_id), int(user_id))
            else:
                return error_response(400, 'upload_folder_id or photo_id required')
        
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
        print(f'[CLIENT_UPLOAD] Error: {str(e)}')
        return error_response(500, str(e))


def get_link_info(cur, short_code):
    cur.execute(
        f"""
        SELECT fsl.id, fsl.folder_id
        FROM {SCHEMA}.folder_short_links fsl
        WHERE fsl.short_code = %s
          AND COALESCE(fsl.is_blocked, FALSE) = FALSE
          AND (fsl.expires_at IS NULL OR fsl.expires_at > NOW())
        """,
        (short_code,)
    )
    return cur.fetchone()


def check_client_upload_allowed(cur, client_id, gallery_code):
    cur.execute(
        f"""
        SELECT id FROM {SCHEMA}.favorite_clients
        WHERE id = %s AND gallery_code = %s AND COALESCE(upload_enabled, FALSE) = TRUE
        """,
        (client_id, gallery_code)
    )
    return cur.fetchone() is not None


def verify_photographer_owns_folder(cur, upload_folder_id, user_id):
    cur.execute(
        f"""
        SELECT cuf.id, cuf.parent_folder_id, pf.user_id
        FROM {SCHEMA}.client_upload_folders cuf
        JOIN {SCHEMA}.photo_folders pf ON pf.id = cuf.parent_folder_id
        WHERE cuf.id = %s AND pf.user_id = %s
        """,
        (upload_folder_id, user_id)
    )
    return cur.fetchone()


def photographer_list_folders(cur, conn, params, user_id):
    if not user_id:
        return error_response(401, 'Unauthorized')
    
    parent_folder_id = params.get('parent_folder_id')
    if not parent_folder_id:
        return error_response(400, 'parent_folder_id required')
    
    cur.execute(
        f"SELECT id FROM {SCHEMA}.photo_folders WHERE id = %s AND user_id = %s",
        (parent_folder_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        conn.close()
        return error_response(403, 'Access denied')
    
    cur.execute(
        f"""
        SELECT cuf.id, cuf.folder_name, cuf.client_name, cuf.photo_count, cuf.created_at, cuf.s3_prefix
        FROM {SCHEMA}.client_upload_folders cuf
        WHERE cuf.parent_folder_id = %s
        ORDER BY cuf.created_at DESC
        """,
        (parent_folder_id,)
    )
    folders = []
    for row in cur.fetchall():
        folders.append({
            'id': row[0],
            'folder_name': row[1],
            'client_name': row[2],
            'photo_count': row[3],
            'created_at': row[4].isoformat() if row[4] else None,
            's3_prefix': row[5]
        })
    
    cur.close()
    conn.close()
    return success_response({'folders': folders})


def photographer_list_photos(cur, conn, params, user_id):
    if not user_id:
        return error_response(401, 'Unauthorized')
    
    upload_folder_id = params.get('upload_folder_id')
    if not upload_folder_id:
        return error_response(400, 'upload_folder_id required')
    
    row = verify_photographer_owns_folder(cur, upload_folder_id, user_id)
    if not row:
        cur.close()
        conn.close()
        return error_response(403, 'Access denied')
    
    cur.execute(
        f"""
        SELECT id, file_name, s3_key, s3_url, thumbnail_s3_url, content_type,
               file_size, width, height, created_at
        FROM {SCHEMA}.client_upload_photos
        WHERE upload_folder_id = %s
        ORDER BY created_at DESC
        """,
        (upload_folder_id,)
    )
    
    rows = cur.fetchall()
    cur.close()
    conn.close()
    
    photos = []
    for r in rows:
        s3_key = r[2]
        presigned = generate_presigned_get(s3_key) if s3_key else (r[3] or '')
        photos.append({
            'id': r[0],
            'file_name': r[1],
            's3_key': s3_key,
            's3_url': presigned,
            'thumbnail_s3_url': presigned,
            'content_type': r[5],
            'file_size': r[6] or 0,
            'width': r[7],
            'height': r[8],
            'created_at': r[9].isoformat() if r[9] else None
        })
    
    return success_response({'photos': photos})


def photographer_download_photos(cur, conn, params, user_id):
    if not user_id:
        return error_response(401, 'Unauthorized')
    
    upload_folder_id = params.get('upload_folder_id')
    if not upload_folder_id:
        return error_response(400, 'upload_folder_id required')
    
    row = verify_photographer_owns_folder(cur, upload_folder_id, user_id)
    if not row:
        cur.close()
        conn.close()
        return error_response(403, 'Access denied')
    
    cur.execute(
        f"""
        SELECT cuf.folder_name FROM {SCHEMA}.client_upload_folders cuf WHERE cuf.id = %s
        """,
        (upload_folder_id,)
    )
    folder_row = cur.fetchone()
    folder_name = folder_row[0] if folder_row else 'client-photos'
    
    cur.execute(
        f"""
        SELECT s3_key, file_name, s3_url
        FROM {SCHEMA}.client_upload_photos
        WHERE upload_folder_id = %s
        ORDER BY created_at DESC
        """,
        (upload_folder_id,)
    )
    
    rows = cur.fetchall()
    files = []
    for r in rows:
        s3_key, file_name, s3_url = r
        if s3_key:
            presigned = generate_presigned_get(s3_key, expiration=7200)
            files.append({'filename': file_name, 'url': presigned})
        elif s3_url:
            files.append({'filename': file_name, 'url': s3_url})
    
    cur.close()
    conn.close()
    
    return success_response({
        'folderName': folder_name,
        'files': files,
        'totalFiles': len(files)
    })


def photographer_delete_photo(cur, conn, photo_id, user_id):
    cur.execute(
        f"""
        SELECT cup.id, cup.upload_folder_id, cup.s3_key
        FROM {SCHEMA}.client_upload_photos cup
        JOIN {SCHEMA}.client_upload_folders cuf ON cuf.id = cup.upload_folder_id
        JOIN {SCHEMA}.photo_folders pf ON pf.id = cuf.parent_folder_id
        WHERE cup.id = %s AND pf.user_id = %s
        """,
        (photo_id, user_id)
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        conn.close()
        return error_response(403, 'Access denied')
    
    upload_folder_id = row[1]
    
    cur.execute(
        f"DELETE FROM {SCHEMA}.client_upload_photos WHERE id = %s",
        (photo_id,)
    )
    cur.execute(
        f"""
        UPDATE {SCHEMA}.client_upload_folders
        SET photo_count = GREATEST(photo_count - 1, 0)
        WHERE id = %s
        """,
        (upload_folder_id,)
    )
    conn.commit()
    cur.close()
    conn.close()
    return success_response({'deleted': True})


def photographer_delete_folder(cur, conn, upload_folder_id, user_id):
    row = verify_photographer_owns_folder(cur, upload_folder_id, user_id)
    if not row:
        cur.close()
        conn.close()
        return error_response(403, 'Access denied')
    
    cur.execute(
        f"DELETE FROM {SCHEMA}.client_upload_photos WHERE upload_folder_id = %s",
        (upload_folder_id,)
    )
    cur.execute(
        f"DELETE FROM {SCHEMA}.client_upload_folders WHERE id = %s",
        (upload_folder_id,)
    )
    conn.commit()
    cur.close()
    conn.close()
    return success_response({'deleted': True})


def create_client_folder(cur, conn, data):
    short_code = data.get('short_code')
    folder_name = data.get('folder_name', '').strip()
    client_name = data.get('client_name', '').strip()
    client_id = data.get('client_id')
    
    if not short_code or not folder_name or not client_id:
        return error_response(400, 'short_code, folder_name and client_id required')
    
    link = get_link_info(cur, short_code)
    if not link:
        return error_response(404, 'Gallery not found')
    
    if not check_client_upload_allowed(cur, client_id, short_code):
        return error_response(403, 'Upload not allowed for this client')
    
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
        (parent_folder_id, short_link_id, folder_name, client_name, s3_prefix, client_id)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
        """,
        (parent_folder_id, link_id, folder_name, client_name or None, s3_prefix, client_id)
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
    client_id = data.get('client_id')
    
    if not short_code or not upload_folder_id or not file_data or not client_id:
        return error_response(400, 'short_code, upload_folder_id, client_id and file_data required')
    
    if len(file_data) > 70 * 1024 * 1024:
        return error_response(413, 'File too large. Maximum size is 50MB')
    
    link = get_link_info(cur, short_code)
    if not link:
        return error_response(404, 'Gallery not found')
    
    if not check_client_upload_allowed(cur, client_id, short_code):
        return error_response(403, 'Upload not allowed for this client')
    
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
    
    if file_size > 50 * 1024 * 1024:
        return error_response(413, 'File too large. Maximum size is 50MB')
    
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'jpg'
    s3_key = f"{s3_prefix}{uuid.uuid4().hex}.{ext}"
    
    s3 = boto3.client('s3',
        endpoint_url=S3_ENDPOINT,
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4'))
    
    s3.put_object(Bucket=S3_BUCKET, Key=s3_key, Body=img_bytes, ContentType=content_type)
    
    cdn_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{s3_key}"
    
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


def get_presigned_upload_url(cur, conn, data):
    short_code = data.get('short_code')
    upload_folder_id = data.get('upload_folder_id')
    file_name = data.get('file_name', '')
    content_type = data.get('content_type', 'image/jpeg')
    client_id = data.get('client_id')

    if not short_code or not upload_folder_id or not file_name or not client_id:
        return error_response(400, 'short_code, upload_folder_id, client_id and file_name required')

    link = get_link_info(cur, short_code)
    if not link:
        return error_response(404, 'Gallery not found')

    if not check_client_upload_allowed(cur, client_id, short_code):
        return error_response(403, 'Upload not allowed for this client')

    link_id = link[0]

    cur.execute(
        f"SELECT id, s3_prefix FROM {SCHEMA}.client_upload_folders WHERE id = %s AND short_link_id = %s",
        (upload_folder_id, link_id)
    )
    folder_row = cur.fetchone()
    if not folder_row:
        return error_response(404, 'Upload folder not found')

    s3_prefix = folder_row[1]
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'jpg'
    s3_key = f"{s3_prefix}{uuid.uuid4().hex}.{ext}"

    s3 = boto3.client('s3',
        endpoint_url=S3_ENDPOINT,
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4'))

    presigned_url = s3.generate_presigned_url(
        'put_object',
        Params={
            'Bucket': S3_BUCKET,
            'Key': s3_key,
            'ContentType': content_type
        },
        ExpiresIn=900
    )

    s3_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{s3_key}"

    cur.close()
    conn.close()

    return success_response({
        'upload_url': presigned_url,
        's3_key': s3_key,
        'cdn_url': s3_url
    })


def confirm_client_upload(cur, conn, data):
    upload_folder_id = data.get('upload_folder_id')
    file_name = data.get('file_name', '')
    s3_key = data.get('s3_key')
    cdn_url = data.get('cdn_url')
    content_type = data.get('content_type', 'image/jpeg')
    file_size = data.get('file_size', 0)
    short_code = data.get('short_code')
    client_id = data.get('client_id')

    if not upload_folder_id or not s3_key or not cdn_url or not short_code or not client_id:
        return error_response(400, 'Missing required fields')

    link = get_link_info(cur, short_code)
    if not link:
        return error_response(404, 'Gallery not found')

    if not check_client_upload_allowed(cur, client_id, short_code):
        return error_response(403, 'Upload not allowed for this client')

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
        f"UPDATE {SCHEMA}.client_upload_folders SET photo_count = photo_count + 1 WHERE id = %s",
        (upload_folder_id,)
    )
    conn.commit()

    cur.close()
    conn.close()

    presigned = generate_presigned_get(s3_key)

    return success_response({
        'photo_id': photo_id,
        's3_url': presigned,
        'file_name': file_name
    })


def client_list_photos(cur, conn, data):
    short_code = data.get('short_code')
    client_id = data.get('client_id')
    upload_folder_id = data.get('upload_folder_id')

    if not short_code or not client_id or not upload_folder_id:
        return error_response(400, 'short_code, client_id and upload_folder_id required')

    link = get_link_info(cur, short_code)
    if not link:
        return error_response(404, 'Gallery not found')

    link_id = link[0]

    cur.execute(
        f"SELECT id FROM {SCHEMA}.client_upload_folders WHERE id = %s AND short_link_id = %s AND client_id = %s",
        (upload_folder_id, link_id, client_id)
    )
    if not cur.fetchone():
        return error_response(403, 'Access denied')

    cur.execute(
        f"""
        SELECT id, file_name, s3_key, s3_url, content_type, file_size, created_at
        FROM {SCHEMA}.client_upload_photos
        WHERE upload_folder_id = %s
        ORDER BY created_at DESC
        """,
        (upload_folder_id,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()

    photos = []
    for r in rows:
        s3_key = r[2]
        presigned = generate_presigned_get(s3_key) if s3_key else (r[3] or '')
        photos.append({
            'photo_id': r[0],
            'file_name': r[1],
            's3_url': presigned,
            'file_size': r[5] or 0,
            'created_at': r[6].isoformat() if r[6] else None
        })

    return success_response({'photos': photos})


def client_delete_photo(cur, conn, data):
    photo_id = data.get('photo_id')
    short_code = data.get('short_code')
    client_id = data.get('client_id')

    if not photo_id or not short_code or not client_id:
        return error_response(400, 'photo_id, short_code and client_id required')

    if not check_client_upload_allowed(cur, client_id, short_code):
        return error_response(403, 'Not allowed')

    link = get_link_info(cur, short_code)
    if not link:
        return error_response(404, 'Gallery not found')

    link_id = link[0]

    cur.execute(
        f"""
        SELECT cup.id, cup.upload_folder_id, cup.s3_key
        FROM {SCHEMA}.client_upload_photos cup
        JOIN {SCHEMA}.client_upload_folders cuf ON cuf.id = cup.upload_folder_id
        WHERE cup.id = %s AND cuf.short_link_id = %s AND cuf.client_id = %s
        """,
        (photo_id, link_id, client_id)
    )
    row = cur.fetchone()
    if not row:
        return error_response(404, 'Photo not found')

    upload_folder_id = row[1]
    s3_key = row[2]

    if s3_key:
        try:
            s3 = get_yc_s3_client()
            s3.delete_object(Bucket=S3_BUCKET, Key=s3_key)
        except Exception as e:
            print(f'[CLIENT_UPLOAD] S3 delete error: {e}')

    cur.execute(f"DELETE FROM {SCHEMA}.client_upload_photos WHERE id = %s", (photo_id,))
    cur.execute(
        f"UPDATE {SCHEMA}.client_upload_folders SET photo_count = GREATEST(photo_count - 1, 0) WHERE id = %s",
        (upload_folder_id,)
    )
    conn.commit()
    cur.close()
    conn.close()

    return success_response({'deleted': True})


def list_client_folders(cur, conn, data):
    short_code = data.get('short_code')
    if not short_code:
        return error_response(400, 'short_code required')
    
    link = get_link_info(cur, short_code)
    if not link:
        return error_response(404, 'Gallery not found')
    
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


_cors_headers = {'Access-Control-Allow-Origin': '*'}

def error_response(status, message):
    return {
        'statusCode': status,
        'headers': {**_cors_headers, 'Content-Type': 'application/json'},
        'body': json.dumps({'error': message})
    }


def success_response(data):
    return {
        'statusCode': 200,
        'headers': {**_cors_headers, 'Content-Type': 'application/json'},
        'body': json.dumps(data)
    }