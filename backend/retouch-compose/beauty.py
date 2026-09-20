"""Бьюти-ретушь: композиция результата AI-ретуши с оригиналом.

Пайплайн (профессиональная бьюти-ретушь):
  1. Маска кожи (SegFormer / эвристика) + защита глаз, губ, бровей, волос.
  2. Healing прыщей — normalized convolution по маске дефектов
     (аналог Spot Healing Brush: дефект заменяется интерполяцией
     окружающей чистой кожи).
  3. Frequency Separation — низкие частоты (тон) выравниваются,
     высокие частоты (поры) сохраняются с клиппингом амплитуды:
     пятна уходят, текстура кожи остаётся.
  4. Выравнивание тона + снятие красноты (red-cast removal).
  5. Возврат микротекстуры и лёгкий шарп.

Всё на numpy + Pillow, без scipy/opencv.
"""

import io
import numpy as np
from PIL import Image, ImageFilter

import skin_mask


# ====================== БАЗОВЫЕ ОПЕРАЦИИ ======================


def _box_blur_1d(arr: np.ndarray, radius: int, axis: int) -> np.ndarray:
    """Box-blur по одной оси через интегральное суммирование — O(n)."""
    if radius < 1:
        return arr
    a = np.swapaxes(arr, 0, axis)
    pad = radius + 1
    ap = np.pad(a, [(pad, pad)] + [(0, 0)] * (a.ndim - 1), mode='edge')
    cs = np.cumsum(ap, axis=0, dtype=np.float32)
    cs = np.pad(cs, [(1, 0)] + [(0, 0)] * (a.ndim - 1), mode='constant')
    n = a.shape[0]
    win = 2 * radius + 1
    # Окно [i-radius, i+radius] в координатах ap (cs сдвинут на 1 из-за pad).
    lo = np.arange(n) + pad - radius
    hi = np.arange(n) + pad + radius + 1
    out = (cs[hi] - cs[lo]) / float(win)
    return np.swapaxes(out, 0, axis)


def _blur_f(arr: np.ndarray, radius: float) -> np.ndarray:
    """Аппроксимация гауссова блюра float32-массива (3 прохода box-blur).

    PIL не умеет блюрить режим 'F', а точность float нам нужна для
    frequency separation и normalized convolution.

    Args:
        arr: 2D float32 массив.
        radius: радиус блюра в px.

    Returns:
        2D float32 массив.
    """
    a = arr.astype(np.float32)
    if radius <= 0:
        return a
    # Радиус box'а, эквивалентный гауссу с sigma = radius/2.
    sigma = float(radius) / 2.0
    box_r = max(1, int(round(sigma * 1.5)))
    for _ in range(3):
        a = _box_blur_1d(a, box_r, axis=0)
        a = _box_blur_1d(a, box_r, axis=1)
    return a


def _blur_rgb(arr: np.ndarray, radius: float) -> np.ndarray:
    """Блюр 3-канального float32 изображения поканально."""
    if radius <= 0:
        return arr.astype(np.float32)
    out = np.empty_like(arr, dtype=np.float32)
    for c in range(arr.shape[2]):
        out[:, :, c] = _blur_f(arr[:, :, c], radius)
    return out


def _normalized_blur(arr: np.ndarray, valid: np.ndarray, radius: float):
    """Normalized convolution: размывает изображение, полностью игнорируя
    невалидные (дефектные) пиксели. Именно это позволяет «затянуть» прыщ
    цветом окружающей ЧИСТОЙ кожи, а не размазать сам прыщ.

    Args:
        arr: 2D или 3D float32 изображение.
        valid: 2D float32 маска валидности (1.0 = чистый пиксель, 0.0 = дефект).
        radius: радиус сбора донорских пикселей.

    Returns:
        (result, confidence) — результат и 0..1 достоверность интерполяции.
        Там, где донорских пикселей почти нет, confidence ≈ 0 и результату
        доверять нельзя (иначе появляются серые кляксы от деления на ~0).
    """
    w = _blur_f(valid, radius)
    w_safe = np.maximum(w, 1e-3)
    conf = np.clip((w - 0.08) / 0.12, 0.0, 1.0)
    if arr.ndim == 2:
        return _blur_f(arr * valid, radius) / w_safe, conf
    out = np.empty_like(arr, dtype=np.float32)
    for c in range(arr.shape[2]):
        out[:, :, c] = _blur_f(arr[:, :, c] * valid, radius) / w_safe
    return out, conf


def _morph(mask: np.ndarray, radius: float, mode: str) -> np.ndarray:
    """Быстрая дилатация/эрозия бинарной маски через box-blur + порог.

    PIL MinFilter/MaxFilter — rank-фильтры, на больших радиусах они съедают
    десятки секунд. Размытие маски и пороговое отсечение даёт практически тот
    же результат за O(n).

    Args:
        mask: uint8 HxW (0/255) или bool.
        radius: радиус структурного элемента в px.
        mode: 'dilate' или 'erode'.

    Returns:
        uint8 HxW (0/255).
    """
    m = (np.asarray(mask) > 128).astype(np.float32) if mask.dtype == np.uint8 \
        else np.asarray(mask).astype(np.float32)
    if radius < 1:
        return (m > 0.5).astype(np.uint8) * 255
    # Радиус блюра подобран так, чтобы фронт распространялся примерно
    # на заданный radius при пороге ниже.
    blurred = _blur_f(m, float(radius) * 1.4)
    thr = 0.12 if mode == 'dilate' else 0.88
    return (blurred > thr).astype(np.uint8) * 255


def _open_close(mask: np.ndarray, open_r: float, close_r: float) -> np.ndarray:
    """Opening (убрать шум) затем closing (заполнить дыры)."""
    out = mask
    if open_r > 0:
        out = _morph(out, open_r, 'erode')
        out = _morph(out, open_r, 'dilate')
    if close_r > 0:
        out = _morph(out, close_r, 'dilate')
        out = _morph(out, close_r, 'erode')
    return out


def _feather(mask: np.ndarray, radius: float) -> np.ndarray:
    """Растушёвка бинарной маски -> float32 0..1."""
    m = mask.astype(np.float32)
    if m.max() > 1.5:
        m = m / 255.0
    return np.clip(_blur_f(m, radius), 0.0, 1.0)


def _grow(mask_u8: np.ndarray, px: int) -> np.ndarray:
    """Дилатация бинарной маски на px пикселей."""
    if px <= 0:
        return mask_u8
    return _morph(mask_u8, px, 'dilate')


def refine_skin_mask(rgb: np.ndarray, skin: np.ndarray) -> np.ndarray:
    """Уточняет маску кожи по цветовой статистике.

    Грубая маска (особенно fallback-эвристика) часто заползает на волосы,
    брови, губы и фон. Там healing не имеет донора и даёт серые кляксы.
    Оставляем только пиксели, чей цвет близок к медианному цвету кожи.

    Args:
        rgb: float32 HxWx3, 0..255.
        skin: uint8 HxW маска (0/255).

    Returns:
        uint8 HxW уточнённая маска.
    """
    h, w = rgb.shape[:2]
    sel = skin > 0
    n0 = int(np.count_nonzero(sel))
    if n0 < 200:
        return skin

    lum = rgb.mean(axis=2)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    # Цветовые признаки, устойчивые к освещению.
    rg = r - g
    gb = g - b

    cur = sel.copy()
    # Итеративное уточнение: исходная маска смещена волосами, поэтому
    # медиана считается заново после каждого отсечения и сходится к коже.
    for it in range(3):
        if int(np.count_nonzero(cur)) < 200:
            break
        med_l = float(np.median(lum[cur]))
        med_rg = float(np.median(rg[cur]))
        med_gb = float(np.median(gb[cur]))
        p10, p90 = np.percentile(lum[cur], [10, 90])
        spread = max(10.0, float(p90 - p10))

        # Волосы/брови/фон темнее кожи; блики светлее, но их оставляем.
        # Порог мягкий: затенённая половина лица не должна отсекаться.
        ok_lum = lum > (med_l - 2.2 * spread)
        # Допуск по цветности с запасом: воспалённые/красные участки кожи
        # (акне, раздражение) отличаются по rg и раньше выпадали из маски —
        # именно они и должны лечиться.
        ok_rg = np.abs(rg - med_rg) < 30.0
        ok_gb = np.abs(gb - med_gb) < 30.0
        cur = sel & ok_lum & ok_rg & ok_gb

    refined = cur.astype(np.uint8) * 255

    # Opening убирает тонкие «языки» маски в волосах, closing заполняет
    # внутренние дырки (глаза, ноздри, блики).
    refined = _open_close(refined,
                          open_r=max(3, int(min(h, w) * 0.010)),
                          close_r=max(3, int(min(h, w) * 0.014)))
    # Не выходим за пределы исходной маски + чуть-чуть внутрь от края.
    refined = np.minimum(refined, skin)

    kept = int(np.count_nonzero(refined))
    print(f"[BEAUTY] refine skin: {n0} -> {kept}px ({kept * 100.0 / max(n0, 1):.0f}% kept)")
    if kept < n0 * 0.15:
        print("[BEAUTY] refine too aggressive -> keep original mask")
        return skin
    return refined


def _largest_component(mask: np.ndarray, max_iter: int = 400) -> np.ndarray:
    """Оставляет крупнейшую связную область маски (итеративное наращивание
    от самой плотной точки — без scipy.label).

    Args:
        mask: bool HxW.

    Returns:
        bool HxW.
    """
    if not mask.any():
        return mask
    h, w = mask.shape
    # Связность считаем на уменьшенной копии — иначе реконструкция на
    # 2000px занимает десятки секунд.
    small_side = 256
    scale = min(1.0, small_side / float(max(h, w)))
    sw, sh = max(8, int(w * scale)), max(8, int(h * scale))
    src = Image.fromarray((mask.astype(np.uint8) * 255), mode='L')
    small = np.asarray(src.resize((sw, sh), Image.NEAREST)) > 128
    if not small.any():
        return mask

    dens = _blur_f(small.astype(np.float32), 4.0)
    dens = np.where(small, dens, 0.0)
    sy, sx = divmod(int(np.argmax(dens)), sw)

    seed = np.zeros_like(small)
    seed[sy, sx] = True
    prev_count = 0
    for _ in range(max_iter):
        m = Image.fromarray((seed.astype(np.uint8) * 255), mode='L')
        m = m.filter(ImageFilter.MaxFilter(3))
        grown = (np.asarray(m) > 0) & small
        cnt = int(np.count_nonzero(grown))
        if cnt == prev_count:
            break
        prev_count = cnt
        seed = grown

    big = Image.fromarray((seed.astype(np.uint8) * 255), mode='L').resize(
        (w, h), Image.BILINEAR)
    return (np.asarray(big) > 96) & mask


def build_skin_from_seed(rgb: np.ndarray, seed_mask: np.ndarray) -> np.ndarray:
    """Строит полную маску кожи по цвету, используя seed как образец тона.

    Базовая маска (особенно fallback без SegFormer) часто покрывает лишь
    часть лица — например, одну щёку. Но даже такой фрагмент — валидный
    образец цвета кожи. Расширяем его на все пиксели с похожей цветностью,
    затем оставляем одну связную область (лицо+шея) и отсекаем фон/одежду.

    Args:
        rgb: float32 HxWx3, 0..255.
        seed_mask: uint8 HxW — грубая маска-образец.

    Returns:
        uint8 HxW маска кожи (0/255).
    """
    h, w = rgb.shape[:2]
    seed = seed_mask > 0
    if int(np.count_nonzero(seed)) < 300:
        return seed_mask

    lum = rgb.mean(axis=2)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    rg = r - g
    gb = g - b

    # Устойчивые центры и разбросы цветности кожи по seed.
    def _robust(ch):
        v = ch[seed]
        med = float(np.median(v))
        p16, p84 = np.percentile(v, [16, 84])
        sd = max(3.0, float(p84 - p16) / 2.0)
        return med, sd

    m_rg, s_rg = _robust(rg)
    m_gb, s_gb = _robust(gb)
    m_l, s_l = _robust(lum)

    # Расстояние в пространстве цветности (яркость — мягче, т.к. светотень).
    d = ((rg - m_rg) / (s_rg * 3.2)) ** 2 + ((gb - m_gb) / (s_gb * 3.2)) ** 2
    # Яркость почти не штрафуем: светотень на лице — это норма, а не «не кожа».
    d += np.clip((m_l - 4.5 * s_l - lum) / max(s_l * 3.0, 15.0), 0.0, None) ** 2
    cand = d < 1.0

    # Кожа насыщеннее по красному, чем нейтральная одежда/фон.
    sat = np.abs(rg) + np.abs(gb)
    cand &= (sat > max(6.0, (abs(m_rg) + abs(m_gb)) * 0.35))
    # Отсекаем совсем тёмный фон.
    cand &= lum > 28.0

    # Блики на коже теряют цветность и выпадают из критерия — возвращаем их,
    # иначе в маске появляются дыры на скулах и лбу.
    highlight = (lum > m_l + 1.2 * s_l) & (lum > 120.0) & (rg > m_rg - 14.0)
    cand |= highlight

    # Opening — убрать шум и тонкие мостики к волосам/фону.
    cand = _morph(cand.astype(np.uint8) * 255, max(2, int(min(h, w) * 0.006)),
                  'erode')
    cand = _morph(cand, max(2, int(min(h, w) * 0.006)), 'dilate') > 128

    comp = _largest_component(cand)
    # Closing — заполнить глаза, брови, ноздри внутри лица.
    close_r = max(2, int(min(h, w) * 0.020))
    out = _morph(comp.astype(np.uint8) * 255, close_r, 'dilate')
    out = _morph(out, close_r, 'erode')

    pct = float(np.count_nonzero(out)) * 100.0 / (h * w)
    seed_pct = float(np.count_nonzero(seed)) * 100.0 / (h * w)
    print(f"[BEAUTY] skin from seed: {seed_pct:.1f}% -> {pct:.1f}%")
    if pct < seed_pct * 0.6 or pct > 70.0:
        print("[BEAUTY] seed-grow unreliable -> keep refined mask")
        return seed_mask
    return out


def build_protect_heuristic(rgb: np.ndarray, skin: np.ndarray) -> np.ndarray:
    """Защита черт лица (глаза, ресницы, ноздри, губы, брови) без ИИ.

    Нужна как страховка: если SegFormer-маска недоступна, грубая маска кожи
    накрывает глаза и губы, и они получаются замыленными.

    Признак: зона с аномально высоким локальным контрастом или сильно
    отличающимся от кожи цветом/яркостью.

    Returns:
        float32 HxW 0..1, где 1 = полностью защитить.
    """
    h, w = rgb.shape[:2]
    sel = skin > 0
    if int(np.count_nonzero(sel)) < 200:
        return np.zeros((h, w), dtype=np.float32)

    lum = rgb.mean(axis=2)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]

    med_l = float(np.median(lum[sel]))
    p10, p90 = np.percentile(lum[sel], [10, 90])
    spread = max(10.0, float(p90 - p10))

    # 1. Очень тёмные зоны: зрачок, ресницы, ноздря, линия рта.
    #    Порог жёсткий — обычная тень на лице сюда попадать не должна.
    very_dark = (lum < (med_l - 1.2 * spread))

    # 1б. Высокий локальный контраст — ресницы, край века, зубы, блик глаза.
    small = max(2.0, min(h, w) * 0.003)
    lmean = _blur_f(lum, small * 3.0)
    contrast = np.sqrt(np.maximum(_blur_f((lum - lmean) ** 2, small * 3.0), 0.0))
    c_thr = float(np.percentile(contrast[sel], 98.5))
    sharp_edges = contrast > max(c_thr, 13.0)

    # Брови/волосы: заметно темнее кожи И менее «красные».
    hair = (lum < med_l - 1.0 * spread) & ((r - g) < float(np.median((r - g)[sel])) - 6.0)

    # 2. Губы: одновременно заметно краснее и темнее окружающей кожи.
    redness = r - (g + b) / 2.0
    med_red = float(np.median(redness[sel]))
    p_red = float(np.percentile(redness[sel], 97))
    lips = (redness > max(med_red + 18.0, p_red)) & (lum < med_l)

    seeds = (very_dark | lips | sharp_edges | hair) & sel
    seed_pct = float(np.count_nonzero(seeds)) * 100.0 / (h * w)
    # Если «семян» неправдоподобно много — статистика сломалась, не защищаем
    # ничего, иначе накроем половину лица и получим мыло.
    if seed_pct > 12.0:
        print(f"[BEAUTY] protect seeds too big ({seed_pct:.1f}%) -> skip protect")
        return np.zeros((h, w), dtype=np.float32)

    # Убираем одиночный шум, затем расширяем на окрестность (веко, край губ).
    m = _morph(seeds.astype(np.uint8) * 255, 1, 'erode')
    m = _morph(m, max(3, int(min(h, w) * 0.006)), 'dilate')
    protect = m.astype(np.float32) / 255.0
    protect = np.clip(_blur_f(protect, max(2.0, min(h, w) * 0.003)), 0.0, 1.0)

    print(f"[BEAUTY] protect zones: seeds={seed_pct:.2f}% "
          f"final={float((protect > 0.25).mean()) * 100:.1f}%")
    return protect.astype(np.float32)


def detect_red_patches(rgb: np.ndarray, skin: np.ndarray,
                       strength: float = 1.0) -> np.ndarray:
    """Находит ПЛОСКИЕ красные пятна: пост-акне, воспаления, раздражение.

    DoG-детектор ловит выпуклые «пики», но зажившие пятна плоские и широкие —
    они остаются. Здесь сравниваем красноту с локальным фоном большого радиуса.

    Returns:
        uint8 HxW маска (0/255).
    """
    h, w = rgb.shape[:2]
    sel = skin > 0
    if int(np.count_nonzero(sel)) < 200:
        return np.zeros((h, w), dtype=np.uint8)

    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    redness = r - (g + b) / 2.0
    valid = sel.astype(np.float32)
    # Фон = краснота, усреднённая по крупному радиусу (общий тон лица).
    bg = _normalized_blur(redness, valid, max(14.0, min(h, w) * 0.05))[0]
    # Второй, средний радиус: у края щеки и по контуру лица краснота растёт
    # плавно, и на крупном радиусе фон «подтягивается» к самому пятну —
    # мелкие красные точки там переставали детектироваться.
    bg_mid = _normalized_blur(redness, valid, max(6.0, min(h, w) * 0.018))[0]
    excess = np.maximum(redness - bg, (redness - bg_mid) * 1.5)

    vals = excess[sel]
    thr = float(np.percentile(vals, float(np.clip(100.0 - 16.0 * strength,
                                                  50.0, 99.5))))
    # Минимальный абсолютный порог смягчается на высокой силе: слегка
    # красноватые следы пост-акне иначе отсекаются константой и остаются
    # видны точками на щеке.
    min_thr = 1.2 / max(1.0, strength)
    thr = max(thr, min_thr)
    patches = ((excess > thr) & sel).astype(np.uint8) * 255

    # Убираем одиночный шум, затем слегка расширяем пятна.
    # На высокой силе эрозию пропускаем: она съедала как раз те точечные
    # следы пост-акне у края щеки, ради которых пресет и включают.
    if strength <= 1.0:
        patches = _morph(patches, 1, 'erode')
    patches = _morph(patches, 3 if strength > 1.0 else 2, 'dilate')
    patches = np.where((patches > 128) & sel, 255, 0).astype(np.uint8)
    print(f"[BEAUTY] red patches: {np.count_nonzero(patches) * 100.0 / (h * w):.2f}% thr={thr:.1f}")
    return patches


def detect_spots(rgb: np.ndarray, skin: np.ndarray,
                 strength: float = 1.0) -> np.ndarray:
    """Ловит мелкие точечные дефекты: чёрные точки, поры-комедоны,
    подсохшее акне, мелкие тёмные пятнышки.

    DoG в skin_mask настроен на выпуклые прыщи и отсекает россыпь мелких
    точек как «шум/щетину». Здесь работаем напрямую: пиксель темнее или
    краснее своего локального окружения на заметную величину = дефект.

    Args:
        rgb: float32 HxWx3, 0..255.
        skin: uint8 HxW маска кожи.
        strength: 0..1, выше = агрессивнее.

    Returns:
        uint8 HxW маска (0/255).
    """
    h, w = rgb.shape[:2]
    sel = skin > 0
    if int(np.count_nonzero(sel)) < 200 or strength <= 0:
        return np.zeros((h, w), dtype=np.uint8)

    lum = rgb.mean(axis=2)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    valid = sel.astype(np.float32)
    redness = r - (g + b) / 2.0

    # Два масштаба фона: крупный ловит пятна и ореолы, мелкий — точечные
    # следы, ямки-рубчики от акне и одиночные красные точки, которые на
    # крупном радиусе тонут в общем тоне щеки.
    bg_r = max(6.0, min(h, w) * 0.012)
    fine_r = max(2.5, min(h, w) * 0.004)
    lum_bg = _normalized_blur(lum, valid, bg_r)[0]
    red_bg = _normalized_blur(redness, valid, bg_r)[0]
    lum_bg_f = _normalized_blur(lum, valid, fine_r)[0]
    red_bg_f = _normalized_blur(redness, valid, fine_r)[0]

    # насколько темнее / краснее фона (максимум по двум масштабам)
    dark_drop = np.maximum(lum_bg - lum, (lum_bg_f - lum) * 1.6)
    red_rise = np.maximum(redness - red_bg, (redness - red_bg_f) * 1.6)

    # Пороги по статистике самой кожи, смягчаются параметром strength.
    pct = float(np.clip(100.0 - 14.0 * strength, 50.0, 99.5))
    d_thr = float(np.percentile(dark_drop[sel], pct))
    r_thr = float(np.percentile(red_rise[sel], pct))
    # На максимальной силе абсолютный минимум опускаем: мелкие бугорки,
    # ямки-рубчики от акне и подсохшие точки дают перепад всего 1-1.5 ед.
    # и раньше игнорировались.
    d_thr = max(d_thr, 1.4 / max(1.0, strength))
    r_thr = max(r_thr, 1.2 / max(1.0, strength))

    spots = ((dark_drop > d_thr) | (red_rise > r_thr)) & sel
    spots = spots.astype(np.uint8) * 255

    # Небольшое расширение — захватить ореол точки целиком.
    spots = _morph(spots, 2 if strength <= 1.0 else 3, 'dilate')
    spots = np.where((spots > 128) & sel, 255, 0).astype(np.uint8)
    print(f"[BEAUTY] spots: {np.count_nonzero(spots) * 100.0 / (h * w):.2f}% "
          f"thr d={d_thr:.1f} r={r_thr:.1f}")
    return spots


# ====================== HEALING ПРЫЩЕЙ ======================


def heal_blemishes(rgb: np.ndarray, defects: np.ndarray, skin: np.ndarray,
                   passes: int = 3) -> np.ndarray:
    """Затягивает дефекты кожи интерполяцией окружающей чистой кожи.

    Мультимасштабно: сначала крупный радиус восстанавливает общий тон,
    затем мелкие радиусы уточняют переход. Работает как Spot Healing:
    внутри маски дефекта не остаётся НИЧЕГО от исходного пятна.

    Args:
        rgb: float32 HxWx3, 0..255.
        defects: uint8 HxW маска дефектов (0/255).
        skin: uint8 HxW маска кожи (0/255).
        passes: число масштабов интерполяции.

    Returns:
        float32 HxWx3 с залеченными дефектами.
    """
    if int(np.count_nonzero(defects)) == 0:
        return rgb

    h, w = rgb.shape[:2]
    base = max(4.0, min(h, w) * 0.006)

    # Валидный донор = кожа без дефектов.
    skin_f = (skin > 0).astype(np.float32)
    defect_f = (defects > 0).astype(np.float32)
    valid = np.clip(skin_f - defect_f, 0.0, 1.0)

    healed = rgb.copy()
    for i in range(passes):
        # Идём от крупного радиуса к мелкому: сначала общий тон, потом детали.
        radius = base * (8.0 / (2.0 ** i))
        filled, conf = _normalized_blur(healed, valid, radius)
        # Подставляем интерполяцию только внутрь дефекта и только там,
        # где рядом достаточно чистой кожи-донора.
        a = (defect_f * conf)[:, :, None]
        healed = healed * (1.0 - a) + filled * a

    # Растушёвываем шов на границе дефекта, чтобы не было пятна-заплатки.
    edge = _feather(defects, max(2.0, base * 0.8))[:, :, None]
    smooth_edge = _blur_rgb(healed, max(1.5, base * 0.5))
    healed = healed * (1.0 - edge * 0.45) + smooth_edge * (edge * 0.45)

    # Вне кожи ничего не трогаем.
    s = skin_f[:, :, None]
    return rgb * (1.0 - s) + healed * s


# ====================== FREQUENCY SEPARATION ======================


def frequency_separation(rgb: np.ndarray, skin_alpha: np.ndarray,
                         tone_radius: float, tone_strength: float,
                         texture_keep: float, blotch_clip: float) -> np.ndarray:
    """Частотное разделение — основа профессиональной бьюти-ретуши.

    LOW (тон/цвет) — выравнивается сильно: уходят пятна, краснота, неровности.
    HIGH (текстура) — сохраняется, но амплитуда клиппится: крупные «кляксы»
    и рельеф прыщей срезаются, поры и микрорельеф остаются.

    Args:
        rgb: float32 HxWx3, 0..255.
        skin_alpha: float32 HxW 0..1 — где применять.
        tone_radius: радиус разделения частот (px).
        tone_strength: 0..1 — насколько сильно выравнивать тон.
        texture_keep: 0..1 — сколько текстуры вернуть.
        blotch_clip: порог амплитуды HF в единицах яркости; всё, что выше,
            считается дефектом и подавляется.

    Returns:
        float32 HxWx3.
    """
    low = _blur_rgb(rgb, tone_radius)
    high = rgb - low

    # Выравнивание низких частот: ещё более широкий блюр = идеально ровный тон.
    low_even = _blur_rgb(low, tone_radius * 2.2)
    low_out = low * (1.0 - tone_strength) + low_even * tone_strength

    # Подавление «клякс» в высоких частотах.
    amp = np.abs(high).max(axis=2)
    # soft-knee: до blotch_clip — texture_keep, выше — быстро к нулю.
    excess = np.clip((amp - blotch_clip) / max(blotch_clip, 1.0), 0.0, 1.0)
    keep = texture_keep * (1.0 - excess) ** 2
    high_out = high * keep[:, :, None]

    result = low_out + high_out
    a = skin_alpha[:, :, None]
    return rgb * (1.0 - a) + result * a


# ====================== ЦВЕТ И КРАСНОТА ======================


def even_out_tone(rgb: np.ndarray, skin_alpha: np.ndarray,
                  strength: float, radius_ratio: float = 0.05) -> np.ndarray:
    """Выравнивает цветовые пятна: краснота, пигментация, синева под глазами.

    Работает по цветности (a/b-подобные разности), не трогая яркость —
    поэтому объём лица и светотень сохраняются.
    """
    if strength <= 0:
        return rgb
    h, w = rgb.shape[:2]
    radius = max(8.0, min(h, w) * radius_ratio)

    lum = rgb.mean(axis=2)
    chroma = rgb - lum[:, :, None]                 # цветовая составляющая
    chroma_local = _blur_rgb(chroma, radius)       # локально усреднённый цвет
    chroma_out = chroma * (1.0 - strength) + chroma_local * strength

    result = lum[:, :, None] + chroma_out
    a = skin_alpha[:, :, None]
    return rgb * (1.0 - a) + result * a


def remove_red_cast(rgb: np.ndarray, skin_alpha: np.ndarray,
                    strength: float) -> np.ndarray:
    """Снимает локальные покраснения (следы акне, розацеа, раздражение)."""
    if strength <= 0:
        return rgb
    h, w = rgb.shape[:2]
    radius = max(10.0, min(h, w) * 0.04)

    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    redness = r - (g + b) / 2.0
    redness_local = _blur_f(redness, radius)
    # Избыток красноты относительно окружающей кожи.
    excess = np.clip(redness - redness_local, 0.0, None)

    out = rgb.copy()
    out[:, :, 0] = r - excess * strength
    a = skin_alpha[:, :, None]
    return rgb * (1.0 - a) + out * a


def micro_texture(rgb: np.ndarray, source: np.ndarray, skin_alpha: np.ndarray,
                  amount: float) -> np.ndarray:
    """Возвращает тонкую текстуру пор из оригинала, чтобы кожа не была
    пластиковой. Берутся ТОЛЬКО низкоамплитудные детали (поры), крупные
    дефекты не возвращаются.
    """
    if amount <= 0:
        return rgb
    detail = source - _blur_rgb(source, 1.6)
    amp = np.abs(detail).max(axis=2)
    # Поры имеют амплитуду ~2-8; прыщи — гораздо больше.
    gate = np.clip(1.0 - (amp - 6.0) / 8.0, 0.0, 1.0)
    detail = detail * gate[:, :, None]
    a = (skin_alpha * amount)[:, :, None]
    return rgb + detail * a


