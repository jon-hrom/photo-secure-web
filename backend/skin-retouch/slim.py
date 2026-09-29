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
PROMPT = (
    "Photo retouch. IMAGE 2 marks the edit area in magenta; edit IMAGE 1 only there. "
    "The body there was already slimmed with liquify. Finish it like a pro retoucher: "
    "make the arm and back contour smooth, straight and slim, remove every fat roll, bulge "
    "and fold where the dress presses into the body, make the back flat and even. "
    "Keep the slimmer shape, never make it wider. Keep the same dress: same lace pattern, "
    "seams, fabric, folds of fabric only where natural. Do NOT change colors, white balance, "
    "brightness, contrast or saturation anywhere. Everything outside the magenta area stays "
    "pixel-identical. Same framing and size, photorealistic, no magenta, no text."
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


def build_inputs(image_b64: str, mask_b64: str):
    """Кроп фото и та же зона с пурпурной подсветкой маски."""
    from PIL import Image
    img, mask = _load(image_b64, mask_b64)
    box = crop_box(img.size, mask)
    crop = img.crop(box)
    mcrop = mask.crop(box)
    marker = Image.new("RGB", crop.size, (255, 0, 255))
    marked = Image.composite(Image.blend(crop, marker, 0.55), crop, mcrop)
    if max(crop.size) > CROP_MAX_SIDE:
        k = CROP_MAX_SIDE / max(crop.size)
        sz = (round(crop.width * k), round(crop.height * k))
        crop = crop.resize(sz, Image.LANCZOS)
        marked = marked.resize(sz, Image.LANCZOS)
    return _jpeg(crop), _jpeg(marked)


# ---------- провайдер ----------
def start(image_b64: str, mask_b64: str, model: str = None):
    """Запускает модель; при ошибке старта пробует следующую по цепочке."""
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    crop_b64, marked_b64 = build_inputs(image_b64, mask_b64)
    name = model or CHAIN[0]
    last = None
    while name:
        try:
            r = requests.post(
                f"{BASE_URL}/tasks",
                json={
                    "model": name,
                    "prompt": PROMPT,
                    "params": MODELS[name],
                    "inputs": {"image_input": [
                        f"data:image/jpeg;base64,{crop_b64}",
                        f"data:image/jpeg;base64,{marked_b64}",
                    ]},
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
    gen = Image.fromarray(g_full.astype(np.uint8), "RGB")

    merged = Image.composite(gen, orig, soft)
    out = img.copy()
    out.paste(merged, box[:2])
    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=94)
    return base64.b64encode(buf.getvalue()).decode()
