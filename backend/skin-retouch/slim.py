"""Генеративная «пластика» по маске: фотограф закрашивает кистью места,
которые надо схуднуть (объём руки, складки спины, бока), модель
перерисовывает только эту зону, а мы вклеиваем её обратно по маске.

Почему кроп, а не весь кадр: модель работает примерно в 1–2K, и на полном
кадре рука занимает мало пикселей — детали кружева и контура теряются.
Кроп вокруг маски с запасом даёт модели крупный план и контекст по краям,
а вне маски пиксели остаются оригинальными 1:1.
"""
import os
import io
import base64
import requests

GPTUNNEL_KEY = os.environ.get("GPTUNNEL_API_KEY", "")
BASE_URL = "https://gptunnel.ru/api/v2/media"

PRICE = int(os.environ.get("SLIM_PRICE", "25"))

# Цепочка: Pro лучше всех держит текстуру ткани и не «дорисовывает» лишнего.
MODELS = {
    "nano-banana-pro": {"resolution": "2K", "aspect_ratio": "auto", "output_format": "jpg"},
    "nano-banana-2": {"resolution": "2K", "aspect_ratio": "auto", "output_format": "jpg"},
    "nano-banana": {"aspect_ratio": "auto"},
}
CHAIN = ["nano-banana-pro", "nano-banana-2", "nano-banana"]

CROP_MAX_SIDE = 1536
# Запас вокруг маски: модели нужен контекст, иначе контур «рвётся» на краю
CROP_PAD = 0.35

# Лимит провайдера — 800 символов. IMAGE 1 — что правим, IMAGE 2 — где.
# Зона уже сужена деформацией на фронте, модель доводит её до естественного вида:
# одной подсказки «сделай тоньше» Nano Banana не слушается и возвращает то же фото.
def _slim_words(amount: int) -> str:
    """Процент ползунка → словесная степень: модель плохо понимает числа."""
    if amount <= 0:
        return "Keep the same thickness, only make the outline straight and smooth."
    if amount <= 15:
        return f"Make it slightly slimmer (about {amount}% narrower)."
    if amount <= 40:
        return f"Make it noticeably slimmer (about {amount}% narrower)."
    return f"Make it clearly slimmer (about {min(amount, 60)}% narrower), still natural."


_COLORS = [
    ("white", (235, 235, 235)), ("ivory", (235, 225, 205)), ("beige", (205, 185, 160)),
    ("light grey", (180, 180, 180)), ("grey", (120, 120, 120)), ("black", (25, 25, 25)),
    ("dark brown", (70, 45, 30)), ("brown", (130, 85, 55)), ("red", (180, 40, 40)),
    ("burgundy", (100, 25, 40)), ("pink", (225, 160, 175)), ("orange", (220, 130, 50)),
    ("yellow", (220, 200, 70)), ("green", (60, 130, 70)), ("dark green", (30, 65, 40)),
    ("light blue", (150, 185, 220)), ("blue", (50, 90, 170)), ("navy", (25, 35, 75)),
    ("purple", (110, 60, 140)), ("skin tone", (215, 170, 140)),
]


def describe_zone(crop, mask) -> str:
    """Словесное описание того, что под маской: цвет и характер фактуры.

    Одежда на каждом фото своя (кружево, трикотаж, атлас, джинса, голая кожа),
    поэтому ткань не прописываем жёстко, а меряем по оригиналу: медианный цвет
    зоны и силу мелкой детали (насколько зона отличается от своей размытой копии).
    """
    import numpy as np
    from PIL import ImageFilter
    k = min(1.0, 384 / max(crop.size))
    sz = (max(8, round(crop.width * k)), max(8, round(crop.height * k)))
    c = crop.resize(sz)
    m = np.asarray(mask.resize(sz)) > 127
    if m.sum() < 30:
        return "Keep the same clothing or skin as in IMAGE 1."
    px = np.asarray(c, dtype=np.float32)[m]
    med = np.median(px, axis=0)
    name = min(_COLORS, key=lambda t: sum((a - b) ** 2 for a, b in zip(med, t[1])))[0]
    g = c.convert("L")
    ga = np.asarray(g, dtype=np.float32)
    gb = np.asarray(g.filter(ImageFilter.GaussianBlur(2)), dtype=np.float32)
    detail = float(np.abs(ga - gb)[m].mean())
    if detail > 7:
        tex = "a fine detailed pattern (lace, embroidery, knit or print)"
    elif detail > 3.5:
        tex = "a visible fabric texture or weave"
    else:
        tex = "a smooth surface (smooth fabric or skin)"
    return f"There it is mostly {name}, {tex}."


