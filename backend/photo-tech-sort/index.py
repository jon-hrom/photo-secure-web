'''
Анализирует фото на технический брак и сортирует в папку tech_rejects
Использует улучшенный OpenCV алгоритм с фокусом на уменьшение ложных срабатываний
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
from face_quality import (
    detect_faces,
    face_sharpness,
    face_exposure,
    face_is_measurable,
    eyes_state,
    EYES_CLOSED,
    EYES_UNCERTAIN,
)

# Пороги резкости ПО ЛИЦУ. Анализ идёт по уменьшенной копии кадра
# (640-800px), поэтому абсолютные значения невысокие.
# Ниже FACE_BLUR_REJECT — однозначно мыло, в техбрак.
# Между порогами — спорно, уходит в папку «Проверить».
FACE_BLUR_REJECT = 12.0
FACE_BLUR_OK = 35.0

# Пороги экспозиции ПО ЛИЦУ (средняя яркость кожи, шкала 0-255).
# Нормальная кожа обычно 90-200. За пределами — кожа не читается.
FACE_TOO_BRIGHT = 235.0
FACE_TOO_DARK = 45.0

# Причины, которые считаются спорными и идут в папку «Проверить»
REVIEW_REASONS = ('review_blur', 'review_eyes')


def detect_closed_eyes(img: np.ndarray) -> bool:
    """
    Улучшенная детекция закрытых глаз - СТРОЖЕ к ложным срабатываниям
    КРИТИЧНО: Прищур при улыбке НЕ ДОЛЖЕН считаться закрытыми глазами!
    
    Изменения от предыдущей версии:
    - Повышен порог EAR (зрачки должны быть более заметны)
    - Увеличен порог яркости (белки глаз должны быть ярче)
    - Требуется больше признаков для решения "глаза закрыты"
    - Приоритет: лучше пропустить брак, чем отбраковать нормальное фото
    
    Returns: True если ОДНОЗНАЧНО закрыты глаза БЕЗ улыбки, False в остальных случаях
    """
    try:
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        smile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_smile.xml')
        
        # Медианный блюр для шумоподавления
        img_filtered = cv2.medianBlur(img, 5)
        gray = cv2.cvtColor(img_filtered, cv2.COLOR_BGR2GRAY)
        
        # CLAHE для выравнивания контраста
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        gray = clahe.apply(gray)
        
        faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        
        if len(faces) == 0:
            print('[TECH_SORT] No faces detected → ACCEPT (no rejection without faces)')
            return False
        
        faces_with_definitely_closed_eyes = 0
        faces_ok = 0
        
        for (x, y, w, h) in faces:
            print(f'[TECH_SORT] Analyzing face at ({x},{y}) size {w}x{h}')
            
            face_roi = gray[y:y+h, x:x+w]
            
            if face_roi.size == 0:
                continue
            
            # Upscale small faces
            if w < 80 or h < 80:
                scale_factor = 120 / min(w, h)
                new_w = int(w * scale_factor)
                new_h = int(h * scale_factor)
                face_roi = cv2.resize(face_roi, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
                print(f'[TECH_SORT] Face upscaled from {w}x{h} to {new_w}x{new_h}')
                w, h = new_w, new_h
            
            # ШАГ 1: Детекция улыбки (СТРОЖЕ - требуем высокую уверенность)
            mouth_region_y = int(h * 0.5)
            mouth_region = face_roi[mouth_region_y:h, 0:w]
            
            smiles_detected = smile_cascade.detectMultiScale(
                mouth_region,
                scaleFactor=1.3,
                minNeighbors=22,  # УВЕЛИЧЕНО с 20 до 22 (строже)
                minSize=(int(w*0.25), int(h*0.15))
            )
            
            is_smiling = len(smiles_detected) > 0
            print(f'[TECH_SORT] Smile detection: {len(smiles_detected)} smiles found → {"😊 SMILING" if is_smiling else "neutral"}')
            
            # ШАГ 2: Детекция глаз
            eye_region_y = int(h * 0.25)
            eye_region_h = int(h * 0.25)
            eye_region = face_roi[eye_region_y:eye_region_y + eye_region_h, 0:w]
            
            if eye_region.size == 0:
                faces_ok += 1  # Не можем проверить - считаем OK
                continue
            
            # Детекция глаз каскадом (оптимизировано для экономии памяти)
            eyes_detected = eye_cascade.detectMultiScale(
                eye_region, 
                scaleFactor=1.1,  # Увеличено с 1.03 (меньше масштабов = меньше памяти)
                minNeighbors=3,   # Снижено с 4 (меньше проходов)
                minSize=(int(w*0.15), int(h*0.2))  # Увеличен минимальный размер
            )
            
            print(f'[TECH_SORT] Eyes detected by cascade: {len(eyes_detected)}')
            
            # Тройная бинаризация (ищем зрачки)
            _, binary_dark_strict = cv2.threshold(eye_region, 40, 255, cv2.THRESH_BINARY_INV)  # Понижен с 45 до 40
            
            binary_dark_adaptive = cv2.adaptiveThreshold(
                eye_region, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY_INV, 13, 3
            )
            
            _, binary_dark_otsu = cv2.threshold(eye_region, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            
            binary_dark = cv2.bitwise_or(binary_dark_strict, binary_dark_adaptive)
            binary_dark = cv2.bitwise_or(binary_dark, binary_dark_otsu)
            
            # Морфологическое закрытие
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            binary_dark = cv2.morphologyEx(binary_dark, cv2.MORPH_CLOSE, kernel)
            
            # Поиск круглых контуров (зрачки)
            contours, _ = cv2.findContours(binary_dark, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            circular_contours = 0
            for contour in contours:
                area = cv2.contourArea(contour)
                min_area = max(12, (w * h) / 2000)  # Понижен с 15 и 1800
                max_area = (w * h) / 8
                
                if area < min_area or area > max_area:
                    continue
                
                perimeter = cv2.arcLength(contour, True)
                if perimeter == 0:
                    continue
                
                circularity = 4 * np.pi * area / (perimeter * perimeter)
                
                x_cnt, y_cnt, w_cnt, h_cnt = cv2.boundingRect(contour)
                aspect_ratio = w_cnt / float(h_cnt) if h_cnt > 0 else 0
                
                # СТРОЖЕ проверка на круглость (понижен порог)
                if circularity > 0.6 and 0.65 <= aspect_ratio <= 1.5:  # Было 0.65/0.7-1.4
                    circular_contours += 1
                    print(f'[TECH_SORT] Pupil candidate: area={area:.1f}, circularity={circularity:.2f}, aspect={aspect_ratio:.2f}')
            
            print(f'[TECH_SORT] Circular contours found (pupils): {circular_contours}')
            
            # Анализ яркости области глаз
            mean_brightness = np.mean(eye_region)
            std_brightness = np.std(eye_region)
            print(f'[TECH_SORT] Eye region: mean_brightness={mean_brightness:.1f}, std={std_brightness:.1f}')
            
            # НОВАЯ ЛОГИКА: СТРОЖЕ к закрытию глаз (меньше ложных срабатываний)
            # Глаза ОДНОЗНАЧНО ОТКРЫТЫ если:
            # 1. Каскад нашёл 2+ глаза (даже при низкой яркости) ИЛИ
            # 2. Найдено 2+ зрачка ИЛИ
            # 3. Найдено 1+ глаз каскадом И яркость > 50 ИЛИ
            # 4. Яркость > 65 (очень светлая область - точно открыты) ИЛИ
            # 5. Стандартное отклонение > 30 (контрастная область - зрачок+белок)
            
            eyes_definitely_open = False
            
            if len(eyes_detected) >= 2:
                eyes_definitely_open = True
                print(f'[TECH_SORT] ✅ Eyes DEFINITELY open: cascade found 2+ eyes')
            elif circular_contours >= 2:
                eyes_definitely_open = True
                print(f'[TECH_SORT] ✅ Eyes DEFINITELY open: found 2+ circular pupils')
            elif len(eyes_detected) >= 1 and mean_brightness > 50:
                eyes_definitely_open = True
                print(f'[TECH_SORT] ✅ Eyes DEFINITELY open: 1 eye detected + brightness > 50')
            elif mean_brightness > 65:
                eyes_definitely_open = True
                print(f'[TECH_SORT] ✅ Eyes DEFINITELY open: very bright region (>{mean_brightness:.1f})')
            elif std_brightness > 30:
                eyes_definitely_open = True
                print(f'[TECH_SORT] ✅ Eyes DEFINITELY open: high contrast (std={std_brightness:.1f} > 30)')
            elif circular_contours >= 1 and mean_brightness > 45:
                eyes_definitely_open = True
                print(f'[TECH_SORT] ✅ Eyes DEFINITELY open: 1+ pupil + brightness > 45')
            else:
                print(f'[TECH_SORT] ⚠️ UNCERTAIN: cascade={len(eyes_detected)}, pupils={circular_contours}, brightness={mean_brightness:.1f}, std={std_brightness:.1f}')
            
            # ФИНАЛЬНОЕ РЕШЕНИЕ с приоритетом на безопасность
            if eyes_definitely_open:
                faces_ok += 1
                print(f'[TECH_SORT] Face verdict: ✅ Eyes open → OK')
            elif is_smiling:
                faces_ok += 1
                print(f'[TECH_SORT] Face verdict: 😊 Smiling (uncertain eyes) → OK (не браковать)')
            elif len(eyes_detected) == 0 and circular_contours == 0 and mean_brightness < 45:
                # ТОЛЬКО если ВСЕ признаки указывают на закрытые глаза
                faces_with_definitely_closed_eyes += 1
                print(f'[TECH_SORT] Face verdict: ❌ Eyes DEFINITELY closed → REJECT')
            else:
                # Сомнительный случай - НЕ браковать (лучше пропустить брак чем отбраковать норму)
                faces_ok += 1
                print(f'[TECH_SORT] Face verdict: ⚠️ UNCERTAIN → OK (приоритет на безопасность)')
        
        # Итог: браковать ТОЛЬКО если есть ОДНОЗНАЧНО закрытые глаза БЕЗ улыбки
        is_rejected = faces_with_definitely_closed_eyes > 0
        print(f'[TECH_SORT] Final: faces_ok={faces_ok}, faces_definitely_closed={faces_with_definitely_closed_eyes} → {"❌ REJECT" if is_rejected else "✅ ACCEPT"}')
        return is_rejected
        
    except Exception as e:
        print(f'[TECH_SORT] Error in eye detection: {str(e)}')
        return False


def detect_blur(img: np.ndarray) -> bool:
    """Проверяет резкость фотографии через Laplacian variance"""
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        is_blurry = laplacian_var < 100
        print(f'[TECH_SORT] Blur score: {laplacian_var:.2f} (threshold=100) → {"❌ BLURRY" if is_blurry else "✅ SHARP"}')
        
        return is_blurry
    except Exception as e:
        print(f'[TECH_SORT] Error in blur detection: {str(e)}')
        return False


def detect_overexposed(img: np.ndarray) -> bool:
    """Проверяет пересвет (overexposure)"""
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        bright_pixels = np.sum(gray > 240)
        total_pixels = gray.size
        bright_ratio = bright_pixels / total_pixels
        
        is_overexposed = bright_ratio > 0.3
        print(f'[TECH_SORT] Overexposure: {bright_ratio*100:.1f}% bright pixels (threshold=30%) → {"❌ OVEREXPOSED" if is_overexposed else "✅ OK"}')
        
        return is_overexposed
    except Exception as e:
        print(f'[TECH_SORT] Error in overexposure detection: {str(e)}')
        return False


def detect_underexposed(img: np.ndarray) -> bool:
    """Проверяет недосвет (underexposure)"""
    try:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        dark_pixels = np.sum(gray < 30)
        total_pixels = gray.size
        dark_ratio = dark_pixels / total_pixels
        
        is_underexposed = dark_ratio > 0.4
        print(f'[TECH_SORT] Underexposure: {dark_ratio*100:.1f}% dark pixels (threshold=40%) → {"❌ UNDEREXPOSED" if is_underexposed else "✅ OK"}')
        
        return is_underexposed
    except Exception as e:
        print(f'[TECH_SORT] Error in underexposure detection: {str(e)}')
        return False


def analyze_photo(s3_client, bucket: str, s3_key: str) -> Tuple[bool, str]:
    """
    Анализирует фото на технический брак
    Returns: (is_rejected, reject_reason)
    """
    try:
        print(f'[TECH_SORT] Analyzing photo: {s3_key}')
        
        # КРИТИЧНО: Проверяем размер файла ПЕРЕД загрузкой (предотвращение OOM)
        head_response = s3_client.head_object(Bucket=bucket, Key=s3_key)
        file_size_mb = head_response['ContentLength'] / (1024 * 1024)
        print(f'[TECH_SORT] File size: {file_size_mb:.1f} MB')
        
        # Пропускаем файлы > 35 МБ (нехватка памяти в Cloud Functions 256MB)
        if file_size_mb > 35:
            print(f'[TECH_SORT] ⚠️ File too large ({file_size_mb:.1f} MB), skipping to prevent OOM')
            return False, ''  # Не браковать, просто пропустить
        
        # Скачиваем фото из S3
        response = s3_client.get_object(Bucket=bucket, Key=s3_key)
        img_data = response['Body'].read()
        print(f'[TECH_SORT] Downloaded {len(img_data)} bytes')
        
        # Для RAW файлов используем встроенный thumbnail (экономия памяти)
        is_raw = s3_key.lower().endswith(('.cr2', '.nef', '.arw', '.raw', '.dng'))
        
        if is_raw:
            print(f'[TECH_SORT] RAW file detected ({len(img_data)} bytes), extracting thumbnail')
            try:
                import rawpy
                import gc
                
                # Освобождаем память перед работой с RAW
                gc.collect()
                print(f'[TECH_SORT] Memory cleared, opening RAW stream')
                
                raw_stream = io.BytesIO(img_data)
                with rawpy.imread(raw_stream) as raw:
                    print(f'[TECH_SORT] RAW opened, extracting thumbnail')
                    # Используем встроенный JPEG preview вместо полного RAW (в 10x меньше памяти)
                    try:
                        thumb = raw.extract_thumb()
                        print(f'[TECH_SORT] Thumbnail extracted, format={thumb.format}')
                        
                        if thumb.format == rawpy.ThumbFormat.JPEG:
                            thumb_data = io.BytesIO(thumb.data)
                            pil_img = Image.open(thumb_data)
                            print(f'[TECH_SORT] JPEG thumbnail size: {pil_img.size}')
                            
                            # КРИТИЧНО: Уменьшаем thumbnail ДО конвертации в numpy (экономия памяти)
                            # Понижено до 640px для предотвращения OOM в Cloud Functions (256MB RAM)
                            max_dim = 640
                            if max(pil_img.size) > max_dim:
                                scale = max_dim / max(pil_img.size)
                                new_size = (int(pil_img.size[0] * scale), int(pil_img.size[1] * scale))
                                pil_img = pil_img.resize(new_size, Image.Resampling.LANCZOS)
                                print(f'[TECH_SORT] Resized thumbnail to: {pil_img.size}')
                            
                            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                            print(f'[TECH_SORT] ✅ Used embedded JPEG thumbnail from RAW')
                            # Очищаем промежуточные объекты
                            del thumb_data, pil_img, thumb
                            gc.collect()
                        else:
                            print(f'[TECH_SORT] No JPEG thumbnail, using half-size decode')
                            # Если thumbnail нет, используем быстрый demosaic с уменьшением
                            rgb = raw.postprocess(half_size=True, use_camera_wb=True, no_auto_bright=True)
                            img = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
                            print(f'[TECH_SORT] ✅ Used half-size RAW decode')
                            del rgb
                            gc.collect()
                    except Exception as thumb_err:
                        print(f'[TECH_SORT] Thumbnail extraction failed: {str(thumb_err)}')
                        # Пробуем fallback на half_size decode
                        print(f'[TECH_SORT] Trying half_size decode as fallback')
                        rgb = raw.postprocess(half_size=True, use_camera_wb=True, no_auto_bright=True)
                        img = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
                        print(f'[TECH_SORT] ✅ Used half-size RAW decode (fallback)')
                        del rgb
                        gc.collect()
                
                # Освобождаем исходные данные RAW
                del raw_stream
                del img_data
                gc.collect()
                print(f'[TECH_SORT] RAW processing completed, memory cleaned')
                
            except Exception as raw_err:
                print(f'[TECH_SORT] ❌ RAW decode failed: {str(raw_err)}')
                import traceback
                traceback.print_exc()
                img = None
        else:
            img = None
        
        # Если RAW не обработался или это не RAW - пробуем обычные методы
        if img is None:
            try:
                # КРИТИЧНО: Уменьшаем изображение В PIL ПЕРЕД конвертацией в numpy/OpenCV
                # Это предотвращает OOM при обработке больших JPEG (9+ МБ сжатых = 50+ МБ в памяти)
                pil_img = Image.open(io.BytesIO(img_data))
                
                # Узнаём размер ДО загрузки полного изображения
                original_width, original_height = pil_img.size
                print(f'[TECH_SORT] JPEG size: {original_width}x{original_height}')
                
                # Уменьшаем в PIL сразу (в 10х экономичнее по памяти чем в OpenCV)
                max_dimension = 800
                if max(original_width, original_height) > max_dimension:
                    scale = max_dimension / max(original_width, original_height)
                    new_width = int(original_width * scale)
                    new_height = int(original_height * scale)
                    pil_img = pil_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    print(f'[TECH_SORT] Resized in PIL: {original_width}x{original_height} → {new_width}x{new_height}')
                
                if pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')
                
                # Теперь конвертируем УМЕНЬШЕННОЕ изображение в OpenCV
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                del pil_img  # Освобождаем PIL объект
                print(f'[TECH_SORT] Converted to OpenCV: {img.shape[1]}x{img.shape[0]}')
                
            except Exception as decode_err:
                print(f'[TECH_SORT] PIL decode failed: {str(decode_err)}, trying OpenCV')
                img = cv2.imdecode(np.frombuffer(img_data, np.uint8), cv2.IMREAD_COLOR)
        
        if img is None:
            print(f'[TECH_SORT] ⚠️ Failed to decode image')
            return False, ''
        
        # Освобождаем память от оригинального изображения если было уменьшение
        import gc
        gc.collect()
        
        # Проверяем технические параметры в порядке приоритета

        # 1. Сначала ищем лица нейросетью — она видит их и в профиль.
        #    Если люди есть, ВСЕ проверки идут по лицу, а не по кадру:
        #    тёмный фон студии и белая циклорама больше не дают ложный брак.
        faces = detect_faces(img)

        if not faces:
            # Людей в кадре нет — судим по всему кадру, как раньше
            if detect_overexposed(img):
                return True, 'overexposed'

            if detect_underexposed(img):
                return True, 'underexposed'

            if detect_blur(img):
                return True, 'blur'

            print('[TECH_SORT] ✅ No faces, photo passed all checks')
            return False, ''

        # 2. Экспозиция ПО ЛИЦУ: важно, чтобы читалась кожа,
        #    а не то, какой яркости фон за спиной.
        main_face_exp = max(faces, key=lambda f: f['box'][2] * f['box'][3])
        mean, blown, crushed = face_exposure(img, main_face_exp)
        print(f'[TECH_SORT] Face exposure: mean={mean:.1f}, blown={blown*100:.1f}%, crushed={crushed*100:.1f}%')

        if mean > FACE_TOO_BRIGHT or blown > 0.5:
            print('[TECH_SORT] ❌ Face overexposed → REJECT')
            return True, 'overexposed'

        if mean < FACE_TOO_DARK or crushed > 0.6:
            print('[TECH_SORT] ❌ Face underexposed → REJECT')
            return True, 'underexposed'

        # 3. Резкость по САМОМУ КРУПНОМУ лицу, а не по всему кадру.
        #    Портрет с размытым фоном больше не считается мыльным.
        main_face = max(faces, key=lambda f: f['box'][2] * f['box'][3])

        if face_is_measurable(img, main_face):
            sharpness = face_sharpness(img, main_face)
            print(f'[TECH_SORT] Face sharpness: {sharpness:.1f} (blur<{FACE_BLUR_REJECT}, ok>{FACE_BLUR_OK})')

            if sharpness < FACE_BLUR_REJECT:
                return True, 'blur'

            if sharpness < FACE_BLUR_OK:
                # Пограничная резкость — не решаем сами, отдаём фотографу
                return True, 'review_blur'
        else:
            # Лицо слишком мелкое для оценки — судим по всему кадру
            print(f'[TECH_SORT] Face too small ({main_face["box"][2]}x{main_face["box"][3]}), using frame blur')
            if detect_blur(img):
                return True, 'blur'

        # 4. Глаза: проверяем ВСЕ лица в кадре по точкам от нейросети.
        #    Взгляд в сторону при резком кадре браком НЕ считается.
        closed = 0
        uncertain = 0
        for face in faces:
            state, detail = eyes_state(img, face)
            print(f'[TECH_SORT] Face {face["box"]}: eyes={state} ({detail})')
            if state == EYES_CLOSED:
                closed += 1
            elif state == EYES_UNCERTAIN:
                uncertain += 1

        if closed > 0:
            print(f'[TECH_SORT] ❌ Closed eyes on {closed} face(s) → REJECT')
            return True, 'closed_eyes'

        if uncertain > 0:
            print(f'[TECH_SORT] ⚠️ Uncertain eyes on {uncertain} face(s) → REVIEW')
            return True, 'review_eyes'

        # Все проверки пройдены - фото ОК
        print(f'[TECH_SORT] ✅ Photo passed all checks')
        return False, ''
        
    except Exception as e:
        print(f'[TECH_SORT] Error analyzing photo: {str(e)}')
        return False, ''


def handler(event: dict, context) -> dict:
    '''
    Анализирует фото в папке на технический брак и сортирует в tech_rejects
    Улучшенный алгоритм с фокусом на уменьшение ложных срабатываний
    Batch processing по 5 фото (оптимизация памяти для RAW + высокое разрешение)
    '''
    try:
        print('[TECH_SORT] Handler started')
        print(f'[TECH_SORT] Event: {json.dumps(event, ensure_ascii=False, default=str)}')
        
        # Обрабатываем OPTIONS запрос для CORS
        method = event.get('httpMethod', 'POST')
        if method == 'OPTIONS':
            return {
                'statusCode': 200,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id'
                },
                'body': ''
            }
        
        # Парсим тело запроса
        body_raw = event.get('body', '{}')
        if isinstance(body_raw, str):
            try:
                body = json.loads(body_raw) if body_raw else {}
            except json.JSONDecodeError:
                body = {}
        else:
            body = body_raw if isinstance(body_raw, dict) else {}
        
        folder_id = body.get('folder_id') if isinstance(body, dict) else None
        reset_analysis = body.get('reset_analysis', False) if isinstance(body, dict) else False
        
        if not folder_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'folder_id is required'})
            }
        
        headers = event.get('headers', {})
        if not isinstance(headers, dict):
            headers = {}
        
        user_id = headers.get('X-User-Id') or headers.get('x-user-id')
        if not user_id:
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'User not authenticated'})
            }
        
        user_id = int(user_id)
        print(f'[TECH_SORT] Processing folder_id={folder_id}, user_id={user_id}, reset_analysis={reset_analysis}')
        
        # Подключаемся к БД
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        
        # Настраиваем S3 клиент (используем Yandex Cloud S3 как в photo-restore)
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            region_name='ru-central1',
            aws_access_key_id=os.environ['YC_S3_KEY_ID'],
            aws_secret_access_key=os.environ['YC_S3_SECRET'],
            config=Config(signature_version='s3v4')
        )
        bucket = 'foto-mix'
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Если reset_analysis=True - восстанавливаем все фото из tech_rejects и сбрасываем флаги
            if reset_analysis:
                print('[TECH_SORT] Resetting analysis: restoring photos from tech_rejects and clearing flags')
                
                # Находим папку tech_rejects
                cur.execute('''
                    SELECT id FROM t_p28211681_photo_secure_web.photo_folders
                    WHERE user_id = %s AND parent_folder_id = %s 
                      AND folder_type = 'tech_rejects' AND is_trashed = FALSE
                ''', (user_id, folder_id))
                
                tech_rejects_folder = cur.fetchone()
                
                if tech_rejects_folder:
                    tech_rejects_id = tech_rejects_folder['id']
                    print(f'[TECH_SORT] Found tech_rejects folder: {tech_rejects_id}')
                    
                    # Перемещаем все фото обратно в оригинальную папку
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_bank
                        SET folder_id = %s, tech_reject_reason = NULL
                        WHERE folder_id = %s AND user_id = %s AND is_trashed = FALSE
                    ''', (folder_id, tech_rejects_id, user_id))
                    
                    restored_count = cur.rowcount
                    print(f'[TECH_SORT] Restored {restored_count} photos from tech_rejects')
                    
                    # Удаляем пустую папку tech_rejects
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_folders
                        SET is_trashed = TRUE
                        WHERE id = %s
                    ''', (tech_rejects_id,))
                    
                    print('[TECH_SORT] Deleted empty tech_rejects folder')

                # Возвращаем фото и из папки «Проверить»
                cur.execute('''
                    SELECT id FROM t_p28211681_photo_secure_web.photo_folders
                    WHERE user_id = %s AND parent_folder_id = %s
                      AND folder_type = 'review' AND is_trashed = FALSE
                ''', (user_id, folder_id))

                review_folder = cur.fetchone()

                if review_folder:
                    review_id = review_folder['id']
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_bank
                        SET folder_id = %s, tech_reject_reason = NULL
                        WHERE folder_id = %s AND user_id = %s AND is_trashed = FALSE
                    ''', (folder_id, review_id, user_id))
                    print(f'[TECH_SORT] Restored {cur.rowcount} photos from review folder')

                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_folders
                        SET is_trashed = TRUE
                        WHERE id = %s
                    ''', (review_id,))
                    print('[TECH_SORT] Deleted empty review folder')

                # Сбрасываем флаги анализа для всех фото в папке
                cur.execute('''
                    UPDATE t_p28211681_photo_secure_web.photo_bank
                    SET tech_analyzed = FALSE, tech_reject_reason = NULL
                    WHERE folder_id = %s AND user_id = %s AND is_trashed = FALSE
                ''', (folder_id, user_id))
                
                reset_count = cur.rowcount
                conn.commit()
                print(f'[TECH_SORT] Reset tech_analyzed flag for {reset_count} photos')
            
            # Создаём папку tech_rejects если её нет (до выборки фото, чтобы она была маркером)
            cur.execute('''
                SELECT id FROM t_p28211681_photo_secure_web.photo_folders
                WHERE user_id = %s AND parent_folder_id = %s 
                  AND folder_type = 'tech_rejects' AND is_trashed = FALSE
            ''', (user_id, folder_id))
            
            tech_rejects_folder = cur.fetchone()
            
            if not tech_rejects_folder:
                # Получаем имя родительской папки
                cur.execute('''
                    SELECT folder_name FROM t_p28211681_photo_secure_web.photo_folders
                    WHERE id = %s AND user_id = %s
                ''', (folder_id, user_id))
                
                parent_folder = cur.fetchone()
                parent_name = parent_folder['folder_name'] if parent_folder else 'Загрузка'
                tech_rejects_name = f'{parent_name} - Технический брак'
                
                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.photo_folders 
                    (user_id, parent_folder_id, folder_name, folder_type, created_at)
                    VALUES (%s, %s, %s, 'tech_rejects', NOW())
                    RETURNING id
                ''', (user_id, folder_id, tech_rejects_name))
                
                tech_rejects_id = cur.fetchone()['id']
                conn.commit()
                print(f'[TECH_SORT] Created tech_rejects folder: {tech_rejects_id}')
            else:
                tech_rejects_id = tech_rejects_folder['id']
                print(f'[TECH_SORT] Using existing tech_rejects folder: {tech_rejects_id}')

            # Папка «Проверить» — для спорных кадров, где алгоритм не уверен.
            # Создаём лениво: только когда реально появится такое фото.
            review_folder_id = None

            def get_review_folder_id():
                '''Возвращает id папки «Проверить», создавая её при первой необходимости.'''
                nonlocal review_folder_id
                if review_folder_id is not None:
                    return review_folder_id

                cur.execute('''
                    SELECT id FROM t_p28211681_photo_secure_web.photo_folders
                    WHERE user_id = %s AND parent_folder_id = %s
                      AND folder_type = 'review' AND is_trashed = FALSE
                ''', (user_id, folder_id))
                existing = cur.fetchone()

                if existing:
                    review_folder_id = existing['id']
                    print(f'[TECH_SORT] Using existing review folder: {review_folder_id}')
                    return review_folder_id

                cur.execute('''
                    SELECT folder_name FROM t_p28211681_photo_secure_web.photo_folders
                    WHERE id = %s AND user_id = %s
                ''', (folder_id, user_id))
                parent = cur.fetchone()
                parent_name = parent['folder_name'] if parent else 'Загрузка'

                cur.execute('''
                    INSERT INTO t_p28211681_photo_secure_web.photo_folders
                    (user_id, parent_folder_id, folder_name, folder_type, created_at)
                    VALUES (%s, %s, %s, 'review', NOW())
                    RETURNING id
                ''', (user_id, folder_id, f'{parent_name} - Проверить'))

                review_folder_id = cur.fetchone()['id']
                conn.commit()
                print(f'[TECH_SORT] Created review folder: {review_folder_id}')
                return review_folder_id
            
            # Находим фото которые ещё не анализировались (batch по 5 фото для оптимизации памяти)
            cur.execute('''
                SELECT id, s3_key, file_name
                FROM t_p28211681_photo_secure_web.photo_bank
                WHERE folder_id = %s AND user_id = %s 
                  AND is_trashed = FALSE
                  AND (tech_analyzed = FALSE OR tech_analyzed IS NULL)
                ORDER BY created_at
                LIMIT 5
            ''', (folder_id, user_id))
            
            photos = cur.fetchall()
            print(f'[TECH_SORT] Found {len(photos)} photos to analyze')
            
            if len(photos) == 0:
                # Проверяем сколько осталось необработанных
                cur.execute('''
                    SELECT COUNT(*) as remaining
                    FROM t_p28211681_photo_secure_web.photo_bank
                    WHERE folder_id = %s AND user_id = %s 
                      AND is_trashed = FALSE
                      AND (tech_analyzed = FALSE OR tech_analyzed IS NULL)
                ''', (folder_id, user_id))
                
                remaining = cur.fetchone()['remaining']
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'processed': 0,
                        'rejected': 0,
                        'remaining': remaining,
                        'message': 'No photos to analyze'
                    })
                }
            
            # Анализируем каждое фото
            rejected_count = 0
            review_count = 0
            processed_count = 0
            
            for photo in photos:
                photo_id = photo['id']
                s3_key = photo['s3_key']
                file_name = photo['file_name']
                
                print(f'[TECH_SORT] Processing photo {photo_id}: {file_name}')
                
                # Анализируем фото с защитой от краша
                try:
                    is_rejected, reject_reason = analyze_photo(s3_client, bucket, s3_key)
                    
                    if is_rejected and reject_reason in REVIEW_REASONS:
                        # Спорный случай — не браковать, отдать фотографу на решение
                        target_folder = get_review_folder_id()
                        cur.execute('''
                            UPDATE t_p28211681_photo_secure_web.photo_bank
                            SET folder_id = %s, tech_analyzed = TRUE, tech_reject_reason = %s
                            WHERE id = %s
                        ''', (target_folder, reject_reason, photo_id))

                        review_count += 1
                        print(f'[TECH_SORT] ⚠️ Photo {photo_id} → review: {reject_reason}')
                    elif is_rejected:
                        # Перемещаем в tech_rejects
                        cur.execute('''
                            UPDATE t_p28211681_photo_secure_web.photo_bank
                            SET folder_id = %s, tech_analyzed = TRUE, tech_reject_reason = %s
                            WHERE id = %s
                        ''', (tech_rejects_id, reject_reason, photo_id))
                        
                        rejected_count += 1
                        print(f'[TECH_SORT] ❌ Photo {photo_id} rejected: {reject_reason}')
                    else:
                        # Помечаем как проанализированное
                        cur.execute('''
                            UPDATE t_p28211681_photo_secure_web.photo_bank
                            SET tech_analyzed = TRUE
                            WHERE id = %s
                        ''', (photo_id,))
                        
                        print(f'[TECH_SORT] ✅ Photo {photo_id} accepted')
                    
                    processed_count += 1
                    
                except Exception as photo_err:
                    # Если фото не удалось обработать - помечаем как проанализированное (пропускаем)
                    print(f'[TECH_SORT] ⚠️ Failed to analyze photo {photo_id}: {str(photo_err)}')
                    cur.execute('''
                        UPDATE t_p28211681_photo_secure_web.photo_bank
                        SET tech_analyzed = TRUE
                        WHERE id = %s
                    ''', (photo_id,))
                    processed_count += 1
                
                # Коммитим после каждого фото + принудительная очистка памяти
                conn.commit()
                import gc
                gc.collect()
            
            # Проверяем сколько ещё осталось необработанных
            cur.execute('''
                SELECT COUNT(*) as remaining
                FROM t_p28211681_photo_secure_web.photo_bank
                WHERE folder_id = %s AND user_id = %s 
                  AND is_trashed = FALSE
                  AND (tech_analyzed = FALSE OR tech_analyzed IS NULL)
            ''', (folder_id, user_id))
            
            remaining = cur.fetchone()['remaining']
            
            print(f'[TECH_SORT] Batch completed: processed={processed_count}, rejected={rejected_count}, review={review_count}, remaining={remaining}')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'processed': processed_count,
                    'rejected': rejected_count,
                    'review': review_count,
                    'remaining': remaining,
                    'tech_rejects_folder_id': tech_rejects_id,
                    'review_folder_id': review_folder_id
                })
            }
    
    except Exception as e:
        print(f'[TECH_SORT] Error: {str(e)}')
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }