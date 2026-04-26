"""Capture One свадебный пресет — применяется к RGB-массиву ПОСЛЕ ретуши.

Все операции in-place / поканально, без полной float32-копии всего кадра,
чтобы укладываться в лимит памяти 256MB.

Параметры подобраны под референс пользователя:
- WB Kelvin 5390 / Tint -5.4
- Exposure -0.39, Contrast -9, Brightness +22, Saturation +12
- HDR: Highlights -50, Shadows +7, Whites -22, Blacks +15
- Vignette -0.34
- Color editor: Orange (sat -12.8, light +4.4),
                Yellow (hue -3.4, sat +5.8, light +10.8),
                Cyan (sat -10.2)
"""
import numpy as np
from PIL import Image, ImageFilter


def _denoise_luminance(arr: np.ndarray, strength: float = 0.6) -> None:
    """Шумодав: убирает зернистость в плоских областях (кожа, фон),
    сохраняет резкость кромок и текстуры (волосы, глаза, ткань).

    Метод: edge-preserving smoothing через blend между размытой версией
    и оригиналом по edge-mask.
        - Низкие частоты (плоские области) -> размываем -> шум исчезает.
        - Высокие частоты (кромки) -> оставляем оригинал -> резкость сохраняется.

    Работает in-place, экономно по памяти.

    Args:
        arr: uint8 RGB массив (H, W, 3), модифицируется in-place.
        strength: 0..1, сила шумодава. 0.6 = умеренно (рекомендуется).
    """
    h, w = arr.shape[:2]

    # 1. Luminance (grayscale) для детекции кромок — быстрая аппроксимация
    #    Y = 0.299R + 0.587G + 0.114B, считаем как uint16 чтобы не переполниться.
    y_u16 = (
        arr[..., 0].astype(np.uint16) * 77
        + arr[..., 1].astype(np.uint16) * 150
        + arr[..., 2].astype(np.uint16) * 29
    ) >> 8  # делим на 256 — приближённо к /255

    y_pil = Image.fromarray(y_u16.astype(np.uint8), 'L')
    del y_u16

    # 2. Edge map: |original - blurred|. Большие значения = кромка.
    #    Используем blur radius=1.5 — ловим тонкие детали (ресницы, волосы).
    y_blurred_small = np.array(
        y_pil.filter(ImageFilter.GaussianBlur(radius=1.5)),
        dtype=np.int16,
    )
    y_orig = np.array(y_pil, dtype=np.int16)
    del y_pil

    edge = np.abs(y_orig - y_blurred_small).astype(np.uint8)
    del y_orig, y_blurred_small

    # Растягиваем edge map: всё что > 6 (порог шума) -> кромка
    # Маска: 0 = плоская область (размываем), 255 = кромка (не трогаем)
    edge_mask = np.clip((edge.astype(np.int16) - 4) * 12, 0, 255).astype(np.uint8)
    del edge

    # Слегка размоем сам edge mask чтобы переход был плавный
    edge_mask = np.array(
        Image.fromarray(edge_mask, 'L').filter(ImageFilter.GaussianBlur(radius=1.0)),
        dtype=np.uint8,
    )

    # 3. Размываем сам кадр (по каждому каналу) — это и есть "denoised" версия
    #    Radius=1.2 — достаточно для зерна ISO 1600-3200, не теряя структуру.
    blur_radius = 1.2
    for c in range(3):
        ch_pil = Image.fromarray(arr[..., c], 'L')
        blurred = np.array(
            ch_pil.filter(ImageFilter.GaussianBlur(radius=blur_radius)),
            dtype=np.uint8,
        )
        # 4. Blend: где кромка -> оригинал, где плоско -> blurred.
        #    alpha = edge_mask / 255 * (1 - strength) + (1 - edge_mask/255) * 0
        #    Проще: result = orig * edge_alpha + blurred * (1 - edge_alpha)
        #    где edge_alpha учитывает strength.
        # Эффективная alpha: 1.0 на кромках, (1 - strength) в плоских областях.
        # alpha_u16 = edge_mask + (1 - edge_mask/255) * (1 - strength) * 255
        # Упрощаем: alpha = edge_mask + (255 - edge_mask) * (1 - strength)
        inv_strength = 1.0 - strength
        alpha = (
            edge_mask.astype(np.uint16)
            + ((255 - edge_mask).astype(np.uint16) * int(inv_strength * 256) >> 8)
        )
        np.clip(alpha, 0, 255, out=alpha)
        alpha_u8 = alpha.astype(np.uint8)
        del alpha

        # result = orig * alpha + blurred * (255 - alpha), всё в uint16, потом >>8
        orig_ch = arr[..., c].astype(np.uint16)
        blurred_u16 = blurred.astype(np.uint16)
        del blurred
        mixed = (
            orig_ch * alpha_u8 + blurred_u16 * (255 - alpha_u8)
        ) // 255
        arr[..., c] = mixed.astype(np.uint8)
        del orig_ch, blurred_u16, mixed, alpha_u8

    del edge_mask


