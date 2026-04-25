import json
import os
import io
import base64
import uuid
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import boto3
from botocore.client import Config
from PIL import Image, ImageFilter, ImageOps
import numpy as np


RAW_EXTENSIONS = ('.cr2', '.cr3', '.nef', '.arw', '.dng', '.orf', '.rw2', '.raw', '.raf')


def _is_raw_filename(name):
    if not name:
        return False
    return name.lower().endswith(RAW_EXTENSIONS)


def _pick_source_key_for_processing(photo):
    """Для RAW (CR2/NEF/...) возвращает thumbnail_s3_key (готовый JPEG превью),
    т.к. cloud-функция не имеет rawpy. Для обычных JPEG/PNG — исходный s3_key.
    """
    fname = photo.get('file_name') or ''
    is_raw = bool(photo.get('is_raw')) or _is_raw_filename(fname)
    if is_raw:
        thumb_key = photo.get('thumbnail_s3_key')
        if thumb_key:
            return thumb_key, True
    return photo.get('s3_key'), False


def _open_image_oriented(image_bytes):
    """Открывает фото и применяет EXIF Orientation (вертикальные кадры
    остаются вертикальными). Возвращает RGB Image.
    """
    img = Image.open(io.BytesIO(image_bytes))
    try:
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        print(f"[RETOUCH] exif_transpose failed: {e}")
    if img.mode != 'RGB':
        img = img.convert('RGB')
    return img


S3_BUCKET = "foto-mix"
API_BASE = "https://io.foto-mix.ru/api/v2"
RETOUCH_BASIC_USER = os.environ.get("RETOUCH_BASIC_USER", "admin")
RETOUCH_BASIC_PASS = os.environ.get("RETOUCH_BASIC_PASS", "")
MAX_ACTIVE_TASKS_PER_USER = 10
DEFAULT_STRENGTH = 0.6
DEFAULT_ENHANCE_FACE = False


def _get_s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )


def _presigned_url(s3_key):
    return _get_s3_client().generate_presigned_url(
        'get_object',
        Params={'Bucket': S3_BUCKET, 'Key': s3_key},
        ExpiresIn=3600
    )


def _auth_header():
    auth_str = base64.b64encode(f"{RETOUCH_BASIC_USER}:{RETOUCH_BASIC_PASS}".encode()).decode()
    return f"Basic {auth_str}"


def _cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
        'Access-Control-Max-Age': '86400'
    }


def _response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(body, default=str),
        'isBase64Encoded': False
    }


def _extract_s3_key(url):
    prefix = f"https://storage.yandexcloud.net/{S3_BUCKET}/"
    if url and url.startswith(prefix):
        return url[len(prefix):]
    return None


def _build_out_key(in_key):
    parts = in_key.rsplit("/", 1)
    if len(parts) == 2:
        return f"{parts[0]}/retouch/{parts[1]}"
    return f"retouch/{in_key}"


def _ensure_jpeg_bytes(image_bytes, file_name=None):
    """Конвертирует изображение в JPEG, если формат не JPG/PNG — внешний API ретуши не умеет webp/heic/bmp/tiff/gif.
    Возвращает (bytes, was_converted).
    """
    try:
        img = Image.open(io.BytesIO(image_bytes))
        fmt = (img.format or '').upper()
    except Exception as e:
        print(f"[RETOUCH] Cannot open image ({file_name}): {e}")
        raise

    # Если EXIF Orientation требует поворота — применяем и пересохраняем,
    # иначе вертикальные кадры уйдут в API горизонтально.
    needs_rotate = False
    try:
        exif = img.getexif()
        if exif and exif.get(0x0112, 1) not in (1, 0):
            needs_rotate = True
    except Exception:
        pass

    if needs_rotate:
        rotated = ImageOps.exif_transpose(img)
        if rotated.mode not in ('RGB', 'L'):
            rotated = rotated.convert('RGB')
        buf = io.BytesIO()
        rotated.save(buf, format='JPEG', quality=95)
        return buf.getvalue(), True

    # JPEG отправляем как есть
    if fmt in ('JPEG', 'JPG'):
        return image_bytes, False

    # PNG без альфы — API обычно ест. С альфой — лучше сразу в JPEG.
    if fmt == 'PNG' and img.mode in ('RGB', 'L'):
        return image_bytes, False

    # Всё остальное (WEBP, HEIC, BMP, TIFF, GIF, RGBA-PNG и т.п.) — перегоняем в JPEG
    if img.mode not in ('RGB', 'L'):
        if img.mode == 'RGBA' or 'transparency' in img.info:
            bg = Image.new('RGB', img.size, (255, 255, 255))
            bg.paste(img.convert('RGBA'), mask=img.convert('RGBA').split()[-1])
            img = bg
        else:
            img = img.convert('RGB')

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=95, optimize=True)
    print(f"[RETOUCH] Converted {fmt} -> JPEG ({file_name}): {len(image_bytes)} -> {buf.tell()} bytes")
    return buf.getvalue(), True


def _load_retouch_settings(conn):
    strength = DEFAULT_STRENGTH
    enhance_face = DEFAULT_ENHANCE_FACE
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT pipeline_json FROM retouch_presets WHERE name = 'default' LIMIT 1")
            row = cur.fetchone()
            if row and row['pipeline_json']:
                pipeline = row['pipeline_json']
                if isinstance(pipeline, str):
                    pipeline = json.loads(pipeline)
                if isinstance(pipeline, list) and len(pipeline) > 0:
                    first = pipeline[0]
                    if isinstance(first, dict):
                        strength = first.get('strength', DEFAULT_STRENGTH)
                        enhance_face = first.get('enhance_face', DEFAULT_ENHANCE_FACE)
    except Exception as e:
        print(f"[RETOUCH] Failed to load preset settings: {e}")
    return strength, enhance_face


def _submit_async_task(image_base64, strength=0.6, enhance_face=False):
    """POST /api/v2/submit — поставить задачу в очередь, получить task_id."""
    resp = requests.post(
        f"{API_BASE}/submit",
        headers={
            'Content-Type': 'application/json',
            'Authorization': _auth_header()
        },
        json={
            'image': image_base64,
            'strength': strength,
            'enhance_face': enhance_face
        },
        timeout=(30, 120)
    )
    print(f"[RETOUCH] Submit response: status={resp.status_code} body={resp.text[:500]}")

    if resp.status_code in (200, 201, 202):
        data = resp.json()
        api_task_id = data.get('task_id')
        if not api_task_id:
            raise RuntimeError(f"No task_id in submit response: {resp.text[:300]}")
        return api_task_id, data.get('status', 'queued')
    else:
        try:
            error_data = resp.json()
            error_msg = error_data.get('error', f'HTTP {resp.status_code}')
        except Exception:
            error_msg = f'HTTP {resp.status_code}: {resp.text[:200]}'
        raise RuntimeError(f"Retouch API submit error: {error_msg}")


