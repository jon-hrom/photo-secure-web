"""Маска кожи и безопасный композит генеративной ретуши.

Идея: модель перерисовывает кожу целиком (как при удалении лого), но наружу
уходит оригинал, в котором заменена ТОЛЬКО поверхность кожи. Черты лица,
глаза, губы, волосы, одежда и фон остаются исходными — человек не меняется.

Ключевые отличия от точечного healing:
  * маска покрывает ВСЮ кожу сплошняком, включая прыщи, покраснения,
    пост-акне и пересвеченные блики — иначе именно дефекты и остаются
    неотретушированными (ровно та проблема, что была раньше);
  * защита узкая и точная: только глаза, брови, ноздри, губы, зубы;
  * микротекстура (поры) возвращается из оригинала, но только слабая —
    сильные высокие частоты это и есть прыщи, их возвращать нельзя;
  * пересвет восстанавливается отдельным шагом: света сжимаются, объём
    возвращается из соседних областей кожи.
"""
import numpy as np
from PIL import Image, ImageFilter


def _odd(n: int) -> int:
    """Размер ядра фильтра PIL должен быть нечётным."""
    n = max(3, int(n))
    return n if n % 2 else n + 1


def _to_arr(img: Image.Image) -> np.ndarray:
    return np.asarray(img, dtype=np.float32)


# Маски — мягкие карты, мелкие детали в них всё равно размываются.
# Считаем их на уменьшенной копии: морфология с большим ядром на полном
# кадре стоит секунды и выбивает функцию из лимита времени.
MASK_SIDE = 512


def _small(img: Image.Image) -> Image.Image:
    """Уменьшенная копия для расчёта масок (или оригинал, если он мелкий)."""
    if max(img.size) <= MASK_SIDE:
        return img
    scaled = img.copy()
    scaled.thumbnail((MASK_SIDE, MASK_SIDE), Image.BILINEAR)
    return scaled


def _upscale_mask(mask: np.ndarray, size) -> np.ndarray:
    """Возвращает маску к размеру оригинала."""
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


def regions_mask(size, regions) -> np.ndarray:
    """Маска 0..1 по боксам с людьми (координаты — доли от кадра)."""
    w, h = size
    m = np.zeros((h, w), dtype=np.float32)
    for x0, y0, x1, y1 in regions:
        # запас: vision-модели дают рамку приблизительно
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


