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

    min_face = (sh * sw) * 0.001
    face_labels = [lid for lid, cnt in label_sizes.items() if cnt > min_face]

    if not face_labels:
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

    # Заполняем дыры в маске лица (зоны, которые по цвету не прошли как кожа —
    # тени под подбородком, нижняя скула и т.д.), используя bounding box + dilation.
    face_closed_pil = Image.fromarray(face_small_up, mode='L').filter(
        ImageFilter.MaxFilter(9)
    ).filter(ImageFilter.MinFilter(5))
    face_closed = np.array(face_closed_pil)

    # Финальная маска: bounding-зона лица ИЛИ сырой skin, если он внутри лица
    result = np.maximum(face_closed, np.minimum(skin_mask, face_closed))
    print(f"[SKIN MASK] Face regions: {len(face_labels)}, {np.count_nonzero(result)*100/(h*w):.1f}%")
    return result


def _exclude_non_skin(img_arr, mask):
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)

    brightness = (r + g + b) / 3.0
    mask[(brightness < 35) & (mask > 0)] = 0

    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.zeros_like(brightness)
    nz = maxc > 0
    sat[nz] = (maxc[nz] - minc[nz]) / maxc[nz]
    mask[(sat < 0.07) & (brightness > 215) & (mask > 0)] = 0

    return mask


def _local_stats(values, skin_mask, tile=64):
    """Локальное среднее/std по тайлам, апсемпл до полного размера.
    Позволяет ловить дефекты в тенях (боковая часть лица), где глобальная
    статистика смещена ярким центром.
    """
    h, w = values.shape
    ty = max(1, h // tile)
    tx = max(1, w // tile)
    bh = h // ty
    bw = w // tx

    means = np.zeros((ty, tx), dtype=np.float32)
    stds = np.zeros((ty, tx), dtype=np.float32)

    for i in range(ty):
        for j in range(tx):
            y1 = i * bh
            y2 = h if i == ty - 1 else (i + 1) * bh
            x1 = j * bw
            x2 = w if j == tx - 1 else (j + 1) * bw
            block_vals = values[y1:y2, x1:x2]
            block_mask = skin_mask[y1:y2, x1:x2] > 0
            if np.count_nonzero(block_mask) > 30:
                v = block_vals[block_mask]
                means[i, j] = np.mean(v)
                stds[i, j] = max(5, np.std(v))
            else:
                means[i, j] = np.nan
                stds[i, j] = np.nan

    # Заполним NaN средним по известным тайлам
    valid = ~np.isnan(means)
    if np.any(valid):
        global_mean = float(np.mean(means[valid]))
        global_std = float(np.mean(stds[valid]))
        means[~valid] = global_mean
        stds[~valid] = global_std
    else:
        means[:] = float(np.mean(values))
        stds[:] = max(5.0, float(np.std(values)))

    # Апсемпл до полного размера с билинейной интерполяцией
    mean_img = np.array(
        Image.fromarray(means).resize((w, h), Image.BILINEAR),
        dtype=np.float32,
    )
    std_img = np.array(
        Image.fromarray(stds).resize((w, h), Image.BILINEAR),
        dtype=np.float32,
    )
    return mean_img, std_img


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

    total = np.count_nonzero(expanded)
    pct = total * 100 / (h * w)
    print(f"[SKIN MASK] Final: {total}px ({pct:.2f}%), dilate={dilate_px}")

    if pct > 15:
        print("[SKIN MASK] Too large, reducing")
        gray = np.mean(img_arr.astype(np.float32), axis=2)
        sp = gray[face_skin > 0]
        sm, ss = np.mean(sp), max(8, np.std(sp))
        strict = ((gray < sm - 2.3 * ss) & (face_skin > 0)).astype(np.uint8) * 255
        strict_pil = Image.fromarray(strict, mode='L')
        strict = np.array(strict_pil.filter(ImageFilter.MinFilter(3)))
        strict_pil2 = Image.fromarray(strict, mode='L')
        strict = np.array(strict_pil2.filter(ImageFilter.MaxFilter(3)))
        expanded = _dilate_mask(strict, dilate_px)
        expanded = np.minimum(expanded, face_skin)
        pct = np.count_nonzero(expanded) * 100 / (h * w)
        print(f"[SKIN MASK] Reduced: {pct:.2f}%")

    return _mask_to_b64(expanded)


def _mask_to_b64(mask_array):
    m = Image.fromarray(mask_array, mode='L')
    buf = io.BytesIO()
    m.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')
