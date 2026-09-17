'''Генерирует JPEG-превью для RAW фотографий.

Два пути:
1) БЫСТРЫЙ (по умолчанию для NEF/ARW/DNG/ORF/RW2/...): читаем встроенное
   полноразмерное JPEG-превью прямо из TIFF-структуры RAW через HTTP Range —
   качаем единицы мегабайт вместо 80 МБ, без демозаика. 1-2 секунды, мало памяти.
2) МЕДЛЕННЫЙ (Canon CR2/CR3 и fallback): полный демозаик rawpy postprocess()
   c camera matrix — цвет/тона как в Capture One. Используется, если встроенного
   превью нет или оно слишком мелкое.

ВАЖНО: функция живёт в 256 МБ памяти. Полный демозаик 60-80 МБ RAW (Sony A7R)
гарантированно упирается в OOM (killed by signal 9), поэтому для крупных файлов
демозаик не запускается вовсе — только быстрый путь.
'''
import json
import os
import struct
import time
import boto3
from io import BytesIO
from PIL import Image, ImageOps
import psycopg2
from psycopg2.extras import RealDictCursor

# Только эти RAW-форматы заведомо умеют postprocess через libraw.
TRUE_RAW_EXT = ('.cr2', '.cr3', '.nef', '.nrw', '.arw', '.srf', '.sr2',
                '.dng', '.orf', '.rw2', '.raf', '.pef', '.raw', '.rwl', '.iiq', '.3fr')

# Для Canon исторически включён полный демозаик (встроенный JPEG у CR2 часто
# уходит в красноту). Остальные форматы идут быстрым путём.
SLOW_PATH_EXT = ('.cr2', '.cr3')

# Больше этого размера демозаик в 256 МБ не влезает — только встроенное превью.
MAX_POSTPROCESS_BYTES = 45 * 1024 * 1024

# Сколько байт головы файла читаем, чтобы разобрать TIFF-структуру.
HEAD_BYTES = 1024 * 1024
# Минимальная длина встроенного JPEG, чтобы считать его полноценным превью
# (а не миниатюрой 160x120 из IFD0).
MIN_PREVIEW_BYTES = 120 * 1024
# Если встроенное превью мельче этого по длинной стороне — оно не годится
# для полноэкранного просмотра, лучше сделать демозаик (если файл влезает).
MIN_PREVIEW_LONG_SIDE = 1400

BUCKET = 'foto-mix'


def is_true_raw(file_name: str) -> bool:
    name = (file_name or '').lower()
    return any(name.endswith(ext) for ext in TRUE_RAW_EXT)


def prefers_slow_path(file_name: str) -> bool:
    name = (file_name or '').lower()
    return name.endswith(SLOW_PATH_EXT)


def postprocess_raw_capture_one_style(raw_data: bytes, file_name: str) -> Image.Image:
    """Полный демозаик с настройками, имитирующими Capture One:
    - camera WB (как поставила камера, но с матрицей)
    - AHD demosaic — самый качественный, минимум артефактов
    - sRGB output
    - 16-bit обработка → конверсия в 8-bit с гаммой
    - мягкий highlight recovery (мода 1 = blend)
    - без auto-bright чтобы не задирать экспозицию
    - bright=1.0, gamma sRGB (2.4, 12.92) — стандарт
    """
    import rawpy  # ленивый импорт: быстрому пути rawpy не нужен вообще
    with rawpy.imread(BytesIO(raw_data)) as raw:
        params = dict(
            use_camera_wb=True,                      # WB по матрице камеры
            demosaic_algorithm=rawpy.DemosaicAlgorithm.AHD,
            output_color=rawpy.ColorSpace.sRGB,      # sRGB для веба
            output_bps=8,
            # Адаптивная авто-яркость libraw (как в Lightroom/просмотрщиках по
            # умолчанию): яркость превью подстраивается под реальный уровень кадра.
            # Раньше стоял no_auto_bright=True + фиксированный bright=1.75 —
            # для многих CR2 это давало тёмные ("будто выключили свет") превью,
            # т.к. фиксированный множитель не компенсировал недо-заполненный
            # диапазон сенсора. auto_bright_thr ограничивает пересветы.
            no_auto_bright=False,
            auto_bright_thr=0.001,
            bright=1.0,
            gamma=(2.4, 12.92),                      # стандартная sRGB-гамма
            highlight_mode=rawpy.HighlightMode.Blend,
            # user_flip=None → libraw применяет ориентацию из EXIF самостоятельно
            # (этого требуют все вертикальные CR2). user_flip=0 принудительно ОТКЛЮЧАЕТ поворот.
            half_size=True,                          # 25MP → 12MP, для лимита памяти 256MB
            fbdd_noise_reduction=rawpy.FBDDNoiseReductionMode.Light,
        )
        rgb = raw.postprocess(**params)

    return Image.fromarray(rgb)


