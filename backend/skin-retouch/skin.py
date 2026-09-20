"""Маска кожи и композит генеративной ретуши через частотное разложение.

ПОЧЕМУ ИМЕННО ТАК.

Смешивать оригинал и картинку модели напрямую по альфе нельзя:
    out = orig * (1 - a) + gen * a
Генеративная модель (grok / qwen / seedream) не возвращает пиксель-в-пиксель
тот же кадр: лицо смещается на единицы пикселей, меняется масштаб и лёгкая
геометрия. Смешение двух несовмещённых картинок даёт ДВОЕНИЕ контуров
(волосы, брови, воротник, край плеча) и МЫЛО (две чуть разные текстуры,
сложенные вместе, взаимно гасят детали). Настройкой силы это не лечится:
дефект заложен в самой формуле.

Рабочая схема (frequency separation, как в профессиональной бьюти-ретуши):
  НИЗКИЕ частоты (тон, цвет, краснота, пятно) — берутся от модели;
  ВЫСОКИЕ (поры, волоски, ресницы, кромки)   — всегда 100% из оригинала.

Итоговая формула:
    out = orig + (blur(gen) - blur(orig)) * mask * strength

Оригинал никогда не заменяется — к нему лишь прибавляется ПЛАВНАЯ поправка
низких частот внутри маски кожи. Отсюда:
  * двоения нет физически: все контуры остались оригинальными пикселями;
  * мыла нет: высокие частоты не трогаются вообще, резкость исходная;
  * акне уходит: модель уже убрала его в тех частотах, которые мы берём.

ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ. Раньше модуль пытался сам находить дефекты,
«залечивать» их средним тоном соседней кожи и вычитать рельеф прыща.
Каждый из этих шагов ошибался: детектор принимал за дефект контур брови и
границу волос, healing заливал тёмное воспаление светлым тоном, а вычитание
рельефа выворачивало прыщ в яркое пятно. На лице появлялись белёсые кляксы,
заметные сильнее исходных высыпаний. Всю эту работу модель делает лучше —
её результат и берётся, ограниченный областью кожи.

МАСКА решает две задачи: не пускает ретушь на волосы, одежду и фон и
защищает черты лица (глаза, брови, ресницы, губы). Все пороги в ней
ОТНОСИТЕЛЬНЫЕ — считаются от медианы кожи конкретного кадра, а не в
абсолютных единицах яркости. Абсолютные пороги работали только при одной
экспозиции: на светлом лице бровь не дотягивала до «тёмного», и защита
молча отключалась.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Маски кожи/защиты — плавные карты, считаются на мелкой копии.
MASK_SIDE = 512


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
    #
    # Нижняя граница 0.55 от медианы была слишком строгой: на освещённой
    # части лица кожа выцветает к бликам и падает по насыщенности вдвое
    # против медианы. Половина лица выпадала из маски, и на границе между
    # обработанной и нетронутой зоной появлялся резкий шов.
    skin &= (s > s_m * 0.40) & (s < s_m * 2.6 + 0.12)
    # Тёмное И насыщенное — это волосы, брови, тень от них. Пороги здесь
    # идут в паре с нижней границей насыщенности: раз кожа теперь
    # принимается более бледная, отсев волос должен быть строже по
    # яркости, иначе в маску полезет тёмная часть причёски.
    skin &= ~((y < y_m * 0.55) & (s > s_m * 1.35))

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
    # Closing. Ядро увеличено (//45 → //22): на щеке россыпь акне рвёт
    # маску на лоскуты шириной в десятки пикселей, мелкое ядро их не
    # смыкало, и ретушь ложилась пятнами с видимыми границами.
    close = _odd(max(5, min(img.size) // 22))
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

    Заливаем фон от рамки кадра настоящим flood fill. То, что осталось
    не залитым и при этом не является маской, — это и есть внутренняя
    дыра (прыщ, родинка, блик, тень от носа).

    ВАЖНО, почему именно flood fill. Раньше связность считалась
    приближённо — повторными размытиями метки от рамки внутрь фона, с
    ограничением в 14 проходов. Этого хватает только на короткие пути:
    фон за плечами отделён от рамки длинным узким коридором, метка до
    него не доползала, и весь дальний фон объявлялся «дырой внутри
    кожи». Маска раздувалась с 19% до 56% кадра, ретушь садилась на
    волосы, одежду и фон — лицо после сборки выглядело перерисованным.
    Flood fill обходит область целиком и такой ошибки не даёт.

    Args:
        mask: float32 HxW, 0 или 1.

    Returns:
        float32 HxW, 0 или 1.
    """
    h, w = mask.shape
    if not (mask < 0.5).any():
        return mask

    # Заливка — последовательный обход, её цена растёт с площадью. На
    # мелкой копии результат тот же: дыры, различимые после морфологии,
    # заведомо крупнее пикселя этого масштаба.
    side = 192
    src = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    if max(h, w) > side:
        sw, sh = (side, max(1, int(h * side / w))) if w >= h else (max(1, int(w * side / h)), side)
        src = src.resize((sw, sh), Image.BILINEAR)
    sw, sh = src.size

    # Рамка из фона по периметру: гарантирует, что старт заливки лежит
    # снаружи маски, даже если кожа подходит вплотную к краю кадра.
    canvas = Image.new("L", (sw + 2, sh + 2), 0)
    canvas.paste(src, (1, 1))
    # .copy() обязателен: изображение, созданное напрямую из numpy-массива,
    # держит его буфер только на чтение, и floodfill по нему молча
    # не срабатывает — маска остаётся незалитой.
    bg_img = Image.fromarray(
        ((np.asarray(canvas) < 128).astype(np.uint8)) * 255, mode="L").copy()
    ImageDraw.floodfill(bg_img, (0, 0), 128)

    holes = np.asarray(bg_img)[1:-1, 1:-1] == 255
    holes_img = Image.fromarray(holes.astype(np.uint8) * 255, mode="L")
    if (sw, sh) != (w, h):
        holes_img = holes_img.resize((w, h), Image.BILINEAR)
    return np.clip(mask + (np.asarray(holes_img) > 128).astype(np.float32), 0.0, 1.0)


