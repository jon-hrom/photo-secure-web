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
    """Сплошная маска кожи 0..1 в размере кадра (для отладки/превью)."""
    return _upscale_mask(skin_mask_small(_small(img)), img.size)


def skin_mask_small(img: Image.Image) -> np.ndarray:
    """Маска кожи в уменьшенном разрешении.

    Держать её в размере кадра нельзя: float32 на 2400x1600 — это 15 МБ,
    а таких карт по ходу композита получалось три-четыре одновременно.
    При лимите функции в 256 МБ это и был OOM (kill -9 → HTTP 502).
    Важно: прыщи, покраснения и пересвеченные зоны обязаны попасть в маску.
    """
    arr = _to_arr(img)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    # Широкое цветовое правило кожи: диапазон Cr/Cb расширен вверх, чтобы
    # воспалённые красные участки (акне) тоже считались кожей.
    # Нижняя граница яркости опущена (35 → 22): затенённая кожа — скула в
    # полутени, зона под челюстью, шея — выпадала из маски, и ретушь её
    # не трогала. Именно там и оставались недочищенные пятна.
    skin = (
        (cr >= 128) & (cr <= 198) &
        (cb >= 70) & (cb <= 138) &
        (y >= 22) & (y <= 255) &
        (r > b) & (r >= g - 8)
    )

    # Волосы, брови, глубокие тени — тёмные. Губы — насыщенно-красные.
    skin &= (s < 0.72) & (v > 0.09)

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

    return np.clip(mask, 0.0, 1.0)


def build_protect_mask(img: Image.Image) -> np.ndarray:
    """Маска «не трогать» в размере кадра (для отладки/превью)."""
    return _upscale_mask(protect_mask_small(_small(img)), img.size)


