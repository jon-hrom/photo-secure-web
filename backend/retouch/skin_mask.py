import io
import base64
import numpy as np
from PIL import Image, ImageFilter


# =========================================================================
# Общие утилиты
# =========================================================================

def _gaussian_blur_np(arr, radius):
    """Быстрый сепарабельный гауссов блюр на numpy."""
    if radius <= 0:
        return arr.astype(np.float32)
    sigma = float(radius) / 2.0
    k = int(max(3, radius * 2 + 1))
    x = np.arange(k, dtype=np.float32) - (k - 1) / 2.0
    kernel = np.exp(-(x * x) / (2.0 * sigma * sigma))
    kernel /= kernel.sum()
    pad = (k - 1) // 2
    a = arr.astype(np.float32)
    ap = np.pad(a, ((0, 0), (pad, pad)), mode='edge')
    tmp = np.zeros_like(a)
    for i, w in enumerate(kernel):
        tmp += ap[:, i:i + a.shape[1]] * w
    ap2 = np.pad(tmp, ((pad, pad), (0, 0)), mode='edge')
    out = np.zeros_like(a)
    for i, w in enumerate(kernel):
        out += ap2[i:i + a.shape[0], :] * w
    return out


def _integral(arr):
    """Интегральное изображение для быстрых сумм по прямоугольникам."""
    a = arr.astype(np.float64)
    return np.pad(np.cumsum(np.cumsum(a, axis=0), axis=1), ((1, 0), (1, 0)), mode='constant')


def _box_mean_std(values, mask, radius):
    """Локальные mean/std по квадратному окну радиуса `radius`,
    усреднение только по пикселям, где mask>0. Результат — полноразмерный
    float-массив БЕЗ блочных артефактов (окно скользит попиксельно).
    """
    h, w = values.shape
    m = (mask > 0).astype(np.float64)
    vals = values.astype(np.float64) * m
    vals2 = (values.astype(np.float64) ** 2) * m

    I_m = _integral(m)
    I_v = _integral(vals)
    I_v2 = _integral(vals2)

    r = int(max(1, radius))
    y1 = np.clip(np.arange(h)[:, None] - r, 0, h)
    y2 = np.clip(np.arange(h)[:, None] + r + 1, 0, h)
    x1 = np.clip(np.arange(w)[None, :] - r, 0, w)
    x2 = np.clip(np.arange(w)[None, :] + r + 1, 0, w)

    def _rect(I):
        return I[y2, x2] - I[y1, x2] - I[y2, x1] + I[y1, x1]

    cnt = _rect(I_m)
    sv = _rect(I_v)
    sv2 = _rect(I_v2)

    cnt_safe = np.maximum(cnt, 1.0)
    mean = sv / cnt_safe
    var = np.maximum(0.0, sv2 / cnt_safe - mean * mean)
    std = np.sqrt(var)

    # Там, где в окне нет маски — возвращаем глобальные.
    g_vals = values[mask > 0]
    if g_vals.size > 50:
        g_mean = float(np.mean(g_vals))
        g_std = max(3.0, float(np.std(g_vals)))
    else:
        g_mean = float(np.mean(values))
        g_std = max(3.0, float(np.std(values)))
    empty = cnt < 8
    mean[empty] = g_mean
    std[empty] = g_std
    std = np.maximum(std, 3.0)
    return mean.astype(np.float32), std.astype(np.float32)


# =========================================================================
# Цветовая детекция кожи (мягкая вероятность)
# =========================================================================