def _build_lut_curve(black_lift, shadow, brightness, contrast, white_pull, highlight):
    x = np.arange(256, dtype=np.float32) / 255.0
    lift = black_lift / 255.0
    x = lift + x * (1.0 - lift)
    pull = white_pull / 255.0
    x = x * (1.0 + pull)
    if brightness != 0:
        gamma = 1.0 - brightness / 200.0
        x = np.clip(x, 0.0, 1.0) ** gamma
    if contrast != 0:
        k = contrast / 100.0
        x = 0.5 + (x - 0.5) * (1.0 + k * 0.5)
    if shadow != 0:
        s = shadow / 200.0
        shadow_mask = np.clip(1.0 - x * 4.0, 0.0, 1.0)
        x = x + shadow_mask * s
    if highlight != 0:
        h = highlight / 200.0
        hl_mask = np.clip((x - 0.6) * 2.5, 0.0, 1.0)
        x = x + hl_mask * h
    return np.clip(x * 255.0, 0, 255).astype(np.uint8)


def _wb_shift_lut(kelvin_target=5390, tint=-5.4):
    delta_k = (kelvin_target - 5500) / 1000.0
    k_r = 1.0 + delta_k * 0.045
    k_b = 1.0 - delta_k * 0.060
    k_g = 1.0
    tint_norm = tint / 100.0
    k_g = k_g * (1.0 - tint_norm * 0.05)
    k_r = k_r * (1.0 + tint_norm * 0.025)
    k_b = k_b * (1.0 + tint_norm * 0.025)
    x = np.arange(256, dtype=np.float32)
    return (
        np.clip(x * k_r, 0, 255).astype(np.uint8),
        np.clip(x * k_g, 0, 255).astype(np.uint8),
        np.clip(x * k_b, 0, 255).astype(np.uint8),
    )


def _exposure_lut(stops):
    mult = 2.0 ** stops
    x = np.arange(256, dtype=np.float32)
    return np.clip(x * mult, 0, 255).astype(np.uint8)


def _apply_lut_per_channel(arr, lut_r, lut_g, lut_b):
    arr[..., 0] = lut_r[arr[..., 0]]
    arr[..., 1] = lut_g[arr[..., 1]]
    arr[..., 2] = lut_b[arr[..., 2]]


def _apply_lut_global(arr, lut):
    for c in range(3):
        arr[..., c] = lut[arr[..., c]]


def _saturation_in_place(arr, factor):
    if abs(factor - 1.0) < 0.01:
        return
    luma = (
        arr[..., 0].astype(np.uint16) * 77 +
        arr[..., 1].astype(np.uint16) * 150 +
        arr[..., 2].astype(np.uint16) * 29
    ) >> 8
    for c in range(3):
        diff = arr[..., c].astype(np.int16) - luma.astype(np.int16)
        new_diff = (diff * int(factor * 256)) >> 8
        arr[..., c] = np.clip(
            luma.astype(np.int16) + new_diff, 0, 255
        ).astype(np.uint8)
    del luma


def _hue_classify(arr):
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    chroma = max_c - min_c
    out = np.zeros(arr.shape[:2], dtype=np.uint8)
    active = chroma >= 18
    is_orange = active & (r >= g) & (g > b) & ((g * 100) > r * 40) & ((g * 100) < r * 75)
    out[is_orange] = 1
    is_yellow = active & (np.abs(r - g) < 25) & (r > b + 25)
    out[is_yellow & ~is_orange] = 2
    is_cyan = active & (np.abs(g - b) < 25) & (g > r + 20)
    out[is_cyan] = 3
    del r, g, b, max_c, min_c, chroma, active, is_orange, is_yellow, is_cyan
    return out