def extract_shot_date_from_raw(raw_data, file_name):
    """Извлекает дату съёмки (DateTimeOriginal) из RAW через встроенный JPEG-превью.
    Возвращает datetime или None. Безопасно: при любой ошибке возвращает None.
    """
    from datetime import datetime
    from PIL.ExifTags import Base as ExifBase
    import rawpy
    try:
        with rawpy.imread(BytesIO(raw_data)) as raw:
            try:
                thumb = raw.extract_thumb()
            except Exception:
                return None
            if thumb.format != rawpy.ThumbFormat.JPEG:
                return None
            img = Image.open(BytesIO(thumb.data))
            exif = img.getexif()
            if not exif:
                return None
            for tag_id in [ExifBase.DateTimeOriginal, ExifBase.DateTimeDigitized, ExifBase.DateTime]:
                val = exif.get(tag_id)
                if val:
                    try:
                        return datetime.strptime(str(val), '%Y:%m:%d %H:%M:%S')
                    except Exception:
                        continue
    except Exception as e:
        print(f'[THUMBNAIL] shot_date extract failed: {e}')
    return None


def try_extract_embedded_jpeg(raw_data):
    """Fallback: извлекает встроенный JPEG-превью из RAW.
    Используется ТОЛЬКО если postprocess упал (например, неизвестная камера).
    """
    import rawpy
    try:
        with rawpy.imread(BytesIO(raw_data)) as raw:
            try:
                thumb = raw.extract_thumb()
            except rawpy.LibRawNoThumbnailError:
                return None
            if thumb.format == rawpy.ThumbFormat.JPEG:
                return Image.open(BytesIO(thumb.data))
            elif thumb.format == rawpy.ThumbFormat.BITMAP:
                return Image.fromarray(thumb.data)
    except Exception as e:
        print(f'[THUMBNAIL] Embedded extract failed: {e}')
    return None


def _s3_range(s3_client, key, start, length):
    """Читает кусок объекта из S3 по HTTP Range. Возвращает bytes."""
    end = start + length - 1
    resp = s3_client.get_object(Bucket=BUCKET, Key=key, Range=f'bytes={start}-{end}')
    return resp['Body'].read()


def _iter_tiff_ifds(head, offset, endian, seen, depth=0):
    """Обходит цепочку IFD (включая SubIFD) и отдаёт словари {tag: (type, count, value_or_offset)}.
    Работает только в пределах уже прочитанной головы файла (head).
    """
    if depth > 4 or offset <= 0 or offset + 2 > len(head) or offset in seen:
        return
    seen.add(offset)
    try:
        (count,) = struct.unpack_from(endian + 'H', head, offset)
    except struct.error:
        return
    if count <= 0 or count > 512:
        return
    entries = {}
    sub_ifds = []
    base = offset + 2
    for i in range(count):
        pos = base + i * 12
        if pos + 12 > len(head):
            break
        tag, ftype, cnt = struct.unpack_from(endian + 'HHI', head, pos)
        raw_val = head[pos + 8:pos + 12]
        if ftype in (3,) and cnt == 1:      # SHORT
            (val,) = struct.unpack_from(endian + 'H', raw_val, 0)
        elif ftype in (4, 13) and cnt == 1:  # LONG / IFD
            (val,) = struct.unpack_from(endian + 'I', raw_val, 0)
        else:
            (val,) = struct.unpack_from(endian + 'I', raw_val, 0)
        entries[tag] = (ftype, cnt, val)
        # 0x014A SubIFDs, 0x8769 ExifIFD — в них лежат крупные превью (NEF/ARW)
        if tag in (0x014A, 0x8769):
            if cnt == 1:
                sub_ifds.append(val)
            else:
                # массив оффсетов SubIFD
                arr_off = val
                for j in range(min(cnt, 8)):
                    p = arr_off + j * 4
                    if p + 4 <= len(head):
                        (sub,) = struct.unpack_from(endian + 'I', head, p)
                        sub_ifds.append(sub)
    yield entries

    # следующий IFD в цепочке
    next_pos = base + count * 12
    if next_pos + 4 <= len(head):
        (next_off,) = struct.unpack_from(endian + 'I', head, next_pos)
        if next_off:
            yield from _iter_tiff_ifds(head, next_off, endian, seen, depth + 1)

    for sub in sub_ifds:
        yield from _iter_tiff_ifds(head, sub, endian, seen, depth + 1)


