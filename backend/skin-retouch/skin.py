"""Маска кожи и композит генеративной ретуши через частотное разложение.

ПОЧЕМУ ИМЕННО ТАК.

Старая схема смешивала оригинал и картинку модели напрямую по альфе:
    out = orig * (1 - a) + gen * a
Генеративная модель (grok / qwen / seedream) не возвращает пиксель-в-пиксель
тот же кадр: лицо смещается на единицы пикселей, меняется масштаб и лёгкая
геометрия. Смешение двух несовмещённых картинок даёт ровно то, что было видно
на результате — ДВОЕНИЕ контуров (волосы, брови, воротник, край плеча) и
МЫЛО (две чуть разные текстуры, сложенные вместе, взаимно гасят детали).
Никакой настройкой силы это не лечится: дефект заложен в самой формуле.

Новая схема (frequency separation, как в профессиональной бьюти-ретуши):
  LOW  (тон, цвет, пятна, светотень)  — берём от модели и дополнительно
                                        выравниваем арифметически.
  MID  (рельеф прыща, пост-акне)      — гасим ТОЧЕЧНО по маске дефектов.
  HIGH (поры, волоски, ресницы, края) — всегда 100% из оригинала.

Итоговая формула:
    out = orig + delta_low - mid * defects

Оригинал никогда не заменяется — к нему лишь прибавляется ПЛАВНАЯ поправка
низких частот и вычитается рельеф дефектов. Отсюда:
  * двоения нет физически: все контуры остались оригинальными пикселями;
  * мыла нет: высокие частоты не трогаются вообще, резкость исходная;
  * акне уходит: краснота живёт в LOW, бугорок — в MID, и оба подавлены.

ТЁМНЫЕ УЧАСТКИ. Детекция дефектов идёт в ЛОГАРИФМИЧЕСКОМ пространстве:
отклонение считается как log(пиксель) - log(локальный фон), то есть в долях
от местной яркости, а не в абсолютных единицах. Прыщ на 20% темнее фона даёт
один и тот же отклик и на освещённой скуле, и в тени под челюстью. Раньше
пороги были аддитивными, и в тенях дефекты просто не дотягивали до порога —
поэтому ретушь там ничего не делала.
"""
import numpy as np
from PIL import Image, ImageFilter

# Маски кожи/защиты — плавные карты, считаются на мелкой копии.
MASK_SIDE = 512
# Детекция дефектов и низкие частоты — на средней копии.
# Размер выбран как компромисс: прыщ на 768 px ещё уверенно различим
# (это 4-10 px), а полнокадровые float32-буферы в лимит 256 МБ и 5 секунд
# уже не помещаются. Обе карты (дефекты и поправка тона) плавные, их
# апскейл на полный кадр ничего не мылит — резкость берётся из оригинала.
WORK_SIDE = 768


def _odd(n: int) -> int:
    """Размер ядра фильтра PIL должен быть нечётным."""
    n = max(3, int(n))
    return n if n % 2 else n + 1


def _to_arr(img: Image.Image) -> np.ndarray:
    return np.asarray(img, dtype=np.float32)


def _small(img: Image.Image, side: int = MASK_SIDE) -> Image.Image:
    """Уменьшенная копия (или оригинал, если он уже мелкий)."""
    if max(img.size) <= side:
        return img
    scaled = img.copy()
    scaled.thumbnail((side, side), Image.BILINEAR)
    return scaled


def _upscale_mask(mask: np.ndarray, size) -> np.ndarray:
    """Возвращает маску 0..1 к заданному размеру (w, h)."""
    h, w = mask.shape
    if (w, h) == size:
        return mask
    img = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), mode="L")
    img = img.resize(size, Image.BILINEAR)
    return np.asarray(img, dtype=np.float32) / 255.0


def _ycbcr(arr: np.ndarray):
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b
    cb = 128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b
    cr = 128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b
    return y, cb, cr


def _hsv(arr: np.ndarray):
    a = arr / 255.0
    mx = a.max(axis=-1)
    mn = a.min(axis=-1)
    diff = mx - mn
    s = np.where(mx > 1e-6, diff / np.maximum(mx, 1e-6), 0.0)
    return mx, s, diff


# ======================= ТОЧНЫЕ БЛЮРЫ ПО FLOAT =======================
# PIL не умеет размывать режим 'F', а упаковка в uint8 убивает точность
# логарифмических карт. Box-blur в три прохода ≈ гаусс, и он O(n).


