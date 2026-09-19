"""Маска кожи и безопасный композит ретуши.

Смысл модуля — страховка от «модель перерисовала человека». Что бы ни вернул
провайдер, наружу уходит оригинал, в котором заменена ТОЛЬКО поверхность кожи:

  * маска кожи строится по оригиналу (YCbCr + HSV, без внешних сервисов);
  * из маски вычитаются глаза, брови, губы, волосы и всё, что не является
    ровной кожей (тёмные и насыщенные зоны);
  * на пиксель накладывается лимит изменения — резкая «пересборка» черт
    лица просто не проходит;
  * микротекстура (поры) возвращается из оригинала, иначе кожа пластиковая.
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
# Поэтому считаем их на уменьшенной копии: морфология MaxFilter/MinFilter
# с большим ядром на полном кадре стоит секунды и выбивала функцию
# из лимита времени (5 с) — пользователь видел «Connection reset by peer».
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
    """Возвращает float-маску кожи 0..1 того же размера, что и картинка."""
    full_size = img.size
    img = _small(img)
    arr = _to_arr(img)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    # Базовое цветовое правило кожи (работает на любом тоне — от светлого
    # до тёмного, потому что опирается на цветность, а не на яркость).
    skin = (
        (cr >= 133) & (cr <= 180) &
        (cb >= 77) & (cb <= 130) &
        (y >= 45) & (y <= 250) &
        (r > b) & (r >= g)
    )

    # Слишком насыщенное и тёмное — это губы, ноздри, тени, волосы.
    skin &= (s < 0.62) & (v > 0.18)

    # Белые/бесцветные светлые объекты (цветы, ткань, бумага, стены)
    # цветностью похожи на кожу — отсекаем их по низкой насыщенности.
    skin &= ~((v > 0.82) & (s < 0.20))

    mask = skin.astype(np.float32)

    # Прыщи, покраснения и пост-акне выпадают из цветового правила —
    # а именно их и надо ретушировать. Поэтому закрываем дырки внутри
    # пятен кожи: сначала расширяем маску, потом возвращаем границы.
    close = _odd(max(7, min(img.size) // 45))
    m = Image.fromarray((mask * 255).astype(np.uint8), mode="L")
    m = m.filter(ImageFilter.MaxFilter(close))   # затянуть дырки от дефектов
    m = m.filter(ImageFilter.MinFilter(close))   # вернуть внешние границы
    # Мелкий мусор (отдельные пиксели фона) убираем открытием.
    m = m.filter(ImageFilter.MinFilter(3))
    m = m.filter(ImageFilter.MaxFilter(3))
    m = m.filter(ImageFilter.GaussianBlur(radius=max(2, min(img.size) // 300)))
    mask = np.asarray(m, dtype=np.float32) / 255.0

    # Края кожи (граница с волосами/одеждой) ослабляем — там любые правки
    # видны как ореол.
    return _upscale_mask(np.clip(mask, 0.0, 1.0), full_size)


def build_protect_mask(img: Image.Image) -> np.ndarray:
    """Маска «не трогать»: глаза, брови, ресницы, губы, зубы, ноздри.

    Строится по контрасту и насыщенности: эти зоны либо тёмные, либо
    сильно краснее кожи. Возвращает 0..1, где 1 = полностью защищено.
    """
    full_size = img.size
    img = _small(img)
    arr = _to_arr(img)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    dark = (y < 90).astype(np.float32)              # зрачки, ресницы, брови
    red = ((cr > 160) & (s > 0.45)).astype(np.float32)  # губы
    bright = ((v > 0.93) & (s < 0.12)).astype(np.float32)  # блики глаз, зубы

    protect = np.clip(dark + red + bright, 0.0, 1.0)

    p = Image.fromarray((protect * 255).astype(np.uint8), mode="L")
    p = p.filter(ImageFilter.MaxFilter(_odd(max(3, min(img.size) // 250))))
    p = p.filter(ImageFilter.GaussianBlur(radius=max(2, min(img.size) // 400)))
    small_mask = np.clip(np.asarray(p, dtype=np.float32) / 255.0, 0.0, 1.0)
    return _upscale_mask(small_mask, full_size)


def _highpass(arr: np.ndarray, radius: float) -> np.ndarray:
    """Высокие частоты = детали (поры, волоски)."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    blurred = np.asarray(img.filter(ImageFilter.GaussianBlur(radius=radius)),
                         dtype=np.float32)
    return arr - blurred