def find_embedded_jpeg_ranges(head):
    """Ищет в TIFF-структуре RAW все встроенные JPEG (offset, length).
    Возвращает список, отсортированный по убыванию размера — самый большой
    это полноразмерное превью кадра.
    """
    if len(head) < 16:
        return []
    if head[:2] == b'II':
        endian = '<'
    elif head[:2] == b'MM':
        endian = '>'
    else:
        return []
    try:
        (magic,) = struct.unpack_from(endian + 'H', head, 2)
        if magic != 42:  # не классический TIFF (например CR3 = ISO BMFF)
            return []
        (ifd0,) = struct.unpack_from(endian + 'I', head, 4)
    except struct.error:
        return []

    found = []
    for entries in _iter_tiff_ifds(head, ifd0, endian, set()):
        # JPEGInterchangeFormat / JPEGInterchangeFormatLength (классический EXIF-превью)
        off = entries.get(0x0201)
        ln = entries.get(0x0202)
        if off and ln and off[2] and ln[2]:
            found.append((off[2], ln[2]))
        # StripOffsets / StripByteCounts при Compression=6 (JPEG) — так хранят
        # крупные превью Nikon NEF и Sony ARW
        comp = entries.get(0x0103)
        so = entries.get(0x0111)
        sbc = entries.get(0x0117)
        if comp and comp[2] in (6, 7) and so and sbc and so[1] == 1 and so[2] and sbc[2]:
            found.append((so[2], sbc[2]))

    # отбрасываем мусор и сортируем: самое большое превью первым
    found = [(o, l) for (o, l) in found if l > 1024 and l < 80 * 1024 * 1024]
    found.sort(key=lambda x: -x[1])
    return found


def fast_preview_from_raw(s3_client, s3_key, file_size=None):
    """БЫСТРЫЙ путь: достаёт встроенное полноразмерное JPEG-превью,
    скачивая только нужные байты вместо всего RAW.

    Возвращает (PIL.Image, head_bytes, original_preview_size) или (None, None, None).
    """
    try:
        head = _s3_range(s3_client, s3_key, 0, HEAD_BYTES)
    except Exception as e:
        print(f'[THUMBNAIL] head range read failed: {e}')
        return None, None, None

    ranges = find_embedded_jpeg_ranges(head)
    if not ranges:
        print('[THUMBNAIL] no embedded JPEG found in TIFF header')
        return None, None, None

    for offset, length in ranges[:3]:
        if length < MIN_PREVIEW_BYTES and len(ranges) > 1:
            continue  # это мелкая иконка, пробуем следующую
        try:
            if offset + length <= len(head):
                blob = head[offset:offset + length]
            else:
                blob = _s3_range(s3_client, s3_key, offset, length)
            if not blob.startswith(b'\xff\xd8'):
                # иногда оффсет указывает чуть раньше SOI — подстрахуемся
                soi = blob.find(b'\xff\xd8\xff')
                if soi < 0:
                    continue
                blob = blob[soi:]
            img = Image.open(BytesIO(blob))
            orig_size = img.size
            # КРИТИЧНО для памяти: у Nikon NEF встроенное превью бывает
            # полноразмерным (8256x5504) — распаковка в RGB это ~136 МБ и OOM
            # при лимите 256 МБ. draft() просит JPEG-декодер сразу отдать
            # уменьшенную в 2/4/8 раз картинку — декодирование дешевле и быстрее.
            try:
                img.draft('RGB', (2400, 2400))
            except Exception:
                pass
            img.load()
            print(f'[THUMBNAIL] fast preview {orig_size[0]}x{orig_size[1]} '
                  f'(decoded {img.size[0]}x{img.size[1]}) from {length // 1024}KB range')
            # orig_size — реальный размер превью до draft-уменьшения
            return img, head, orig_size
        except Exception as e:
            print(f'[THUMBNAIL] embedded jpeg at {offset} unusable: {e}')
            continue
    return None, None, None


