import io
import base64
import numpy as np
from PIL import Image, ImageFilter


def _detect_skin_color(img_arr):
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)

    y = 0.299 * r + 0.587 * g + 0.114 * b
    cr = (r - y) * 0.713 + 128
    cb = (b - y) * 0.564 + 128

    skin = (
        (y > 40) & (y < 245) &
        (cr > 128) & (cr < 190) &
        (cb > 77) & (cb < 140)
    )

    return skin.astype(np.uint8) * 255


def _find_face_regions(skin_mask):
    h, w = skin_mask.shape

    step = max(1, min(h, w) // 300)
    small = skin_mask[::step, ::step]
    sh, sw = small.shape

    labels = np.zeros((sh, sw), dtype=np.int32)
    label_id = 0
    label_sizes = {}

    visited = set()
    for y0 in range(0, sh, 4):
        for x0 in range(0, sw, 4):
            if small[y0, x0] > 0 and (y0, x0) not in visited:
                label_id += 1
                stack = [(y0, x0)]
                count = 0
                while stack:
                    cy, cx = stack.pop()
                    if (cy, cx) in visited:
                        continue
                    if cy < 0 or cy >= sh or cx < 0 or cx >= sw:
                        continue
                    if small[cy, cx] == 0:
                        continue
                    visited.add((cy, cx))
                    labels[cy, cx] = label_id
                    count += 1
                    if count > 200000:
                        break
                    for dy, dx in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < sh and 0 <= nx < sw and (ny, nx) not in visited and small[ny, nx] > 0:
                            stack.append((ny, nx))
                label_sizes[label_id] = count

    if not label_sizes:
        return skin_mask

    # Берём ТОЛЬКО самый большой connected-компонент. Если одежда+кожа
    # связаны через шею, это тоже один компонент, но дальше ограничим bbox'ом.
    biggest = max(label_sizes, key=label_sizes.get)
    face_labels = [biggest]

    face_small = np.zeros((sh, sw), dtype=np.uint8)
    for lid in face_labels:
        face_small[labels == lid] = 255

    if step > 1:
        face_pil = Image.fromarray(face_small, mode='L').resize((w, h), Image.NEAREST)
        face_small_up = np.array(face_pil)
    else:
        face_small_up = face_small

    # Заполняем дыры (тени под подбородком, глаза, рот) через closing.
    face_closed_pil = Image.fromarray(face_small_up, mode='L').filter(
        ImageFilter.MaxFilter(9)
    ).filter(ImageFilter.MinFilter(5))
    blur_r = max(3, min(h, w) // 200)
    face_closed_pil = face_closed_pil.filter(ImageFilter.GaussianBlur(radius=blur_r))
    face_closed = np.array(face_closed_pil)
    face_closed = np.where(face_closed > 64, 255, 0).astype(np.uint8)

    # ГЕОГРАФИЧЕСКОЕ ОГРАНИЧЕНИЕ: находим bbox ЛИЦА по плотности skin-пикселей
    # в горизонтальных полосах. Лицо — это полоса с максимальной концентрацией
    # кожи; одежда ниже неё — широкая зона с пробелами.
    col_density = np.sum(face_closed > 0, axis=1) / max(1, w)
    # Лицо: горизонтальные ряды с плотностью кожи 20–80% ширины кадра.
    face_rows = np.where((col_density > 0.10) & (col_density < 0.85))[0]
    if len(face_rows) > 10:
        top = int(face_rows[0])
        # Нижняя граница лица — последний ряд с приличной плотностью, но не "одежда".
        # Одежда обычно даёт плотность >0.5 сплошняком на большой высоте.
        # Ищем "провал" после лица: резкое увеличение плотности (воротник)
        # или сужение после широкой части (шея→плечи).
        peak_row = int(face_rows[np.argmax(col_density[face_rows])])
        peak_density = float(col_density[peak_row])
        # Нижний край: после пика плотность падает (подбородок→шея), потом снова
        # растёт (одежда). Находим первый локальный минимум после пика.
        bottom = h
        for y in range(peak_row + 10, h - 5):
            # Зона шеи: плотность снизилась относительно пика.
            if col_density[y] < peak_density * 0.35:
                # Дальше ищем рост (начало одежды) — это и есть граница.
                for y2 in range(y, min(h, y + int(h * 0.15))):
                    if col_density[y2] > peak_density * 0.7:
                        bottom = y
                        break
                if bottom != h:
                    break
        # Если не нашли — ограничим 90% от высоты кадра, минус зона явной одежды.
        if bottom == h:
            bottom = min(h, peak_row + int((peak_row - top) * 1.3))

        # Горизонтально — bbox головы с запасом 5%.
        col_sums = np.sum(face_closed[top:bottom] > 0, axis=0)
        col_nz = np.where(col_sums > 0)[0]
        if len(col_nz) > 0:
            left = max(0, int(col_nz[0]) - int(w * 0.02))
            right = min(w, int(col_nz[-1]) + int(w * 0.02))
        else:
            left, right = 0, w

        bbox_mask = np.zeros_like(face_closed)
        bbox_mask[top:bottom, left:right] = 255
        face_closed = np.minimum(face_closed, bbox_mask)
        print(f"[SKIN MASK] Face bbox: y=[{top},{bottom}] x=[{left},{right}], peak_row={peak_row}")

    # Финальная маска: реальные skin-пиксели внутри bbox головы.
    result = np.minimum(skin_mask, face_closed)
    print(f"[SKIN MASK] Face regions: {len(face_labels)}, {np.count_nonzero(result)*100/(h*w):.1f}%")
    return result


def _exclude_non_skin(img_arr, mask):
    """Вычищаем из маски всё, что заведомо НЕ кожа.
    ВАЖНО: прыщи (красноватые пятна) НЕ отсекаем — они нужны для ретуши.
    """
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)

    brightness = (r + g + b) / 3.0
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.zeros_like(brightness)
    nz = maxc > 0
    sat[nz] = (maxc[nz] - minc[nz]) / maxc[nz]

    # 1) Тёмные — волосы брюнет, тени, зрачки
    mask[(brightness < 55) & (mask > 0)] = 0

    # 2) Серо-белые зоны — одежда, фон, засветы без цвета (R≈G≈B)
    neutral = (sat < 0.12) & (brightness > 120)
    mask[neutral & (mask > 0)] = 0

    # 3) Пересвет с низкой сатурацией — блики, одежда
    mask[(sat < 0.08) & (brightness > 200) & (mask > 0)] = 0

    # 4) Волосы русые/светлые: высокая насыщенность + доминирующий жёлто-коричневый
    #    (R>G>B с большим разрывом). У кожи разрыв меньше.
    yellow_hair = (r - b > 55) & (g - b > 30) & (brightness < 180) & (sat > 0.25)
    mask[yellow_hair & (mask > 0)] = 0

    # 5) Холодные оттенки (синева) — не кожа
    bluish = (b > r) | (b > g + 15)
    mask[bluish & (mask > 0)] = 0

    # 6) Зелёные оттенки — не кожа
    greenish = (g > r + 10) & (g > b + 15)
    mask[greenish & (mask > 0)] = 0

    return mask


def _local_stats(values, skin_mask, tile=64):
    """Локальное среднее/std по тайлам с ПЕРЕКРЫТИЕМ, затем апсемпл +
    сильное гауссово сглаживание. Так граница между тайлами перестаёт
    проявляться в маске как резкая "ступенька" на лице.
    """
    h, w = values.shape
    # Перекрывающиеся тайлы: шаг = tile/2, окно = tile.
    step = max(16, tile // 2)
    ty = max(1, (h + step - 1) // step)
    tx = max(1, (w + step - 1) // step)

    means = np.zeros((ty, tx), dtype=np.float32)
    stds = np.zeros((ty, tx), dtype=np.float32)

    for i in range(ty):
        for j in range(tx):
            cy = i * step
            cx = j * step
            y1 = max(0, cy - tile // 2)
            y2 = min(h, cy + tile // 2 + step)
            x1 = max(0, cx - tile // 2)
            x2 = min(w, cx + tile // 2 + step)
            block_vals = values[y1:y2, x1:x2]
            block_mask = skin_mask[y1:y2, x1:x2] > 0
            if np.count_nonzero(block_mask) > 30:
                v = block_vals[block_mask]
                means[i, j] = np.mean(v)
                stds[i, j] = max(5, np.std(v))
            else:
                means[i, j] = np.nan
                stds[i, j] = np.nan

    # Итеративно заполним NaN соседями — избегаем «дырок» там, где
    # тайл пустой (вне маски лица), чтобы после blur не было тёмных пятен.
    valid = ~np.isnan(means)
    if np.any(valid):
        g_mean_fill = float(np.mean(means[valid]))
        g_std_fill = float(np.mean(stds[valid]))
    else:
        g_mean_fill = float(np.mean(values))
        g_std_fill = max(5.0, float(np.std(values)))
    means[~valid] = g_mean_fill
    stds[~valid] = g_std_fill

    # Апсемпл: через uint16 mode 'I;16' — гарантированно работает в PIL.
    # Масштаб ×100 сохраняет 2 знака точности (значения статистики 0..255).
    def _upsample(arr_small, out_w, out_h):
        arr16 = np.clip(arr_small * 100.0, 0, 65535).astype(np.uint16)
        img = Image.fromarray(arr16, mode='I;16').resize((out_w, out_h), Image.BILINEAR)
        return np.array(img, dtype=np.float32) / 100.0

    mean_img = _upsample(means, w, h)
    std_img = _upsample(stds, w, h)

    # Сглаживание через собственную separable-гауссову свёртку numpy —
    # избегаем проблем с режимом 'F' в PIL и гарантированно убираем
    # "ступеньки" на границах тайлов.
    smooth_r = max(16, tile // 2)
    mean_img = _gaussian_blur_np(mean_img, smooth_r)
    std_img = _gaussian_blur_np(std_img, smooth_r)
    return mean_img, std_img


def _gaussian_blur_np(arr, radius):
    """Быстрый сепарабельный гауссов блюр на numpy (без SciPy)."""
    if radius <= 0:
        return arr.astype(np.float32)
    sigma = float(radius) / 2.0
    k = int(max(3, radius * 2 + 1))
    x = np.arange(k, dtype=np.float32) - (k - 1) / 2.0
    kernel = np.exp(-(x * x) / (2.0 * sigma * sigma))
    kernel /= kernel.sum()
    # Конволюция по строкам, потом по столбцам.
    pad = (k - 1) // 2
    a = arr.astype(np.float32)
    # По оси X
    ap = np.pad(a, ((0, 0), (pad, pad)), mode='edge')
    tmp = np.zeros_like(a)
    for i, w in enumerate(kernel):
        tmp += ap[:, i:i + a.shape[1]] * w
    # По оси Y
    ap2 = np.pad(tmp, ((pad, pad), (0, 0)), mode='edge')
    out = np.zeros_like(a)
    for i, w in enumerate(kernel):
        out += ap2[i:i + a.shape[0], :] * w
    return out


def _detect_defects(img_arr, skin_mask):
    h, w = img_arr.shape[:2]
    gray = np.mean(img_arr.astype(np.float32), axis=2)

    img_pil = Image.fromarray(img_arr)
    blurred = np.mean(np.array(img_pil.filter(ImageFilter.GaussianBlur(radius=3.0))).astype(np.float32), axis=2)
    detail = gray - blurred

    skin_px = gray[skin_mask > 0]
    if len(skin_px) < 50:
        return np.zeros((h, w), dtype=np.uint8)

    # Глобальные статы (страховка)
    g_mean = float(np.mean(skin_px))
    g_std = max(5.0, float(np.std(skin_px)))

    # Локальные статы — критично для периферии лица (тени, боковая щека)
    l_mean, l_std = _local_stats(gray, skin_mask, tile=64)

    # Тёмные точки: и по локальной, и по глобальной статистике (объединение)
    dark_local = ((gray < l_mean - 1.3 * l_std) & (skin_mask > 0))
    dark_global = ((gray < g_mean - 1.6 * g_std) & (skin_mask > 0))
    dark = (dark_local | dark_global).astype(np.uint8) * 255

    # Детали/текстура: локальный порог (в тенях шум ниже — отлавливаем всё равно)
    d_abs = np.abs(detail)
    l_det_mean, l_det_std = _local_stats(d_abs, skin_mask, tile=64)
    texture_local = ((d_abs > l_det_mean + 1.2 * l_det_std) & (skin_mask > 0))
    sd = d_abs[skin_mask > 0]
    d_thr = max(5, np.percentile(sd, 90)) if len(sd) > 50 else 10
    texture_global = ((d_abs > d_thr) & (skin_mask > 0))
    texture = (texture_local | texture_global).astype(np.uint8) * 255

    # Красные пятна: сравниваем redness с ЛОКАЛЬНЫМ средним redness
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)
    redness = r - (g + b) / 2.0
    l_red_mean, l_red_std = _local_stats(redness, skin_mask, tile=64)
    red_local = ((redness > l_red_mean + 1.2 * l_red_std) & (skin_mask > 0))
    sr = redness[skin_mask > 0]
    if len(sr) > 50:
        r_mean = np.mean(sr)
        r_std = max(3, np.std(sr))
        red_global = ((redness > r_mean + 1.3 * r_std) & (skin_mask > 0))
    else:
        red_global = np.zeros_like(red_local)
    red = (red_local | red_global).astype(np.uint8) * 255

    defects = np.maximum(np.maximum(dark, texture), red)
    defects = np.minimum(defects, skin_mask)

    # Морфология: закрываем дырки (closing), потом лёгкая эрозия чтобы
    # не захватывать единичный шум, потом опять dilate.
    defects_pil = Image.fromarray(defects, mode='L')
    defects_pil = defects_pil.filter(ImageFilter.MaxFilter(3))
    defects_pil = defects_pil.filter(ImageFilter.MinFilter(3))
    defects = np.array(defects_pil)

    cnt = np.count_nonzero(defects)
    print(f"[SKIN MASK] Defects: {cnt}px, g_mean={g_mean:.0f} g_std={g_std:.0f} d_thr={d_thr:.1f}")
    return defects


def _dilate_mask(mask, px):
    if px <= 0:
        return mask
    m = Image.fromarray(mask, mode='L')
    # Два прохода: crude dilate + closing для склейки соседних пятен.
    for _ in range(max(1, px // 2)):
        m = m.filter(ImageFilter.MaxFilter(min(px * 2 + 1, 13)))
    # Closing: dilate затем erode — заполняет мелкие промежутки
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    return np.array(m)


def build_face_skin_mask(image_bytes):
    """Возвращает маску ВСЕЙ кожи лица и шеи (без дефектов — всю зону целиком).
    Используется для композиции результата внешней ретуши с оригиналом:
    внутри маски применяем ретушь, снаружи (волосы, брови, одежда) — оригинал.
    """
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img_arr = np.array(img)
    h, w = img_arr.shape[:2]

    skin_color = _detect_skin_color(img_arr)
    pct = np.count_nonzero(skin_color) * 100 / (h * w)
    if pct < 1:
        return _mask_to_b64(np.zeros((h, w), dtype=np.uint8))

    face_skin = _find_face_regions(skin_color)
    face_skin = _exclude_non_skin(img_arr, face_skin)

    # Небольшое расширение — чтобы ретушь покрыла тонкие границы кожи
    # и края дефектов на стыке с волосами/бровями.
    dilate_px = max(3, int(min(h, w) * 0.006))
    m = Image.fromarray(face_skin, mode='L')
    for _ in range(max(1, dilate_px // 2)):
        m = m.filter(ImageFilter.MaxFilter(min(dilate_px * 2 + 1, 9)))
    # Закрываем дыры (глаза, рот) внутри зоны кожи, чтобы внутри ретушировалось ровно.
    m = m.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(5))
    face_skin = np.array(m)

    print(f"[SKIN MASK] Face skin: {np.count_nonzero(face_skin) * 100 / (h * w):.1f}%")
    return _mask_to_b64(face_skin)


def build_auto_mask(image_bytes):
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')

    img_arr = np.array(img)
    h, w = img_arr.shape[:2]
    print(f"[SKIN MASK] Image: {w}x{h}")

    skin_color = _detect_skin_color(img_arr)
    pct = np.count_nonzero(skin_color) * 100 / (h * w)
    print(f"[SKIN MASK] Skin color: {pct:.1f}%")

    if pct < 1:
        print("[SKIN MASK] No skin — empty mask")
        return _mask_to_b64(np.zeros((h, w), dtype=np.uint8))

    face_skin = _find_face_regions(skin_color)
    face_skin = _exclude_non_skin(img_arr, face_skin)

    defects = _detect_defects(img_arr, face_skin)

    dilate_px = max(6, int(min(h, w) * 0.012))
    expanded = _dilate_mask(defects, dilate_px)
    expanded = np.minimum(expanded, face_skin)

    # Смягчаем края маски — иначе прямоугольные ядра MaxFilter оставляют
    # угловатые следы на коже после инпейнта.
    soft_r = max(2, dilate_px // 3)
    soft = np.array(
        Image.fromarray(expanded, mode='L').filter(ImageFilter.GaussianBlur(radius=soft_r))
    )
    # Порог 40 — круглые края без "ступенек", не теряя центр пятен
    expanded = np.where(soft > 40, 255, 0).astype(np.uint8)
    expanded = np.minimum(expanded, face_skin)

    total = np.count_nonzero(expanded)
    pct = total * 100 / (h * w)
    print(f"[SKIN MASK] Final: {total}px ({pct:.2f}%), dilate={dilate_px}")

    # Защита от «маска залила всё лицо» — только при действительно огромных значениях.
    # Лицо с сильным акне реально требует 15–25% кадра, поэтому порог подняли до 30%.
    if pct > 30:
        print("[SKIN MASK] Too large, reducing")
        gray = np.mean(img_arr.astype(np.float32), axis=2)
        sp = gray[face_skin > 0]
        sm, ss = np.mean(sp), max(8, np.std(sp))
        # Мягче порог: 1.8·std вместо 2.3·std, чтобы fallback не обнулял маску.
        strict = ((gray < sm - 1.8 * ss) & (face_skin > 0)).astype(np.uint8) * 255
        strict_pil = Image.fromarray(strict, mode='L')
        strict = np.array(strict_pil.filter(ImageFilter.MinFilter(3)))
        strict_pil2 = Image.fromarray(strict, mode='L')
        strict = np.array(strict_pil2.filter(ImageFilter.MaxFilter(3)))
        strict_expanded = _dilate_mask(strict, dilate_px)
        strict_expanded = np.minimum(strict_expanded, face_skin)
        strict_pct = np.count_nonzero(strict_expanded) * 100 / (h * w)
        print(f"[SKIN MASK] Reduced candidate: {strict_pct:.2f}%")
        # Применяем fallback ТОЛЬКО если он не обнулил маску.
        if strict_pct >= 1.0:
            expanded = strict_expanded
            pct = strict_pct
        else:
            print("[SKIN MASK] Fallback produced empty mask — keep original")

    return _mask_to_b64(expanded)


def _mask_to_b64(mask_array):
    # Отдаём RGBA: R=G=B=255 (белый), A=сама маска. Так:
    # 1) Бэкенд-инпейнт по-прежнему читает яркость (всё белое там где A>0).
    # 2) Фронт-CSS mask-image через альфу корректно показывает прозрачные зоны,
    #    вместо того чтобы заливать весь кадр.
    h, w = mask_array.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = 255
    rgba[..., 1] = 255
    rgba[..., 2] = 255
    rgba[..., 3] = mask_array
    m = Image.fromarray(rgba, mode='RGBA')
    buf = io.BytesIO()
    m.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')