def slim_prompt(amount: int, zone: str) -> str:
    # Лимит провайдера — 800 символов. Маска — отдельная ч/б картинка, а не
    # цветная заливка поверх фото: заливка протекала в результат розовым.
    return (
        "Professional body retouch. IMAGE 2 is a black/white mask: edit IMAGE 1 only "
        "inside the WHITE area. Redraw the body part there (arm, waist or back) slimmer "
        "and toned, with a clean smooth outline: no bulges, dents or fat rolls. "
        + _slim_words(amount) + " " + zone + " "
        "Keep exactly the clothing or skin IMAGE 1 shows there: same fabric, pattern, "
        "texture, sharpness and color. Fill freed space with the matching background. "
        "Do NOT change colors, tint, brightness or white balance. Outside the white "
        "area keep IMAGE 1 identical. Same framing, photorealistic, no text."
    )


# Режим «Разгладить»: зона на фото замазана размытым окружением (без цветной
# заливки), маска идёт отдельной ч/б картинкой. Модель не видит складку
# и рисует место заново по краям — в настоящих цветах одежды.
def redraw_prompt(zone: str) -> str:
    return (
        "Inpainting. IMAGE 2 is a black/white mask; in IMAGE 1 the WHITE area is blurred. "
        "Repaint only that area as a seamless continuation of the clothing or skin around "
        "it. " + zone + " Same fabric, pattern, texture, sharpness, color and light, lying "
        "smooth on a slim body: no fat folds, bulges, creases, shadow hollows or skin rolls. "
        "Clean straight contours, no new objects. Do NOT change colors or white balance. "
        "Outside the white area keep IMAGE 1 identical. Same framing, photorealistic, "
        "no blur left, no text."
    )


def _headers():
    return {"Authorization": GPTUNNEL_KEY, "Content-Type": "application/json"}


def next_model(current: str):
    if current in CHAIN:
        i = CHAIN.index(current)
        return CHAIN[i + 1] if i + 1 < len(CHAIN) else None
    return None


# ---------- геометрия ----------
def _load(image_b64: str, mask_b64: str):
    from PIL import Image
    img = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
    m = Image.open(io.BytesIO(base64.b64decode(mask_b64)))
    # Маска с фронта — белое на прозрачном; берём альфу, если она есть
    if m.mode in ("RGBA", "LA"):
        m = m.getchannel("A")
    else:
        m = m.convert("L")
    if m.size != img.size:
        m = m.resize(img.size, Image.BILINEAR)
    m = m.point(lambda v: 255 if v > 40 else 0)
    return img, m


def crop_box(size, mask):
    box = mask.getbbox()
    if not box:
        raise ValueError("маска пустая — закрасьте кистью места, которые нужно схуднуть")
    W, H = size
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    side = max(w, h) * (1 + CROP_PAD * 2)
    side = max(side, min(W, H) * 0.35)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    cw, ch = min(W, side), min(H, side)
    nx0 = min(max(0, cx - cw / 2), W - cw)
    ny0 = min(max(0, cy - ch / 2), H - ch)
    return (int(nx0), int(ny0), int(nx0 + cw), int(ny0 + ch))


def _jpeg(img, q=92) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=q)
    return base64.b64encode(buf.getvalue()).decode()