def unsharp(rgb: np.ndarray, amount: float, radius: float) -> np.ndarray:
    """Финальный аккуратный шарп по всему кадру (глаза, волосы, губы)."""
    if amount <= 0:
        return rgb
    blurred = _blur_rgb(rgb, radius)
    return rgb + (rgb - blurred) * amount


# ====================== ГЛАВНЫЙ ПАЙПЛАЙН ======================


def compose(original_bytes: bytes, retouched_bytes: bytes,
            preset: dict) -> bytes:
    """Полная бьюти-композиция.

    Args:
        original_bytes: JPEG оригинала.
        retouched_bytes: JPEG результата AI-ретуши (LaMa).
        preset: словарь параметров из presets.py.

    Returns:
        JPEG байты финального изображения.
    """
    full_img = Image.open(io.BytesIO(original_bytes))
    if full_img.mode != 'RGB':
        full_img = full_img.convert('RGB')
    orig_img = full_img
    ret_img = Image.open(io.BytesIO(retouched_bytes))
    if ret_img.mode != 'RGB':
        ret_img = ret_img.convert('RGB')

    # Рабочее разрешение.
    max_side = int(preset.get('max_compose_side', 1800))
    full_size = full_img.size
    w0, h0 = full_size
    scale = min(1.0, max_side / float(max(w0, h0)))
    if scale < 1.0:
        work_size = (int(round(w0 * scale)), int(round(h0 * scale)))
        orig_img = full_img.resize(work_size, Image.LANCZOS)
    work_size = orig_img.size
    if ret_img.size != work_size:
        ret_img = ret_img.resize(work_size, Image.LANCZOS)

    orig = np.asarray(orig_img, dtype=np.float32)
    ret = np.asarray(ret_img, dtype=np.float32)
    h, w = orig.shape[:2]

    import time as _t
    _t0 = _t.time()

    def _tick(stage):
        print(f"[BEAUTY] {stage}: {_t.time() - _t0:.1f}s")

    print(f"[BEAUTY] work size: {orig.shape[1]}x{orig.shape[0]}")

    # --- 1. Маска кожи ---
    work_bytes = _to_jpeg_bytes(orig_img, 92)
    # ВАЖНО: каждый вызов AI-сегментации — сетевой запрос на 15 сек таймаута,
    # поэтому дергаем сервер строго по одному разу на режим.
    ai_mask = skin_mask._call_ai_face_parse(work_bytes, mode="skin")
    use_ai = ai_mask is not None

    if use_ai:
        # SegFormer точно разделяет кожу/волосы/одежду.
        print("[BEAUTY] skin mask source: SegFormer (AI)")
        ai_protect = skin_mask._call_ai_face_parse(work_bytes, mode="protect")
        if ai_protect is not None:
            expand_r = max(4, int(min(*ai_mask.shape) * 0.006))
            protect_exp = _morph(ai_protect, expand_r, 'dilate')
            ai_mask = np.where(protect_exp > 128, 0, ai_mask).astype(np.uint8)
        skin = np.where(ai_mask > 128, 255, 0).astype(np.uint8)
        if skin.shape[:2] != (h, w):
            skin = np.asarray(Image.fromarray(skin, mode='L').resize(
                (w, h), Image.LANCZOS))
            skin = np.where(skin > 128, 255, 0).astype(np.uint8)
    else:
        skin = _decode_mask(skin_mask.build_face_skin_mask(work_bytes), (w, h))
        # Fallback-эвристика дырявая: покрывает лишь часть лица, и прыщи на
        # непокрытых участках остаются. Чистим её по цвету и достраиваем
        # полную маску по образцу тона; глаза/губы/брови затем вырезаются
        # protect-маской ниже.
        print("[BEAUTY] skin mask source: heuristic fallback")
        skin = refine_skin_mask(orig, skin)
        # Эвристика часто покрывает лишь фрагмент лица (одна щека, лоб), и
        # прыщи вне этого фрагмента остаются нетронутыми — «Сильная» тогда
        # визуально не отличается от «Стандарта». Если покрытие явно мало
        # для портрета, достраиваем маску по образцу цвета кожи; черты лица
        # защищает protect-маска ниже.
        cover = float(np.count_nonzero(skin)) * 100.0 / (h * w)
        if cover < 12.0:
            print(f"[BEAUTY] fallback mask too small ({cover:.1f}%) -> grow from seed")
            skin = build_skin_from_seed(orig, skin)
    skin_pct = float(np.count_nonzero(skin)) * 100.0 / (h * w)
    print(f"[BEAUTY] skin mask: {skin_pct:.1f}%")

    if skin_pct < 0.5:
        print("[BEAUTY] no skin found -> return AI result as is")
        return _to_jpeg_bytes(ret_img, int(preset.get('jpeg_quality', 95)))

    _tick('skin mask')

    # --- 2. Защита черт лица (глаза, губы, ноздри, ресницы) ---
    if use_ai:
        # SegFormer уже исключил глаза/губы/брови из маски кожи.
        protect = np.zeros((h, w), dtype=np.float32)
    else:
        protect = build_protect_heuristic(orig, skin)

    _tick('protect')

    # --- 3. База: AI-результат внутри кожи, оригинал снаружи ---
    alpha_mult = float(preset.get('alpha_multiplier', 1.0))
    base_alpha = float(np.clip(alpha_mult * 0.7, 0.0, 1.0))
    # Широкая растушёвка: граница ретушированной кожи не должна быть видна.
    feather_r = max(6.0, min(h, w) * 0.020)
    skin_a = _feather(skin, feather_r) * (1.0 - protect)

    img = orig * (1.0 - (skin_a * base_alpha)[:, :, None]) \
        + ret * (skin_a * base_alpha)[:, :, None]

    _tick('base blend')

    # --- 4. Healing прыщей ---
    # Объёмные прыщи (DoG) + плоские красные пятна и пост-акне.
    defects = skin_mask._detect_defects(
        orig.astype(np.uint8), skin,
        sensitivity=float(preset.get('defect_sensitivity', 98.0)),
        stubble_guard=bool(preset.get('stubble_guard', True)),
    )
    patch_strength = float(preset.get('red_patch_strength', 0.0))
    if patch_strength > 0:
        patches = detect_red_patches(orig, skin, patch_strength)
        defects = np.maximum(defects, patches)

    spot_strength = float(preset.get('spot_strength', 0.0))
    if spot_strength > 0:
        defects = np.maximum(defects, detect_spots(orig, skin, spot_strength))

    grow_px = int(preset.get('defect_grow_px', 3))
    if grow_px > 0:
        defects = _grow(defects, grow_px)
    # Дефекты лечим только в глубине кожи: у самого края маски донора мало.
    # Порог настраиваемый: при 0.85 отсекалась полоса шириной в несколько
    # пикселей вдоль контура лица, и красные точки у края щеки оставались.
    edge_guard = float(preset.get('edge_guard', 0.85))
    inner = _feather(skin, max(3.0, min(h, w) * 0.004))
    defects = np.where(inner > edge_guard, defects, 0).astype(np.uint8)
    # Не лечим внутри защищённых зон — иначе поплывут глаза и губы.
    defects = np.where(protect > 0.25, 0, defects).astype(np.uint8)
    defect_pct = float(np.count_nonzero(defects)) * 100.0 / (h * w)
    print(f"[BEAUTY] defects total: {defect_pct:.2f}% grow={grow_px}px")

    heal_passes = int(preset.get('heal_passes', 3))
    heal_zone = np.where(protect > 0.25, 0, skin).astype(np.uint8)
    if heal_passes > 0:
        img = heal_blemishes(img, defects, heal_zone, passes=heal_passes)

        # Второй проход: после первого healing часть пятен ослабевает, но
        # не исчезает (сливавшиеся прыщи, широкие воспаления). Детектируем
        # заново уже по обработанному кадру и долечиваем остатки.
        for it in range(1, int(preset.get('heal_iterations', 1))):
            cur = np.clip(img, 0, 255)
            residual = skin_mask._detect_defects(
                cur.astype(np.uint8), heal_zone,
                sensitivity=float(preset.get('defect_sensitivity', 98.0)),
                stubble_guard=bool(preset.get('stubble_guard', True)),
            )
            if patch_strength > 0:
                residual = np.maximum(
                    residual, detect_red_patches(cur, heal_zone, patch_strength))
            if spot_strength > 0:
                residual = np.maximum(
                    residual, detect_spots(cur, heal_zone, spot_strength))
            if grow_px > 0:
                residual = _grow(residual, grow_px)
            residual = np.where(inner > edge_guard, residual, 0).astype(np.uint8)
            residual = np.where(protect > 0.25, 0, residual).astype(np.uint8)
            res_pct = float(np.count_nonzero(residual)) * 100.0 / (h * w)
            print(f"[BEAUTY] residual defects (pass {it}): {res_pct:.2f}%")
            if res_pct < 0.02:
                break
            img = heal_blemishes(img, residual, heal_zone, passes=heal_passes)
            defects = np.maximum(defects, residual)

    _tick('healing')

    # --- 4. Frequency separation ---
    tone_radius = max(3.0, min(h, w) * float(preset.get('tone_radius_ratio', 0.008)))
    img = frequency_separation(
        img, skin_a,
        tone_radius=tone_radius,
        tone_strength=float(preset.get('tone_strength', 0.6)),
        texture_keep=float(preset.get('texture_keep', 0.55)),
        blotch_clip=float(preset.get('blotch_clip', 9.0)),
    )

    _tick('freq sep')

    # --- 5. Цвет: выравнивание тона и снятие красноты ---
    img = even_out_tone(img, skin_a, float(preset.get('color_even_strength', 0.5)))
    img = remove_red_cast(img, skin_a, float(preset.get('red_cast_strength', 0.5)))

    _tick('colour')

    # --- 6. Возврат микротекстуры ---
    # Внутри залеченных зон текстуру НЕ возвращаем — иначе точки акне
    # приедут обратно вместе с порами.
    texture_a = skin_a * (1.0 - _feather(defects, max(2.0, min(h, w) * 0.003)))
    img = micro_texture(img, orig, texture_a,
                        float(preset.get('micro_texture', 0.35)))

    _tick('texture')

    # --- 7. Финальный шарп ---
    sharp_amt = float(preset.get('sharpen_amount', 0.0))
    if sharp_amt > 0:
        sharpened = unsharp(img, sharp_amt, float(preset.get('sharpen_radius', 0.8)))
        # В залеченных зонах шарп не применяем: он вытащил бы обратно
        # контраст остаточных пятен.
        keep = _feather(defects, max(2.0, min(h, w) * 0.003))[:, :, None]
        img = sharpened * (1.0 - keep) + img * keep

    out_img = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), mode='RGB')
    # Освобождаем рабочие float32-массивы до работы с полным разрешением:
    # памяти у функции мало, а дальше создаются полноразмерные буферы.
    skin_a_small = skin_a.copy()
    del img, ret, orig, skin_a, texture_a, inner, heal_zone
    import gc
    gc.collect()

    _tick('sharpen')

    # --- 8. Возврат на полное разрешение ---
    # Апскейл результата размылил бы кадр. Поэтому переносим на оригинал
    # только РАЗНИЦУ (изменение тона и убранные дефекты), а вся резкость
    # глаз, волос и ресниц остаётся из исходного файла.
    if out_img.size != full_size:
        out_img = _transfer_to_full(
            full_img, orig_img, out_img, defects, skin_a_small,
            hf_damp=float(preset.get('full_hf_damp', 0.0)),
        )

    _tick('transfer')
    return _to_jpeg_bytes(out_img, int(preset.get('jpeg_quality', 95)))