def _tiff_scan_tags(head):
    """Собирает по всем IFD головы RAW: дату съёмки, максимальные ImageWidth/Length
    и EXIF Orientation.
    Возвращает (datetime|None, (w, h)|None, orientation|None). Без rawpy и без
    скачивания полного файла.
    """
    from datetime import datetime
    if len(head) < 16 or head[:2] not in (b'II', b'MM'):
        return None, None, None
    endian = '<' if head[:2] == b'II' else '>'
    try:
        (magic,) = struct.unpack_from(endian + 'H', head, 2)
        if magic != 42:
            return None, None, None
        (ifd0,) = struct.unpack_from(endian + 'I', head, 4)
    except struct.error:
        return None, None, None

    best_dt = None
    max_w = max_h = 0
    orientation = None
    for entries in _iter_tiff_ifds(head, ifd0, endian, set()):
        # Orientation (0x0112) из IFD0 — во встроенном JPEG-превью его обычно нет,
        # поэтому вертикальные кадры иначе лягут набок.
        if orientation is None:
            o = entries.get(0x0112)
            if o and o[1] == 1 and 1 <= o[2] <= 8:
                orientation = o[2]
        # DateTimeOriginal (0x9003) / DateTimeDigitized (0x9004) / DateTime (0x0132)
        for tag in (0x9003, 0x9004, 0x0132):
            e = entries.get(tag)
            if not e or best_dt:
                continue
            ftype, cnt, val = e
            if ftype != 2 or cnt < 19:
                continue
            # ASCII длиннее 4 байт всегда лежит по смещению
            if val + 19 <= len(head):
                s = head[val:val + 19].decode('ascii', 'ignore')
                try:
                    best_dt = datetime.strptime(s, '%Y:%m:%d %H:%M:%S')
                except Exception:
                    pass
        # ImageWidth / ImageLength — самый большой вариант это полный кадр
        w_e, h_e = entries.get(0x0100), entries.get(0x0101)
        if w_e and h_e and w_e[1] == 1 and h_e[1] == 1:
            w, h = w_e[2], h_e[2]
            if 0 < w < 100000 and 0 < h < 100000 and w * h > max_w * max_h:
                max_w, max_h = w, h
        # EXIF PixelXDimension / PixelYDimension
        px, py = entries.get(0xA002), entries.get(0xA003)
        if px and py and px[1] == 1 and py[1] == 1:
            w, h = px[2], py[2]
            if 0 < w < 100000 and 0 < h < 100000 and w * h > max_w * max_h:
                max_w, max_h = w, h

    dims = (max_w, max_h) if max_w and max_h else None
    return best_dt, dims, orientation


def shot_date_from_head(head):
    """Дата съёмки из EXIF-блока головы RAW — без скачивания всего файла."""
    from datetime import datetime
    from PIL.ExifTags import Base as ExifBase
    try:
        img = Image.open(BytesIO(head))
        exif = img.getexif()
        if not exif:
            return None
        for tag_id in [ExifBase.DateTimeOriginal, ExifBase.DateTimeDigitized, ExifBase.DateTime]:
            val = exif.get(tag_id)
            if val:
                try:
                    return datetime.strptime(str(val), '%Y:%m:%d %H:%M:%S')
                except Exception:
                    continue
    except Exception:
        pass
    return None


