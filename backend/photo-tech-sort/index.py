'''
Анализирует фото на технический брак и сортирует в папку tech_rejects
Использует CV2 для анализа blur, exposure, noise
Args: event с folder_id для обработки
Returns: Статус обработки и количество забракованных фото
'''

import json
import os
import io
from typing import Dict, Any, List, Tuple
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config
import cv2
import numpy as np
from PIL import Image

def analyze_photo_quality(image_bytes: bytes) -> Tuple[bool, str]:
    """
    Анализирует качество фото и определяет является ли оно техническим браком
    Оптимизирован для быстрой работы на облачных функциях
    Returns: (is_reject: bool, reason: str)
    """
    try:
        # Загружаем изображение
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return True, 'corrupt_file'
        
        # Уменьшаем размер для ускорения анализа (макс 1000px по длинной стороне)
        height, width = img.shape[:2]
        max_dimension = 1000
        if max(height, width) > max_dimension:
            scale = max_dimension / max(height, width)
            new_width = int(width * scale)
            new_height = int(height * scale)
            img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)
        
        # Проверка 1: Размытие (Blur Detection) - используем Laplacian variance
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Порог: если вариация < 100, фото сильно размыто
        if laplacian_var < 100:
            return True, 'blur'
        
        # Проверка 2: Экспозиция (Overexposed/Underexposed)
        # Вычисляем средние значения яркости
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        v_channel = hsv[:, :, 2]
        mean_brightness = np.mean(v_channel)
        
        # Пересвет: средняя яркость > 240
        if mean_brightness > 240:
            return True, 'overexposed'
        
        # Недосвет: средняя яркость < 20
        if mean_brightness < 20:
            return True, 'underexposed'
        
        # Проверка 3: Шум (Noise Detection) - используем упрощённый метод
        # Вычисляем стандартное отклонение в случайных областях
        h, w = gray.shape
        sample_size = min(100, h, w)
        if h > sample_size and w > sample_size:
            y = np.random.randint(0, h - sample_size)
            x = np.random.randint(0, w - sample_size)
            sample = gray[y:y+sample_size, x:x+sample_size]
            noise_level = np.std(sample)
            
            # Порог шума: если > 50, фото сильно зашумлено
            if noise_level > 50:
                return True, 'noise'
        
        # Проверка 4: Контраст (Low Contrast)
        # Если стандартное отклонение яркости очень низкое, контраст плохой
        contrast = np.std(v_channel)
        if contrast < 20:
            return True, 'low_contrast'
        
        # Фото прошло все проверки - не брак
        return False, 'ok'
        
    except Exception as e:
        print(f'[TECH_SORT] Error analyzing image: {str(e)}')
        return True, 'analysis_error'


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Обрабатывает папку с фото, находит технический брак и перемещает в подпапку tech_rejects
    """
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    
    # Получаем folder_id из body
    try:
        body = json.loads(event.get('body', '{}'))
        folder_id = body.get('folder_id')
    except:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid JSON body'}),
            'isBase64Encoded': False
        }
    
    if not folder_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'folder_id required'}),
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
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Проверяем что папка принадлежит пользователю и это папка "originals"
            cur.execute('''
                SELECT id, folder_name, s3_prefix, folder_type, parent_folder_id
                FROM t_p28211681_photo_secure_web.photo_folders
                WHERE id = %s AND user_id = %s AND is_trashed = FALSE
            ''', (folder_id, user_id))
            
            folder = cur.fetchone()
            if not folder:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Folder not found'}),
                    'isBase64Encoded': False
                }
            
            # Проверяем - нет ли уже папки tech_rejects для этой папки
            cur.execute('''
                SELECT id, s3_prefix
                FROM t_p28211681_photo_secure_web.photo_folders
                WHERE parent_folder_id = %s 
                  AND folder_type = 'tech_rejects' 
                  AND user_id = %s 
                  AND is_trashed = FALSE
            ''', (folder_id, user_id))
            
            tech_rejects_folder = cur.fetchone()
            
            # Если папки tech_rejects нет - создаём
            if not tech_rejects_folder:
                tech_rejects_name = f"{folder['folder_name']} - Технический брак"
                tech_rejects_prefix = f"{folder['s3_prefix']}tech_rejects/"
                
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.photo_folders 
                    (user_id, folder_name, s3_prefix, folder_type, parent_folder_id, created_at, updated_at)
                    VALUES (%s, %s, %s, 'tech_rejects', %s, NOW(), NOW())
                    RETURNING id, s3_prefix
                ''', (user_id, tech_rejects_name, tech_rejects_prefix, folder_id))
                
                tech_rejects_folder = cur.fetchone()
                conn.commit()
            
            tech_rejects_folder_id = tech_rejects_folder['id']
            tech_rejects_s3_prefix = tech_rejects_folder['s3_prefix']
            
            # Получаем все фото из папки originals, которые ещё не анализировались
            cur.execute('''
                SELECT id, s3_key, file_name, content_type
                FROM t_p28211681_photo_secure_web.photo_bank
                WHERE folder_id = %s 
                  AND user_id = %s 
                  AND is_trashed = FALSE
                  AND (tech_analyzed = FALSE OR tech_analyzed IS NULL)
                  AND is_video = FALSE
            ''', (folder_id, user_id))
            
            photos = cur.fetchall()
            
            rejected_count = 0
            processed_count = 0
            
            # Обрабатываем каждое фото
            for photo in photos:
                try:
                    # Скачиваем фото из S3
                    response = s3_client.get_object(Bucket=bucket, Key=photo['s3_key'])
                    image_bytes = response['Body'].read()
                    
                    # Анализируем качество
                    is_reject, reason = analyze_photo_quality(image_bytes)
                    
                    if is_reject:
                        # Перемещаем фото в tech_rejects
                        new_s3_key = f"{tech_rejects_s3_prefix}{photo['file_name']}"
                        
                        # Копируем в новое место
                        s3_client.copy_object(
                            Bucket=bucket,
                            CopySource={'Bucket': bucket, 'Key': photo['s3_key']},
                            Key=new_s3_key
                        )
                        
                        # Обновляем запись в БД
                        cur.execute('''
                            UPDATE t_p28211681_photo_secure_web.photo_bank
                            SET folder_id = %s,
                                s3_key = %s,
                                tech_reject_reason = %s,
                                tech_analyzed = TRUE,
                                updated_at = NOW()
                            WHERE id = %s
                        ''', (tech_rejects_folder_id, new_s3_key, reason, photo['id']))
                        
                        # Удаляем старый файл из S3
                        s3_client.delete_object(Bucket=bucket, Key=photo['s3_key'])
                        
                        rejected_count += 1
                    else:
                        # Фото ОК - просто помечаем как проанализированное
                        cur.execute('''
                            UPDATE t_p28211681_photo_secure_web.photo_bank
                            SET tech_analyzed = TRUE,
                                tech_reject_reason = 'ok',
                                updated_at = NOW()
                            WHERE id = %s
                        ''', (photo['id'],))
                    
                    processed_count += 1
                    
                except Exception as e:
                    print(f'[TECH_SORT] Error processing photo {photo["id"]}: {str(e)}')
                    # Помечаем фото как проанализированное с ошибкой
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_bank
                        SET tech_analyzed = TRUE,
                            tech_reject_reason = 'analysis_error',
                            updated_at = NOW()
                        WHERE id = %s
                    ''', (photo['id'],))
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'processed': processed_count,
                    'rejected': rejected_count,
                    'tech_rejects_folder_id': tech_rejects_folder_id,
                    'message': f'Обработано {processed_count} фото, найдено {rejected_count} технических браков'
                }),
                'isBase64Encoded': False
            }
            
    except Exception as e:
        print(f'[TECH_SORT] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Internal server error: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()