def _box_blur_1d(arr: np.ndarray, radius: int, axis: int) -> np.ndarray:
    if radius < 1:
        return arr
    if radius <= 2:
        # На маленьком окне прямое суммирование сдвигов дешевле cumsum:
        # нет обхода всего массива с накоплением и потери точности на хвосте.
        pad = [(0, 0)] * arr.ndim
        pad[axis] = (radius, radius)
        ap = np.pad(arr, pad, mode="edge")
        n = arr.shape[axis]
        acc = None
        for off in range(2 * radius + 1):
            sl = [slice(None)] * arr.ndim
            sl[axis] = slice(off, off + n)
            part = ap[tuple(sl)]
            acc = part.astype(np.float32, copy=True) if acc is None else acc + part
        return acc * np.float32(1.0 / (2 * radius + 1))
    pad = radius + 1
    padw = [(0, 0)] * arr.ndim
    padw[axis] = (pad, pad)
    ap = np.pad(arr, padw, mode="edge")
    cs = np.cumsum(ap, axis=axis, dtype=np.float32)
    n = arr.shape[axis]
    win = 2 * radius + 1
    lo = pad - radius
    # Срезы вместо fancy-индексации и без swapaxes: тот же результат,
    # но без лишних транспонирований и таблиц смещений.
    hi_sl = [slice(None)] * arr.ndim
    hi_sl[axis] = slice(lo + win - 1, lo + win - 1 + n)
    lo_sl = [slice(None)] * arr.ndim
    lo_sl[axis] = slice(lo - 1, lo - 1 + n)
    return (cs[tuple(hi_sl)] - cs[tuple(lo_sl)]) * np.float32(1.0 / win)


def _downsample(a: np.ndarray, k: int) -> np.ndarray:
    """Усреднение блоками kxk (аналог area-resize, но без PIL и без uint8)."""
    h, w = a.shape[:2]
    ph, pw = (-h) % k, (-w) % k
    if ph or pw:
        a = np.pad(a, [(0, ph), (0, pw)] + [(0, 0)] * (a.ndim - 2), mode="edge")
    hh, ww = a.shape[0] // k, a.shape[1] // k
    if a.ndim == 2:
        return a.reshape(hh, k, ww, k).mean(axis=(1, 3), dtype=np.float32)
    return a.reshape(hh, k, ww, k, a.shape[2]).mean(axis=(1, 3), dtype=np.float32)