def _adjust_color_channel(arr, mask, color_code, hue_shift=0.0, sat=0.0, light=0.0):
    sel = (mask == color_code)
    if not sel.any():
        return
    if light != 0:
        light_mult = 1.0 + light / 100.0
        for c in range(3):
            arr[sel, c] = np.clip(
                arr[sel, c].astype(np.float32) * light_mult, 0, 255
            ).astype(np.uint8)
    if sat != 0:
        sat_factor = 1.0 + sat / 100.0
        sub = arr[sel]
        luma = (sub[..., 0].astype(np.uint16) * 77
                + sub[..., 1].astype(np.uint16) * 150
                + sub[..., 2].astype(np.uint16) * 29) >> 8
        for c in range(3):
            d = sub[..., c].astype(np.int16) - luma.astype(np.int16)
            sub[..., c] = np.clip(
                luma.astype(np.int16) + (d.astype(np.float32) * sat_factor).astype(np.int16),
                0, 255
            ).astype(np.uint8)
        arr[sel] = sub
    if hue_shift != 0 and color_code == 2:
        shift = abs(hue_shift) / 100.0
        sign = -1 if hue_shift < 0 else 1
        if sign < 0:
            arr[sel, 1] = np.clip(
                arr[sel, 1].astype(np.float32) * (1.0 - shift * 0.5), 0, 255
            ).astype(np.uint8)


def _apply_vignette(arr, amount=-0.34):
    if abs(amount) < 0.02:
        return
    h, w = arr.shape[:2]
    yy, xx = np.indices((h, w), dtype=np.float32)
    cx, cy = w / 2.0, h / 2.0
    dx = (xx - cx) / cx
    dy = (yy - cy) / cy
    dist = np.sqrt(dx * dx + dy * dy) / np.sqrt(2.0)
    del xx, yy, dx, dy
    falloff = np.clip(dist, 0.0, 1.0) ** 2.2
    mult = 1.0 + amount * falloff
    del dist, falloff
    mult_u8 = np.clip(mult * 255, 0, 255).astype(np.uint16)
    del mult
    for c in range(3):
        arr[..., c] = ((arr[..., c].astype(np.uint16) * mult_u8) >> 8).astype(np.uint8)
    del mult_u8


def apply_capture_one_wedding_preset(img: Image.Image) -> Image.Image:
    """Применяет свадебный пресет Capture One к ретушированному изображению.

    Версия v2: добавлены сочность и контраст, убраны агрессивные затемнения
    (highlights -50, whites -22, vignette -0.34) — они делали кадр серым/мутным.
    """
    arr = np.array(img, dtype=np.uint8)
    del img

    # 0. ШУМОДАВ — всегда первым шагом. Убирает зернистость ISO в плоских
    #    областях (кожа, фон, потолок), сохраняя резкость кромок (волосы,
    #    глаза, ткань). Без него последующий контраст +12 и saturation +22
    #    усиливают шум, и появляются "пятна" на коже.
    _denoise_luminance(arr, strength=0.6)

    # 1. WB — лёгкий тёплый сдвиг и тинт в зелёный
    lut_r, lut_g, lut_b = _wb_shift_lut(kelvin_target=5390, tint=-5.4)
    _apply_lut_per_channel(arr, lut_r, lut_g, lut_b)
    del lut_r, lut_g, lut_b

    # 2. Tone — добавляем КОНТРАСТА и ЯРКОСТИ, без агрессивного гашения светов.
    _apply_lut_global(arr, _build_lut_curve(
        black_lift=4,        # Чёрный +4 (минимально, чтобы не было flat)
        shadow=10,           # Тень +10 (поднять тёмные участки лица)
        brightness=12,       # Яркость +12 (mid-tones светлее)
        contrast=12,         # Контраст +12 — даёт "хруст" вместо мутности
        white_pull=0,        # НЕ опускаем белые
        highlight=-15,       # Highlights -15 (мягко защитить пересвет)
    ))

    # 3. Saturation — больше сочности (+22)
    _saturation_in_place(arr, factor=1.22)

    # 4. Color editor — приглушаем оранжевый и голубой как в эталоне C1
    color_mask = _hue_classify(arr)
    _adjust_color_channel(arr, color_mask, 1, sat=-10, light=4)
    _adjust_color_channel(arr, color_mask, 2, hue_shift=-3.4, sat=6, light=8)
    _adjust_color_channel(arr, color_mask, 3, sat=-10)
    del color_mask

    # 5. Vignette — УБРАНА (создавала затемнение по краям/ощущение мутности).

    return Image.fromarray(arr, 'RGB')