def _skin_probability(img_arr):
    """Возвращает float32 карту [0..1] — вероятность, что пиксель является кожей.
    Комбинируем YCbCr + HSV-гейт + «тёплость» + отсев серости.
    """
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)

    y = 0.299 * r + 0.587 * g + 0.114 * b
    cr = (r - y) * 0.713 + 128.0
    cb = (b - y) * 0.564 + 128.0

    # Гауссов центр кожи в CbCr (классические значения).
    dcb = cb - 110.0
    dcr = cr - 152.0
    p_ycbcr = np.exp(-(dcb * dcb / (2 * 14.0 ** 2) + dcr * dcr / (2 * 10.0 ** 2)))

    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.where(maxc > 0, (maxc - minc) / np.maximum(maxc, 1.0), 0.0)

    # Яркость в рабочем диапазоне кожи.
    p_y = np.clip((y - 35.0) / 20.0, 0.0, 1.0) * np.clip((245.0 - y) / 20.0, 0.0, 1.0)

    # Тёплость: R > B, G между ними — типично для кожи всех тонов.
    warm = np.clip((r - b + 5.0) / 40.0, 0.0, 1.0)

    # Штраф за «холодные» и «зелёные» тона.
    cold = np.clip((b - r) / 20.0, 0.0, 1.0) + np.clip((b - g - 10.0) / 20.0, 0.0, 1.0)
    green = np.clip((g - r - 8.0) / 20.0, 0.0, 1.0) * np.clip((g - b - 8.0) / 20.0, 0.0, 1.0)
    penalty = np.clip(cold + green, 0.0, 1.0)

    # Слишком серые/бесцветные пиксели (одежда, фон) — не кожа.
    p_sat = np.clip((sat - 0.05) / 0.15, 0.0, 1.0)

    prob = p_ycbcr * p_y * (0.4 + 0.6 * warm) * p_sat * (1.0 - 0.9 * penalty)
    return np.clip(prob, 0.0, 1.0).astype(np.float32)


# =========================================================================
# Поиск региона лица — крупнейшая связная область по порогу вероятности
# =========================================================================

def _largest_component(binary):
    """Возвращает бинарную маску крупнейшей связной компоненты (4-соседство)."""
    h, w = binary.shape
    b = (binary > 0).astype(np.uint8)
    if b.sum() == 0:
        return b
    labels = -np.ones((h, w), dtype=np.int32)
    sizes = []
    cur = 0
    # Итеративный flood-fill на numpy-стеке.
    ys, xs = np.where(b > 0)
    visited = np.zeros((h, w), dtype=bool)
    for idx in range(len(ys)):
        sy, sx = int(ys[idx]), int(xs[idx])
        if visited[sy, sx]:
            continue
        stack = [(sy, sx)]
        count = 0
        while stack:
            cy, cx = stack.pop()
            if cy < 0 or cy >= h or cx < 0 or cx >= w:
                continue
            if visited[cy, cx] or b[cy, cx] == 0:
                continue
            visited[cy, cx] = True
            labels[cy, cx] = cur
            count += 1
            stack.append((cy + 1, cx))
            stack.append((cy - 1, cx))
            stack.append((cy, cx + 1))
            stack.append((cy, cx - 1))
        sizes.append(count)
        cur += 1
    if not sizes:
        return b
    biggest = int(np.argmax(sizes))
    return (labels == biggest).astype(np.uint8)