def _blur_f(arr: np.ndarray, radius: float) -> np.ndarray:
    """Гаусс-подобное размытие float32 массива (2D или 3D).

    Для больших радиусов считаем на уменьшенной копии: размытие радиусом
    в десятки пикселей по определению не содержит мелких деталей, поэтому
    результат тот же, а работы в k² раз меньше. Именно эти широкие блюры
    (healing, опорный тон, карта доверия) съедали основное время функции
    и приводили к 504 по таймауту.
    """
    a = arr.astype(np.float32)
    if radius <= 0:
        return a
    k = int(radius // 3)
    if k >= 2 and min(a.shape[0], a.shape[1]) // k >= 16:
        small = _downsample(a, k)
        box_s = max(1, int(round(float(radius) / k / 2.0 * 1.5)))
        for _ in range(3):
            small = _box_blur_1d(small, box_s, axis=0)
            small = _box_blur_1d(small, box_s, axis=1)
        up = np.repeat(np.repeat(small, k, axis=0), k, axis=1)[:a.shape[0], :a.shape[1]]
        # Сглаживаем ступеньки апскейла — он идёт блоками kxk.
        smooth = max(1, k // 2)
        up = _box_blur_1d(up, smooth, axis=0)
        up = _box_blur_1d(up, smooth, axis=1)
        return up
    box_r = max(1, int(round(float(radius) / 2.0 * 1.5)))
    for _ in range(3):
        a = _box_blur_1d(a, box_r, axis=0)
        a = _box_blur_1d(a, box_r, axis=1)
    return a


def _norm_blur(arr: np.ndarray, weight: np.ndarray, radius: float) -> np.ndarray:
    """Нормализованная свёртка: усреднение ТОЛЬКО по валидным пикселям.

    Нужна, чтобы локальный тон кожи не затягивал в себя волосы, одежду и фон.
    Без неё у края лица поправка уезжает по цвету и появляется ореол — ещё
    одна причина «двоения» в старой версии.
    """
    w = np.maximum(_blur_f(weight, radius), 1e-3)
    if arr.ndim == 2:
        return _blur_f(arr * weight, radius) / w
    out = np.empty_like(arr, dtype=np.float32)
    wf = weight[..., None] if weight.ndim == 2 else weight
    num = _blur_f(arr * wf, radius)
    for c in range(arr.shape[2]):
        out[..., c] = num[..., c] / w
    return out


def _blur_arr(arr: np.ndarray, radius: float) -> np.ndarray:
    """Размытие RGB через PIL — быстро, когда точность не критична."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius=radius)),
                      dtype=np.float32)


def _ramp(x: np.ndarray, t0: float, t1: float) -> np.ndarray:
    """Мягкий порог 0..1 (без жёстких краёв, иначе видны заплатки)."""
    return np.clip((x - t0) / max(t1 - t0, 1e-6), 0.0, 1.0)


def _window_sum(mask: np.ndarray, k: int) -> np.ndarray:
    """Сумма бинарной маски в окне kxk через интегральное изображение."""
    r = k // 2
    a = np.pad(mask.astype(np.float32), ((r, r), (r, r)), mode="edge")
    cs = np.cumsum(np.cumsum(a, axis=0, dtype=np.float32), axis=1, dtype=np.float32)
    cs = np.pad(cs, ((1, 0), (1, 0)), mode="constant")
    h, w = mask.shape
    return cs[k:k + h, k:k + w] - cs[0:h, k:k + w] - cs[k:k + h, 0:w] + cs[0:h, 0:w]


def _erode(mask: np.ndarray, k: int) -> np.ndarray:
    """Эрозия бинарной маски квадратом kxk.

    Полный аналог ImageFilter.MinFilter для маски из нулей и единиц, но
    время не зависит от размера ядра: PIL перебирает k² пикселей на каждую
    точку, и на ядре 13 это десятки миллисекунд — заметная часть лимита
    времени функции.
    """
    return (_window_sum(mask, k) > k * k - 0.5).astype(np.float32)


def _dilate(mask: np.ndarray, k: int) -> np.ndarray:
    """Дилатация бинарной маски квадратом kxk (аналог MaxFilter)."""
    return (_window_sum(mask, k) > 0.5).astype(np.float32)


# ============================ МАСКИ ============================


def regions_mask(size, regions) -> np.ndarray:
    """Маска 0..1 по боксам с людьми (координаты — доли от кадра)."""
    w, h = size
    m = np.zeros((h, w), dtype=np.float32)
    for x0, y0, x1, y1 in regions:
        px, py = (x1 - x0) * 0.06, (y1 - y0) * 0.06
        a = max(0, int((x0 - px) * w))
        b = max(0, int((y0 - py) * h))
        c = min(w, int((x1 + px) * w))
        d = min(h, int((y1 + py) * h))
        if c > a and d > b:
            m[b:d, a:c] = 1.0
    if m.max() == 0:
        return np.ones((h, w), dtype=np.float32)
    img = Image.fromarray((m * 255).astype(np.uint8), mode="L")
    img = img.filter(ImageFilter.GaussianBlur(radius=max(4, min(w, h) // 150)))
    return np.asarray(img, dtype=np.float32) / 255.0


def skin_mask_small(img: Image.Image) -> np.ndarray:
    """Сплошная маска кожи 0..1 в уменьшенном разрешении.

    Маска строится в два шага, и это принципиально. Одно фиксированное
    цветовое правило всегда ошибается в одну из сторон: широкое — забирает
    русые волосы, кремовую толстовку и тёплый фон (и тогда ретушь мылит
    ровно эти зоны), узкое — теряет кожу в полутени вместе с дефектами.

      1. ЯДРО — заведомо кожа: типичная цветность, средняя яркость. По нему
         считаются МЕДИАНЫ конкретного кадра.
      2. РОСТ — принимаем всё, что близко к медианам ЭТОГО человека при
         этом освещении. Волосы и ткань отсекаются тем, что их цветность
         отличается от медианной кожи, даже если формально «телесная».

    Прыщи, покраснения и блики обязаны попасть ВНУТРЬ маски — иначе ретушь
    обойдёт именно то, ради чего запускалась. За это отвечает closing.
    """
    arr = _to_arr(img)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    # --- 1. Ядро: узкое правило, только уверенная кожа ---
    core = (
        (cr >= 137) & (cr <= 180) &
        (cb >= 80) & (cb <= 130) &
        (y >= 60) & (y <= 235) &
        (r > b + 12) & (r > g + 4) &
        (s > 0.12) & (s < 0.55)
    )
    if int(np.count_nonzero(core)) < 200:
        core = (cr >= 133) & (cr <= 190) & (cb >= 75) & (cb <= 135) & (r > b)
    if int(np.count_nonzero(core)) < 50:
        return np.zeros(arr.shape[:2], dtype=np.float32)

    # --- 2. Медианы кадра и рост от ядра ---
    cr_m = float(np.median(cr[core]))
    cb_m = float(np.median(cb[core]))
    s_m = float(np.median(s[core]))
    y_m = float(np.median(y[core]))

    skin = (
        (np.abs(cr - cr_m) < 20.0) &
        (np.abs(cb - cb_m) < 17.0) &
        (r > b + 4) &
        # Яркость гуляет широко: тень под челюстью и блик на лбу — та же
        # кожа. Ограничиваем только совсем провалы (волосы, фон).
        (y > max(14.0, y_m * 0.28))
    )
    # Ткань и бумага бледнее кожи по насыщенности. Верхнюю границу держим
    # щедрой: воспалённое акне насыщеннее здоровой кожи, и узкий порог
    # выбрасывал из маски ровно те пятна, которые надо убрать.
    skin &= (s > s_m * 0.55) & (s < s_m * 2.6 + 0.12)
    # Тёмное И насыщенное — это волосы, брови, тень от них.
    skin &= ~((y < y_m * 0.60) & (s > s_m * 1.20))

    mask = skin.astype(np.float32)

    # --- 3. Волосы и ткань: отсев по текстуре ---
    # Цвет русых волос и кремовой толстовки почти совпадает с кожей, и
    # цветовое правило их не разделит. Зато отличается структура: пряди и
    # складки дают плотную россыпь мелких перепадов.
    #
    # Отсев применяется ОТДЕЛЬНОЙ маской «точно не кожа», а не умножением
    # на общую. Это принципиально: россыпь акне тоже шероховата, и прямое
    # умножение выбрасывало из маски именно проблемную щёку — ретушь её
    # не трогала вовсе. Поэтому в «не кожу» пиксель попадает, только если
    # он шероховатый И его цветность заметно отличается от медианы кожи.
    detail = np.abs(y - _blur_f(y, 1.6))
    rough = _blur_f(detail, max(2.0, min(img.size) / 70.0))
    not_skin = np.zeros_like(mask)
    if int(np.count_nonzero(core)) > 200:
        rough_skin = float(np.percentile(rough[core], 85))
        far_color = np.maximum(_ramp(np.abs(cr - cr_m), 9.0, 17.0),
                               _ramp(np.abs(cb - cb_m), 8.0, 15.0))
        not_skin = _ramp(rough, rough_skin * 2.2 + 1.0, rough_skin * 4.5 + 3.5) * far_color
        del far_color
    mask = np.clip(mask - (not_skin > 0.45).astype(np.float32), 0.0, 1.0)

    # --- 4. Морфология ---
    # Opening ПЕРВЫМ: снимаем мелкие «острова» на фоне, волосах и одежде,
    # пока closing их не раздул до сплошных пятен.
    open_k = _odd(max(3, min(img.size) // 110))
    mask = _dilate(_erode(mask, open_k), open_k)
    close = _odd(max(5, min(img.size) // 45))
    mask = _erode(_dilate(mask, close), close)

    # --- 5. Заполнение дыр ---
    # Самое важное для акне. Очаг воспаления на щеке по цвету из маски
    # выпадает — он краснее и темнее здоровой кожи. Closing такую дыру
    # не закрывает: она размером с полщеки, а ядро закрытия физически
    # не может быть таким большим, не перепрыгнув на волосы.
    # Заливка решает это точно: всё, что ОКРУЖЕНО кожей со всех сторон,
    # объявляется кожей независимо от своего цвета. Именно так в маску
    # попадают прыщи, родинки, блики и тени — то есть цели ретуши.
    mask = _fill_holes(mask)

    # --- 6. Финальная доводка края ---
    # Эрозия на полшага внутрь: край маски не должен залезать на волосы
    # и воротник, иначе там появится ореол.
    mask = _erode(mask, _odd(max(3, min(img.size) // 100)))
    m = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    m = m.filter(ImageFilter.GaussianBlur(radius=max(2, min(img.size) // 200)))
    mask = np.clip(np.asarray(m, dtype=np.float32) / 255.0, 0.0, 1.0)

    # Заливка могла втянуть волосы, зажатые между лбом и виском —
    # возвращаем уверенно «не кожу» обратно в ноль.
    if not_skin.max() > 0:
        mask *= 1.0 - _blur_f(np.clip(not_skin, 0.0, 1.0),
                              max(1.0, min(img.size) / 220.0))
    return np.clip(mask, 0.0, 1.0)


def _fill_holes(mask: np.ndarray) -> np.ndarray:
    """Заполняет дыры внутри маски: всё, что не связано с краем кадра.

    Реализация без scipy: заливка фона от рамки изображения. То, что
    осталось не залитым и при этом не является маской, — это и есть
    внутренняя дыра (прыщ, родинка, блик, тень от носа).

    Args:
        mask: float32 HxW, 0 или 1.

    Returns:
        float32 HxW, 0 или 1.
    """
    h, w = mask.shape
    bg = (mask < 0.5)
    if not bg.any():
        return mask

    # Итеративная дилатация метки от рамки внутрь фона. Маска мелкая
    # (≤512 px), поэтому десятка проходов box-blur хватает с запасом.
    reach = np.zeros((h, w), dtype=np.float32)
    reach[0, :] = reach[-1, :] = 1.0
    reach[:, 0] = reach[:, -1] = 1.0
    reach *= bg
    for _ in range(14):
        grown = _blur_f(reach, 3.0)
        new = np.where((grown > 0.02) & bg, 1.0, reach)
        if float(np.abs(new - reach).sum()) < 1.0:
            reach = new
            break
        reach = new

    # Фон, до которого заливка не добралась = дыра внутри кожи.
    holes = bg & (reach < 0.5)
    return np.clip(mask + holes.astype(np.float32), 0.0, 1.0)


def protect_mask_small(img: Image.Image) -> np.ndarray:
    """Защита: глаза, брови, губы, зубы, ноздри. Намеренно узкая —
    широкая защита «съедала» прыщи и мешала их убрать."""
    arr = _to_arr(img)
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    skin_like = (cr > 128) & (cr < 200) & (y > 40)
    if skin_like.any():
        cr_med = float(np.median(cr[skin_like]))
        y_med = float(np.median(y[skin_like]))
    else:
        cr_med, y_med = 140.0, 130.0

    dark = (y < min(62.0, y_med * 0.42)).astype(np.float32)
    # Губы: краснее И ЗАМЕТНО темнее кожи. Пороги намеренно жёсткие —
    # на мягких порогах под «губы» попадал очаг акне на щеке (он тоже
    # красный и слегка тёмный), защищался целиком, и ретушь его не
    # трогала. Ради этого же убран второй вариант «просто очень красное».
    red = (
        (cr > cr_med + 16) & (y < y_med - 26) & (s > 0.34)
    ).astype(np.float32)
    bright = ((v > 0.96) & (s < 0.08)).astype(np.float32)

    protect = np.clip(dark + red + bright, 0.0, 1.0)

    # Открытие: мелкие красные точки (прыщи) из защиты выпадают, крупные
    # зоны — губы, глаза, брови — остаются. Ядро крупное: россыпь акне
    # занимает площадь, сравнимую с губами, и мелкое ядро её сохраняло.
    open_k = _odd(max(5, min(img.size) // 26))
    protect = _dilate(_erode(protect, open_k), open_k)
    protect = _dilate(protect, _odd(max(3, min(img.size) // 200)))
    p = Image.fromarray((protect * 255).astype(np.uint8), mode="L")
    p = p.filter(ImageFilter.GaussianBlur(radius=max(2, min(img.size) // 400)))
    return np.clip(np.asarray(p, dtype=np.float32) / 255.0, 0.0, 1.0)


def build_skin_mask(img: Image.Image) -> np.ndarray:
    return _upscale_mask(skin_mask_small(_small(img)), img.size)


def build_protect_mask(img: Image.Image) -> np.ndarray:
    return _upscale_mask(protect_mask_small(_small(img)), img.size)


def mask_preview(img: Image.Image, regions=None) -> Image.Image:
    """Отладка: показывает, что именно считается кожей."""
    mask = build_skin_mask(img) * (1.0 - build_protect_mask(img))
    if regions:
        mask = mask * regions_mask(img.size, regions)
    return Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), mode="L")


# ====================== ДЕТЕКЦИЯ ДЕФЕКТОВ ======================


def detect_defects(arr: np.ndarray, skin: np.ndarray,
                   sensitivity: float = 0.6) -> np.ndarray:
    """Карта дефектов кожи 0..1 в ЛОГАРИФМИЧЕСКОМ (относительном) контрасте.

    Ключевой момент — почему работает и в тенях. Отклонение считается как
    log(пиксель) - log(локальный фон кожи). Это отношение, а не разность:
    пятно, которое на 18% темнее окружающей кожи, даёт отклик 0.18 и на
    залитом светом лбу, и в глубокой тени под челюстью. Абсолютные пороги
    (как было раньше) в тени срабатывать переставали.

    Ловим три типа дефектов:
      * тёмные   — пост-акне, точки, комедоны, рубцы;
      * красные  — воспалённое акне, раздражение, розацеа;
      * светлые  — белые головки, точечный жирный блеск.

    Args:
        arr: float32 HxWx3 0..255 (рабочее разрешение).
        skin: float32 HxW 0..1 — где искать.
        sensitivity: 0..1, выше = агрессивнее.

    Returns:
        float32 HxW 0..1.
    """
    h, w = arr.shape[:2]
    sens = float(np.clip(sensitivity, 0.0, 1.0))
    valid = np.clip(skin, 0.0, 1.0).astype(np.float32)
    if float(valid.sum()) < 50:
        return np.zeros((h, w), dtype=np.float32)

    eps = 6.0  # гасит шум логарифма в самых тёмных пикселях
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y = 0.299 * r + 0.587 * g + 0.114 * b

    lum = np.log(np.maximum(y, 0.0) + eps)
    # Относительная краснота: тоже логарифм отношения, поэтому не зависит
    # от того, насколько ярко освещён участок.
    red = np.log(np.maximum(r, 0.0) + eps) - np.log(np.maximum(g + b, 0.0) * 0.5 + eps)

    # Мелкое сглаживание — убирает шум матрицы и JPEG-артефакты,
    # но сохраняет прыщ (он крупнее пары пикселей).
    fine_r = max(1.0, min(h, w) * 0.0018)
    lum_s = _blur_f(lum, fine_r)
    red_s = _blur_f(red, fine_r)

    # --- Полосовой фильтр (DoG) вместо простого «темнее фона» ---
    # Это ключевая деталь. Разность с одним фоном срабатывает на ЛЮБОМ
    # тёмном участке — глазницу, бровь, тень от носа и волосы она честно
    # считает «дефектом», и именно поэтому лицо раньше плыло.
    # Прыщ же — локальный пик ОПРЕДЕЛЁННОГО размера. Разность двух блюров
    # (мелкого и крупного) пропускает только эту полосу масштабов: всё
    # крупнее (светотень, глазница) и всё мельче (шум, поры) обнуляется.
    #
    # Берём два масштаба, чтобы ловить и точку пост-акне, и крупный очаг.
    def dog(src, s1, s2):
        return _blur_f(src, s1) - _blur_f(src, s2)

    sm = max(1.2, min(h, w) * 0.0025)   # мелкие точки, комедоны
    md = max(2.5, min(h, w) * 0.0060)   # крупные прыщи
    # dog(-x) == -dog(x), поэтому тёмный и светлый отклики считаются из
    # одних и тех же блюров — это вдвое меньше работы на самом дорогом шаге.
    lum_sm = dog(lum_s, sm, sm * 3.5)
    lum_md = dog(lum_s, md, md * 3.5)
    dark = np.maximum(-lum_sm, -lum_md)
    del lum_md
    redx = np.maximum(dog(red_s, sm, sm * 3.5), dog(red_s, md, md * 3.5))
    # Светлые дефекты (белые головки) — только на мелком масштабе: на
    # крупном туда попадает блик на носу и скуле, то есть нормальный объём.
    light = lum_sm

    # --- Плоские красные пятна ---
    # DoG ловит выпуклые «пики» нужного размера, но зажившее пост-акне и
    # сплошное воспаление на щеке — это широкое ПЛОСКОЕ пятно. На масштабе
    # прыща оно почти не даёт отклика, и именно поэтому такая щека раньше
    # оставалась нетронутой. Сравниваем красноту с тоном кожи ВСЕГО лица.
    red_bg = _norm_blur(red_s, valid, max(12.0, min(h, w) * 0.09))
    flat_red = red_s - red_bg

    # Объединяем каналы. Краснота весит больше всего: она отличает
    # воспаление от тени и от контура века лучше любого яркостного признака.
    resp = np.maximum(np.maximum(dark, redx * 1.8), light * 0.6)
    resp = np.maximum(resp, flat_red * 1.4)
    del red_bg, flat_red

    # --- Подавление КРАЁВ ---
    # DoG сам по себе охотно отзывается на границы: контур века, крыло носа,
    # линия губ, край брови. Именно это и было видно — правка садилась на
    # черты лица, а не на акне.
    # Отличие геометрическое: прыщ — замкнутое пятно, внутри него градиент
    # близок к нулю, сильные перепады только по кольцу вокруг. У контура же
    # градиент велик В САМОЙ точке отклика. Гасим по локальному градиенту.
    gy, gx = np.gradient(lum_s)
    grad = _blur_f(np.sqrt(gx * gx + gy * gy), max(1.0, sm))
    del gx, gy
    resp *= 1.0 - _ramp(grad, 0.045, 0.110)

    # Волосяные структуры: ресница, бровь, волосок дают перепад заметно
    # резче и контрастнее любого дефекта кожи.
    struct = np.abs(lum_s - _blur_f(lum_s, fine_r * 3.0))
    resp *= 1.0 - _ramp(struct, 0.16, 0.32)
    resp *= valid

    # --- Порог по БЮДЖЕТУ ПЛОЩАДИ ---
    # Фиксированный порог всегда подводит: на проблемной коже он ловит
    # слишком мало, на чистой — выдумывает дефекты из шума и светотени.
    # Поэтому берём фиксированную долю самых сильных откликов внутри кожи.
    # Площадь правки предсказуема по определению, и лицо не может «поплыть»
    # целиком, сколько бы ни ошиблась маска.
    sel = valid > 0.5
    budget = 3.0 + 17.0 * sens     # 3% площади кожи на «Лёгкой», 20% на «Сильной»
    if int(np.count_nonzero(sel)) > 500:
        thr = float(np.percentile(resp[sel], 100.0 - budget))
        # Абсолютный минимум: на чистой коже дефекты не выдумываем.
        thr = max(thr, 0.020)
    else:
        thr = 0.030
    defects = _ramp(resp, thr, thr * 1.9 + 0.012) * valid

    # Расширяем каждый очаг: у прыща есть ореол, и если оставить только
    # ядро, вокруг останется кольцо — это читается как грязь.
    grow = max(1.0, min(h, w) * 0.0035)
    defects = np.clip(_blur_f(defects, grow) * 2.2, 0.0, 1.0) * valid
    return defects.astype(np.float32)


# ====================== НИЗКИЕ ЧАСТОТЫ ======================


def _tone_layer(orig_s: np.ndarray, gen_s: np.ndarray, alpha_s: np.ndarray,
                skin_s: np.ndarray, defects: np.ndarray, even_out: float,
                highlights: float) -> np.ndarray:
    """Считает поправку НИЗКИХ частот (тон и цвет) на рабочем разрешении.

    ГЛАВНЫЙ ПРИНЦИП: тон правится ТОЛЬКО там, где найден дефект.

    Предыдущая версия выравнивала тон по всей коже сразу — и именно это
    делало лицо плоским и белёсым: вместе с пятнами уходила светотень,
    скулы и объём. Здесь вместо «выравнивания всего» работает healing:
    внутри пятна цвет берётся интерполяцией окружающей ЧИСТОЙ кожи
    (нормализованная свёртка, аналог Spot Healing Brush в Photoshop).
    Чистые участки не трогаются вообще, поэтому объём лица сохраняется
    полностью, а исчезают ровно дефекты.

    Healing идёт в НЕСКОЛЬКО МАСШТАБОВ, от крупного к мелкому: первый
    проход вытягивает общий тон на месте крупного воспаления, следующие
    подгоняют переход к краю. Один проход оставлял бы вокруг залеченного
    пятна заметное кольцо.

    Args:
        orig_s: оригинал в рабочем разрешении, float32 0..255.
        gen_s: результат модели там же.
        alpha_s: 0..1 — где разрешено брать тон модели.
        skin_s: 0..1 маска кожи.
        defects: 0..1 карта дефектов.
        even_out: 0..1 сила арифметического healing.
        highlights: 0..1 сила сжатия пересвета.

    Returns:
        float32 HxWx3 — дельта, которую надо прибавить к оригиналу.
    """
    h, w = orig_s.shape[:2]
    # Разделение low/high: пятно и краснота целиком попадают в low.
    split_r = max(2.0, min(h, w) * 0.020)

    low_o = _blur_f(orig_s, split_r)

    # 1. Тон от модели — только в низких частотах и только на коже.
    low = low_o + (_blur_f(gen_s, split_r) - low_o) * alpha_s[..., None]

    valid_skin = np.clip(skin_s, 0.0, 1.0).astype(np.float32)

    # 2. Healing: дефекты заливаются цветом окружающей чистой кожи.
    ev = float(np.clip(even_out, 0.0, 1.0))
    if ev > 0.01:
        d = np.clip(defects, 0.0, 1.0)
        # Донор — кожа за вычетом дефектов. Брать пиксели из самого прыща
        # нельзя: тогда он «залечится» сам в себя и останется на месте.
        donor = np.clip(valid_skin - d, 0.0, 1.0)
        base_r = max(5.0, min(h, w) * 0.045)
        for i in range(3):
            radius = base_r / (1.8 ** i)
            filled = _norm_blur(low, donor, radius)
            # Уверенность: там, где чистой кожи рядом почти нет, результату
            # доверять нельзя — иначе на краю маски вылезут серые кляксы.
            conf = _ramp(_blur_f(donor, radius), 0.10, 0.25)
            a = (d * conf * ev)[..., None]
            low = low * (1.0 - a) + filled * a
            del filled, conf, a
        del donor, d

    # 3. Пересвет: жирный блеск на лбу и носу подтягиваем к тону кожи.
    #    Делаем это в low, поэтому текстура под бликом остаётся живой.
    hl = float(np.clip(highlights, 0.0, 1.0))
    if hl > 0.01:
        # Опорный тон берём по широкому радиусу — блик должен сравниваться
        # с кожей вокруг, а не сам с собой.
        base = _norm_blur(low, valid_skin, max(10.0, min(h, w) * 0.10))
        y_low = low.mean(axis=-1)
        y_base = np.maximum(base.mean(axis=-1), 1.0)
        # Порог высокий: обычная светотень (до +22%) остаётся нетронутой,
        # гасится только выбитый в белое блеск.
        over = _ramp(y_low / y_base - 1.0, 0.22, 0.55) * valid_skin
        low = low + (base - low) * (over * hl * 0.6)[..., None]
        del base, y_low, y_base, over

    return low - low_o


# ====================== ГЛАВНЫЙ КОМПОЗИТ ======================


def blend_skin(original: Image.Image, generated: Image.Image,
               strength: float = 0.9, keep_texture: float = 0.9,
               regions=None, trust_threshold: float = 60.0,
               highlight_recovery: float = 0.6,
               even_out: float = 0.7) -> Image.Image:
    """Собирает финал по схеме частотного разложения.

        out = orig + delta_low - mid * defects * supp

    Оригинал не заменяется ни в одном пикселе — к нему прибавляется плавная
    поправка тона и вычитается рельеф дефектов. Поэтому контуры, ресницы,
    волосы и края одежды остаются ровно такими, какими были: ни двоения,
    ни потери резкости.

    Args:
        original: исходный кадр.
        generated: результат генеративной модели (нужны только его тона).
        strength: 0..1 — насколько доверяем тону модели.
        keep_texture: 0..1 — сколько текстуры кожи сохранить (1 = вся).
        regions: боксы с людьми, вне них ретушь не применяется.
        trust_threshold: порог структурного расхождения с моделью.
        highlight_recovery: 0..1 — сила восстановления пересвета.
        even_out: 0..1 — сила арифметического выравнивания тона.
    """
    strength = float(np.clip(strength, 0.0, 1.0))
    keep_texture = float(np.clip(keep_texture, 0.0, 1.0))

    # --- 1. Маски на мелкой копии ---
    mask_img = _small(original, MASK_SIDE)
    mask_s = np.clip(
        skin_mask_small(mask_img) * (1.0 - protect_mask_small(mask_img)), 0.0, 1.0)
    if regions:
        mask_s *= regions_mask(mask_img.size, regions)

    # --- 2. Рабочее разрешение: тон, дефекты ---
    work = _small(original, WORK_SIDE)
    work_size = work.size
    orig_s = _to_arr(work)
    # Картинка модели приходит своего размера. Приводим её сразу к рабочему
    # разрешению: work_size имеет пропорции оригинала, поэтому геометрия
    # нормализуется тем же самым образом, что и раньше, но за один ресайз.
    # REDUCING_GAP включает предварительное усреднение — без него при сильном
    # уменьшении появляется алиасинг на коже.
    gen_s = _to_arr(generated.resize(work_size, Image.BILINEAR, reducing_gap=2.0))
    skin_s = _upscale_mask(mask_s, work_size)
    del mask_s, mask_img

    # Структурная страховка: считаем расхождение по СИЛЬНО размытым кадрам,
    # чтобы видеть сдвиг черт, но не видеть локальных дефектов. Если модель
    # перерисовала человека — доверие падает и берём меньше её тона.
    blur_r = max(6.0, min(work_size) / 60.0)
    diff = np.abs(_blur_f(gen_s, blur_r) - _blur_f(orig_s, blur_r)).mean(axis=-1)
    trust = np.clip(1.0 - (diff - float(trust_threshold)) / 30.0, 0.0, 1.0)
    trust = _blur_f(trust, blur_r)
    del diff

    alpha_s = np.clip(skin_s * trust * strength, 0.0, 1.0)
    del trust

    # Карта дефектов — общая и для healing тона, и для срезания рельефа.
    # Чувствительность растёт вместе с силой пресета.
    defects = detect_defects(orig_s, skin_s, sensitivity=0.30 + 0.65 * strength)

    delta_s = _tone_layer(orig_s, gen_s, alpha_s, skin_s, defects,
                          even_out=even_out, highlights=highlight_recovery)
    del gen_s

    # Подавление рельефа: бугорок прыща живёт в средних частотах, и одного
    # выравнивания цвета мало — без этого шага пятно уходит, а «шишка»
    # остаётся видна на косом свете.
    supp = np.clip(defects * (0.55 + 0.45 * strength), 0.0, 1.0)
    # Общее приглаживание кожи вне дефектов — ровно настолько, насколько
    # разрешает keep_texture (при 1.0 его нет вовсе, и это норма).
    supp = np.clip(supp + skin_s * (1.0 - keep_texture) * 0.35, 0.0, 1.0)
    del defects, orig_s, alpha_s, skin_s

    # --- 3. Упаковка карт в изображения: полнокадровых float32 не держим ---
    # Дельта тона: диапазон ±96 с запасом покрывает любую реальную поправку.
    delta_img = Image.fromarray(
        np.clip(delta_s * (127.0 / 96.0) + 128.0, 0, 255).astype(np.uint8)
    ).resize(original.size, Image.BICUBIC)
    supp_img = Image.fromarray(
        (np.clip(supp, 0, 1) * 255).astype(np.uint8), mode="L"
    ).resize(original.size, Image.BILINEAR)
    # Низкие частоты полного кадра = апскейл размытой рабочей копии. Это
    # корректно ровно потому, что они низкие: апскейл их не искажает,
    # а честный блюр радиусом в десятки пикселей стоил бы секунд.
    low_full_img = Image.fromarray(
        np.clip(_blur_f(_to_arr(work), max(2.0, min(work_size) * 0.022)),
                0, 255).astype(np.uint8)
    ).resize(original.size, Image.BICUBIC)
    del delta_s, supp, work

    # --- 4. Сборка полосами: пик памяти — десятки мегабайт, не сотни ---
    width, height = original.size
    fine_r = max(1.0, min(original.size) / 700.0)
    band = max(64, int(700_000 / max(width, 1)))
    overlap = int(fine_r * 4) + 4
    out_img = Image.new("RGB", original.size)

    for top in range(0, height, band):
        bottom = min(height, top + band)
        src_top = max(0, top - overlap)
        src_bottom = min(height, bottom + overlap)
        box = (0, src_top, width, src_bottom)

        arr = np.asarray(original.crop(box), dtype=np.float32)
        delta = (np.asarray(delta_img.crop(box), dtype=np.float32) - 128.0) * (96.0 / 127.0)
        low = np.asarray(low_full_img.crop(box), dtype=np.float32)
        s = np.asarray(supp_img.crop(box), dtype=np.float32)[..., None] / 255.0

        # MID = рельеф дефектов: всё между порами и тоном.
        # HIGH (arr - blur(arr, fine_r)) не участвует вообще — поры,
        # волоски и края остаются нетронутыми, поэтому мыла нет.
        mid = _blur_arr(arr, fine_r) - low
        out = arr + delta - mid * s
        del arr, delta, low, s, mid

        chunk = np.clip(out, 0, 255).astype(np.uint8)
        inner = chunk[top - src_top: top - src_top + (bottom - top)]
        out_img.paste(Image.fromarray(inner), (0, top))
        del out, chunk, inner

    delta_img.close()
    supp_img.close()
    low_full_img.close()
    return out_img