def _blur_hole(crop, hole):
    """Замазывает зону размытым окружением — без цветной заливки.

    Модель не видит складку, но видит настоящие цвета ткани вокруг.
    Размываем на мелкой копии (дёшево), затем растягиваем обратно.
    """
    from PIL import Image, ImageFilter
    k = min(1.0, 256 / max(crop.size))
    sz = (max(8, round(crop.width * k)), max(8, round(crop.height * k)))
    small = crop.resize(sz, Image.BILINEAR)
    r = max(4, int(max(sz) * 0.06))
    soft = small.filter(ImageFilter.GaussianBlur(r)).resize(crop.size, Image.BILINEAR)
    return Image.composite(soft, crop, hole)


def build_inputs(image_b64: str, mask_b64: str, mode: str = "slim"):
    """Кроп фото (в настоящих цветах) + отдельная ч/б маска той же зоны.

    slim   — фото как есть: модель видит тело и одежду и доводит суженный контур;
    redraw — зона на фото замазана размытым окружением: складки не видно.
    Возвращает (фото, маска, словесное описание одежды под маской).
    """
    from PIL import Image, ImageFilter
    img, mask = _load(image_b64, mask_b64)
    box = crop_box(img.size, mask)
    crop = img.crop(box)
    mcrop = mask.crop(box)
    zone = describe_zone(crop, mcrop)
    if mode == "redraw":
        # Чуть шире маски: тень от складки на краю тоже должна исчезнуть
        hole = mcrop.filter(ImageFilter.MaxFilter(7))
        crop = _blur_hole(crop, hole)
        marked = hole.convert("RGB")
    else:
        marked = mcrop.filter(ImageFilter.MaxFilter(9)).convert("RGB")
    if max(crop.size) > CROP_MAX_SIDE:
        k = CROP_MAX_SIDE / max(crop.size)
        sz = (round(crop.width * k), round(crop.height * k))
        crop = crop.resize(sz, Image.LANCZOS)
        marked = marked.resize(sz, Image.LANCZOS)
    return _jpeg(crop), _jpeg(marked), zone


# ---------- провайдер ----------
def start(image_b64: str, mask_b64: str, model: str = None, mode: str = "slim", amount: int = 0):
    """Запускает модель; при ошибке старта пробует следующую по цепочке."""
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    crop_b64, marked_b64, zone = build_inputs(image_b64, mask_b64, mode)
    prompt = redraw_prompt(zone) if mode == "redraw" else slim_prompt(amount, zone)
    print(f"[SLIM] mode={mode} zone='{zone}' prompt_len={len(prompt)}")
    # В обоих режимах: IMAGE 1 — фото в настоящих цветах, IMAGE 2 — ч/б маска.
    # В redraw складка на фото уже замазана, оригинал модели не передаём.
    images = [crop_b64, marked_b64]
    name = model or CHAIN[0]
    last = None
    while name:
        try:
            r = requests.post(
                f"{BASE_URL}/tasks",
                json={
                    "model": name,
                    "prompt": prompt,
                    "params": MODELS[name],
                    "inputs": {"image_input": [f"data:image/jpeg;base64,{b}" for b in images]},
                },
                headers=_headers(),
                timeout=60,
            )
            if r.status_code not in (200, 201):
                raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
            task_id = r.json().get("id")
            if not task_id:
                raise RuntimeError("GPTunneL не вернул id задачи")
            return task_id, name
        except Exception as e:
            print(f"[SLIM] start {name} failed: {e}")
            last = e
            name = next_model(name)
    raise last or RuntimeError("нет доступных моделей")