def protect_mask_small(img: Image.Image, skin: np.ndarray = None) -> np.ndarray:
    """Защита: глаза, брови, губы, зубы, ноздри. Намеренно узкая —
    широкая защита «съедала» прыщи и мешала их убрать.

    Темнота считается ОТНОСИТЕЛЬНО соседней кожи, а не по абсолютной
    яркости кадра. Абсолютный порог (y < 62) работал только на снимках
    определённой экспозиции: на светлом лице брови и ресницы имеют
    яркость 150 и под него не попадали вовсе — защита черт лица молча
    отключалась, и модель перерисовывала глаза и брови. Опора берётся
    нормализованным размытием по самой коже, поэтому чёрный фон или
    светлая одежда рядом её не сбивают.
    """
    arr = _to_arr(img)
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    skin_like = (cr > 128) & (cr < 200) & (y > 40)
    if skin_like.any():
        cr_med = float(np.median(cr[skin_like]))
        y_med = float(np.median(y[skin_like]))
    else:
        cr_med, y_med = 140.0, 130.0

    if skin is None:
        skin = skin_mask_small(img)
    valid = np.maximum(np.clip(skin, 0.0, 1.0), 0.05)

    # Радиус опоры — порядка размера глазницы: шире, чем бровь или глаз,
    # но уже, чем светотень всего лица.
    local_r = max(4.0, min(img.size) * 0.035)
    y_local = _norm_blur(y, valid, local_r)
    rel_dark = (y_local - y) / np.maximum(y_local, 20.0)

    # Темнее соседней кожи на 15%+ — это бровь, ресница, ноздря, линия рта.
    #
    # Но воспалённый прыщ тоже темнее окружающей кожи, и по одной яркости
    # он неотличим от брови — попадая под защиту, он переставал убираться.
    # Различает их цвет: прыщ локально КРАСНЕЕ фона (+11 и выше), волос и
    # ресница нейтральны или холоднее (около нуля). Поэтому из защиты
    # исключается всё, что даёт выраженный локальный выброс красноты.
    redness = arr[..., 0] - (arr[..., 1] + arr[..., 2]) * 0.5
    local_red = redness - _blur_f(redness, max(8.0, min(img.size) * 0.04))
    not_inflamed = local_red < 4.0
    dark = (
        ((rel_dark > 0.15) & not_inflamed) | (y < min(62.0, y_med * 0.42))
    ).astype(np.float32)
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
    # зоны — губы, глаза, брови — остаются.
    #
    # Ядро было //26 (19 px на копии 512) — настолько крупное, что вместе
    # с прыщами стирало из защиты сами брови, ресницы и глаза: они тоньше
    # ядра. Защита молча отключалась там, ради чего она и нужна, и модель
    # свободно перерисовывала взгляд и линию брови. //140 (3-4 px) черты
    # лица сохраняет, а прыщи по-прежнему убирает: прыщ круглый и цельный,
    # он исчезает при эрозии, бровь же длинная и восстанавливается.
    open_k = _odd(max(3, min(img.size) // 140))
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



# ====================== ГЛАВНЫЙ КОМПОЗИТ ======================


def blend_skin(original: Image.Image, generated: Image.Image,
               strength: float = 0.9, keep_texture: float = 0.9,
               regions=None, trust_threshold: float = 60.0,
               highlight_recovery: float = 0.6,
               even_out: float = 0.7) -> Image.Image:
    """Собирает финал: тон кожи от модели, вся текстура от оригинала.

        out = orig + (blur(gen) - blur(orig)) * mask * strength

    Разделение частот идёт по МАЛЕНЬКОМУ радиусу (0.2% кадра, около 3 px).
    Всё, что крупнее, — цвет, краснота, пятно, тень прыща — берётся от
    модели, которая их уже убрала. Всё, что мельче, — поры, волоски,
    ресницы, кромки — остаётся оригинальным попиксельно, поэтому не
    появляется ни мыла, ни двоения контуров.

    ПОЧЕМУ ИМЕННО ТАК, а не как было раньше. Предыдущая версия не брала
    результат модели напрямую: она сама искала дефекты, сама «залечивала»
    их средним тоном соседней кожи и сама вычитала рельеф. Каждый из этих
    шагов ошибался — детектор принимал за дефект контур брови и границу
    волос, healing заливал тёмное воспаление светлым тоном, а вычитание
    рельефа выворачивало прыщ в яркое пятно. В сумме на лице появлялись
    белёсые кляксы, заметные сильнее исходных высыпаний. Модель делает ту
    же работу лучше — её и берём, ограничив областью кожи.

    Args:
        original: исходный кадр.
        generated: результат генеративной модели.
        strength: 0..1 — насколько применяем тон модели.
        keep_texture: 0..1 — сколько текстуры кожи сохранить (1 = вся).
        regions: боксы с людьми, вне них ретушь не применяется.
        trust_threshold: не используется, оставлен для совместимости.
        highlight_recovery: не используется, оставлен для совместимости.
        even_out: 0..1 — расширяет полосу частот, взятых от модели.

    Одного результата модели мало. Она убирает высыпания частично — на
    проблемной коже краснота падает примерно на четверть, — поэтому поверх
    её тона идёт собственная точечная доводка по красноте и тёмным точкам,
    и отдельная страховка от мест, где модель перерисовала геометрию.
    """
    strength = float(np.clip(strength, 0.0, 1.0))
    keep_texture = float(np.clip(keep_texture, 0.0, 1.0))

    # --- 1. Маска кожи на мелкой копии ---
    mask_img = _small(original, MASK_SIDE)
    skin_raw = skin_mask_small(mask_img)
    mask_s = np.clip(
        skin_raw * (1.0 - protect_mask_small(mask_img, skin_raw)), 0.0, 1.0)
    del skin_raw
    if regions:
        mask_s *= regions_mask(mask_img.size, regions)
    del mask_img

    width, height = original.size
    side = min(width, height)

    # Модель отдаёт кадр своего размера — приводим к оригиналу.
    if generated.size != original.size:
        generated = generated.resize(original.size, Image.LANCZOS)

    # --- 1b. Страховка от перерисовки (structure guard) ---
    # Модель не всегда возвращает тот же кадр: местами она сдвигает ухо,
    # линию челюсти, край причёски на несколько пикселей. В таких местах
    # её тон уже не про «ту же кожу», и вычитание давало светлые кляксы.
    # Сравниваем кадры на КРУПНОМ масштабе (мелкие дефекты туда не попадают,
    # поэтому чистке это не мешает) и там, где расхождение велико, доверие
    # к модели падает до нуля. Считаем на мелкой копии — дёшево и достаточно.
    guard_side = 384
    gw = max(64, int(guard_side * width / max(side, 1)))
    gh = max(64, int(guard_side * height / max(side, 1)))
    o_small = _to_arr(original.resize((gw, gh), Image.BILINEAR))
    g_small = _to_arr(generated.resize((gw, gh), Image.BILINEAR))
    gr = max(2.0, min(gw, gh) * 0.03)
    struct_diff = np.abs(_blur_f(g_small, gr) - _blur_f(o_small, gr)).mean(axis=2)
    guard = _blur_f(1.0 - _ramp(struct_diff, 8.0, 22.0), max(2.0, min(gw, gh) * 0.01))
    del o_small, g_small, struct_diff
    guard_full = np.asarray(
        Image.fromarray((np.clip(guard, 0.0, 1.0) * 255).astype(np.uint8), mode="L")
        .resize((mask_s.shape[1], mask_s.shape[0]), Image.BILINEAR),
        dtype=np.float32) / 255.0
    mask_s = np.clip(mask_s * guard_full, 0.0, 1.0)
    del guard, guard_full

    # Мягкий край маски: ретушь должна втекать в кожу постепенно, иначе
    # по контуру лица видна ступенька.
    mask_img_full = Image.fromarray(
        (np.clip(mask_s, 0.0, 1.0) * 255).astype(np.uint8), mode="L"
    ).resize(original.size, Image.BILINEAR).filter(
        ImageFilter.GaussianBlur(radius=max(2.0, side * 0.005)))
    del mask_s

    # Радиус разделения. even_out чуть расширяет полосу: на «Сильной»
    # от модели берётся больше средних частот, то есть глубже чистка.
    split_r = max(2.0, side * (0.0018 + 0.0010 * float(np.clip(even_out, 0.0, 1.0))))
    # keep_texture < 1 добавляет лёгкое общее приглаживание кожи.
    smooth_extra = (1.0 - keep_texture) * 0.5

    # --- Собственная доводка поверх модели ---
    # Модель убирает высыпания лишь частично: на проблемной коже краснота
    # падает с 10.8 до 8.1 по нашей метрике, то есть примерно на четверть,
    # и «Сильная» на глаз мало отличалась от «Стандарта». Просто умножить
    # вклад модели нельзя — вместе с чисткой множатся и её огрехи, вылезают
    # светлые пятна. Поэтому добавляем точечную доводку по самому признаку
    # дефекта: локальный выброс красноты гасится, локальное затемнение
    # (пост-акне, комедон) подтягивается к тону соседней кожи. Обе правки
    # работают в узкой полосе масштабов — размер прыща, — поэтому поры и
    # общая светотень лица не затрагиваются.
    extra = float(np.clip(strength, 0.0, 1.0)) ** 1.6
    k_red = 1.30 * extra
    k_dark = 0.55 * extra

    # Карты доводки считаем один раз на копии 768 px, а не на каждой полосе
    # полного кадра: дефект размером в прыщ на этом масштабе виден целиком,
    # результат совпадает с полноразмерным расчётом до сотых, а работы в
    # несколько раз меньше — и по времени, и по памяти.
    red_map = dark_map = None
    if k_red > 0.01 or k_dark > 0.01:
        cw = max(64, int(768 * width / max(side, 1)))
        ch = max(64, int(768 * height / max(side, 1)))
        c_arr = _to_arr(original.resize((cw, ch), Image.LANCZOS))
        c_mask = np.asarray(
            mask_img_full.resize((cw, ch), Image.BILINEAR), dtype=np.float32) / 255.0
        c_fine = max(1.0, min(cw, ch) * 0.0012)
        c_spot = max(4.0, min(cw, ch) * 0.018)

        # --- Защита от макияжа: почему без неё по краю губ шёл зелёный кант ---
        # Доводка по красноте гасит красный канал и ПОДНИМАЕТ зелёный с синим
        # (чтобы на месте прыща не осталось серого пятна). Помада, румяна и
        # цветная подводка дают выброс красноты в разы больше любого прыща, и
        # у самой кромки губ, куда защита черт лица не достаёт ровно на ширину
        # растушёвки, эта поправка срабатывала на полную: красный вниз на
        # десятки единиц, зелёный вверх — вдоль овала рта появлялась зелёная
        # кайма. Поэтому окрестность любого пикселя, чья цветность заметно
        # уходит от медианы кожи (помада, тени, подводка, тушь), из доводки
        # исключается. Радиус исключения — порядка c_spot: именно на столько
        # широкое размытие разносит влияние помады на соседнюю кожу.
        c_y, c_cb, c_cr = _ycbcr(c_arr)
        sel = c_mask > 0.35
        if int(np.count_nonzero(sel)) > 64:
            cr_med = float(np.median(c_cr[sel]))
            cb_med = float(np.median(c_cb[sel]))
            off = np.maximum(_ramp(np.abs(c_cr - cr_med), 13.0, 25.0),
                             _ramp(np.abs(c_cb - cb_med), 11.0, 21.0))
            spread = np.clip(_blur_f(off, c_spot * 1.6) * 2.4, 0.0, 1.0)
            c_mask = c_mask * (1.0 - spread)
            del off, spread
        del sel, c_y, c_cb, c_cr

        # --- Вторая причина канта: сама кромка маски ---
        # Доводка по красноте сравнивает пиксель с его окрестностью радиусом
        # c_spot. У границы овала лица в эту окрестность попадает голубой
        # свитер и фон — кожа на их фоне «краснее нормы» на всём протяжении
        # контура, и поправка чертила по овалу ровную зелёную линию, похожую
        # на край маски. Мягкое затухание маски тут не спасает: линия идёт
        # как раз там, где маска ещё близка к единице.
        # Лечится сужением: доводка работает только в ЯДРЕ маски, где вся
        # опорная окрестность — кожа. Ядро берётся как размытие маски самой
        # на себя: значение около единицы означает «вокруг сплошная кожа».
        # Основная чистка (тон от модели) по-прежнему идёт до самого края —
        # сужается только точечная доводка, которая и давала цветной сдвиг.
        core_m = _ramp(_blur_f(c_mask, c_spot * 2.0), 0.72, 0.94)
        c_mask = c_mask * core_m
        del core_m

        # Краснота воспаления: насколько пиксель краснее соседней кожи.
        red = c_arr[..., 0] - (c_arr[..., 1] + c_arr[..., 2]) * 0.5
        red_map = np.clip(_blur_f(red, c_fine) - _blur_f(red, c_spot), 0.0, None)
        # Прыщ даёт локальный выброс красноты 4..20 единиц. Всё, что выше 25, —
        # это уже не кожа: кромка губ, подводка, ноздря. Не обрезаем по потолку
        # (обрезка оставляет поправку максимальной силы), а гасим до нуля.
        red_map = red_map * (1.0 - _ramp(red_map, 22.0, 38.0))
        red_map *= c_mask * k_red
        del red
        # Тёмные точки: пост-акне и комедоны. Берём только провалы — светлые
        # участки не трогаем, иначе гаснет объём лица и блики.
        lum = c_arr.mean(axis=2)
        dark_map = np.clip(_blur_f(lum, c_spot) - _blur_f(lum, c_fine), 0.0, None)
        dark_map = dark_map * (1.0 - _ramp(dark_map, 34.0, 55.0))
        dark_map *= c_mask * k_dark
        del lum, c_arr, c_mask

        red_map = Image.fromarray(
            np.clip(red_map, 0, 255).astype(np.uint8), mode="L").resize(
            original.size, Image.BILINEAR)
        dark_map = Image.fromarray(
            np.clip(dark_map, 0, 255).astype(np.uint8), mode="L").resize(
            original.size, Image.BILINEAR)

    # --- Крупинки: осыпавшаяся тушь, пыль на матрице, точки под глазом ---
    # Почему это отдельный проход, а не dark_map. Карты доводки считаются на
    # копии 768 px: прыжок в 3-4 раза по стороне. Крупинка туши размером
    # 2-4 px на исходном кадре при таком уменьшении занимает меньше пикселя и
    # растворяется в усреднении — её просто нет в c_arr, гасить нечего. Модель
    # их тоже не убирает: для неё это законная деталь ресниц. Поэтому мелкие
    # тёмные точки считаются прямо на полном разрешении, в узкой полосе
    # частот (их собственный размер), с жёстким потолком по амплитуде.
    #
    # Потолок обязателен. Провал яркости у крупинки — единицы, максимум пара
    # десятков. Ресница, бровь и контур века дают 60 и выше; без ограничения
    # сверху эта же поправка осветляла бы их и стирала взгляд. Сама ресница
    # вдобавок лежит под маской защиты, крупинка рядом с ней — нет: она
    # круглая и мелкая, её из защиты выбивает opening.
    speck_fine = max(0.8, side * 0.0008)
    speck_spot = max(3.0, side * 0.0055)
    k_speck = 1.15 * float(np.clip(strength, 0.0, 1.0)) ** 1.2

    # --- 2. Сборка полосами: пик памяти — десятки мегабайт, не сотни ---
    band = max(64, int(600_000 / max(width, 1)))
    overlap = int(max(split_r, speck_spot) * 4) + 8
    out_img = Image.new("RGB", original.size)

    for top in range(0, height, band):
        bottom = min(height, top + band)
        src_top = max(0, top - overlap)
        src_bottom = min(height, bottom + overlap)
        box = (0, src_top, width, src_bottom)

        arr = np.asarray(original.crop(box), dtype=np.float32)
        gen = np.asarray(generated.crop(box), dtype=np.float32)
        m = np.asarray(mask_img_full.crop(box), dtype=np.float32)[..., None] / 255.0

        low_o = _blur_f(arr, split_r)
        # Вклад модели ограничен по амплитуде: осветлять она может не более
        # чем на 18 единиц. Затемнение (собственно чистка прыща) не режем.
        # Без этого редкие выбросы модели (+130 и выше) давали белые кляксы.
        delta = np.clip(_blur_f(gen, split_r) - low_o, -60.0, 18.0) * (m * strength)
        del gen

        if smooth_extra > 0.001:
            # Мягкое приглаживание: подмешиваем размытую версию самой кожи.
            delta += (low_o - arr) * (m * smooth_extra)
        del low_o

        out = arr + delta
        del arr, delta, m

        if red_map is not None:
            # Красноту гасим по каналам так, чтобы яркость пикселя почти не
            # менялась: красный вниз, зелёный и синий чуть вверх. Иначе на
            # месте прыща остаётся серое пятно вместо кожи.
            excess = np.asarray(red_map.crop(box), dtype=np.float32)
            out[..., 0] -= excess * 0.66
            out[..., 1] += excess * 0.17
            out[..., 2] += excess * 0.17
            del excess
            out += np.asarray(dark_map.crop(box), dtype=np.float32)[..., None]

        if k_speck > 0.01:
            # Полоса частот размером с крупинку: вычитаем из локального фона
            # чуть сглаженную яркость. Положительный остаток — точка темнее
            # окружающей кожи. Ресница и бровь дают тот же знак, но в разы
            # большую амплитуду, поэтому всё, что глубже 26 единиц, гасится
            # до нуля через ramp, а не обрезается по потолку.
            band_arr = np.asarray(original.crop(box), dtype=np.float32)
            lum_b = band_arr.mean(axis=2)
            del band_arr
            speck = np.clip(
                _blur_f(lum_b, speck_spot) - _blur_f(lum_b, speck_fine), 0.0, None)
            del lum_b
            speck *= 1.0 - _ramp(speck, 18.0, 30.0)
            mb = np.asarray(mask_img_full.crop(box), dtype=np.float32) / 255.0
            out += (speck * mb * k_speck)[..., None]
            del speck, mb

        chunk = np.clip(out, 0, 255).astype(np.uint8)
        inner = chunk[top - src_top: top - src_top + (bottom - top)]
        out_img.paste(Image.fromarray(inner), (0, top))
        del out, chunk, inner

    mask_img_full.close()
    if red_map is not None:
        red_map.close()
        dark_map.close()
    return out_img