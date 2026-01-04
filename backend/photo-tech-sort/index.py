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

def detect_closed_eyes(img: np.ndarray) -> bool:
    """
    Улучшенная детекция закрытых глаз через анализ круглых форм
    Открытые глаза = круглые тёмные области (зрачки) в светлых областях (белки)
    Закрытые глаза = горизонтальные линии без круглых форм
    ВАЖНО: Если хотя бы у ОДНОГО человека глаза открыты → фото OK
    Returns: True если ВСЕ лица с закрытыми глазами, False если хотя бы одно лицо с открытыми
    """
    try:
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        # Если лиц не найдено - не считаем браком
        if len(faces) == 0:
            return False
        
        # Счётчик лиц с закрытыми глазами
        faces_with_closed_eyes = 0
        faces_with_open_eyes = 0
        
        # Проверяем каждое лицо
        for (x, y, w, h) in faces:
            print(f'[TECH_SORT] Face detected at ({x},{y}) size {w}x{h}')
            
            # Вырезаем область лица
            face_roi = gray[y:y+h, x:x+w]
            
            if face_roi.size == 0:
                continue
            
            # Если лицо маленькое (< 80px) - увеличиваем его для точного анализа
            if w < 80 or h < 80:
                scale_factor = 120 / min(w, h)  # Масштабируем до минимум 120px
                new_w = int(w * scale_factor)
                new_h = int(h * scale_factor)
                face_roi = cv2.resize(face_roi, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
                print(f'[TECH_SORT] Face upscaled from {w}x{h} to {new_w}x{new_h} (scale={scale_factor:.2f}x)')
                w, h = new_w, new_h
            
            # Область глаз находится примерно на 25-50% высоты лица от верха
            eye_region_y = int(h * 0.25)
            eye_region_h = int(h * 0.25)
            eye_region = face_roi[eye_region_y:eye_region_y + eye_region_h, 0:w]
            
            if eye_region.size == 0:
                continue
            
            # Детектируем глаза каскадом Хаара
            eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
            eyes_detected = eye_cascade.detectMultiScale(
                eye_region, 
                scaleFactor=1.05, 
                minNeighbors=3, 
                minSize=(int(w*0.1), int(h*0.15))
            )
            
            print(f'[TECH_SORT] Eyes detected by cascade: {len(eyes_detected)}')
            
            # Применяем несколько методов бинаризации для надёжности
            # Метод 1: Жёсткий порог для очень тёмных зрачков
            _, binary_dark_strict = cv2.threshold(eye_region, 40, 255, cv2.THRESH_BINARY_INV)
            
            # Метод 2: Адаптивная бинаризация (лучше работает при разном освещении)
            binary_dark_adaptive = cv2.adaptiveThreshold(
                eye_region, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY_INV, 11, 2
            )
            
            # Объединяем оба метода (логическое ИЛИ)
            binary_dark = cv2.bitwise_or(binary_dark_strict, binary_dark_adaptive)
            
            # Ищем круглые контуры (зрачки)
            contours, _ = cv2.findContours(binary_dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            circular_contours = 0
            for contour in contours:
                area = cv2.contourArea(contour)
                # Минимальная площадь зависит от размера лица
                min_area = max(10, (w * h) / 2000)
                if area < min_area:
                    continue
                
                # Проверяем круглость через соотношение площади к периметру
                perimeter = cv2.arcLength(contour, True)
                if perimeter == 0:
                    continue
                
                circularity = 4 * np.pi * area / (perimeter * perimeter)
                # Более строгая проверка круглости для надёжности
                if circularity > 0.6:
                    circular_contours += 1
            
            print(f'[TECH_SORT] Circular contours found (pupils): {circular_contours}')
            
            # Строгая логика определения:
            # Глаза ОТКРЫТЫ если:
            # 1. Каскад нашёл 2 глаза ИЛИ
            # 2. Найдено минимум 2 круглых зрачка ИЛИ  
            # 3. Найден 1 глаз каскадом И есть хотя бы 1 зрачок
            
            eyes_open = False
            
            if len(eyes_detected) >= 2:
                eyes_open = True
                print(f'[TECH_SORT] ✅ Eyes open: cascade detected 2+ eyes')
            elif circular_contours >= 2:
                eyes_open = True
                print(f'[TECH_SORT] ✅ Eyes open: found 2+ circular pupils')
            elif len(eyes_detected) >= 1 and circular_contours >= 1:
                eyes_open = True
                print(f'[TECH_SORT] ✅ Eyes open: 1 eye by cascade + 1 pupil detected')
            else:
                print(f'[TECH_SORT] ❌ Eyes closed: {len(eyes_detected)} eyes by cascade, {circular_contours} pupils')
            
            if eyes_open:
                faces_with_open_eyes += 1
            else:
                faces_with_closed_eyes += 1
        
        # Финальное решение: если хотя бы ОДНО лицо с ЗАКРЫТЫМИ глазами → БРАК
        print(f'[TECH_SORT] Summary: {faces_with_open_eyes} faces with open eyes, {faces_with_closed_eyes} with closed')
        
        if faces_with_closed_eyes > 0:
            print(f'[TECH_SORT] ❌ Photo rejected: at least one person with closed eyes')
            return True
        
        # Все лица с открытыми глазами → ОК
        print(f'[TECH_SORT] ✅ Photo OK: all faces have open eyes')
        return False
        
    except Exception as e:
        print(f'[TECH_SORT] Error in eye detection: {str(e)}')
        import traceback
        print(traceback.format_exc())
        return False


def analyze_photo_quality(image_bytes: bytes, is_raw: bool = False) -> Tuple[bool, str]:
    """
    Анализирует качество фото и определяет является ли оно техническим браком
    Оптимизирован для быстрой работы на облачных функциях
    Returns: (is_reject: bool, reason: str)
    """
    try:
        # Загружаем изображение
        if is_raw:
            # Обработка RAW файлов через rawpy
            import rawpy
            with rawpy.imread(io.BytesIO(image_bytes)) as raw:
                rgb = raw.postprocess(use_camera_wb=True, half_size=True)  # half_size для ускорения
            img = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        else:
            # Обычные JPEG/PNG
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
            
            # Порог шума: если > 80, фото ОЧЕНЬ сильно зашумлено
            # Повышен до 80 чтобы не отбраковывать улыбающихся людей (прищур даёт шум)
            print(f'[TECH_SORT] Noise level: {noise_level:.2f}')
            if noise_level > 80:
                return True, 'noise'
        
        # Проверка 4: Контраст (Low Contrast)
        # Если стандартное отклонение яркости очень низкое, контраст плохой
        contrast = np.std(v_channel)
        if contrast < 20:
            return True, 'low_contrast'
        
        # Проверка 5: Закрытые глаза
        if detect_closed_eyes(img):
            return True, 'closed_eyes'
        
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
        print(f'[TECH_SORT] Starting analysis for folder_id={folder_id}, user_id={user_id}')
        print(f'[TECH_SORT] S3 config: bucket={bucket}, endpoint=https://storage.yandexcloud.net')
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Проверяем что папка принадлежит пользователю и это папка "originals"
            cur.execute('''
                SELECT id, folder_name, s3_prefix, folder_type, parent_folder_id
                FROM photo_folders
                WHERE id = %s AND user_id = %s AND is_trashed = FALSE
            ''', (folder_id, user_id))
            print('[TECH_SORT] Folder query executed')
            
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
                FROM photo_folders
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
                    INSERT INTO photo_folders 
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
                SELECT id, s3_key, s3_url, file_name, content_type
                FROM photo_bank
                WHERE folder_id = %s 
                  AND user_id = %s 
                  AND is_trashed = FALSE
                  AND (tech_analyzed = FALSE OR tech_analyzed IS NULL)
                  AND is_video = FALSE
            ''', (folder_id, user_id))
            
            photos = cur.fetchall()
            print(f'[TECH_SORT] Found {len(photos)} photos to analyze')
            
            rejected_count = 0
            processed_count = 0
            
            # Обрабатываем каждое фото
            for photo in photos:
                print(f'[TECH_SORT] Processing photo id={photo["id"]}, s3_key={photo.get("s3_key", "none")}')
                try:
                    # Получаем байты изображения из S3
                    if not photo['s3_key'] and not photo['s3_url']:
                        # Нет s3_key и s3_url - пропускаем
                        print(f'[TECH_SORT] No S3 storage for photo {photo["id"]}')
                        cur.execute('''
                            UPDATE photo_bank
                            SET tech_analyzed = TRUE,
                                tech_reject_reason = 'no_storage'
                            WHERE id = %s
                        ''', (photo['id'],))
                        continue
                    
                    # Извлекаем ключ из s3_key или s3_url
                    s3_key = photo['s3_key']
                    if not s3_key and photo['s3_url']:
                        # Извлекаем ключ из URL вида https://storage.yandexcloud.net/foto-mix/path/file.jpg
                        s3_key = photo['s3_url'].replace('https://storage.yandexcloud.net/foto-mix/', '')
                    
                    print(f'[TECH_SORT] Reading S3: bucket={bucket}, key={s3_key}')
                    try:
                        response = s3_client.get_object(Bucket=bucket, Key=s3_key)
                        image_bytes = response['Body'].read()
                        print(f'[TECH_SORT] S3 read success: {len(image_bytes)} bytes')
                    except Exception as s3_err:
                        # Файл не найден в S3 - пропускаем
                        print(f'[TECH_SORT] S3 error for photo {photo["id"]}, key={s3_key}: {str(s3_err)}')
                        cur.execute('''
                            UPDATE photo_bank
                            SET tech_analyzed = TRUE,
                                tech_reject_reason = 's3_not_found'
                            WHERE id = %s
                        ''', (photo['id'],))
                        continue
                    
                    # Определяем является ли файл RAW форматом
                    raw_extensions = ['.cr2', '.nef', '.arw', '.dng', '.orf', '.rw2', '.raw']
                    is_raw = any(photo['file_name'].lower().endswith(ext) for ext in raw_extensions)
                    
                    # Сохраняем s3_key для дальнейшего использования
                    current_s3_key = None
                    if photo['s3_key'] or photo['s3_url']:
                        current_s3_key = photo['s3_key']
                        if not current_s3_key and photo['s3_url']:
                            current_s3_key = photo['s3_url'].replace('https://storage.yandexcloud.net/foto-mix/', '')
                    
                    # Анализируем качество
                    is_reject, reason = analyze_photo_quality(image_bytes, is_raw=is_raw)
                    
                    if is_reject:
                        # Перемещаем фото в tech_rejects
                        # Копируем файл в S3
                        new_s3_key = f"{tech_rejects_s3_prefix}{photo['file_name']}"
                        
                        print(f'[TECH_SORT] Copying photo {photo["id"]}: {current_s3_key} → {new_s3_key}')
                        
                        try:
                            s3_client.copy_object(
                                Bucket=bucket,
                                CopySource={'Bucket': bucket, 'Key': current_s3_key},
                                Key=new_s3_key
                            )
                            
                            # Удаляем старый файл из S3
                            s3_client.delete_object(Bucket=bucket, Key=current_s3_key)
                            
                            # Обновляем запись в БД
                            cur.execute('''
                                UPDATE photo_bank
                                SET folder_id = %s,
                                    s3_key = %s,
                                    tech_reject_reason = %s,
                                    tech_analyzed = TRUE
                                WHERE id = %s
                            ''', (tech_rejects_folder_id, new_s3_key, reason, photo['id']))
                            
                            rejected_count += 1
                        except Exception as copy_err:
                            # Ошибка при копировании - помечаем как ошибку
                            print(f'[TECH_SORT] S3 copy error for photo {photo["id"]}: {str(copy_err)}')
                            cur.execute('''
                                UPDATE photo_bank
                                SET tech_analyzed = TRUE,
                                    tech_reject_reason = 's3_copy_error'
                                WHERE id = %s
                            ''', (photo['id'],))
                            continue
                    else:
                        # Фото ОК - просто помечаем как проанализированное
                        cur.execute('''
                            UPDATE photo_bank
                            SET tech_analyzed = TRUE,
                                tech_reject_reason = 'ok'
                            WHERE id = %s
                        ''', (photo['id'],))
                    
                    processed_count += 1
                    
                except Exception as e:
                    print(f'[TECH_SORT] Error processing photo {photo["id"]}: {str(e)}')
                    # Помечаем фото как проанализированное с ошибкой
                    cur.execute('''
                        UPDATE photo_bank
                        SET tech_analyzed = TRUE,
                            tech_reject_reason = 'analysis_error'
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
        import traceback
        error_details = traceback.format_exc()
        print(f'[TECH_SORT] Error: {str(e)}')
        print(f'[TECH_SORT] Traceback: {error_details}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': f'Internal server error: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        conn.close()