def build_skin_mask(img: Image.Image) -> np.ndarray:
    """Сплошная маска кожи 0..1, включая дефекты и блики.

    Важно: прыщи, покраснения и пересвеченные зоны обязаны попасть в маску.
    Раньше они отсекались цветовым правилом — и именно поэтому оставались
    на фото нетронутыми.
    """
    full_size = img.size
    img = _small(img)
    arr = _to_arr(img)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    # Широкое цветовое правило кожи: диапазон Cr/Cb расширен вверх, чтобы
    # воспалённые красные участки (акне) тоже считались кожей.
    skin = (
        (cr >= 130) & (cr <= 195) &
        (cb >= 70) & (cb <= 135) &
        (y >= 35) & (y <= 255) &
        (r > b) & (r >= g - 8)
    )

    # Волосы, брови, глубокие тени — тёмные. Губы — насыщенно-красные.
    skin &= (s < 0.70) & (v > 0.15)

    # Белые/бесцветные объекты (ткань, бумага, стены) похожи на кожу
    # по цветности. Но пересвеченная кожа тоже бесцветная и яркая,
    # поэтому отсекаем только то, что ЯВНО ахроматично.
    skin &= ~((v > 0.90) & (s < 0.10))

    mask = skin.astype(np.float32)

    # Главное: закрываем дырки внутри кожи. Прыщи, родинки и блики
    # выпадают из цветового правила, но находятся ВНУТРИ пятна кожи —
    # их надо затянуть, иначе ретушь их не тронет.
    close = _odd(max(9, min(img.size) // 22))
    m = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    m = m.filter(ImageFilter.MaxFilter(close))   # затянуть дырки от дефектов
    m = m.filter(ImageFilter.MinFilter(close))   # вернуть внешние границы
    # Мелкий мусор (отдельные пиксели фона) убираем открытием.
    m = m.filter(ImageFilter.MinFilter(3))
    m = m.filter(ImageFilter.MaxFilter(3))
    m = m.filter(ImageFilter.GaussianBlur(radius=max(2, min(img.size) // 300)))
    mask = np.asarray(m, dtype=np.float32) / 255.0

    return _upscale_mask(np.clip(mask, 0.0, 1.0), full_size)


def build_protect_mask(img: Image.Image) -> np.ndarray:
    """Маска «не трогать»: глаза, брови, ресницы, губы, зубы, ноздри.

    Защита намеренно узкая. Широкая защита «съедала» прыщи и покраснения
    (они тоже тёмные и красные) и мешала их убрать.
    """
    full_size = img.size
    img = _small(img)
    arr = _to_arr(img)
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    # Только реально тёмное: зрачки, ресницы, брови, ноздри.
    # Порог понижен с 90 до 62 — тени на щеке и пост-акне защищать не нужно.
    dark = (y < 62).astype(np.float32)
    # Губы отличаются от кожи не абсолютным цветом, а сочетанием: они
    # краснее И ТЕМНЕЕ окружающей кожи. Абсолютные пороги тут не работают —
    # на бледных губах cr почти как на щеке. Поэтому сравниваем с медианой
    # кожи по кадру.
    skin_like = (cr > 128) & (cr < 200) & (y > 40)
    if skin_like.any():
        cr_med = float(np.median(cr[skin_like]))
        y_med = float(np.median(y[skin_like]))
    else:
        cr_med, y_med = 140.0, 130.0
    red = (
        ((cr > cr_med + 4) & (y < y_med - 12) & (s > 0.22)) |
        ((cr > cr_med + 22) & (s > 0.40))
    ).astype(np.float32)
    # Блики в глазах и зубы — предельно яркие и бесцветные.
    bright = ((v > 0.96) & (s < 0.08)).astype(np.float32)

    protect = np.clip(dark + red + bright, 0.0, 1.0)

    p = Image.fromarray((protect * 255).astype(np.uint8), mode="L")
    # Открытие: мелкие красные точки (прыщи) выпадают из защиты, а крупные
    # области — губы, глаза, брови — остаются. Без этого шага защита
    # накрывала бы сами дефекты и мешала их убрать.
    open_k = _odd(max(3, min(img.size) // 90))
    p = p.filter(ImageFilter.MinFilter(open_k))
    p = p.filter(ImageFilter.MaxFilter(open_k))
    # Небольшой запас по краю защищённых зон.
    p = p.filter(ImageFilter.MaxFilter(_odd(max(3, min(img.size) // 160))))
    p = p.filter(ImageFilter.GaussianBlur(radius=max(2, min(img.size) // 400)))
    small_mask = np.clip(np.asarray(p, dtype=np.float32) / 255.0, 0.0, 1.0)
    return _upscale_mask(small_mask, full_size)


def _highpass(arr: np.ndarray, radius: float) -> np.ndarray:
    """Высокие частоты = детали (поры, волоски)."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    blurred = np.asarray(img.filter(ImageFilter.GaussianBlur(radius=radius)),
                         dtype=np.float32)
    return arr - blurred


def recover_highlights(img: Image.Image, mask: np.ndarray,
                       strength: float = 0.6) -> Image.Image:
    """Восстановление пересвета на коже: сжимает света и возвращает объём.

    Пересвеченные зоны (жирный блеск на лбу, носу, скулах) вытянуты в белое
    и теряют цвет. Приводим их яркость к уровню окружающей кожи и
    возвращаем телесный оттенок, взятый из соседних нормальных участков.
    """
    strength = float(np.clip(strength, 0.0, 1.0))
    if strength <= 0.01:
        return img

    # Карты пересвета и «локального тона кожи» — сильно размытые, мелкие
    # детали в них роли не играют. Считаем на уменьшенной копии: на полном
    # кадре это несколько float32-копий и выход за лимит памяти функции.
    small = _small(img)
    arr_s = _to_arr(small)
    y, _, _ = _ycbcr(arr_s)
    v, s, _ = _hsv(arr_s)
    mask_s = _upscale_mask(mask, small.size)

    # Пересвет определяем ОТНОСИТЕЛЬНО самой кожи, а не по абсолютной
    # яркости. Жирный блеск на лбу и щеках часто не доходит до белого
    # (на тёмном фото максимум яркости кожи бывает ~160), и абсолютный
    # порог его просто не видел — пересвет оставался на месте.
    sk = mask_s > 0.3
    if not sk.any():
        return img
    y_hi = float(np.percentile(y[sk], 82))
    y_top = float(np.percentile(y[sk], 99))
    span = max(8.0, y_top - y_hi)

    over_s = np.clip((y - y_hi) / span, 0.0, 1.0)
    # Блик обесцвечен: чем ниже насыщенность относительно кожи, тем сильнее.
    s_med = float(np.median(s[sk]))
    over_s *= np.clip((s_med + 0.06 - s) / max(0.08, s_med), 0.0, 1.0)
    over_s *= mask_s  # только по коже
    if over_s.max() < 0.02:
        return img

    # Цвет и яркость «нормальной» кожи рядом: сильное размытие по маске,
    # взвешенное на не-пересвеченные пиксели.
    good = mask_s * (1.0 - over_s)
    radius = max(12.0, min(small.size) / 14.0)

    def _blur(a):
        return np.asarray(
            Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
            .filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32)

    w = np.asarray(
        Image.fromarray((good * 255).astype(np.uint8), mode="L")
        .filter(ImageFilter.GaussianBlur(radius=radius)), dtype=np.float32) / 255.0
    w = np.maximum(w, 1e-3)

    local_s = np.empty_like(arr_s)
    for c in range(3):
        local_s[..., c] = _blur(arr_s[..., c] * good) / w

    # Поправка (насколько тянуть пиксель к тону кожи) считается на мелкой
    # копии и растягивается — она плавная, апскейл её не портит.
    delta_s = np.clip(local_s - arr_s + 128.0, 0, 255).astype(np.uint8)
    delta = np.asarray(
        Image.fromarray(delta_s).resize(img.size, Image.BILINEAR),
        dtype=np.float32) - 128.0
    over = _upscale_mask(over_s, img.size)
    del arr_s, local_s, delta_s, over_s, mask_s, good, w, y, v, s

    arr = _to_arr(img)
    # Тянем пересвет к локальному тону кожи, но не полностью: блик
    # должен остаться бликом, иначе лицо станет плоским.
    a = (over * strength * 0.85)[..., None]
    out = arr + delta * a

    # Возвращаем микрорельеф, чтобы восстановленная зона не была пятном.
    detail = _highpass(arr, max(1.5, min(img.size) / 400.0))
    out += detail * (over * 0.35)[..., None]

    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def blend_skin(original: Image.Image, generated: Image.Image,
               strength: float = 0.8, keep_texture: float = 0.35,
               regions=None, trust_threshold: float = 40.0,
               highlight_recovery: float = 0.6) -> Image.Image:
    """Вклеивает генеративную ретушь в оригинал только по коже.

    trust_threshold — порог «доверия» к результату модели. Чем выше, тем
    сильнее разрешено менять кожу. На низком пороге защита срабатывала
    даже на нормальной ретуши и возвращала прыщи обратно.
    """
    strength = float(np.clip(strength, 0.0, 1.0))
    keep_texture = float(np.clip(keep_texture, 0.0, 1.0))

    skin_mask = build_skin_mask(original)
    protect = build_protect_mask(original)
    mask = np.clip(skin_mask * (1.0 - protect), 0.0, 1.0)
    del skin_mask, protect
    if regions:
        mask *= regions_mask(original.size, regions)

    # Геометрическая страховка. Считаем расхождение по СИЛЬНО размытым
    # версиям кадра: так видно сдвиг черт и формы, но не видно локальных
    # дефектов. Иначе защита срабатывала бы ровно на прыщах — то есть
    # мешала бы убрать именно то, ради чего инструмент и нужен.
    orig_s = _small(original)
    gen_small = generated.resize(orig_s.size, Image.BILINEAR)
    blur_r = max(6.0, min(orig_s.size) / 60.0)
    orig_low = np.asarray(orig_s.filter(ImageFilter.GaussianBlur(radius=blur_r)),
                          dtype=np.float32)
    gen_low = np.asarray(gen_small.filter(ImageFilter.GaussianBlur(radius=blur_r)),
                         dtype=np.float32)
    struct_diff = np.abs(gen_low - orig_low).mean(axis=-1)
    trust = np.clip(1.0 - (struct_diff - trust_threshold) / 30.0, 0.0, 1.0)
    trust_img = Image.fromarray((trust * 255).astype(np.uint8), mode="L")
    trust_img = trust_img.filter(ImageFilter.GaussianBlur(radius=blur_r / 2))
    trust = _upscale_mask(np.asarray(trust_img, dtype=np.float32) / 255.0,
                          original.size)

    # Карту силы храним как uint8: float32 на весь кадр — это лишние
    # десятки мегабайт, а точности 1/255 для маски достаточно.
    alpha_map = (np.clip(mask * trust * strength, 0.0, 1.0) * 255).astype(np.uint8)
    skin_for_highlights = mask
    del trust

    # Финал считаем горизонтальными полосами. Раньше в памяти одновременно
    # жили ~8 float32-копий кадра — на 1600px это 450 МБ, и функцию убивал
    # OOM (лимит 256 МБ). Полосами пик держится в десятках мегабайт.
    radius = max(1.2, min(original.size) / 500.0)
    width, height = original.size
    band = max(64, int(600_000 / max(width, 1)))
    overlap = int(radius * 3) + 2  # запас, чтобы блюр не рвал стык полос

    out_img = Image.new("RGB", original.size)

    for top in range(0, height, band):
        bottom = min(height, top + band)
        # Читаем с перехлёстом, а вклеиваем только «чистую» середину.
        src_top = max(0, top - overlap)
        src_bottom = min(height, bottom + overlap)
        box = (0, src_top, width, src_bottom)

        orig = np.asarray(original.crop(box), dtype=np.float32)
        gen = np.asarray(generated.crop(box), dtype=np.float32)

        # Низкие частоты берём у модели (ровный тон), высокие частично
        # возвращаем из оригинала — так сохраняются поры и кожа живая.
        gen_detail = _highpass(gen, radius)
        orig_detail = _highpass(orig, radius)
        # Из оригинала берём ТОЛЬКО слабые детали — поры и микрорельеф.
        # Сильные высокие частоты это и есть прыщи и пятна: вернуть их
        # означало бы отменить ретушь.
        amp = np.abs(orig_detail).mean(axis=-1, keepdims=True)
        fine = np.clip(1.0 - (amp - 4.0) / 5.0, 0.0, 1.0)
        detail = gen_detail + (orig_detail * fine - gen_detail) * keep_texture
        gen_final = gen - gen_detail + detail
        del gen_detail, orig_detail, amp, fine, detail

        alpha = alpha_map[src_top:src_bottom][..., None].astype(np.float32) / 255.0
        chunk = orig * (1.0 - alpha) + gen_final * alpha
        del orig, gen, gen_final, alpha

        chunk = np.clip(chunk, 0, 255).astype(np.uint8)
        inner = chunk[top - src_top: top - src_top + (bottom - top)]
        out_img.paste(Image.fromarray(inner), (0, top))
        del chunk, inner

    del alpha_map

    if highlight_recovery > 0.01:
        out_img = recover_highlights(out_img, skin_for_highlights,
                                     strength=highlight_recovery)

    return out_img


def mask_preview(img: Image.Image, regions=None) -> Image.Image:
    """Отладка: показывает, что именно считается кожей."""
    mask = build_skin_mask(img) * (1.0 - build_protect_mask(img))
    if regions:
        mask = mask * regions_mask(img.size, regions)
    return Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), mode="L")