def _face_bbox_from_prob(prob, thresh=0.35):
    """Находит bbox лица по вероятностной карте кожи."""
    h, w = prob.shape
    # Работаем на уменьшенной копии — быстрее и устойчивее.
    scale = max(1, min(h, w) // 220)
    if scale > 1:
        small = prob[::scale, ::scale]
    else:
        small = prob
    sh, sw = small.shape

    binary = (small > thresh).astype(np.uint8)
    # Лёгкое морфо-закрытие, чтобы глаза/рот не дробили область.
    pil = Image.fromarray((binary * 255).astype(np.uint8), mode='L')
    pil = pil.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    binary = (np.array(pil) > 0).astype(np.uint8)

    comp = _largest_component(binary)
    if comp.sum() < 50:
        return 0, h, 0, w

    ys, xs = np.where(comp > 0)
    top = int(ys.min()) * scale
    bottom = int(ys.max()) * scale
    left = int(xs.min()) * scale
    right = int(xs.max()) * scale

    # Ограничиваем bbox «лицом + шеей»: отбрасываем всё, что ниже 1.3 высоты от top,
    # если кадр включает плечи/одежду.
    face_h = bottom - top
    face_w = right - left
    if face_h > 0:
        # Обрезаем низ мягче: до 1.15 высоты лица от верха (голова+шея).
        max_bottom = top + int(face_h * 1.05)
        bottom = min(bottom, max_bottom, h)

    # Немного расширяем в стороны, чтобы не обрезать виски.
    pad_x = int(face_w * 0.04)
    left = max(0, left - pad_x)
    right = min(w, right + pad_x)
    pad_top = int(face_h * 0.02)
    top = max(0, top - pad_top)

    return top, bottom, left, right


# =========================================================================
# Исключение не-кожи: глаза, брови, губы, волосы, одежда
# =========================================================================

def _exclude_features(img_arr, skin_prob, bbox):
    """Уменьшает вероятность для явно не-кожи зон: тёмные провалы глаз/бровей,
    красные губы, тёмные волосы. Всё на вероятностной основе (без резких порогов).
    """
    top, bottom, left, right = bbox
    h, w = skin_prob.shape
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)
    y = 0.299 * r + 0.587 * g + 0.114 * b
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.where(maxc > 0, (maxc - minc) / np.maximum(maxc, 1.0), 0.0)

    prob = skin_prob.copy()

    # 1) Тёмные пиксели — волосы, зрачки, брови, ресницы, тени.
    dark = np.clip((70.0 - y) / 35.0, 0.0, 1.0)
    prob *= (1.0 - 0.95 * dark)

    # 2) Насыщенные тёмно-цветные — радужка глаз.
    iris = np.clip((100.0 - y) / 40.0, 0.0, 1.0) * np.clip((sat - 0.30) / 0.25, 0.0, 1.0)
    prob *= (1.0 - 0.95 * iris)

    # 3) Белки глаз — очень высокая яркость, низкая сатурация, внутри bbox.
    sclera = np.clip((y - 200.0) / 30.0, 0.0, 1.0) * np.clip((0.12 - sat) / 0.12, 0.0, 1.0)
    prob *= (1.0 - 0.9 * sclera)

    # 4) Губы — насыщенный красный (r−b велик, r−g заметен).
    rg = r - g
    rb = r - b
    lips = np.clip((rb - 30.0) / 30.0, 0.0, 1.0) * np.clip((rg - 15.0) / 25.0, 0.0, 1.0) \
           * np.clip((sat - 0.22) / 0.25, 0.0, 1.0) * np.clip((180.0 - y) / 40.0, 0.0, 1.0)
    prob *= (1.0 - 0.85 * lips)

    # 5) Серо-белые пиксели (одежда, фон): низкая sat + не тёмные.
    neutral = np.clip((0.10 - sat) / 0.10, 0.0, 1.0) * np.clip((y - 110.0) / 50.0, 0.0, 1.0)
    prob *= (1.0 - 0.9 * neutral)

    # 6) Жёлто-коричневые волосы (r>g>b с большим разрывом и средней яркостью).
    hair = np.clip((rb - 30.0) / 30.0, 0.0, 1.0) * np.clip((g - b - 12.0) / 20.0, 0.0, 1.0) \
           * np.clip((160.0 - y) / 70.0, 0.0, 1.0) * np.clip((sat - 0.18) / 0.25, 0.0, 1.0)
    prob *= (1.0 - 0.8 * hair)

    # 7) Зона ВНЕ bbox лица — убиваем полностью.
    outside = np.ones((h, w), dtype=np.float32)
    outside[top:bottom, left:right] = 0.0
    prob *= (1.0 - outside)

    return prob


# =========================================================================
# Финальная маска кожи (для композиции с ретушью)
# =========================================================================

