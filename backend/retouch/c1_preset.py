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


def apply_skin_denoise_with_mask(
    img: Image.Image,
    skin_mask_u8: np.ndarray,
    strength: float = 0.45,
) -> Image.Image:
    """Шумодав, применяемый ТОЛЬКО по skin-mask.

    Вне маски (волосы, фон, одежда, глаза) пиксели остаются ТОЧНО как в
    оригинале (никакого мыла). Внутри маски — edge-preserving denoise:
    плоская кожа размывается, кромки (поры, пушок) сохраняются.

    Args:
        img: PIL RGB изображение (после композиции с оригиналом).
        skin_mask_u8: uint8 маска (H, W), 0=не кожа, 255=кожа. Должна
                      совпадать по размеру с img.
        strength: 0..1, сила шумодава внутри маски (0.45 = умеренно).

    Returns:
        Новое PIL RGB изображение.
    """
    arr = np.array(img, dtype=np.uint8)
    h, w = arr.shape[:2]

    # Приводим маску к размеру кадра, если нужно
    if skin_mask_u8.shape != (h, w):
        mask_pil = Image.fromarray(skin_mask_u8, 'L').resize((w, h), Image.BILINEAR)
        skin_mask_u8 = np.array(mask_pil, dtype=np.uint8)
        del mask_pil

    # Если кожи в кадре почти нет — возвращаем оригинал без изменений
    if int(skin_mask_u8.max()) < 32:
        return img

    # Перьим маску, чтобы переход кожа/не-кожа был мягким (без обводки)
    skin_mask_feather = np.array(
        Image.fromarray(skin_mask_u8, 'L').filter(ImageFilter.GaussianBlur(radius=4)),
        dtype=np.uint8,
    )

    # Денойзим копию массива (in-place edge-preserving)
    arr_denoised = arr.copy()
    _denoise_luminance(arr_denoised, strength=strength)

    # Бленд: где маска=255 -> denoised, где маска=0 -> оригинал
    mask_f = skin_mask_feather.astype(np.uint16)
    inv_f = 255 - mask_f
    for c in range(3):
        mixed = (
            arr_denoised[..., c].astype(np.uint16) * mask_f
            + arr[..., c].astype(np.uint16) * inv_f
        ) // 255
        arr[..., c] = mixed.astype(np.uint8)
    del arr_denoised, mask_f, inv_f, skin_mask_feather

    return Image.fromarray(arr, 'RGB')


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


def _wb_shift_lut(kelvin_target=5200, tint=3.0):
    """Сдвиг баланса белого по модели Lightroom.

    kelvin_target — цель в Кельвинах. Чем НИЖЕ значение, тем ТЕПЛЕЕ кадр
    (т.к. фотограф говорит камере "сцена холоднее" → камера компенсирует
    добавлением тепла). Нейтраль = 5500K.
    tint — сдвиг между зелёным (-) и магентой (+). Для кожи нужен лёгкий
    плюс (магента), чтобы убрать зелень от вольфрамового света.

    Корректные коэффициенты: при kelvin_target < 5500 — R растёт, B падает.
    """
    delta_k = (5500 - kelvin_target) / 1000.0  # >0 = теплее
    k_r = 1.0 + delta_k * 0.060   # ниже Kelvin → больше красного
    k_b = 1.0 - delta_k * 0.045   # ниже Kelvin → меньше синего
    k_g = 1.0
    tint_norm = tint / 100.0
    # Положительный tint = магента (R+B вверх, G вниз)
    k_g = k_g * (1.0 - tint_norm * 0.05)
    k_r = k_r * (1.0 + tint_norm * 0.020)
    k_b = k_b * (1.0 + tint_norm * 0.020)
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


def _estimate_scene_wb(arr: np.ndarray) -> tuple[float, float]:
    """Оценивает текущий баланс белого кадра по нейтральным областям.

    Метод:
    1. Берём пиксели со средней яркостью (Y в [60..220]) — без теней и пересветов.
    2. Исключаем насыщенные (chroma > 50) — это цветные объекты, не нейтраль.
    3. Исключаем телесные тона (hue ~ оранжевый) — кожа смещает оценку.
    4. По оставшимся "почти серым" пикселям считаем среднее R/G/B.
    5. Соотношение R/B даёт текущую температуру кадра в Кельвинах.
       (R/B ≈ 1.0 → ~5500K, R/B > 1 → теплее, R/B < 1 → холоднее)
    6. Соотношение G/((R+B)/2) даёт tint (>1 → зелень, <1 → магента).

    Returns:
        (current_kelvin, current_tint) — оценка цветовой температуры
        и тинта исходного кадра.
    """
    h, w = arr.shape[:2]
    # Сэмплируем не весь кадр, а каждые ~4 пикселя — экономия памяти.
    step = max(1, int(np.sqrt(h * w / 200_000)))
    sample = arr[::step, ::step].astype(np.int16)
    r = sample[..., 0]
    g = sample[..., 1]
    b = sample[..., 2]
    y = (r * 77 + g * 150 + b * 29) >> 8  # luma BT.601

    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    chroma = max_c - min_c

    # Маска "почти-нейтрали": средние тона + низкая chroma.
    neutral = (y >= 60) & (y <= 220) & (chroma <= 35)
    # Дополнительно отсеиваем телесные тона (R > G > B с заметным запасом).
    is_skin_like = (r > g + 8) & (g > b + 4) & (r - b > 15)
    neutral = neutral & (~is_skin_like)

    if neutral.sum() < 200:
        # Мало нейтральных пикселей — кадр насыщенный/однотонный, не двигаем.
        return 5500.0, 0.0

    r_mean = float(np.mean(r[neutral]))
    g_mean = float(np.mean(g[neutral]))
    b_mean = float(np.mean(b[neutral]))

    # Защита от деления на 0
    if b_mean < 1 or g_mean < 1:
        return 5500.0, 0.0

    rb_ratio = r_mean / b_mean
    # Эмпирическое отображение R/B → Kelvin (откалибровано на тестовых кадрах):
    #   R/B = 1.00 → 5500K (нейтраль)
    #   R/B = 1.30 → ~3500K (вольфрам)
    #   R/B = 0.85 → ~7000K (тень, облачно)
    # Линейная аппроксимация в логарифме отношения.
    log_rb = np.log(rb_ratio)
    current_kelvin = 5500.0 * np.exp(-log_rb * 1.55)
    current_kelvin = float(np.clip(current_kelvin, 2500.0, 9000.0))

    # Tint: G относительно (R+B)/2. Нейтраль = 1.0
    rb_avg = (r_mean + b_mean) / 2.0
    g_ratio = g_mean / max(rb_avg, 1.0)
    # g_ratio > 1 → перевес зелёного → положительный tint в нашей шкале
    # g_ratio < 1 → магента → отрицательный
    current_tint = (g_ratio - 1.0) * 100.0
    current_tint = float(np.clip(current_tint, -30.0, 30.0))

    return current_kelvin, current_tint