def poll(task_id: str) -> dict:
    r = requests.get(f"{BASE_URL}/tasks/{task_id}", headers=_headers(), timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    data = r.json()
    status = data.get("status")
    out = {"status": status, "url": None, "error": None}
    if status == "done":
        res = data.get("result") or []
        if res and res[0].get("url"):
            out["url"] = res[0]["url"]
        else:
            out.update(status="failed", error="пустой результат")
    elif status == "failed":
        err = data.get("error") or {}
        out["error"] = err.get("message") or "модель не справилась"
    return out


# ---------- сборка ----------
def compose(image_b64: str, mask_b64: str, result_url: str) -> str:
    """Вклеивает перерисованную зону в фото по расширенной маске с мягким краем."""
    import numpy as np
    from PIL import Image, ImageFilter

    r = requests.get(result_url, timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"не скачался результат: {r.status_code}")

    img, mask = _load(image_b64, mask_b64)
    box = crop_box(img.size, mask)
    cw, ch = box[2] - box[0], box[3] - box[1]
    gen = Image.open(io.BytesIO(r.content)).convert("RGB").resize((cw, ch), Image.LANCZOS)
    orig = img.crop(box)
    m = mask.crop(box)

    # Маску считаем на мелкой копии — MaxFilter/Blur на полном кропе дорогие,
    # а лимит функции 5 секунд.
    k = min(1.0, 320 / max(cw, ch))
    sw, sh = max(8, round(cw * k)), max(8, round(ch * k))
    small = m.resize((sw, sh), Image.BILINEAR).point(lambda v: 255 if v > 60 else 0)
    bw = small.getbbox()
    size = max(bw[2] - bw[0], bw[3] - bw[1]) if bw else max(sw, sh)
    # Расширяем: схуднённый контур уходит внутрь, и фон за старым контуром
    # тоже должен прийти из генерации — иначе останется «призрак» руки.
    grow = max(3, int(size * 0.12)) | 1
    left = grow
    while left > 1:
        step = min(left, 15) | 1
        small = small.filter(ImageFilter.MaxFilter(step))
        left -= step - 1
    feather = max(2, int(size * 0.05))
    soft = small.filter(ImageFilter.GaussianBlur(feather)).resize((cw, ch), Image.BILINEAR)

    # Модель сдвигает цвета всего кадра. Вне маски она должна была вернуть
    # оригинал, поэтому по этим пикселям подбираем линейную поправку
    # (gain + offset на канал) и применяем её ко всей генерации.
    a = np.asarray(soft.resize((sw, sh), Image.BILINEAR), dtype=np.float32) / 255
    o = np.asarray(orig.resize((sw, sh), Image.BILINEAR), dtype=np.float32)
    g = np.asarray(gen.resize((sw, sh), Image.BILINEAR), dtype=np.float32)
    outside = a < 0.02
    g_full = np.asarray(gen, dtype=np.float32)
    if outside.sum() > 200:
        for c in range(3):
            go, oo = g[..., c][outside], o[..., c][outside]
            gs = go.std()
            gain = float(np.clip(oo.std() / gs, 0.8, 1.25)) if gs > 1 else 1.0
            off = float(oo.mean() - go.mean() * gain)
            g_full[..., c] = g_full[..., c] * gain + off
        g_full = np.clip(g_full, 0, 255)
        g = np.asarray(
            Image.fromarray(g_full.astype(np.uint8), "RGB").resize((sw, sh), Image.BILINEAR),
            dtype=np.float32)

    # Внутри маски модель любит «подогреть» белое кружево в розовый.
    # Сравниваем средний оттенок зоны с оригиналом той же зоны и снимаем
    # лишний сдвиг по каналам (яркость не трогаем — форма зоны могла измениться).
    inside = a > 0.5
    if inside.sum() > 100:
        go = g[inside].mean(axis=0)
        oo = o[inside].mean(axis=0)
        shift = (go - go.mean()) - (oo - oo.mean())  # разница оттенка, без яркости
        shift = np.clip(shift, -25, 25)
        g_full = np.clip(g_full - shift.reshape(1, 1, 3), 0, 255)
        # Светлые пиксели (белая ткань) дополнительно приводим к нейтрали оригинала
        lum = g_full.mean(axis=2, keepdims=True)
        o_light = o[inside & (o.mean(axis=2) > 200)]
        if len(o_light) > 50:
            tint = o_light.mean(axis=0) - o_light.mean()
            w = np.clip((lum - 190) / 40, 0, 1)
            neutral = lum + tint.reshape(1, 1, 3)
            g_full = np.clip(g_full * (1 - w * 0.7) + neutral * (w * 0.7), 0, 255)
    gen = Image.fromarray(g_full.astype(np.uint8), "RGB")

    merged = Image.composite(gen, orig, soft)
    out = img.copy()
    out.paste(merged, box[:2])
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=94)
    return base64.b64encode(buf.getvalue()).decode()