def protect_mask_small(img: Image.Image) -> np.ndarray:
    """Защита в уменьшенном разрешении: глаза, брови, губы, зубы, ноздри.

    Защита намеренно узкая. Широкая защита «съедала» прыщи и покраснения
    (они тоже тёмные и красные) и мешала их убрать.
    """
    arr = _to_arr(img)
    y, cb, cr = _ycbcr(arr)
    v, s, _ = _hsv(arr)

    # Медианы кожи по кадру — все пороги ниже считаются ОТНОСИТЕЛЬНО них.
    # Абсолютные значения не работают: на тёмном снимке щека в полутени
    # попадала под «тёмное» и защищалась целиком, из-за чего в тенях кожа
    # оставалась неотретушированной.
    skin_like = (cr > 128) & (cr < 200) & (y > 40)
    if skin_like.any():
        cr_med = float(np.median(cr[skin_like]))
        y_med = float(np.median(y[skin_like]))
    else:
        cr_med, y_med = 140.0, 130.0

    # Только реально тёмное: зрачки, ресницы, брови, ноздри. Полутень на
    # коже заметно светлее — она в защиту не попадает.
    dark = (y < min(62.0, y_med * 0.42)).astype(np.float32)
    # Губы отличаются от кожи не абсолютным цветом, а сочетанием: они
    # краснее И ТЕМНЕЕ окружающей кожи.
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
    # Ядро открытия подобрано по размеру: прыщ и точка пост-акне на
    # превью 512 px — это 4-8 px, губы и глаза — втрое крупнее. На прежнем
    # ядре (size//90) воспалённые прыщи на подбородке переживали открытие
    # и попадали под защиту — из-за этого ретушь их не трогала вовсе.
    open_k = _odd(max(5, min(img.size) // 38))
    p = p.filter(ImageFilter.MinFilter(open_k))
    p = p.filter(ImageFilter.MaxFilter(open_k))
    # Небольшой запас по краю защищённых зон.
    p = p.filter(ImageFilter.MaxFilter(_odd(max(3, min(img.size) // 200))))
    p = p.filter(ImageFilter.GaussianBlur(radius=max(2, min(img.size) // 400)))
    return np.clip(np.asarray(p, dtype=np.float32) / 255.0, 0.0, 1.0)


def _blur_arr(arr: np.ndarray, radius: float) -> np.ndarray:
    """Размытая копия массива (через PIL — быстрее любой свёртки на numpy)."""
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius=radius)),
                      dtype=np.float32)


def _blur_gray(a: np.ndarray, radius: float, span: float = 255.0) -> np.ndarray:
    """Размытие одноканальной карты. span — во сколько её масштабировать
    перед упаковкой в uint8 (карты 0..1 нужно растянуть до 0..255)."""
    img = Image.fromarray(
        np.clip(a * (255.0 / span), 0, 255).astype(np.uint8), mode="L")
    img = img.filter(ImageFilter.GaussianBlur(radius=radius))
    return np.asarray(img, dtype=np.float32) * (span / 255.0)


def _highpass(arr: np.ndarray, radius: float) -> np.ndarray:
    """Высокие частоты = детали (поры, волоски)."""
    return arr - _blur_arr(arr, radius)


def even_out_skin(img: Image.Image, mask_small: np.ndarray,
                  strength: float = 0.6) -> Image.Image:
    """Добивка: выравнивает кожу там, где модель не дочистила.

    Зачем нужен отдельный шаг. Генеративная модель убирает то, что хорошо
    видит — дефекты на освещённой стороне. В тенях (скула в полутени, зона
    под челюстью, шея) контраст пятна падает в разы, и модель их просто
    «не замечает»: пост-акне и покраснения остаются.

    Здесь кожа выравнивается арифметически, по принципу частотного
    разделения: локальный тон берётся из окрестности, а пиксели, которые
    ОТКЛОНЯЮТСЯ от этого тона (краснее, темнее или светлее), подтягиваются
    к нему. Работает только внутри маски кожи, поэтому черты лица, глаза,
    губы, волосы, одежда и контуры остаются нетронутыми — геометрия кадра
    вообще не меняется, двигается только цвет поверхности кожи.

    Ключевое для теней: пороги масштабируются локальной яркостью. В тёмной
    зоне тот же дефект даёт вдвое меньшую разницу, и фиксированный порог
    его пропускал — ровно то, что было видно на результате.

    Правка разделена на два независимых канала, и это принципиально:
      * ЦВЕТ (краснота) правится по большому радиусу — покраснения и
        пост-акне это пятна размером с полщеки. Яркость при этом не
        трогается вообще, поэтому светотень и объём лица сохраняются;
      * ЯРКОСТЬ правится только по малому радиусу и только на мелких
        точках. Большой радиус по яркости — это и есть тот «пластилин»,
        который стирает брови и ресницы, поэтому его тут нет.
    Плюс явный стоп для волосяных структур: перепад ярче некоторого
    предела — это волос, бровь или ресница, а не дефект кожи.
    """
    strength = float(np.clip(strength, 0.0, 1.0))
    if strength <= 0.01:
        return img

    width, height = img.size
    alpha_img = Image.fromarray(
        (np.clip(mask_small, 0, 1) * 255).astype(np.uint8), mode="L"
    ).resize(img.size, Image.BILINEAR)

    # Опорный радиус тона кожи. Должен быть заметно КРУПНЕЕ самого дефекта:
    # раздражение вокруг носа и россыпь пост-акне на подбородке занимают
    # изрядный кусок щеки, и на малом радиусе «локальный тон» вбирал эту
    # красноту в себя — отклонения не оставалось, и правка не срабатывала
    # именно на крупных зонах.
    color_r = max(10.0, min(img.size) / 11.0)
    # Радиус точки: отдельный прыщ, точка пост-акне.
    spot_r = max(2.0, min(img.size) / 130.0)
    # Средний радиус для правки яркости — между точкой и пятном.
    mid_r = max(4.0, min(img.size) / 30.0)
    fine_r = max(1.0, min(img.size) / 500.0)

    band = max(64, int(500_000 / max(width, 1)))
    overlap = int(color_r * 3) + 4
    out_img = Image.new("RGB", img.size)

    for top in range(0, height, band):
        bottom = min(height, top + band)
        src_top = max(0, top - overlap)
        src_bottom = min(height, bottom + overlap)
        box = (0, src_top, width, src_bottom)

        arr = np.asarray(img.crop(box), dtype=np.float32)
        alpha = np.asarray(alpha_img.crop(box), dtype=np.float32) / 255.0

        # Опорный тон кожи считаем ВЗВЕШЕННО по маске: радиус большой, и
        # обычное размытие затянуло бы в «тон кожи» волосы, одежду и фон,
        # а у границы лица правка поехала бы по цвету. Веса — сама маска.
        wa = np.maximum(alpha, 1e-3)
        wblur = np.maximum(_blur_gray(wa, color_r, span=1.0), 1e-3)
        base = np.empty_like(arr)
        for ch in range(3):
            base[..., ch] = _blur_gray(arr[..., ch] * wa, color_r) / wblur
        del wa, wblur

        mid = _blur_arr(arr, mid_r)         # фон для пятен пост-акне
        spot = _blur_arr(arr, spot_r)       # фон для точечных дефектов

        y = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]
        y_base = 0.299 * base[..., 0] + 0.587 * base[..., 1] + 0.114 * base[..., 2]
        y_mid = 0.299 * mid[..., 0] + 0.587 * mid[..., 1] + 0.114 * mid[..., 2]
        y_spot = 0.299 * spot[..., 0] + 0.587 * spot[..., 1] + 0.114 * spot[..., 2]

        # Адаптация порогов к освещённости: в тени дефект слабее по контрасту.
        scale = np.clip(y_base / 150.0, 0.40, 1.35)

        # Насколько пиксель краснее локальной кожи. Это главный признак,
        # отличающий дефект от волоса: акне, пост-акне и раздражение —
        # красные, а брови, ресницы и волосы нейтрально-коричневые или
        # серые, то есть по красноте от кожи не отклоняются.
        redness = (arr[..., 0] - arr[..., 2]) - (base[..., 0] - base[..., 2])

        # --- канал цвета: убираем красноту пятен ---
        w_color = np.clip((redness - 0.8 * scale) / (4.5 * scale), 0.0, 1.0)

        # --- канал яркости ---
        # Пятно пост-акне крупнее точки, поэтому фон для него — СРЕДНИЙ
        # радиус (на малом фон темнел вместе с пятном, и правка почти
        # ничего не делала), но не большой: большой снял бы светотень лица.
        # Пропуском служит краснота: без неё (волос, бровь, ресница,
        # контур губ, тень от носа) яркость не трогается вообще.
        # Пропуск не жёсткий: заживший пост-акне на подбородке уже не
        # красный, а коричневатый, и полный запрет по красноте оставлял
        # именно эти точки. Даём базовую долю всем тёмным пятнам, а
        # красным — полную силу.
        red_gate = 0.45 + 0.55 * np.clip((redness + 1.0) / 3.0, 0.0, 1.0)
        w_dark = np.clip((y_mid - y - 1.0 * scale) / (5.0 * scale), 0.0, 1.0)
        w_dark *= red_gate
        # Белые точки и точечный жирный блеск — по малому радиусу, они мелкие.
        w_light = np.clip((y - y_spot - 4.0 * scale) / (12.0 * scale), 0.0, 1.0)
        w_spot = np.maximum(w_dark, w_light * 0.7)

        # Страховка от совсем контрастных структур (ресница на щеке,
        # резкий контур): такого перепада у дефекта кожи не бывает.
        # Порог поднимается на красных участках: воспалённый прыщ может
        # быть не менее контрастным, чем волос, и жёсткая страховка
        # снимала правку ровно с самых заметных дефектов.
        edge = np.abs(y_mid - y)
        limit = (30.0 + 34.0 * red_gate) * scale
        keep = np.clip(1.0 - (edge - limit) / (16.0 * scale), 0.0, 1.0)
        w_color *= keep
        w_spot *= keep
        del (redness, red_gate, w_dark, w_light, edge, limit, keep,
             y, y_base, y_spot, scale)

        # Сглаживаем карты, чтобы правка не оставляла резких краёв.
        w_color = _blur_gray(w_color, max(1.0, spot_r * 1.5), span=1.0)
        w_spot = _blur_gray(w_spot, max(1.0, spot_r), span=1.0)

        wc = (w_color * alpha * strength)[..., None]
        ws = (w_spot * alpha * strength)[..., None]

        # 1. Выравниваем ЦВЕТ, не трогая яркость: из пикселя вычитается его
        #    отклонение по цветовым разностям, светлота остаётся прежней.
        out = arr.copy()
        chroma = arr - arr.mean(axis=-1, keepdims=True)
        chroma_base = base - base.mean(axis=-1, keepdims=True)
        out += (chroma_base - chroma) * wc
        del chroma, chroma_base

        # 2. Гасим дефекты по яркости — подтягиваем светлоту к среднему
        #    радиусу, цвет при этом остаётся своим.
        y_arr = arr.mean(axis=-1, keepdims=True)
        y_m = mid.mean(axis=-1, keepdims=True)
        out += (y_m - y_arr) * ws
        del mid, y_arr, y_m, y_mid

        # Возвращаем поры: слабые высокие частоты, амплитуда ограничена,
        # чтобы вместе с текстурой не вернулось само пятно.
        detail = np.clip(_highpass(arr, fine_r), -3.5, 3.5)
        out += detail * ws * 0.6
        del arr, base, spot, w_color, w_spot, alpha, wc, ws, detail

        chunk = np.clip(out, 0, 255).astype(np.uint8)
        inner = chunk[top - src_top: top - src_top + (bottom - top)]
        out_img.paste(Image.fromarray(inner), (0, top))
        del out, chunk, inner

    alpha_img.close()
    return out_img


def recover_highlights(img: Image.Image, mask_small: np.ndarray,
                       strength: float = 0.6) -> Image.Image:
    """Восстановление пересвета на коже: сжимает света и возвращает объём.

    Пересвеченные зоны (жирный блеск на лбу, носу, скулах) вытянуты в белое
    и теряют цвет. Приводим их яркость к уровню окружающей кожи и
    возвращаем телесный оттенок, взятый из соседних нормальных участков.

    mask_small — маска кожи в уменьшенном разрешении (см. skin_mask_small).
    Финал считается горизонтальными полосами: полнокадровые float32-копии
    (arr, delta, detail, out) в сумме давали ~200 МБ и убивали функцию.
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
    mask_s = _upscale_mask(mask_small, small.size)

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
    # копии и растягивается — она плавная, апскейл её не портит. Держим её
    # как картинки, а не как float32-массивы кадра: разворачиваем по полосам.
    delta_img = Image.fromarray(
        np.clip(local_s - arr_s + 128.0, 0, 255).astype(np.uint8)
    ).resize(img.size, Image.BILINEAR)
    over_img = Image.fromarray(
        (np.clip(over_s, 0, 1) * 255).astype(np.uint8), mode="L"
    ).resize(img.size, Image.BILINEAR)
    del arr_s, local_s, over_s, mask_s, good, w, y, v, s

    width, height = img.size
    radius = max(1.5, min(img.size) / 400.0)
    band = max(64, int(600_000 / max(width, 1)))
    overlap = int(radius * 3) + 2
    out_img = Image.new("RGB", img.size)

    for top in range(0, height, band):
        bottom = min(height, top + band)
        src_top = max(0, top - overlap)
        src_bottom = min(height, bottom + overlap)
        box = (0, src_top, width, src_bottom)

        arr = np.asarray(img.crop(box), dtype=np.float32)
        delta = np.asarray(delta_img.crop(box), dtype=np.float32) - 128.0
        over = np.asarray(over_img.crop(box), dtype=np.float32)[..., None] / 255.0

        # Тянем пересвет к локальному тону кожи, но не полностью: блик
        # должен остаться бликом, иначе лицо станет плоским.
        out = arr + delta * (over * strength * 0.85)
        # Возвращаем микрорельеф, чтобы восстановленная зона не была пятном.
        out += _highpass(arr, radius) * (over * 0.35)
        del arr, delta, over

        chunk = np.clip(out, 0, 255).astype(np.uint8)
        inner = chunk[top - src_top: top - src_top + (bottom - top)]
        out_img.paste(Image.fromarray(inner), (0, top))
        del out, chunk, inner

    return out_img


def blend_skin(original: Image.Image, generated: Image.Image,
               strength: float = 0.8, keep_texture: float = 0.35,
               regions=None, trust_threshold: float = 40.0,
               highlight_recovery: float = 0.6,
               even_out: float = 0.6) -> Image.Image:
    """Вклеивает генеративную ретушь в оригинал только по коже.

    trust_threshold — порог «доверия» к результату модели. Чем выше, тем
    сильнее разрешено менять кожу. На низком пороге защита срабатывала
    даже на нормальной ретуши и возвращала прыщи обратно.

    even_out — сила финального выравнивания кожи (even_out_skin). Модель
    не дочищает дефекты в тенях: там контраст пятна низкий, и она их
    не видит. Этот шаг доводит тон до ровного арифметически, не трогая
    геометрию — форма лица и тела остаются оригинальными.
    """
    strength = float(np.clip(strength, 0.0, 1.0))
    keep_texture = float(np.clip(keep_texture, 0.0, 1.0))

    # Все карты считаем и храним в уменьшенном разрешении. Полнокадровые
    # float32-маски (15 МБ каждая, и их тут четыре) не помещались в лимит
    # функции 256 МБ — процесс убивало по OOM, наружу уходил HTTP 502.
    orig_s = _small(original)
    mask = np.clip(
        skin_mask_small(orig_s) * (1.0 - protect_mask_small(orig_s)), 0.0, 1.0)
    if regions:
        mask *= regions_mask(orig_s.size, regions)

    # Геометрическая страховка. Считаем расхождение по СИЛЬНО размытым
    # версиям кадра: так видно сдвиг черт и формы, но не видно локальных
    # дефектов. Иначе защита срабатывала бы ровно на прыщах — то есть
    # мешала бы убрать именно то, ради чего инструмент и нужен.
    gen_small = generated.resize(orig_s.size, Image.BILINEAR)
    blur_r = max(6.0, min(orig_s.size) / 60.0)
    orig_low = np.asarray(orig_s.filter(ImageFilter.GaussianBlur(radius=blur_r)),
                          dtype=np.float32)
    gen_low = np.asarray(gen_small.filter(ImageFilter.GaussianBlur(radius=blur_r)),
                         dtype=np.float32)
    struct_diff = np.abs(gen_low - orig_low).mean(axis=-1)
    del orig_low, gen_low, gen_small
    trust = np.clip(1.0 - (struct_diff - trust_threshold) / 30.0, 0.0, 1.0)
    trust_img = Image.fromarray((trust * 255).astype(np.uint8), mode="L")
    trust_img = trust_img.filter(ImageFilter.GaussianBlur(radius=blur_r / 2))
    trust = np.asarray(trust_img, dtype=np.float32) / 255.0

    # Карта силы: маленькая, uint8, растягивается на кадр только при чтении
    # очередной полосы — в памяти полного кадра она никогда не лежит.
    alpha_img = Image.fromarray(
        (np.clip(mask * trust * strength, 0.0, 1.0) * 255).astype(np.uint8),
        mode="L").resize(original.size, Image.BILINEAR)
    skin_for_highlights = mask
    del trust, struct_diff, trust_img

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

        alpha = np.asarray(alpha_img.crop(box),
                           dtype=np.float32)[..., None] / 255.0
        chunk = orig * (1.0 - alpha) + gen_final * alpha
        del orig, gen, gen_final, alpha

        chunk = np.clip(chunk, 0, 255).astype(np.uint8)
        inner = chunk[top - src_top: top - src_top + (bottom - top)]
        out_img.paste(Image.fromarray(inner), (0, top))
        del chunk, inner

    alpha_img.close()
    del alpha_img

    if highlight_recovery > 0.01:
        out_img = recover_highlights(out_img, skin_for_highlights,
                                     strength=highlight_recovery)

    # Финальная добивка по всей коже — она же вычищает тени, куда модель
    # не дотянулась. Идёт последней, чтобы выровнять и то, что осталось
    # после композита, и стыки восстановленного пересвета.
    if even_out > 0.01:
        out_img = even_out_skin(out_img, skin_for_highlights, strength=even_out)

    return out_img


def mask_preview(img: Image.Image, regions=None) -> Image.Image:
    """Отладка: показывает, что именно считается кожей."""
    mask = build_skin_mask(img) * (1.0 - build_protect_mask(img))
    if regions:
        mask = mask * regions_mask(img.size, regions)
    return Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8), mode="L")