def _check_api_status(api_task_id):
    """GET /api/v2/status/<task_id> — проверить статус задачи."""
    resp = requests.get(
        f"{API_BASE}/status/{api_task_id}",
        headers={'Authorization': _auth_header()},
        timeout=(5, 30)
    )
    print(f"[RETOUCH] Status check {api_task_id}: status={resp.status_code} body={resp.text[:500]}")

    if resp.status_code in (200, 202):
        try:
            return resp.json()
        except Exception:
            text = resp.text.strip()
            if text:
                return json.loads(text)
    return {'status': 'pending'}


def _generate_thumbnails_from_bytes(s3_client, result_key, file_bytes):
    try:
        img = Image.open(io.BytesIO(file_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')

        prefix = result_key.rsplit('/', 1)[0] if '/' in result_key else ''
        thumb_prefix = f"{prefix}/thumbnails" if prefix else "thumbnails"

        img.thumbnail((800, 800), Image.Resampling.LANCZOS)
        thumb_buf = io.BytesIO()
        img.save(thumb_buf, format='JPEG', quality=85)
        thumb_key = f"{thumb_prefix}/{uuid.uuid4()}.jpg"
        s3_client.put_object(Bucket=S3_BUCKET, Key=thumb_key, Body=thumb_buf.getvalue(), ContentType='image/jpeg')
        thumb_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{thumb_key}"

        img.thumbnail((400, 400), Image.Resampling.LANCZOS)
        grid_buf = io.BytesIO()
        img.save(grid_buf, format='JPEG', quality=60, optimize=True)
        grid_key = f"{thumb_prefix}/grid_{uuid.uuid4()}.jpg"
        s3_client.put_object(Bucket=S3_BUCKET, Key=grid_key, Body=grid_buf.getvalue(), ContentType='image/jpeg')
        grid_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{grid_key}"

        print(f"[RETOUCH] Thumbnails created: {thumb_key}, {grid_key}")
        return thumb_key, thumb_url, grid_key, grid_url
    except Exception as e:
        print(f"[RETOUCH] Thumbnail generation failed: {e}")
        return None, None, None, None


def _get_or_create_retouch_folder(conn, user_id, parent_folder_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM photo_folders WHERE user_id = %s AND parent_folder_id = %s AND folder_type = 'retouch' AND is_trashed = FALSE LIMIT 1",
            (user_id, parent_folder_id)
        )
        existing = cur.fetchone()
        if existing:
            return existing['id']

        cur.execute("SELECT folder_name FROM photo_folders WHERE id = %s", (parent_folder_id,))
        parent = cur.fetchone()
        parent_name = parent['folder_name'] if parent else 'Папка'

        cur.execute(
            "INSERT INTO photo_folders (user_id, folder_name, folder_type, parent_folder_id) VALUES (%s, %s, 'retouch', %s) RETURNING id",
            (user_id, f"{parent_name} — Ретушь", parent_folder_id)
        )
        new_folder = cur.fetchone()
        conn.commit()
        print(f"[RETOUCH] Created retouch folder id={new_folder['id']} for parent={parent_folder_id}")
        return new_folder['id']


def _save_retouched_photo(conn, user_id, photo_id, result_key, result_url, result_bytes=None):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT folder_id, file_name, file_size, width, height, content_type FROM photo_bank WHERE id = %s",
            (photo_id,)
        )
        original = cur.fetchone()

    if not original:
        print(f"[RETOUCH] Original photo {photo_id} not found, skipping save")
        return

    retouch_folder_id = _get_or_create_retouch_folder(conn, user_id, original['folder_id'])

    s3_client = _get_s3_client()
    thumb_key, thumb_url, grid_key, grid_url = None, None, None, None
    if result_bytes:
        thumb_key, thumb_url, grid_key, grid_url = _generate_thumbnails_from_bytes(s3_client, result_key, result_bytes)

    orig_name = original['file_name']
    base_name = orig_name.rsplit('.', 1)[0] if '.' in orig_name else orig_name
    file_name = f"{base_name}.jpg"

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id FROM photo_bank WHERE folder_id = %s AND s3_key = %s AND is_trashed = FALSE LIMIT 1",
            (retouch_folder_id, result_key)
        )
        existing = cur.fetchone()

    if existing:
        with conn.cursor() as cur:
            cur.execute(
                '''UPDATE photo_bank SET s3_url = %s,
                   thumbnail_s3_key = COALESCE(%s, thumbnail_s3_key), thumbnail_s3_url = COALESCE(%s, thumbnail_s3_url),
                   grid_thumbnail_s3_key = COALESCE(%s, grid_thumbnail_s3_key), grid_thumbnail_s3_url = COALESCE(%s, grid_thumbnail_s3_url)
                   WHERE id = %s''',
                (result_url, thumb_key, thumb_url, grid_key, grid_url, existing['id'])
            )
            conn.commit()
        print(f"[RETOUCH] Updated existing retouched photo {existing['id']}")
    else:
        with conn.cursor() as cur:
            cur.execute(
                '''INSERT INTO photo_bank (folder_id, user_id, file_name, s3_key, s3_url,
                   thumbnail_s3_key, thumbnail_s3_url, grid_thumbnail_s3_key, grid_thumbnail_s3_url,
                   file_size, width, height, content_type)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                (retouch_folder_id, user_id, file_name, result_key, result_url,
                 thumb_key, thumb_url, grid_key, grid_url,
                 len(result_bytes) if result_bytes else original['file_size'] or 0,
                 original['width'], original['height'], 'image/jpeg')
            )
            conn.commit()
        print(f"[RETOUCH] Saved retouched photo to folder {retouch_folder_id}: {file_name}")


def _normalize_image_bytes(raw_bytes):
    """Привести байты к валидному JPEG. Поддерживает JPEG/PNG/PPM/WEBP и JSON-обёртку с base64."""
    if not raw_bytes:
        raise RuntimeError("Empty result bytes")

    head = raw_bytes[:1]
    if head in (b'{', b'['):
        try:
            parsed = json.loads(raw_bytes.decode('utf-8', errors='ignore'))
            b64 = None
            if isinstance(parsed, dict):
                b64 = parsed.get('image') or parsed.get('result') or parsed.get('data') or parsed.get('image_base64')
            if not b64:
                raise RuntimeError(f"JSON response without image field: {list(parsed.keys()) if isinstance(parsed, dict) else 'list'}")
            if isinstance(b64, str) and b64.startswith('data:'):
                b64 = b64.split(',', 1)[1]
            raw_bytes = base64.b64decode(b64)
            print(f"[RETOUCH] Decoded base64 from JSON: {len(raw_bytes)} bytes")
        except Exception as e:
            raise RuntimeError(f"Failed to parse JSON image response: {e}")

    if raw_bytes[:2] == b'P6' or raw_bytes[:2] == b'P3':
        print(f"[RETOUCH] PPM format detected, converting to JPEG")
        img = Image.open(io.BytesIO(raw_bytes))
        buf = io.BytesIO()
        img.convert('RGB').save(buf, format='JPEG', quality=95)
        return buf.getvalue()

    try:
        img = Image.open(io.BytesIO(raw_bytes))
        fmt = (img.format or '').upper()
        if fmt == 'JPEG':
            return raw_bytes
        print(f"[RETOUCH] Converting {fmt} -> JPEG")
        buf = io.BytesIO()
        img.convert('RGB').save(buf, format='JPEG', quality=95)
        return buf.getvalue()
    except Exception as e:
        raise RuntimeError(f"Invalid image bytes: {e}")


def _compose_with_original_by_mask(s3_client, in_key, retouched_bytes):
    """Смешивает результат внешнего API с оригиналом по маске кожи:
    - внутри маски (кожа, дефекты) — пиксели ретуши,
    - снаружи (волосы, брови, одежда, фон) — пиксели оригинала.

    Это защищает не-кожу от сглаживания внешним API.
    """
    from skin_mask import build_face_skin_mask

    # 1) Скачиваем оригинал
    try:
        orig_obj = s3_client.get_object(Bucket=S3_BUCKET, Key=in_key)
        orig_bytes = orig_obj['Body'].read()
    except Exception as e:
        print(f"[RETOUCH] Cannot fetch original {in_key}: {e}")
        return retouched_bytes

    try:
        orig_img = Image.open(io.BytesIO(orig_bytes)).convert('RGB')
        ret_img = Image.open(io.BytesIO(retouched_bytes)).convert('RGB')
    except Exception as e:
        print(f"[RETOUCH] Cannot open images for compose: {e}")
        return retouched_bytes

    # ОГРАНИЧЕНИЕ ПАМЯТИ: Cloud Function имеет 256MB лимита.
    # Фото >1800px по стороне не помещается (float32 * 3 канала * 3 копии = OOM).
    # Ресайзим ДО композиции, это же разрешение отдаём наружу.
    MAX_COMPOSE_SIDE = 1800
    ow_orig, oh_orig = orig_img.size
    if max(ow_orig, oh_orig) > MAX_COMPOSE_SIDE:
        scale = MAX_COMPOSE_SIDE / max(ow_orig, oh_orig)
        new_w = int(ow_orig * scale)
        new_h = int(oh_orig * scale)
        orig_img = orig_img.resize((new_w, new_h), Image.LANCZOS)
        print(f"[RETOUCH] Downscaled {ow_orig}x{oh_orig} -> {new_w}x{new_h} для композиции (лимит памяти)")

    # Приводим результат к размеру оригинала (после возможного ресайза).
    if ret_img.size != orig_img.size:
        ret_img = ret_img.resize(orig_img.size, Image.LANCZOS)

    # 2) Строим маску по оригиналу (тот же алгоритм, что и preview_mask).
    #    Ограничиваем размер превью для скорости (внутри build_auto_mask
    #    работа уже на 1024-пиксельном max-side, но снаружи мы тоже уменьшим).
    preview_side = 1024
    ow, oh = orig_img.size
    if max(ow, oh) > preview_side:
        ratio = preview_side / max(ow, oh)
        small = orig_img.resize((int(ow * ratio), int(oh * ratio)), Image.LANCZOS)
    else:
        small = orig_img

    buf = io.BytesIO()
    small.save(buf, format='JPEG', quality=85)
    try:
        mask_b64 = build_face_skin_mask(buf.getvalue())
    except Exception as e:
        print(f"[RETOUCH] build_face_skin_mask failed: {e}")
        return retouched_bytes

    try:
        mask_png = base64.b64decode(mask_b64)
        mask_img = Image.open(io.BytesIO(mask_png))
        # build_auto_mask теперь возвращает RGBA; берём альфу как интенсивность маски.
        if mask_img.mode == 'RGBA':
            mask_gray = mask_img.split()[-1]
        else:
            mask_gray = mask_img.convert('L')
    except Exception as e:
        print(f"[RETOUCH] Cannot decode mask: {e}")
        return retouched_bytes

    # Маска сейчас в размере small — растягиваем до размера оригинала.
    if mask_gray.size != orig_img.size:
        mask_gray = mask_gray.resize(orig_img.size, Image.BILINEAR)

    # 3) Смягчаем края маски, чтобы не было резких границ между "кожа" и "не-кожа".
    feather_r = max(4, min(ow, oh) // 200)
    mask_gray = mask_gray.filter(ImageFilter.GaussianBlur(radius=feather_r))

    # 4) Композиция: где маска — берём ретушь, где нет — оригинал.
    mask_arr = np.array(mask_gray, dtype=np.float32) / 255.0
    if mask_arr.max() < 0.05:
        print("[RETOUCH] Empty mask after compose — keeping raw retouched")
        return retouched_bytes

    # === АДАПТИВНАЯ КОМПОЗИЦИЯ с Frequency Separation ===
    # Идея: разделяем изображение на низкие частоты (тон, цвет, пятна)
    # и высокие (поры, волоски, текстура). LaMa убирает прыщи на LF, но ломает HF.
    # Поэтому берём LF от LaMa + HF от оригинала → чистая кожа С СОХРАНЁННОЙ ТЕКСТУРОЙ.
    #
    # Адаптивность: анализируем "возраст кожи" по текстурной активности:
    # - молодая с акне → сильное LF-сглаживание, полная HF (чистая кожа с порами)
    # - молодая чистая → слабое LF, полная HF (почти не трогаем)
    # - зрелая/пожилая → очень слабое LF, полная HF (НЕ превращаем в молодого)
    coverage = float(mask_arr.mean())
    if coverage < 0.01:
        print("[RETOUCH] Empty mask — keeping raw retouched")
        return retouched_bytes

    # === ДЕТЕКТОР ПЛАНА ПО ОТДЕЛЬНЫМ ЛИЦАМ ===
    # Прежний детектор по coverage был неточным: на групповом фото 5 мелких
    # лиц = 10% кадра → попадал в "closeup", хотя по факту это средний план.
    #
    # Новый алгоритм:
    # 1) Находим отдельные лица как connected-components в маске кожи.
    # 2) Для каждого лица оцениваем его высоту относительно высоты кадра
    #    и резкость (variance Лапласиана внутри bbox).
    # 3) Лица с низкой резкостью (вне фокуса) — игнорируем при выборе плана.
    # 4) Классификация по самому крупному лицу В ФОКУСЕ:
    #      ≥25% высоты — крупный план (полная ретушь, alpha ×1.0)
    #      10–25%      — средний план (alpha ×0.45)
    #       4–10%      — дальний план (только разглаживание, alpha ×0.20)
    #       <4%        — массовка, ретушь не нужна.
    # 5) Маска ретуши обнуляется на расфокусных лицах (фоновые гости),
    #    чтобы LaMa не "пластмассила" размытые лица.
    try:
        from skin_mask import build_focus_mask
        # build_focus_mask ожидает RGB uint8 + uint8 0..255 маску.
        orig_for_faces = np.array(orig_img, dtype=np.uint8)
        mask_u8 = (mask_arr * 255.0).clip(0, 255).astype(np.uint8)
        focus_mask_u8, shot_info = build_focus_mask(orig_for_faces, mask_u8)
        del orig_for_faces

        shot_type = shot_info.get('shot_type', 'closeup')
        plan_multiplier = float(shot_info.get('plan_multiplier', 1.0))
        print(
            f"[RETOUCH] Shot detector: {shot_info.get('reason')} "
            f"focus_faces={shot_info.get('focus_faces_count')} "
            f"total_faces={shot_info.get('total_faces')} → "
            f"shot={shot_type} plan_mult={plan_multiplier:.2f}"
        )

        # Подменяем mask_arr на маску только лиц в фокусе.
        if focus_mask_u8 is not None and np.count_nonzero(focus_mask_u8) > 0:
            mask_arr = focus_mask_u8.astype(np.float32) / 255.0
        # На дальних планах оставляем только лёгкое разглаживание — это
        # уже учтено через plan_multiplier=0.20.
    except Exception as e:
        print(f"[RETOUCH] Face-based shot detector failed, fallback to coverage: {e}")
        skin_pct = coverage * 100
        if skin_pct >= 15:
            shot_type = "closeup"
            plan_multiplier = 1.0
        elif skin_pct >= 5:
            shot_type = "medium"
            plan_multiplier = 0.45
        elif skin_pct >= 2:
            shot_type = "wide"
            plan_multiplier = 0.22
        else:
            shot_type = "very_wide"
            plan_multiplier = 0.0
        print(f"[RETOUCH] Fallback shot: {shot_type} (skin={skin_pct:.1f}% of frame) → plan_mult={plan_multiplier:.2f}")

    # На очень дальнем плане ретушь бесполезна — слишком мало пикселей на лицах.
    # Возвращаем оригинал (без применения ретуши сервера вообще).
    if plan_multiplier == 0:
        print("[RETOUCH] Very wide shot — skipping retouch, returning original")
        # Возвращаем оригинал в исходном размере:
        out_buf = io.BytesIO()
        orig_img.save(out_buf, format='JPEG', quality=95)
        return out_buf.getvalue()

    # ЭКОНОМИЯ ПАМЯТИ: работаем в int16 вместо float32 (в 2 раза меньше RAM).
    # Детектор возраста кожи запускаем ДО создания больших массивов.
    w_full, h_full = orig_img.size

    # --- Детектор "возраста кожи" на уменьшенной версии (512px) ---
    det_side = 512
    scale = det_side / max(h_full, w_full)
    if scale < 1:
        det_w, det_h = int(w_full * scale), int(h_full * scale)
        det_orig = np.array(orig_img.resize((det_w, det_h), Image.BILINEAR), dtype=np.float32)
        det_mask = np.array(
            Image.fromarray((mask_arr > 0.3).astype(np.uint8) * 255, 'L').resize((det_w, det_h), Image.BILINEAR)
        ) > 128
    else:
        det_orig = np.array(orig_img, dtype=np.float32)
        det_mask = mask_arr > 0.3

    mask_bool = mask_arr > 0.3

    gray = np.mean(det_orig, axis=2).astype(np.float32)
    blur_gray = np.array(
        Image.fromarray(gray.clip(0, 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(radius=4)),
        dtype=np.float32,
    )
    hf = gray - blur_gray
    skin_hf = hf[det_mask]
    if skin_hf.size > 100:
        hf_std = float(np.std(skin_hf))
        # Плотность локальных "всплесков" — грубая оценка дефектов.
        blob_density = float(np.mean(np.abs(skin_hf) > 12)) * 100
    else:
        hf_std, blob_density = 6.0, 0.0

    # === ДЕТЕКТОР МОРЩИН через структурный тензор ===
    # Морщины = линейные структуры (λ1 >> λ2, coherence → 1.0)
    # Прыщи/пятна = круглые blob'ы (λ1 ≈ λ2, coherence → 0)
    try:
        gx = np.gradient(blur_gray, axis=1).astype(np.float32)
        gy = np.gradient(blur_gray, axis=0).astype(np.float32)

        # Сглаживание компонент тензора через uint8-подход (stable в PIL).
        def _blur_tensor(a):
            # Нормализуем в uint8 → blur → обратно.
            amax = float(np.max(np.abs(a))) + 1e-6
            a_u8 = ((a / amax) * 127.0 + 128.0).clip(0, 255).astype(np.uint8)
            b_u8 = np.array(
                Image.fromarray(a_u8, 'L').filter(ImageFilter.GaussianBlur(radius=5))
            )
            return (b_u8.astype(np.float32) - 128.0) * (amax / 127.0)

        Jxx = _blur_tensor(gx * gx)
        Jyy = _blur_tensor(gy * gy)
        Jxy = _blur_tensor(gx * gy)
        del gx, gy
        trace = Jxx + Jyy
        det_val = Jxx * Jyy - Jxy * Jxy
        disc = np.maximum(trace * trace / 4.0 - det_val, 0.0)
        sq = np.sqrt(disc)
        lam1 = trace / 2.0 + sq
        lam2 = trace / 2.0 - sq
        denom = (lam1 + lam2) + 1e-6
        coherence = ((lam1 - lam2) / denom) ** 2
        strong = (trace > 4.0) & det_mask
        if strong.sum() > 100:
            wrinkle_score = float(np.mean(coherence[strong])) * 100
        else:
            wrinkle_score = 0.0
        del Jxx, Jyy, Jxy, trace, det_val, disc, sq, lam1, lam2, coherence
    except Exception as e:
        print(f"[RETOUCH] wrinkle detector failed: {e} — fallback to 0")
        wrinkle_score = 0.0

    # === АДАПТИВНАЯ СИЛА РЕТУШИ ===
    # wrinkle_score (0-100): высокий → много линейных структур (морщины) → щадяще
    # hf_std: общая активность текстуры
    # blob_density: круглые пятна (прыщи/постакне)
    #
    # Главная идея: ВЫСОКИЙ wrinkle_score → alpha ВНИЗ, независимо от других метрик.
    # Это защищает пожилые лица от "омолаживания".
    if wrinkle_score > 18:
        # Пожилая кожа: alpha=0.60. Сервер для mature НЕ делает cleanup (морщины
        # защищены), поэтому мы можем применить его результат сильнее — это уберёт
        # возрастные пигментные пятна (их сервер чистит на первом проходе LaMa),
        # но при этом морщины сохранятся, потому что сервер их не трогал.
        skin_type = "mature"
        lf_strength = 0.60
    elif wrinkle_score > 12 and hf_std > 8:
        # Зрелая с текстурой — тоже сильнее, пятна заметнее на таком лице.
        skin_type = "mature_textured"
        lf_strength = 0.65
    elif blob_density > 2.5 and wrinkle_score < 10:
        # Акне на молодой коже (пятна, но мало линий).
        skin_type = "young_acne"
        lf_strength = 0.85
    elif hf_std < 5:
        skin_type = "young_clean"
        lf_strength = 0.35
    else:
        skin_type = "normal"
        lf_strength = 0.55
    hf_from_orig = 1.0

    print(f"[RETOUCH] Skin: type={skin_type} hf_std={hf_std:.1f} blob={blob_density:.1f}% "
          f"wrinkle={wrinkle_score:.1f} → alpha={lf_strength:.2f}")

    # --- ПРОСТОЙ АЛЬФА-BLEND ---
    # Сервер уже сам делает: детекцию, LaMa, frequency separation, skin texture,
    # restore volume, GFPGAN. Наша задача — применить его результат ТОЛЬКО
    # на области кожи, а всё остальное (губы/глаза/брови/волосы/одежда/фон)
    # оставить оригинальным.
    #
    # Адаптивная сила: тип кожи → коэффициент смешивания с оригиналом.
    # Смесь = orig * (1 - m * alpha) + ret * (m * alpha)
    # где m = маска кожи, alpha = сила под тип кожи.

    # Эффективная сила смешивания: тип кожи × тип плана.
    # На среднем плане × 0.6, на дальнем × 0.3 — ретушь менее агрессивная
    # когда лицо занимает небольшую часть кадра.
    alpha = lf_strength * plan_multiplier
    print(f"[RETOUCH] Final alpha = {lf_strength:.2f} × {plan_multiplier:.2f} = {alpha:.2f}")

    # ЭКОНОМНАЯ КОМПОЗИЦИЯ: работаем в uint8 + int16 (в 2 раза меньше памяти чем float32).
    # Формула: out = orig + (ret - orig) * (effective_alpha_per_pixel)
    #
    # Базовая маска: m_u8 = mask * alpha
    m_u8 = (mask_arr * alpha * 255.0).clip(0, 255).astype(np.uint8)

    # Для mature лиц КРУПНОГО ПЛАНА: запрашиваем маску НОСА и усиливаем alpha до 0.90.
    # На носу особенно заметны возрастные пятна, а морщин на нём мало — можно чистить сильнее.
    # На средних/дальних планах усиление не нужно — лицо и так маленькое.
    if skin_type in ("mature", "mature_textured") and shot_type == "closeup":
        try:
            # Импорт локально, чтобы не ломать если skin_mask недоступен
            from skin_mask import _call_ai_face_parse
            # Ресайзим исходное изображение чтобы ИИ-маска соответствовала текущему размеру orig_img
            buf_nose = io.BytesIO()
            orig_img.save(buf_nose, format='JPEG', quality=85)
            nose_mask_np = _call_ai_face_parse(buf_nose.getvalue(), mode="nose")
            if nose_mask_np is not None and nose_mask_np.size > 0:
                # Маска носа в uint8 0/255. Сглаживаем края.
                nose_pil = Image.fromarray(nose_mask_np, mode='L').filter(
                    ImageFilter.GaussianBlur(radius=4)
                )
                nose_u8 = np.array(nose_pil)
                # На носу ставим alpha=0.90 вместо lf_strength (0.60)
                nose_alpha = int(0.90 * 255)
                # m_u8 = max(m_u8, nose_mask * 0.90) — поднимаем alpha в зоне носа
                nose_component = ((nose_u8.astype(np.float32) / 255.0) * nose_alpha).astype(np.uint8)
                m_u8 = np.maximum(m_u8, nose_component)
                nose_cov = float(np.count_nonzero(nose_u8 > 128)) * 100 / max(1, nose_u8.size)
                print(f"[RETOUCH] Nose boost: coverage={nose_cov:.1f}% alpha_on_nose=0.90")
                del nose_u8, nose_component, nose_mask_np
        except Exception as e:
            print(f"[RETOUCH] Nose boost failed (non-critical): {e}")

    del mask_arr, det_orig, det_mask  # освобождаем лишнее

    orig_u8 = np.array(orig_img, dtype=np.uint8)
    ret_u8 = np.array(ret_img, dtype=np.uint8)

    # === ЗАЩИТА ОТ ПЯТНА ПЕРЕСВЕТА ===
    # На средних/общих планах ретушь часто осветляет уже яркие участки кожи
    # (нос, лоб, скулы при контровом свете) — получается белое пятно.
    # Гасим маску там, где:
    #   1) пиксель оригинала уже очень светлый (Y > 215) — это естественный блик;
    #   2) ретушь пытается сделать пиксель ЕЩЁ ярче (ret_Y > orig_Y).
    # На closeup эффект слабее (там нос-усиление полезно), для medium/wide подавляем
    # сильнее, т.к. лицо мелкое и пятно сразу бросается в глаза.
    try:
        orig_y = (
            orig_u8[:, :, 0].astype(np.float32) * 0.299
            + orig_u8[:, :, 1].astype(np.float32) * 0.587
            + orig_u8[:, :, 2].astype(np.float32) * 0.114
        )
        ret_y = (
            ret_u8[:, :, 0].astype(np.float32) * 0.299
            + ret_u8[:, :, 1].astype(np.float32) * 0.587
            + ret_u8[:, :, 2].astype(np.float32) * 0.114
        )
        # 0 в самых ярких бликах, 1 в средних/тёмных тонах
        knee_lo, knee_hi = 200.0, 245.0
        bright = np.clip((orig_y - knee_lo) / (knee_hi - knee_lo), 0.0, 1.0)
        # подавление активно только если ретушь делает пиксель ярче
        brightening = np.clip((ret_y - orig_y) / 20.0, 0.0, 1.0)
        suppress_strength = 0.55 if shot_type == "closeup" else 0.85
        attenuation = 1.0 - bright * brightening * suppress_strength
        # сглаживаем чтобы не было резких границ
        att_pil = Image.fromarray((attenuation * 255.0).clip(0, 255).astype(np.uint8), 'L')
        att_pil = att_pil.filter(ImageFilter.GaussianBlur(radius=3))
        m_u8 = (m_u8.astype(np.float32) * (np.array(att_pil, dtype=np.float32) / 255.0)).clip(0, 255).astype(np.uint8)
        del orig_y, ret_y, bright, brightening, attenuation, att_pil
    except Exception as e:
        print(f"[RETOUCH] Highlight guard failed (non-critical): {e}")

    # diff = ret - orig (в int16 чтобы не терять знак)
    diff = ret_u8.astype(np.int16) - orig_u8.astype(np.int16)
    del ret_u8

    # Применяем маску канально: diff[y,x,c] *= m_u8[y,x] / 255
    # Работаем с одним каналом за раз чтобы экономить память.
    m_f = m_u8.astype(np.float32) / 255.0
    del m_u8
    for c in range(3):
        diff[:, :, c] = (diff[:, :, c].astype(np.float32) * m_f).astype(np.int16)
    del m_f

    # out = orig + diff (с клиппингом в uint8)
    result = np.clip(orig_u8.astype(np.int16) + diff, 0, 255).astype(np.uint8)
    del orig_u8, diff

    out_img = Image.fromarray(result, 'RGB')
    del result

    out_buf = io.BytesIO()
    out_img.save(out_buf, format='JPEG', quality=95)
    print(f"[RETOUCH] Composed: coverage={coverage*100:.1f}% skin={skin_type} alpha={alpha:.2f}")
    return out_buf.getvalue()


def _save_result_bytes(conn, user_id, task, result_bytes):
    """Сохранить готовые байты результата в S3 и БД."""
    s3_client = _get_s3_client()
    db_task_id = task['task_id']
    photo_id = task.get('photo_id')
    in_key = task.get('in_key', '')
    out_key = _build_out_key(in_key)

    if not out_key.endswith('.jpg'):
        out_key = out_key.rsplit('.', 1)[0] + '.jpg' if '.' in out_key else out_key + '.jpg'

    result_bytes = _normalize_image_bytes(result_bytes)

    # ПОСТ-ОБРАБОТКА: внешний API ретушит ВСЁ изображение (включая волосы, брови,
    # одежду), что делает их "мультяшными". Смешиваем результат с оригиналом
    # по нашей маске кожи — вне маски возвращаем пиксели оригинала.
    try:
        if in_key:
            result_bytes = _compose_with_original_by_mask(s3_client, in_key, result_bytes)
    except Exception as e:
        print(f"[RETOUCH] Skin-mask compose failed (using raw result): {e}")

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=out_key,
        Body=result_bytes,
        ContentType='image/jpeg'
    )
    final_url = f"https://storage.yandexcloud.net/{S3_BUCKET}/{out_key}"
    print(f"[RETOUCH] Uploaded to S3: {out_key} ({len(result_bytes)} bytes)")

    with conn.cursor() as cur:
        cur.execute(
            "UPDATE retouch_tasks SET status='finished', result_key=%s, result_url=%s, error_message=NULL, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
            (out_key, final_url, db_task_id, user_id)
        )
        conn.commit()

    if photo_id:
        _save_retouched_photo(conn, user_id, photo_id, out_key, final_url, result_bytes=result_bytes)

    return out_key, final_url


def _download_result_and_save(conn, user_id, task, result_url_from_api):
    """Скачать результат по URL, сохранить в свой бакет и в БД."""
    s3_client = _get_s3_client()

    print(f"[RETOUCH] Downloading result from: {result_url_from_api}")
    result_bytes = None
    s3_key_from_url = _extract_s3_key(result_url_from_api)
    if s3_key_from_url:
        try:
            print(f"[RETOUCH] Trying S3 direct download: {s3_key_from_url}")
            obj = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key_from_url)
            result_bytes = obj['Body'].read()
            print(f"[RETOUCH] S3 direct download OK: {len(result_bytes)} bytes")
        except Exception as e:
            print(f"[RETOUCH] S3 direct download failed: {e}")

    if not result_bytes:
        download_headers = {}
        if 'io.foto-mix.ru' in result_url_from_api:
            download_headers['Authorization'] = _auth_header()
        resp = requests.get(result_url_from_api, headers=download_headers, timeout=(10, 120))
        if resp.status_code == 403:
            resp = requests.get(
                result_url_from_api,
                headers={'Authorization': _auth_header()},
                timeout=(10, 120)
            )
        if resp.status_code != 200:
            raise RuntimeError(f"Failed to download result: HTTP {resp.status_code}")
        result_bytes = resp.content

    print(f"[RETOUCH] Downloaded {len(result_bytes)} bytes")

    return _save_result_bytes(conn, user_id, task, result_bytes)


def _check_plugins_available():
    try:
        r = requests.get(
            f"{API_BASE}/health",
            headers={'Authorization': _auth_header()},
            timeout=10
        )
        api_ok = r.status_code == 200
    except Exception:
        api_ok = False

    return {
        "retouch_api": {
            "available": api_ok,
            "label": "Retouch API (io.foto-mix.ru)",
            "url": API_BASE,
        }
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Ретушь фотографий через API io.foto-mix.ru — асинхронная очередь (submit → poll status → скачать результат)."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors_headers(), 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')

    if not user_id:
        return _response(401, {'error': 'User not authenticated'})

    params = event.get('queryStringParameters', {}) or {}
    if params.get('check_plugins') == '1':
        return _response(200, {'plugins': _check_plugins_available()})

    if params.get('probe_api') == '1':
        return _probe_retouch_api()

    db_url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(db_url)

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute('SELECT id, email_verified_at FROM users WHERE id = %s', (user_id,))
            user = cur.fetchone()
            if not user or not user['email_verified_at']:
                return _response(403, {'error': 'Email not verified'})

        if method == 'GET' and params.get('action') == 'preview_mask':
            return _handle_preview_mask(conn, user_id, params)

        if method == 'POST':
            return _handle_create(event, conn, user_id)
        elif method == 'GET':
            return _handle_status(event, conn, user_id)
        else:
            return _response(405, {'error': 'Method not allowed'})
    finally:
        conn.close()


def _handle_preview_mask(conn, user_id, params):
    """GET ?action=preview_mask&photo_id=X — возвращает автоматическую маску дефектов для фото."""
    photo_id = params.get('photo_id')
    if not photo_id:
        return _response(400, {'error': 'photo_id is required'})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT id, s3_key, file_name, is_raw, thumbnail_s3_key FROM photo_bank WHERE id = %s AND user_id = %s AND is_trashed = FALSE',
            (photo_id, user_id)
        )
        photo = cur.fetchone()

    if not photo or not photo['s3_key']:
        return _response(404, {'error': 'Photo not found'})

    src_key, used_thumb = _pick_source_key_for_processing(photo)
    if not src_key:
        return _response(400, {
            'error': 'Для RAW-файла ещё не готово превью — повторите через минуту'
        })

    try:
        import gc
        from skin_mask import build_auto_mask
        s3_client = _get_s3_client()
        s3_resp = s3_client.get_object(Bucket=S3_BUCKET, Key=src_key)
        image_bytes = s3_resp['Body'].read()
        s3_resp = None
        if used_thumb:
            print(f"[RETOUCH] preview_mask: using thumbnail for RAW ({src_key})")

        img = _open_image_oriented(image_bytes)
        orig_w, orig_h = img.size
        max_side = 768
        if max(orig_w, orig_h) > max_side:
            ratio = max_side / max(orig_w, orig_h)
            img = img.resize((int(orig_w * ratio), int(orig_h * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=80)
        preview_bytes = buf.getvalue()
        out_w, out_h = img.size

        del image_bytes, img, buf
        gc.collect()

        mask_b64 = build_auto_mask(preview_bytes)
        del preview_bytes
        gc.collect()
        return _response(200, {
            'mask_b64': mask_b64,
            'width': out_w,
            'height': out_h,
        })
    except MemoryError:
        print("[RETOUCH] preview_mask OOM")
        return _response(413, {'error': 'Фото слишком большое для предпросмотра маски'})
    except Exception as e:
        print(f"[RETOUCH] preview_mask error: {e}")
        return _response(500, {'error': f'Failed to build mask: {str(e)}'})


def _handle_create(event, conn, user_id):
    body = json.loads(event.get('body', '{}') or '{}')
    photo_id = body.get('photo_id')

    if not photo_id:
        return _response(400, {'error': 'photo_id is required'})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT COUNT(*) as cnt FROM retouch_tasks WHERE user_id = %s AND status IN ('queued', 'processing', 'started') AND created_at > NOW() - INTERVAL '10 minutes'",
            (user_id,)
        )
        active = cur.fetchone()
        if active and active['cnt'] >= MAX_ACTIVE_TASKS_PER_USER:
            return _response(429, {
                'error': f'Слишком много задач в очереди ({active["cnt"]}). Подождите завершения текущих',
                'active_tasks': active['cnt'],
            })

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT id, s3_key, file_name, is_raw, thumbnail_s3_key FROM photo_bank WHERE id = %s AND user_id = %s AND is_trashed = FALSE',
            (photo_id, user_id)
        )
        photo = cur.fetchone()

    if not photo:
        return _response(404, {'error': 'Photo not found'})
    if not photo['s3_key']:
        return _response(400, {'error': 'Photo has no S3 file'})

    src_key, used_thumb = _pick_source_key_for_processing(photo)
    if not src_key:
        return _response(400, {
            'error': 'Для RAW-файла ещё не готово превью — повторите через минуту'
        })

    in_key = src_key
    out_key = _build_out_key(photo['s3_key'])
    out_prefix = out_key.rsplit("/", 1)[0] + "/" if "/" in out_key else "retouch/"

    strength = body.get('strength', None)
    enhance_face = body.get('enhance_face', None)
    if strength is None or enhance_face is None:
        db_strength, db_enhance_face = _load_retouch_settings(conn)
        if strength is None:
            strength = db_strength
        if enhance_face is None:
            enhance_face = db_enhance_face

    print(f"[RETOUCH] Starting: photo_id={photo_id}, in_key={in_key}, strength={strength}")

    try:
        s3_client = _get_s3_client()
        print(f"[RETOUCH] Downloading from S3: {in_key}")
        s3_resp = s3_client.get_object(Bucket=S3_BUCKET, Key=in_key)
        image_bytes = s3_resp['Body'].read()
        print(f"[RETOUCH] Downloaded {len(image_bytes)} bytes")

        try:
            image_bytes, _converted = _ensure_jpeg_bytes(image_bytes, photo.get('file_name'))
        except Exception as conv_err:
            return _response(400, {
                'error': f'Неподдерживаемый формат файла: {conv_err}'
            })

        image_base64 = base64.b64encode(image_bytes).decode('utf-8')

        api_task_id, api_status = _submit_async_task(image_base64, strength=strength, enhance_face=enhance_face)
        print(f"[RETOUCH] Submitted: api_task_id={api_task_id}, status={api_status}")

        with conn.cursor() as cur:
            cur.execute(
                '''INSERT INTO retouch_tasks (user_id, photo_id, task_id, status, in_bucket, in_key, out_bucket, out_prefix)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)''',
                (user_id, photo_id, api_task_id, 'started', S3_BUCKET, in_key, S3_BUCKET, out_prefix)
            )
            conn.commit()

        return _response(200, {
            'task_id': api_task_id,
            'status': 'started',
            'result_url': None,
        })

    except Exception as e:
        import traceback
        print(f"[RETOUCH] Submit failed: {e}")
        print(f"[RETOUCH] Traceback: {traceback.format_exc()}")
        return _response(503, {'error': f'Сервер ретуши недоступен: {str(e)[:200]}'})


def _handle_status(event, conn, user_id):
    params = event.get('queryStringParameters', {}) or {}
    task_id = params.get('task_id')
    task_ids_param = params.get('task_ids')

    if task_ids_param:
        ids = [t.strip() for t in task_ids_param.split(',') if t.strip()]
        if not ids:
            return _response(400, {'error': 'task_ids is empty'})
        placeholders = ','.join(['%s'] * len(ids))
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f'SELECT task_id, photo_id, status, result_key, result_url, in_key, error_message, created_at, updated_at FROM retouch_tasks WHERE task_id IN ({placeholders}) AND user_id = %s',
                (*ids, user_id)
            )
            tasks = cur.fetchall()
        results = [_check_single_task(conn, user_id, t) for t in tasks]
        return _response(200, {'tasks': results})

    if not task_id:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                '''SELECT task_id, photo_id, status, result_url, error_message, created_at, updated_at
                   FROM retouch_tasks WHERE user_id = %s ORDER BY created_at DESC LIMIT 50''',
                (user_id,)
            )
            tasks = cur.fetchall()
        return _response(200, {'tasks': tasks})

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            'SELECT task_id, photo_id, status, result_key, result_url, in_key, error_message, created_at, updated_at FROM retouch_tasks WHERE task_id = %s AND user_id = %s',
            (task_id, user_id)
        )
        task = cur.fetchone()

    if not task:
        return _response(404, {'error': 'Task not found'})

    return _response(200, _check_single_task(conn, user_id, task))


def _check_single_task(conn, user_id, task):
    """Проверить статус задачи — если ещё не finished, опросить API."""
    task = _sync_task_from_api(conn, user_id, task)
    return {
        'task_id': task['task_id'],
        'status': task['status'],
        'result_url': _presigned_url(task['result_key']) if task.get('result_key') else None,
        'error_message': task.get('error_message'),
    }


def _sync_task_from_api(conn, user_id, task):
    """Если задача ещё активна — проверить статус через API и обновить."""
    if task['status'] not in ('queued', 'started', 'processing', 'pending'):
        return task

    api_task_id = task['task_id']
    try:
        data = _check_api_status(api_task_id)
    except Exception as e:
        print(f"[RETOUCH] API status check failed for {api_task_id}: {e}")
        return task

    api_status = data.get('status', 'pending')

    if api_status == 'completed':
        inline_b64 = data.get('image') or data.get('result') or data.get('image_base64')
        result_url_from_api = data.get('result_url')

        if inline_b64:
            try:
                if isinstance(inline_b64, str) and inline_b64.startswith('data:'):
                    inline_b64 = inline_b64.split(',', 1)[1]
                decoded = base64.b64decode(inline_b64)
                print(f"[RETOUCH] Got inline base64 image: {len(decoded)} bytes")
                out_key, final_url = _save_result_bytes(conn, user_id, task, decoded)
                task = dict(task)
                task['status'] = 'finished'
                task['result_key'] = out_key
                task['result_url'] = final_url
                return task
            except Exception as e:
                import traceback
                print(f"[RETOUCH] Failed to save inline image: {e}")
                print(f"[RETOUCH] Traceback: {traceback.format_exc()}")
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                        (f"Ошибка сохранения: {str(e)[:300]}", api_task_id, user_id)
                    )
                    conn.commit()
                task = dict(task)
                task['status'] = 'failed'
                task['error_message'] = str(e)[:300]
                return task

        if result_url_from_api:
            try:
                out_key, final_url = _download_result_and_save(conn, user_id, task, result_url_from_api)
                task = dict(task)
                task['status'] = 'finished'
                task['result_key'] = out_key
                task['result_url'] = final_url
            except Exception as e:
                import traceback
                print(f"[RETOUCH] Failed to download/save result: {e}")
                print(f"[RETOUCH] Traceback: {traceback.format_exc()}")
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                        (f"Ошибка сохранения: {str(e)[:300]}", api_task_id, user_id)
                    )
                    conn.commit()
                task = dict(task)
                task['status'] = 'failed'
                task['error_message'] = str(e)[:300]
        else:
            fallback_urls = [
                f"{API_BASE}/result/{api_task_id}",
                f"https://storage.yandexcloud.net/{S3_BUCKET}/retouch_results/{api_task_id}.jpg",
            ]
            downloaded = False
            for fallback_url in fallback_urls:
                try:
                    print(f"[RETOUCH] Trying fallback URL: {fallback_url}")
                    out_key, final_url = _download_result_and_save(conn, user_id, task, fallback_url)
                    task = dict(task)
                    task['status'] = 'finished'
                    task['result_key'] = out_key
                    task['result_url'] = final_url
                    downloaded = True
                    break
                except Exception as e:
                    print(f"[RETOUCH] Fallback {fallback_url} failed: {e}")
            if not downloaded:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                        ("Не удалось скачать результат ретуши", api_task_id, user_id)
                    )
                    conn.commit()
                task = dict(task)
                task['status'] = 'failed'
                task['error_message'] = 'Не удалось скачать результат ретуши'

        return task

    if api_status in ('failed', 'error'):
        raw_error = data.get('error', 'Processing failed')
        if 'timed out' in raw_error.lower() or 'timeout' in raw_error.lower():
            error_msg = 'Сервер ретуши не успел обработать фото — слишком большой файл или высокая нагрузка. Попробуйте ещё раз'
        else:
            error_msg = f'Ошибка обработки: {raw_error[:300]}'
        print(f"[RETOUCH] Task {api_task_id} failed: {raw_error[:300]}")
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE retouch_tasks SET status='failed', error_message=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                (error_msg[:500], api_task_id, user_id)
            )
            conn.commit()
        task = dict(task)
        task['status'] = 'failed'
        task['error_message'] = error_msg
        return task

    if api_status in ('pending', 'processing'):
        new_status = 'processing'
        if task['status'] != new_status:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE retouch_tasks SET status=%s, updated_at=NOW() WHERE task_id=%s AND user_id=%s",
                    (new_status, api_task_id, user_id)
                )
                conn.commit()
            task = dict(task)
            task['status'] = new_status

    return task


def _probe_retouch_api():
    results = {}
    try:
        r = requests.get(
            f"{API_BASE}/health",
            headers={'Authorization': _auth_header()},
            timeout=10
        )
        results["health"] = {"status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        results["health"] = {"error": str(e)}

    try:
        test_pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        r = requests.post(
            f"{API_BASE}/submit",
            headers={
                'Content-Type': 'application/json',
                'Authorization': _auth_header()
            },
            json={'image': test_pixel, 'strength': 0.6, 'enhance_face': False},
            timeout=15
        )
        results["submit_test"] = {"status": r.status_code, "body": r.text[:500]}
    except Exception as e:
        results["submit_test"] = {"error": str(e)}

    return _response(200, results)