def _build_face_skin_float(img_arr):
    """Возвращает float32 [0..1] — плавная маска кожи лица с мягкими границами."""
    h, w = img_arr.shape[:2]
    prob = _skin_probability(img_arr)

    # Сгладим вероятность перед поиском bbox, чтобы избежать шумных дырок.
    prob_smooth = _gaussian_blur_np(prob, radius=max(3, min(h, w) // 250))
    bbox = _face_bbox_from_prob(prob_smooth, thresh=0.35)

    prob_excl = _exclude_features(img_arr, prob_smooth, bbox)

    # Крупнейшая связная область + мягкое сглаживание границы.
    binary = (prob_excl > 0.30).astype(np.uint8)
    comp = _largest_component(binary)

    # Заполнение дыр (глаза, рот, ноздри) внутри контура лица.
    pil = Image.fromarray((comp * 255).astype(np.uint8), mode='L')
    close_r = max(5, int(min(h, w) * 0.015))
    pil = pil.filter(ImageFilter.MaxFilter(min(close_r * 2 + 1, 21)))
    pil = pil.filter(ImageFilter.MinFilter(min(close_r * 2 + 1, 21)))
    closed = np.array(pil).astype(np.float32) / 255.0

    # Режем по маске non-skin (чтобы глаза внутри контура не считались кожей).
    skin_soft = closed * np.clip(prob_excl * 2.0, 0.0, 1.0)

    # Размываем границу — избавляемся от «квадратов».
    skin_soft = _gaussian_blur_np(skin_soft, radius=max(3, int(min(h, w) * 0.006)))
    skin_soft = np.clip(skin_soft, 0.0, 1.0)

    # Лёгкая эрозия по периметру — не залезаем в волосы.
    skin_soft = np.where(skin_soft > 0.35, skin_soft, skin_soft * 0.0)
    return skin_soft.astype(np.float32)


# =========================================================================
# Детекция дефектов внутри маски кожи
# =========================================================================

def _remove_large_blobs(mask, blob_radius=6):
    """Удаляет крупные сплошные заливки, оставляя точечные дефекты."""
    m = Image.fromarray(mask, mode='L')
    for _ in range(blob_radius):
        m = m.filter(ImageFilter.MinFilter(3))
    for _ in range(blob_radius + 2):
        m = m.filter(ImageFilter.MaxFilter(3))
    large = np.array(m)
    return np.where(large > 0, 0, mask).astype(np.uint8)


def _detect_defects(img_arr, skin_soft, sensitivity=50):
    h, w = img_arr.shape[:2]
    skin_mask = (skin_soft > 0.5).astype(np.uint8) * 255

    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)
    gray = (r + g + b) / 3.0
    redness = r - (g + b) / 2.0

    # Blur для detail-канала.
    img_pil = Image.fromarray(img_arr)
    blurred = np.mean(
        np.array(img_pil.filter(ImageFilter.GaussianBlur(radius=3.0))).astype(np.float32),
        axis=2
    )
    detail = np.abs(gray - blurred)

    if np.count_nonzero(skin_mask) < 100:
        return np.zeros((h, w), dtype=np.uint8)

    s = max(0, min(100, float(sensitivity)))
    if s >= 50:
        k = -(s - 50.0) / 100.0      # до −0.5 (мягче)
    else:
        k = (50.0 - s) / 70.0        # до +0.71 (жёстче)

    # Радиус окна локальных статов — в % от размера кадра.
    win_r = max(16, int(min(h, w) * 0.04))

    l_mean_g, l_std_g = _box_mean_std(gray, skin_mask, win_r)
    l_mean_d, l_std_d = _box_mean_std(detail, skin_mask, win_r)
    l_mean_r, l_std_r = _box_mean_std(redness, skin_mask, win_r)

    # Тёмные точки — локально ниже среднего кожи.
    dark = (gray < l_mean_g - (1.15 + k) * l_std_g) & (skin_mask > 0)

    # Текстурные аномалии.
    texture = (detail > l_mean_d + (1.00 + k) * l_std_d) & (skin_mask > 0)

    # Красные пятна.
    red = (redness > l_mean_r + (1.00 + k) * l_std_r) & (skin_mask > 0)

    defects = (dark | texture | red).astype(np.uint8) * 255
    defects = np.minimum(defects, skin_mask)

    # Морфо-закрытие мелких разрывов.
    defects_pil = Image.fromarray(defects, mode='L').filter(ImageFilter.MaxFilter(3))
    defects = np.array(defects_pil)

    before = int(np.count_nonzero(defects))
    defects = _remove_large_blobs(defects, blob_radius=5)
    after = int(np.count_nonzero(defects))

    print(f"[SKIN MASK] Defects: {after}px (was {before}), sens={s:.0f} k={k:+.2f} win_r={win_r}")
    return defects


def _dilate_mask(mask, px):
    if px <= 0:
        return mask
    m = Image.fromarray(mask, mode='L')
    for _ in range(max(1, px // 2)):
        m = m.filter(ImageFilter.MaxFilter(min(px * 2 + 1, 13)))
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    return np.array(m)


# =========================================================================
# Публичный API
# =========================================================================

def build_face_skin_mask(image_bytes):
    """Плавная маска кожи лица и шеи (без дефектов — зона целиком)."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img_arr = np.array(img)
    h, w = img_arr.shape[:2]

    skin_soft = _build_face_skin_float(img_arr)
    # Бинаризация с мягкими краями через альфу.
    alpha = np.clip(skin_soft * 255.0, 0, 255).astype(np.uint8)

    # Лёгкая эрозия, чтобы не залезать в волосы.
    erode_px = max(2, int(min(h, w) * 0.004))
    alpha_pil = Image.fromarray(alpha, mode='L').filter(
        ImageFilter.MinFilter(min(erode_px * 2 + 1, 7))
    )
    alpha = np.array(alpha_pil)

    pct = np.count_nonzero(alpha > 32) * 100.0 / (h * w)
    print(f"[SKIN MASK] Face skin: {pct:.1f}%")
    return _mask_to_b64(alpha)


def build_auto_mask(image_bytes, sensitivity=50):
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img_arr = np.array(img)
    h, w = img_arr.shape[:2]
    print(f"[SKIN MASK] Image: {w}x{h} sensitivity={sensitivity}")

    skin_soft = _build_face_skin_float(img_arr)
    skin_pct = float(np.mean(skin_soft > 0.5)) * 100
    print(f"[SKIN MASK] Face skin region: {skin_pct:.1f}%")
    if skin_pct < 0.5:
        print("[SKIN MASK] No face skin — empty mask")
        return _mask_to_b64(np.zeros((h, w), dtype=np.uint8))

    defects = _detect_defects(img_arr, skin_soft, sensitivity=sensitivity)

    dilate_px = max(4, int(min(h, w) * 0.008))
    expanded = _dilate_mask(defects, dilate_px)
    # Ограничиваем маской кожи (мягкой).
    skin_bin = (skin_soft > 0.5).astype(np.uint8) * 255
    expanded = np.minimum(expanded, skin_bin)

    # Сглаживаем края.
    soft_r = max(2, dilate_px // 2)
    soft = np.array(
        Image.fromarray(expanded, mode='L').filter(ImageFilter.GaussianBlur(radius=soft_r))
    )
    expanded = np.where(soft > 80, 255, 0).astype(np.uint8)
    expanded = np.minimum(expanded, skin_bin)
    expanded = _remove_large_blobs(expanded, blob_radius=8)
    expanded = np.minimum(expanded, skin_bin)

    pct = np.count_nonzero(expanded) * 100.0 / (h * w)
    print(f"[SKIN MASK] Final: {pct:.2f}%, dilate={dilate_px}")

    # Защита от «залитого» лица — только если маска реально перекрыла всё.
    if pct > 30:
        print("[SKIN MASK] Too large, reducing")
        gray = np.mean(img_arr.astype(np.float32), axis=2)
        sp = gray[skin_bin > 0]
        if sp.size > 50:
            sm, ss = float(np.mean(sp)), max(8.0, float(np.std(sp)))
            strict = ((gray < sm - 1.8 * ss) & (skin_bin > 0)).astype(np.uint8) * 255
            strict_pil = Image.fromarray(strict, mode='L').filter(ImageFilter.MinFilter(3))
            strict = np.array(strict_pil)
            strict_pil2 = Image.fromarray(strict, mode='L').filter(ImageFilter.MaxFilter(3))
            strict = np.array(strict_pil2)
            strict_expanded = _dilate_mask(strict, dilate_px)
            strict_expanded = np.minimum(strict_expanded, skin_bin)
            strict_pct = np.count_nonzero(strict_expanded) * 100.0 / (h * w)
            if strict_pct >= 1.0:
                expanded = strict_expanded

    return _mask_to_b64(expanded)


def _mask_to_b64(mask_array):
    """RGBA-маска: белый цвет + альфа = mask_array.
    Бэкенд-инпейнт читает яркость (везде 255), фронт — альфу.
    """
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
