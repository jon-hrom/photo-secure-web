"""Capture One свадебный пресет — применяется к RGB-массиву после rawpy.postprocess().

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


def _build_lut_curve(black_lift: int, shadow: int, brightness: int,
                     contrast: int, white_pull: int, highlight: int) -> np.ndarray:
    """Строит общую тоновую LUT 256→256 учётом всех тоновых параметров.
    Все значения — в шкале Capture One (-100..+100)."""
    x = np.arange(256, dtype=np.float32) / 255.0  # 0..1

    # 1. Lift blacks (поднимаем ноль)
    lift = black_lift / 255.0  # +15 → +0.058
    x = lift + x * (1.0 - lift)

    # 2. Pull whites (опускаем верхушку)
    pull = white_pull / 255.0  # -22 → -0.086
    x = x * (1.0 + pull)  # pull отрицательное → опускает белый

    # 3. Brightness — гамма-кривая в средних тонах
    if brightness != 0:
        # +22 → gamma ~0.78 (осветляет mid-tones)
        gamma = 1.0 - brightness / 200.0
        x = np.clip(x, 0.0, 1.0) ** gamma

    # 4. Contrast — мягкая S-кривая через sigmoid вокруг 0.5
    if contrast != 0:
        # -9 → лёгкое разглаживание
        k = contrast / 100.0  # -0.09
        x = 0.5 + (x - 0.5) * (1.0 + k * 0.5)

    # 5. Shadows lift (поднимает только нижнюю четверть)
    if shadow != 0:
        # +7 → лёгкий подъём теней
        s = shadow / 200.0  # +0.035
        shadow_mask = np.clip(1.0 - x * 4.0, 0.0, 1.0)
        x = x + shadow_mask * s

    # 6. Highlights pull (приглушает только верхнюю четверть)
    if highlight != 0:
        # -50 → сильное приглушение света
        h = highlight / 200.0  # -0.25
        hl_mask = np.clip((x - 0.6) * 2.5, 0.0, 1.0)
        x = x + hl_mask * h

    return np.clip(x * 255.0, 0, 255).astype(np.uint8)


def _wb_shift_lut(kelvin_target: int = 5390, tint: float = -5.4):
    """Возвращает три LUT для WB: имитируем сдвиг температуры/тинта.
    kelvin > 5500 — теплее (+R/-B), kelvin < 5500 — холоднее.
    tint > 0 — magenta (+R+B), tint < 0 — green (+G).
    """
    # Нормированные коэффициенты от 5500K (нейтрального дневного света)
    # Эмпирическая формула, как в большинстве RAW-конвертеров:
    delta_k = (kelvin_target - 5500) / 1000.0  # 5390 → -0.11
    k_r = 1.0 + delta_k * 0.045   # 5390 → 0.995
    k_b = 1.0 - delta_k * 0.060   # 5390 → 1.0066
    k_g = 1.0

    # Tint в шкале C1 ±100 → ±5% по зелёному каналу
    tint_norm = tint / 100.0  # -0.054
    k_g = k_g * (1.0 - tint_norm * 0.05)  # tint -5.4 → k_g ×1.0027 (чуть зеленее)
    k_r = k_r * (1.0 + tint_norm * 0.025)
    k_b = k_b * (1.0 + tint_norm * 0.025)

    x = np.arange(256, dtype=np.float32)
    return (
        np.clip(x * k_r, 0, 255).astype(np.uint8),
        np.clip(x * k_g, 0, 255).astype(np.uint8),
        np.clip(x * k_b, 0, 255).astype(np.uint8),
    )


def _exposure_lut(stops: float) -> np.ndarray:
    """Экспозиция в стопах: -0.39 → ×0.87"""
    mult = 2.0 ** stops
    x = np.arange(256, dtype=np.float32)
    return np.clip(x * mult, 0, 255).astype(np.uint8)


def _apply_lut_per_channel(arr: np.ndarray, lut_r: np.ndarray,
                            lut_g: np.ndarray, lut_b: np.ndarray) -> None:
    """In-place применение разных LUT к R/G/B."""
    arr[..., 0] = lut_r[arr[..., 0]]
    arr[..., 1] = lut_g[arr[..., 1]]
    arr[..., 2] = lut_b[arr[..., 2]]


def _apply_lut_global(arr: np.ndarray, lut: np.ndarray) -> None:
    """In-place применение одной LUT ко всем каналам."""
    for c in range(3):
        arr[..., c] = lut[arr[..., c]]


def _saturation_in_place(arr: np.ndarray, factor: float) -> None:
    """Поднимает/опускает насыщенность вокруг яркости пикселя. In-place."""
    if abs(factor - 1.0) < 0.01:
        return
    # luma = 0.299R + 0.587G + 0.114B  (BT.601)
    luma = (
        arr[..., 0].astype(np.uint16) * 77 +
        arr[..., 1].astype(np.uint16) * 150 +
        arr[..., 2].astype(np.uint16) * 29
    ) >> 8  # uint16
    for c in range(3):
        diff = arr[..., c].astype(np.int16) - luma.astype(np.int16)
        new_diff = (diff * int(factor * 256)) >> 8
        arr[..., c] = np.clip(
            luma.astype(np.int16) + new_diff, 0, 255
        ).astype(np.uint8)
    del luma


def _hue_classify(arr: np.ndarray) -> np.ndarray:
    """Возвращает uint8-маску с кодом цвета на пиксель:
    0 = неактивный (серый/чёрный/белый)
    1 = orange (R-Y) — кожа, дерево
    2 = yellow — лампы, свет
    3 = cyan — небо, вода
    """
    r = arr[..., 0].astype(np.int16)
    g = arr[..., 1].astype(np.int16)
    b = arr[..., 2].astype(np.int16)
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    chroma = max_c - min_c

    out = np.zeros(arr.shape[:2], dtype=np.uint8)
    active = chroma >= 18  # достаточная насыщенность

    # orange: R доминирует, G средний, B минимум; G/R в (0.4..0.75)
    is_orange = active & (r >= g) & (g > b) & ((g * 100) > r * 40) & ((g * 100) < r * 75)
    out[is_orange] = 1

    # yellow: R≈G > B, оба светлых
    is_yellow = active & (np.abs(r - g) < 25) & (r > b + 25)
    out[is_yellow & ~is_orange] = 2

    # cyan: G≈B > R
    is_cyan = active & (np.abs(g - b) < 25) & (g > r + 20)
    out[is_cyan] = 3

    del r, g, b, max_c, min_c, chroma, active, is_orange, is_yellow, is_cyan
    return out


def _adjust_color_channel(arr: np.ndarray, mask: np.ndarray, color_code: int,
                           hue_shift: float = 0.0, sat: float = 0.0,
                           light: float = 0.0) -> None:
    """Применяет HSL-сдвиги только к пикселям, относящимся к данному цвету.
    Параметры в шкале C1: hue/sat/light в условных единицах.
    """
    sel = (mask == color_code)
    if not sel.any():
        return

    # Light: умножение каналов
    if light != 0:
        light_mult = 1.0 + light / 100.0  # +10.8 → ×1.108
        for c in range(3):
            arr[sel, c] = np.clip(
                arr[sel, c].astype(np.float32) * light_mult, 0, 255
            ).astype(np.uint8)

    # Saturation: смещение от luma
    if sat != 0:
        sat_factor = 1.0 + sat / 100.0  # -12.8 → 0.872
        sub = arr[sel]  # (N,3)
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

    # Hue shift: для жёлтого -3.4 → чуть в красную сторону.
    # Простая аппроксимация: уменьшаем G, оставляем R.
    if hue_shift != 0 and color_code == 2:  # пока только yellow
        shift = abs(hue_shift) / 100.0  # 0.034
        sign = -1 if hue_shift < 0 else 1
        # hue<0 → к красному: чуть подавим G
        if sign < 0:
            arr[sel, 1] = np.clip(
                arr[sel, 1].astype(np.float32) * (1.0 - shift * 0.5), 0, 255
            ).astype(np.uint8)


def _apply_vignette(arr: np.ndarray, amount: float = -0.34) -> None:
    """Эллиптическая виньетка. amount<0 — затемнение по краям. In-place."""
    if abs(amount) < 0.02:
        return
    h, w = arr.shape[:2]
    yy, xx = np.indices((h, w), dtype=np.float32)
    cx, cy = w / 2.0, h / 2.0
    # эллиптическая нормированная дистанция (0 в центре, 1 на углах)
    dx = (xx - cx) / cx
    dy = (yy - cy) / cy
    dist = np.sqrt(dx * dx + dy * dy) / np.sqrt(2.0)
    del xx, yy, dx, dy
    # мягкая кривая: к краю эффект сильнее
    falloff = np.clip(dist, 0.0, 1.0) ** 2.2
    # амплитуда: -0.34 → до -34% яркости в углах
    mult = 1.0 + amount * falloff
    del dist, falloff
    # применяем поканально через uint16
    mult_u8 = np.clip(mult * 255, 0, 255).astype(np.uint16)
    del mult
    for c in range(3):
        arr[..., c] = ((arr[..., c].astype(np.uint16) * mult_u8) >> 8).astype(np.uint8)
    del mult_u8


def apply_capture_one_wedding_preset(img: Image.Image) -> Image.Image:
    """Главная точка входа: применяет полный пресет к PIL Image.
    Принимает RGB-PIL, возвращает RGB-PIL.
    """
    arr = np.array(img, dtype=np.uint8)  # H×W×3 uint8
    del img

    # === 1. WHITE BALANCE (Kelvin 5390 / Tint -5.4) ===
    lut_r, lut_g, lut_b = _wb_shift_lut(kelvin_target=5390, tint=-5.4)
    _apply_lut_per_channel(arr, lut_r, lut_g, lut_b)
    del lut_r, lut_g, lut_b

    # === 2. EXPOSURE (-0.39 stops) ===
    exp_lut = _exposure_lut(-0.39)
    _apply_lut_global(arr, exp_lut)
    del exp_lut

    # === 3. TONE (HDR + Brightness + Contrast) — одной LUT ===
    tone_lut = _build_lut_curve(
        black_lift=15,    # HDR Чёрный +15
        shadow=7,         # HDR Тень +7
        brightness=22,    # Яркость +22
        contrast=-9,      # Контраст -9
        white_pull=-22,   # HDR Белый -22
        highlight=-50,    # HDR Свет -50
    )
    _apply_lut_global(arr, tone_lut)
    del tone_lut

    # === 4. SATURATION (+12 общая) ===
    _saturation_in_place(arr, factor=1.12)

    # === 5. COLOR EDITOR (orange / yellow / cyan) ===
    color_mask = _hue_classify(arr)
    # Orange: sat -12.8, light +4.4
    _adjust_color_channel(arr, color_mask, 1, sat=-12.8, light=4.4)
    # Yellow: hue -3.4, sat +5.8, light +10.8
    _adjust_color_channel(arr, color_mask, 2, hue_shift=-3.4, sat=5.8, light=10.8)
    # Cyan: sat -10.2
    _adjust_color_channel(arr, color_mask, 3, sat=-10.2)
    del color_mask

    # === 6. VIGNETTE (-0.34) ===
    _apply_vignette(arr, amount=-0.34)

    return Image.fromarray(arr, 'RGB')