def _compute_wb_correction(
    current_kelvin: float,
    current_tint: float,
    target_kelvin: float = 5300.0,
    target_tint: float = 0.0,
    strength: float = 0.55,
) -> tuple[float, float]:
    """Вычисляет параметры WB-сдвига для приведения кадра к целевому диапазону.

    Не "выкручивает" коррекцию на 100% — атмосфера зала должна сохраниться.
    Целимся в 5000–5500K с центром 5300K.

    Args:
        current_kelvin: оцененная температура исходного кадра.
        current_tint: оцененный tint исходного кадра.
        target_kelvin: куда хотим прийти (5300K = тёплая нейтраль).
        target_tint: целевой tint (0 = нейтраль, лёгкая магента в коже).
        strength: 0..1 — насколько сильно тянем к цели (0.55 = умеренно).

    Returns:
        (wb_kelvin, wb_tint) — параметры для _wb_shift_lut, которые
        частично сдвинут текущий кадр к цели.
    """
    # Если текущая температура уже в целевом диапазоне — мягкий сдвиг.
    if 5000.0 <= current_kelvin <= 5500.0:
        strength *= 0.4

    # Целимся: new_kelvin = current + (target - current) * strength
    # Но _wb_shift_lut принимает АБСОЛЮТНОЕ значение — пересчитываем
    # в относительный сдвиг от 5500K.
    desired_shift = (target_kelvin - current_kelvin) * strength
    # _wb_shift_lut(kelvin_target=X) делает сдвиг (5500-X)/1000 в "теплее".
    # Чтобы получить желаемый desired_shift Кельвинов в сторону тепла,
    # нужно kelvin_target = 5500 - desired_shift.
    wb_kelvin = 5500.0 - desired_shift
    wb_kelvin = float(np.clip(wb_kelvin, 4000.0, 7000.0))

    # Tint: компенсируем отклонение, плюс лёгкая магента к цели.
    tint_correction = (target_tint - current_tint) * strength
    # _wb_shift_lut: положительный tint = магента (хорошо для кожи).
    # Если кадр имел избыток зелёного (current_tint > 0), коррекция
    # будет положительной — ровно то что нужно.
    wb_tint = float(np.clip(tint_correction, -10.0, 10.0))

    return wb_kelvin, wb_tint


def apply_capture_one_wedding_preset(img: Image.Image) -> Image.Image:
    """Применяет свадебный пресет Capture One к ретушированному изображению.

    Версия v2: добавлены сочность и контраст, убраны агрессивные затемнения
    (highlights -50, whites -22, vignette -0.34) — они делали кадр серым/мутным.
    """
    arr = np.array(img, dtype=np.uint8)
    del img

    # ВАЖНО: глобальный шумодав здесь ОТКЛЮЧЁН — он мылил фон и волосы.
    # Шумодав применяется ОТДЕЛЬНО по skin-mask в index.py
    # (см. apply_skin_denoise_with_mask).

    # 1. WB — АДАПТИВНЫЙ: оцениваем температуру исходного кадра по
    #    нейтральным областям и подбираем коррекцию индивидуально.
    #    Цель — привести кожу к диапазону 5000–5500K, но мягко
    #    (strength=0.55), чтобы не убить атмосферу зала.
    cur_k, cur_t = _estimate_scene_wb(arr)
    wb_k, wb_t = _compute_wb_correction(cur_k, cur_t)
    print(
        f"[C1-PRESET] auto-WB: scene≈{cur_k:.0f}K tint={cur_t:+.1f} "
        f"→ shift kelvin_target={wb_k:.0f}K tint={wb_t:+.1f}"
    )
    lut_r, lut_g, lut_b = _wb_shift_lut(kelvin_target=wb_k, tint=wb_t)
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

    # 4. Color editor — НЕ душим оранжевый (это кожа!), голубой приглушаем.
    color_mask = _hue_classify(arr)
    # Оранжевый (кожа): не трогаем насыщенность, только +4 luminance
    _adjust_color_channel(arr, color_mask, 1, sat=0, light=4)
    # Жёлтый: лёгкий сдвиг к оранжевому + чуть насыщеннее
    _adjust_color_channel(arr, color_mask, 2, hue_shift=-3.4, sat=6, light=8)
    # Голубой/синий: приглушаем (фон)
    _adjust_color_channel(arr, color_mask, 3, sat=-10)
    del color_mask

    # 5. Vignette — УБРАНА (создавала затемнение по краям/ощущение мутности).

    return Image.fromarray(arr, 'RGB')