import json
import os
import psycopg2

SCHEMA = "t_p28211681_photo_secure_web"

def handler(event, context):
    """Возвращает фото из папок клиента для превью в чате"""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }

    params = event.get('queryStringParameters') or {}
    client_id = params.get('client_id')
    photographer_id = params.get('photographer_id')

    if not client_id or not photographer_id:
        return {
            'statusCode': 400,
            'headers': headers,
            'body': json.dumps({'error': 'client_id and photographer_id required'})
        }

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()

    cur.execute(f"""
        SELECT pb.id, pb.file_name, pb.s3_url, pb.thumbnail_s3_url
        FROM {SCHEMA}.photo_bank pb
        JOIN {SCHEMA}.photo_folders pf ON pf.id = pb.folder_id
        WHERE pf.client_id = {int(client_id)}
          AND pf.user_id = {int(photographer_id)}
          AND (pb.is_trashed IS NULL OR pb.is_trashed = false)
          AND (pf.is_trashed IS NULL OR pf.is_trashed = false)
        ORDER BY pb.id
    """)

    rows = cur.fetchall()
    cur.close()
    conn.close()

    photos = []
    for row in rows:
        photos.append({
            'id': row[0],
            'file_name': row[1],
            'photo_url': row[2],
            'thumbnail_url': row[3] or row[2]
        })

    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({'photos': photos})
    }
