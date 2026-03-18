'''Просмотр фотобанка любого пользователя из админ-панели — папки и фото'''

import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Admin-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters') or {}
    action = params.get('action', 'folders')
    target_user_id = params.get('user_id')
    
    if not target_user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
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
                        (SELECT COUNT(*) FROM t_p28211681_photo_secure_web.photo_bank 
                         WHERE folder_id = pf.id AND is_trashed = FALSE) as photo_count
                    FROM t_p28211681_photo_secure_web.photo_folders pf
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
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'folders': folders}),
                'isBase64Encoded': False
            }
        
        elif action == 'photos':
            folder_id = params.get('folder_id')
            if not folder_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'folder_id is required'}),
                    'isBase64Encoded': False
                }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute('''
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
                             FROM t_p28211681_photo_secure_web.download_logs dl 
                             WHERE dl.photo_id = pb.id AND dl.download_type = 'photo'),
                            0
                        ) as photo_download_count
                    FROM t_p28211681_photo_secure_web.photo_bank pb
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
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'photos': photos}),
                'isBase64Encoded': False
            }
        
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Unknown action: {action}'}),
            'isBase64Encoded': False
        }
    
    finally:
        conn.close()