def blend_skin(original: Image.Image, generated: Image.Image,
               strength: float = 0.8, keep_texture: float = 0.35,
               regions=None) -> Image.Image:
    """Вклеивает ретушь модели в оригинал только по коже, с защитами."""
    strength = float(np.clip(strength, 0.0, 1.0))
    keep_texture = float(np.clip(keep_texture, 0.0, 1.0))

    orig = _to_arr(original)
    gen = _to_arr(generated)

    skin_mask = build_skin_mask(original)
    protect = build_protect_mask(original)
    mask = np.clip(skin_mask * (1.0 - protect), 0.0, 1.0)
    if regions:
        mask *= regions_mask(original.size, regions)

    # Геометрическая страховка. Считаем расхождение по СИЛЬНО размытым
    # версиям кадра: так видно сдвиг черт и формы, но не видно локальных
    # дефектов. Иначе защита срабатывала бы ровно на прыщах — то есть
    # мешала бы убрать именно то, ради чего инструмент и нужен.
    # Считаем на уменьшенных копиях: карта и так сильно размыта, а на полном
    # кадре два гауссовых блюра большого радиуса занимали секунды.
    orig_s = _small(original)
    gen_small = generated.resize(orig_s.size, Image.BILINEAR)
    blur_r = max(6.0, min(orig_s.size) / 60.0)
    orig_low = np.asarray(orig_s.filter(ImageFilter.GaussianBlur(radius=blur_r)),
                          dtype=np.float32)
    gen_low = np.asarray(gen_small.filter(ImageFilter.GaussianBlur(radius=blur_r)),
                         dtype=np.float32)
    struct_diff = np.abs(gen_low - orig_low).mean(axis=-1)
    trust = np.clip(1.0 - (struct_diff - 40.0) / 30.0, 0.0, 1.0)
    trust_img = Image.fromarray((trust * 255).astype(np.uint8), mode="L")
    trust_img = trust_img.filter(ImageFilter.GaussianBlur(radius=blur_r / 2))
    trust = _upscale_mask(np.asarray(trust_img, dtype=np.float32) / 255.0,
                          original.size)

    alpha = (mask * trust * strength)[..., None]

    # Низкие частоты берём у модели (ровный тон), высокие частично
    # возвращаем из оригинала — так сохраняются поры и кожа живая.
    radius = max(1.2, min(original.size) / 500.0)
    gen_detail = _highpass(gen, radius)
    orig_detail = _highpass(orig, radius)
    # Из оригинала берём ТОЛЬКО слабые детали — поры и микрорельеф.
    # Сильные высокие частоты это и есть прыщи и пятна: вернуть их
    # означало бы отменить ретушь.
    amp = np.abs(orig_detail).mean(axis=-1, keepdims=True)
    fine = np.clip(1.0 - (amp - 6.0) / 8.0, 0.0, 1.0)
    orig_fine = orig_detail * fine
    detail = gen_detail + (orig_fine - gen_detail) * keep_texture
    gen_final = (gen - gen_detail) + detail

    out = orig * (1.0 - alpha) + gen_final * alpha
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def mask_preview(img: Image.Image, regions=None) -> Image.Image:
    """Отладка: показывает, что именно считается кожей."""
    mask = build_skin_mask(img) * (1.0 - build_protect_mask(img))
    if regions:
        mask = mask * regions_mask(img.size, regions)
    return Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), mode="L")