def process_single_thumbnail(conn, s3_client, photo_id, force=False):
    start = time.time()
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute('''
            SELECT id, s3_key, user_id, file_name, thumbnail_s3_key, file_size
            FROM photo_bank
            WHERE id = %s AND is_trashed = FALSE
        ''', (photo_id,))
        photo = cur.fetchone()
        
        if not photo:
            return {'photo_id': photo_id, 'skipped': True, 'reason': 'not found'}
        
        if photo['thumbnail_s3_key'] and not force:
            return {'photo_id': photo_id, 'skipped': True, 'reason': 'already exists', 'thumbnail_key': photo['thumbnail_s3_key']}

    file_name = photo['file_name'] or ''
    s3_key = photo['s3_key']
    file_size = photo.get('file_size') or 0

    img = None
    source = None
    shot_date = None
    raw_data = None
    preview_size = None
    raw_dims = None          # реальный размер кадра из TIFF-тегов
    raw_orientation = None   # EXIF Orientation из TIFF-тегов RAW

    # --- ШАГ 1: быстрый путь (Range + встроенный JPEG), без скачивания всего RAW ---
    # Для Canon CR2/CR3 предпочитаем демозаик, но только если файл влезает в память.
    try_fast_first = not prefers_slow_path(file_name) or file_size > MAX_POSTPROCESS_BYTES

    if try_fast_first:
        print(f'[THUMBNAIL] fast path: {s3_key} ({file_size // 1024 // 1024}MB)')
        img, head, preview_size = fast_preview_from_raw(s3_client, s3_key, file_size)
        if img is not None:
            # Слишком мелкое встроенное превью не годится для полноэкранного
            # просмотра — отдаём его только если демозаик всё равно невозможен.
            too_small = max(preview_size or img.size) < MIN_PREVIEW_LONG_SIDE
            can_demosaic = file_size and file_size <= MAX_POSTPROCESS_BYTES
            if too_small and can_demosaic:
                print(f'[THUMBNAIL] embedded preview too small {img.size}, going slow path')
                shot_date = shot_date_from_head(head)
                img = None
                preview_size = None
            else:
                source = 'embedded(range)'
                shot_date = shot_date_from_head(head)
            # У Sony ARW дата и размеры кадра лежат в TIFF-тегах, а не в EXIF
            # встроенной превьюшки — дочитываем их напрямую из заголовка.
            tiff_dt, tiff_dims, tiff_orient = _tiff_scan_tags(head)
            if shot_date is None:
                shot_date = tiff_dt
            if tiff_dims:
                raw_dims = tiff_dims
            raw_orientation = tiff_orient
            del head

    # --- ШАГ 2: медленный путь (полный демозаик) ---
    # Только если быстрый не сработал И файл реально влезает в 256 МБ функции.
    if img is None:
        if file_size and file_size > MAX_POSTPROCESS_BYTES:
            raise RuntimeError(
                f'RAW {file_size // 1024 // 1024}MB has no usable embedded preview '
                f'and is too large for in-memory demosaic'
            )
        print(f'[THUMBNAIL] slow path (full download): {s3_key}')
        response = s3_client.get_object(Bucket=BUCKET, Key=s3_key)
        raw_data = response['Body'].read()
        dl_time = time.time() - start
        print(f'[THUMBNAIL] Downloaded {len(raw_data)//1024//1024}MB in {dl_time:.1f}s, converting...')

        if shot_date is None:
            shot_date = extract_shot_date_from_raw(raw_data, file_name)

        if is_true_raw(file_name):
            try:
                img = postprocess_raw_capture_one_style(raw_data, file_name)
                source = 'postprocess(C1-style)'
            except Exception as e:
                print(f'[THUMBNAIL] postprocess failed ({e}), fallback to embedded JPEG')
                img = try_extract_embedded_jpeg(raw_data)
                source = 'embedded(fallback)'
        else:
            # Не RAW (например прислали JPEG с RAW-расширением .raw в имени)
            img = try_extract_embedded_jpeg(raw_data)
            source = 'embedded'
            if img is None:
                img = postprocess_raw_capture_one_style(raw_data, file_name)
                source = 'postprocess(fallback)'

        del raw_data
        raw_data = None

    dl_time = time.time() - start

    if img is None:
        raise RuntimeError('Failed to decode RAW: both postprocess and embedded JPEG returned None')

    had_own_exif_orientation = False
    try:
        exif = img.getexif()
        had_own_exif_orientation = bool(exif and exif.get(0x0112, 1) != 1)
    except Exception:
        pass

    try:
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        print(f'[THUMBNAIL] exif_transpose failed: {e}')

    # Во встроенном JPEG-превью RAW своего Orientation обычно нет — берём его
    # из TIFF-тега самого RAW, иначе вертикальные кадры лягут набок.
    if (source == 'embedded(range)' and not had_own_exif_orientation
            and raw_orientation and raw_orientation != 1):
        ops = {
            2: [Image.Transpose.FLIP_LEFT_RIGHT],
            3: [Image.Transpose.ROTATE_180],
            4: [Image.Transpose.FLIP_TOP_BOTTOM],
            5: [Image.Transpose.TRANSPOSE],
            6: [Image.Transpose.ROTATE_270],
            7: [Image.Transpose.TRANSVERSE],
            8: [Image.Transpose.ROTATE_90],
        }.get(raw_orientation, [])
        for op in ops:
            img = img.transpose(op)
        if ops:
            print(f'[THUMBNAIL] applied RAW orientation={raw_orientation}')

    # Реальные размеры кадра (до ресайза превью). half_size в postprocess
    # уменьшает RAW вдвое — компенсируем, чтобы записать настоящее разрешение.
    full_w, full_h = img.size
    if is_true_raw(file_name) and source and source.startswith('postprocess'):
        full_w, full_h = full_w * 2, full_h * 2
    elif source == 'embedded(range)':
        # Приоритет — реальные размеры кадра из TIFF-тегов (Sony ARW и др.).
        # Иначе берём размер превью ДО draft-уменьшения, но только если оно
        # полноразмерное: писать в width/height размер превьюшки нельзя.
        pw, ph = raw_dims or preview_size or (full_w, full_h)
        if max(pw, ph) >= 2000:
            # с учётом поворота: ImageOps мог поменять стороны местами
            full_w, full_h = (pw, ph) if (full_w >= full_h) == (pw >= ph) else (ph, pw)
        else:
            full_w, full_h = None, None

    # Превью отдаём как с камеры (camera WB + лёгкое auto-bright libraw),
    # БЕЗ цветокора. Пресет применяется только на этапе ретуши.
    img.thumbnail((2400, 2400), Image.Resampling.LANCZOS)

    # Встроенные превью иногда приходят в CMYK/P/RGBA — JPEG такое не сохранит.
    if img.mode not in ('RGB', 'L'):
        img = img.convert('RGB')

    jpeg_buffer = BytesIO()
    img.save(jpeg_buffer, format='JPEG', quality=92, subsampling=0)
    jpeg_buffer.seek(0)
    del img

    print(f'[THUMBNAIL] Generated from {source}')
    
    thumbnail_key = photo['s3_key'].rsplit('.', 1)[0] + '_thumb.jpg'
    
    s3_client.put_object(
        Bucket='foto-mix',
        Key=thumbnail_key,
        Body=jpeg_buffer.getvalue(),
        ContentType='image/jpeg'
    )
    
    total_time = time.time() - start
    print(f'[THUMBNAIL] Done photo_id={photo_id} in {total_time:.1f}s (download: {dl_time:.1f}s)')
    
    with conn.cursor() as cur:
        # shot_date пишем только если он ещё не задан (COALESCE),
        # чтобы не перетирать дату при принудительной перегенерации.
        cur.execute('''
            UPDATE photo_bank 
            SET thumbnail_s3_key = %s,
                is_raw = TRUE,
                shot_date = COALESCE(shot_date, %s),
                width = COALESCE(width, %s),
                height = COALESCE(height, %s)
            WHERE id = %s
        ''', (thumbnail_key, shot_date, full_w, full_h, photo_id))
        conn.commit()
    
    return {'photo_id': photo_id, 'thumbnail_key': thumbnail_key, 'time': round(total_time, 1)}