def _transfer_to_full(full_img: Image.Image, work_orig: Image.Image,
                      work_result: Image.Image,
                      defects: np.ndarray, skin_alpha: np.ndarray,
                      hf_damp: float = 0.0) -> Image.Image:
    """Переносит результат ретуши с рабочего разрешения на полноразмерный кадр.

    Переносится разница (result - original), увеличенная до полного размера:
    резкость глаз, волос и ресниц остаётся из оригинала, а не из апскейла.
    Но внутри зон дефектов разницы мало — там прыщ вернулся бы обратно из
    высоких частот оригинала. Поэтому в этих зонах берём апскейл результата
    целиком (текстура прыща нам и не нужна).

    Args:
        full_img: оригинал в полном разрешении.
        work_orig: оригинал в рабочем разрешении.
        work_result: результат ретуши в рабочем разрешении.
        defects: uint8 маска дефектов в рабочем разрешении.

    Returns:
        PIL Image в полном разрешении.
    """
    size = full_img.size
    print(f"[BEAUTY] transfer to full: {work_result.size} -> {size}")

    # Вес смешивания: 1 = берём апскейл результата (дефекты и кожа),
    # 0 = оригинал + перенесённая разница (глаза, губы, волосы, фон).
    d_small = np.clip(defects.astype(np.float32) / 255.0, 0.0, 1.0)
    w_small = np.clip(np.maximum(d_small, skin_alpha * 0.75), 0.0, 1.0)
    w_img = Image.fromarray(
        (w_small * 255.0).astype(np.uint8), mode='L').resize(size, Image.BILINEAR)
    del d_small, w_small
    # Маска кожи на полном разрешении — для подавления мелких дефектов,
    # которых на рабочем разрешении просто не было видно.
    s_img = Image.fromarray(
        (np.clip(skin_alpha, 0.0, 1.0) * 255.0).astype(np.uint8), mode='L'
    ).resize(size, Image.BILINEAR) if hf_damp > 0 else None

    # Разница на рабочем разрешении, упакованная в uint8 (экономия памяти).
    diff_img = Image.fromarray(np.clip(
        np.asarray(work_result, dtype=np.int16)
        - np.asarray(work_orig, dtype=np.int16) + 128, 0, 255
    ).astype(np.uint8), mode='RGB').resize(size, Image.BICUBIC)
    healed_img = work_result.resize(size, Image.BICUBIC)

    # Обрабатываем полосами, чтобы не держать несколько float32-копий
    # полноразмерного кадра одновременно (лимит памяти функции).
    out = np.empty((size[1], size[0], 3), dtype=np.uint8)
    band = 512
    w_arr = np.asarray(w_img)
    s_arr = np.asarray(s_img) if s_img is not None else None
    # Радиус мелкой высокой частоты на ПОЛНОМ разрешении: точки акне и
    # рубчики-углубления живут именно здесь.
    hf_r = max(1.5, min(size) * 0.0018)
    # Перекрытие полос, чтобы блюр не дал швов на стыках.
    ov = int(hf_r * 4) + 2
    for y0 in range(0, size[1], band):
        y1 = min(y0 + band, size[1])
        base = np.asarray(full_img.crop((0, y0, size[0], y1)), dtype=np.float32)
        base += np.asarray(diff_img.crop((0, y0, size[0], y1)),
                           dtype=np.float32) - 128.0
        if s_arr is not None:
            # Считаем блюр на расширенной полосе, затем обрезаем обратно.
            ey0, ey1 = max(0, y0 - ov), min(size[1], y1 + ov)
            ext = np.asarray(full_img.crop((0, ey0, size[0], ey1)),
                             dtype=np.float32)
            ext += np.asarray(diff_img.crop((0, ey0, size[0], ey1)),
                              dtype=np.float32) - 128.0
            low = np.empty_like(ext)
            for c in range(3):
                low[:, :, c] = _blur_f(ext[:, :, c], hf_r)
            top = y0 - ey0
            low = low[top:top + (y1 - y0)]
            hf = base - low
            # Гасим только мелкоамплитудный рельеф (до ~7 ед.) — это точки,
            # рубчики и неровности; крупные перепады (нос, губы, контур)
            # остаются нетронутыми. И только внутри кожи.
            amp = np.abs(hf).mean(axis=2, keepdims=True)
            soft = np.clip(1.0 - amp / 7.0, 0.0, 1.0)
            sk = (s_arr[y0:y1].astype(np.float32) / 255.0)[:, :, None]
            base = low + hf * (1.0 - hf_damp * soft * sk)
            del ext, low, hf, amp, soft, sk
        healed = np.asarray(healed_img.crop((0, y0, size[0], y1)),
                            dtype=np.float32)
        wb = (w_arr[y0:y1].astype(np.float32) / 255.0)[:, :, None]
        out[y0:y1] = np.clip(base * (1.0 - wb) + healed * wb, 0, 255).astype(np.uint8)

    return Image.fromarray(out, mode='RGB')


def _to_jpeg_bytes(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=quality, subsampling=0, optimize=True)
    return buf.getvalue()


def _decode_mask(mask_b64: str, size) -> np.ndarray:
    """Декодирует base64 PNG-маску и приводит к размеру (w, h)."""
    import base64
    raw = base64.b64decode(mask_b64)
    m = Image.open(io.BytesIO(raw))
    # _mask_to_b64 отдаёт RGBA с белым RGB и маской в альфе.
    if m.mode in ('RGBA', 'LA'):
        m = m.split()[-1]
    else:
        m = m.convert('L')
    if m.size != size:
        m = m.resize(size, Image.LANCZOS)
    arr = np.asarray(m)
    return np.where(arr > 128, 255, 0).astype(np.uint8)