def handler(event: dict, context) -> dict:
    '''Генерирует JPEG-превью из RAW файлов (CR2, NEF, ARW, DNG и др.)'''
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body_str = event.get('body', '{}')
        if not body_str or body_str.strip() == '':
            body = {}
        else:
            body = json.loads(body_str)
        
        photo_ids = body.get('photo_ids', [])
        single_id = body.get('photo_id')
        if single_id:
            photo_ids = [single_id]
        force = bool(body.get('force', False))
        
        if not photo_ids:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'photo_id or photo_ids required'}),
                'isBase64Encoded': False
            }
        
        from botocore.config import Config
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
            aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
            region_name='ru-central1',
            config=Config(
                signature_version='s3v4',
                connect_timeout=10,
                read_timeout=60
            )
        )
        
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        results = []
        
        import gc
        for photo_id in photo_ids:
            try:
                result = process_single_thumbnail(conn, s3_client, photo_id, force=force)
                results.append(result)
            except Exception as e:
                print(f'[THUMBNAIL_ERROR] photo_id={photo_id}: {str(e)}')
                results.append({'photo_id': photo_id, 'error': str(e)})
            finally:
                # Освобождаем буферы предыдущего кадра: при пачке из нескольких
                # крупных RAW пик памяти иначе подбирается к лимиту функции.
                gc.collect()
        
        conn.close()
        
        successful = [r for r in results if 'thumbnail_key' in r]
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'processed': len(results),
                'successful': len(successful),
                'results': results
            }),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'[THUMBNAIL_ERROR] {str(e)}')
        import traceback
        traceback.print_exc()
        
        if 'conn' in locals():
            conn.close()
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }