"""Перенос лица с фото-донора на целевое фото.

Схема:
  1. С донора вырезаем лицо по маске фотографа (остальное приглушаем серым, чтобы
     модель не перепутала лица, если на фото донора их несколько).
  2. На целевом фото вырезаем область вокруг закрашенного лица с запасом контекста.
  3. Мультимодальная модель редактирования (nano-banana-pro → nano-banana на Replicate,
     резерв — GPTunneL) переписывает лицо: личность донора, но поза, свет, ракурс,
     выражение и СТИЛЬ целевого кадра (рисунок остаётся рисунком, фото — фото).
  4. Результат вклеиваем обратно в оригинал по расширенной маске с мягким краем
     и выравниванием цвета — всё за пределами области остаётся 1:1.
"""
import os
import io
import base64
import requests

GPTUNNEL_KEY = os.environ.get("GPTUNNEL_API_KEY", "")
GPT_BASE = "https://gptunnel.ru/api/v2/media"

REPLICATE_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "")
REPLICATE_API = "https://api.replicate.com/v1"
REPLICATE_MODELS = {
    "nano-banana-pro": "google/nano-banana-pro",
    "nano-banana": "google/nano-banana",
}

# Модели GPTunneL для переноса. nano-banana-pro (Gemini 3 Pro Image) заметно лучше
# держит сходство лица, чем обычная nano-banana, которая давала «похожую, но другую» женщину.
GPT_MODELS = {
    "gpt-nano-banana-pro": {"model": "nano-banana-pro",
                            "params": {"resolution": "2K", "aspect_ratio": "auto", "output_format": "jpg"}},
    "gpt-nano-banana-2": {"model": "nano-banana-2",
                          "params": {"resolution": "2K", "aspect_ratio": "auto", "output_format": "jpg"}},
    "gpt-nano-banana": {"model": "nano-banana", "params": {"aspect_ratio": "auto"}},
}

# Replicate-токен сейчас недействителен (401), поэтому основной путь — GPTunneL.
_CHAIN_GPTUNNEL = ["gpt-nano-banana-pro", "gpt-nano-banana-2", "gpt-nano-banana"]
_CHAIN_REPLICATE = ["gpt-nano-banana-pro", "nano-banana-pro", "gpt-nano-banana-2", "gpt-nano-banana"]


def _chain():
    return _CHAIN_REPLICATE if REPLICATE_TOKEN else _CHAIN_GPTUNNEL


MODEL = os.environ.get("FACE_SWAP_MODEL") or _chain()[0]
PRICE = int(os.environ.get("FACE_SWAP_PRICE", "30"))
LABEL = "Перенос лица"
HINT = "Лицо донора органично встанет на целевое фото в его стиле"

# Меньше вход — быстрее провайдер принимает задачу (лимит функции ~5 c).
TARGET_MAX_SIDE = 1152
DONOR_MAX_SIDE = 768

# Промпты держим < 800 символов (лимит GPTunneL).
PROMPT = (
    "Face swap. IMAGE 1 = target. IMAGE 2 = identity reference (ignore grey). "
    "Replace the face in IMAGE 1 with the exact face of the woman/man from IMAGE 2 so she is instantly "
    "recognizable: same face shape, jaw, eye shape and spacing, nose, lips, brows, cheekbones, age, "
    "moles. Render it highly detailed and lifelike, realistic facial anatomy and fine features, "
    "but in the same medium and technique as IMAGE 1 (if illustration: same line work, soft shading, "
    "palette; if photo: photorealistic). Keep IMAGE 1 hairstyle, glasses, head pose, expression, "
    "light, body, clothes, background, framing. No text."
)

# Режим «лицо + волосы»: причёска тоже берётся с донора — так узнаваемость максимальная.
PROMPT_HAIR = (
    "Head swap. IMAGE 1 = target. IMAGE 2 = identity reference (ignore grey). "
    "Replace the head in IMAGE 1 with the person from IMAGE 2 so she is instantly recognizable: "
    "exact face shape, jaw, eyes, nose, lips, brows, cheekbones, age, moles AND her exact hairstyle: "
    "hair colour, length, cut, fringe, parting, volume. Ignore sunglasses or hats on her head. "
    "Highly detailed, lifelike anatomy, but drawn in the same medium and technique as IMAGE 1 "
    "(illustration: same line work, shading, palette; photo: photorealistic). Keep IMAGE 1 eyeglasses, "
    "head pose, light, body, clothes, background, framing. No text."
)

# Если средняя разница в зоне лица меньше порога — модель фактически ничего не сделала.
UNCHANGED_THRESHOLD = float(os.environ.get("FACE_SWAP_MIN_DIFF", "6"))


class UnchangedResult(Exception):
    """Модель вернула кадр без заметной замены лица."""


def _headers_gpt():
    return {"Authorization": GPTUNNEL_KEY, "Content-Type": "application/json"}


def _rep_headers():
    return {"Authorization": f"Bearer {REPLICATE_TOKEN}"}


def next_model(current: str):
    chain = _chain()
    if current in chain:
        i = chain.index(current)
        return chain[i + 1] if i + 1 < len(chain) else None
    return None


# ---------- Геометрия ----------
def _open_rgb(b64: str):
    from PIL import Image
    return Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")


def _open_mask(b64: str, size):
    from PIL import Image
    m = Image.open(io.BytesIO(base64.b64decode(b64))).convert("L")
    if m.size != size:
        m = m.resize(size, Image.LANCZOS)
    return m.point(lambda v: 255 if v > 40 else 0)


def _bbox(mask):
    box = mask.getbbox()
    if not box:
        raise ValueError("маска пустая — закрасьте лицо кистью")
    return box


def _expand_box(box, size, factor: float, min_side: int = 0, square: bool = True):
    """Расширяет рамку вокруг центра в factor раз, по возможности квадратно, не выходя за кадр."""
    W, H = size
    x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    w, h = (x1 - x0) * factor, (y1 - y0) * factor
    if square:
        w = h = max(w, h)
    w, h = max(w, min_side), max(h, min_side)
    w, h = min(w, W), min(h, H)
    nx0 = min(max(0, cx - w / 2), W - w)
    ny0 = min(max(0, cy - h / 2), H - h)
    return (int(round(nx0)), int(round(ny0)), int(round(nx0 + w)), int(round(ny0 + h)))


def target_region(target_b64: str, target_mask_b64: str, with_hair: bool = False):
    """Возвращает (оригинал, маска, рамка кропа). Детерминировано — нужно и на старте, и при сборке."""
    original = _open_rgb(target_b64)
    mask = _open_mask(target_mask_b64, original.size)
    box = _bbox(mask)
    side = min(original.size)
    crop_box = _expand_box(box, original.size, 3.0 if with_hair else 2.4, min_side=min(side, 384))
    return original, mask, crop_box


def build_donor(donor_b64: str, donor_mask_b64: str, with_hair: bool = False) -> bytes:
    """Вырезка лица донора: вне закрашенного — нейтрально-серый, чтобы не путать лица.
    В режиме с волосами открываем широкий овал вокруг головы, чтобы причёска попала целиком."""
    from PIL import Image, ImageFilter, ImageDraw, ImageChops

    donor = _open_rgb(donor_b64)
    mask = _open_mask(donor_mask_b64, donor.size)
    box = _bbox(mask)
    size = max(box[2] - box[0], box[3] - box[1])
    grow = max(9, int(size * 0.12) | 1)
    region = mask.filter(ImageFilter.MaxFilter(min(grow, 61)))
    if with_hair:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        w, h = (box[2] - box[0]), (box[3] - box[1])
        head = Image.new("L", donor.size, 0)
        ImageDraw.Draw(head).ellipse(
            (cx - w * 1.05, cy - h * 1.15, cx + w * 1.05, cy + h * 1.05), fill=255)
        region = ImageChops.lighter(region, head)
    soft = region.filter(ImageFilter.GaussianBlur(6 if not with_hair else 10))
    grey = Image.new("RGB", donor.size, (128, 128, 128))
    isolated = Image.composite(donor, grey, soft)
    crop = isolated.crop(_expand_box(box, donor.size, 2.4 if with_hair else 1.5))
    if max(crop.size) > DONOR_MAX_SIDE:
        crop.thumbnail((DONOR_MAX_SIDE, DONOR_MAX_SIDE), Image.LANCZOS)
    elif max(crop.size) < 512:
        s = 512 / max(crop.size)
        crop = crop.resize((round(crop.width * s), round(crop.height * s)), Image.LANCZOS)
    return _to_bytes(crop, "JPEG", 90)


def build_target(target_b64: str, target_mask_b64: str, with_hair: bool = False) -> bytes:
    from PIL import Image
    original, _, crop_box = target_region(target_b64, target_mask_b64, with_hair)
    crop = original.crop(crop_box)
    if max(crop.size) > TARGET_MAX_SIDE:
        crop.thumbnail((TARGET_MAX_SIDE, TARGET_MAX_SIDE), Image.LANCZOS)
    elif max(crop.size) < 768:
        s = 768 / max(crop.size)
        crop = crop.resize((round(crop.width * s), round(crop.height * s)), Image.LANCZOS)
    return _to_bytes(crop, "JPEG", 90)


def _to_bytes(img, fmt: str, quality: int = 93) -> bytes:
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.save(buf, format="JPEG", quality=quality)
    else:
        img.save(buf, format=fmt)
    return buf.getvalue()


def validate_inputs(donor_b64, donor_mask_b64, target_b64, target_mask_b64, with_hair: bool = False):
    build_donor(donor_b64, donor_mask_b64, with_hair)
    target_region(target_b64, target_mask_b64)


# ---------- Replicate ----------
def _rep_upload(data: bytes, filename: str) -> str:
    r = requests.post(
        f"{REPLICATE_API}/files",
        headers=_rep_headers(),
        files={"content": (filename, data, "image/jpeg")},
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Replicate upload {r.status_code}: {r.text[:300]}")
    url = (r.json().get("urls") or {}).get("get")
    if not url:
        raise RuntimeError("Replicate не вернул ссылку на файл")
    return url


def _rep_start(model: str, target_bytes: bytes, donor_bytes: bytes, prompt: str = PROMPT) -> str:
    if not REPLICATE_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN не задан")
    t_url = _rep_upload(target_bytes, "target.jpg")
    d_url = _rep_upload(donor_bytes, "donor.jpg")
    inp = {
        "prompt": prompt,
        "image_input": [t_url, d_url],
        "aspect_ratio": "match_input_image",
        "output_format": "png",
    }
    if model == "nano-banana-pro":
        inp["resolution"] = "2K"
        inp["safety_filter_level"] = "block_only_high"
    r = requests.post(
        f"{REPLICATE_API}/models/{REPLICATE_MODELS[model]}/predictions",
        headers={**_rep_headers(), "Content-Type": "application/json"},
        json={"input": inp},
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Replicate {r.status_code}: {r.text[:300]}")
    pid = r.json().get("id")
    if not pid:
        raise RuntimeError("Replicate не вернул id задачи")
    return f"rep:{pid}"


def _rep_poll(pid: str) -> dict:
    r = requests.get(f"{REPLICATE_API}/predictions/{pid}", headers=_rep_headers(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"Replicate {r.status_code}: {r.text[:300]}")
    data = r.json()
    st = data.get("status")
    out = {"status": "processing", "url": None, "error": None}
    if st == "succeeded":
        res = data.get("output")
        if isinstance(res, list):
            res = res[0] if res else None
        if isinstance(res, dict):
            res = res.get("url") or res.get("image")
        if not res:
            out.update(status="failed", error="пустой результат")
        else:
            out.update(status="done", url=res)
    elif st in ("failed", "canceled"):
        out.update(status="failed", error=str(data.get("error") or "модель не справилась")[:300])
    return out


# ---------- GPTunneL ----------
def _gpt_start(name: str, target_bytes: bytes, donor_bytes: bytes, prompt: str = PROMPT) -> str:
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    t = base64.b64encode(target_bytes).decode()
    d = base64.b64encode(donor_bytes).decode()
    r = requests.post(
        f"{GPT_BASE}/tasks",
        json={
            "model": GPT_MODELS[name]["model"],
            "prompt": prompt,
            "params": GPT_MODELS[name]["params"],
            "inputs": {"image_input": [f"data:image/jpeg;base64,{t}", f"data:image/jpeg;base64,{d}"]},
        },
        headers=_headers_gpt(),
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    task_id = r.json().get("id")
    if not task_id:
        raise RuntimeError("GPTunneL не вернул id задачи")
    return task_id


def _gpt_poll(task_id: str) -> dict:
    r = requests.get(f"{GPT_BASE}/tasks/{task_id}", headers=_headers_gpt(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    data = r.json()
    status = data.get("status")
    out = {"status": status, "url": None, "error": None}
    if status == "done":
        results = data.get("result") or []
        if not results:
            out.update(status="failed", error="пустой результат")
        else:
            out["url"] = results[0].get("url")
    elif status == "failed":
        err = data.get("error") or {}
        out["error"] = err.get("message") or "модель не справилась"
    return out


# ---------- Общий интерфейс ----------
def start_with_fallback(donor_b64, donor_mask_b64, target_b64, target_mask_b64, model: str = None,
                        with_hair: bool = False):
    donor_bytes = build_donor(donor_b64, donor_mask_b64, with_hair)
    target_bytes = build_target(target_b64, target_mask_b64, with_hair)
    prompt = PROMPT_HAIR if with_hair else PROMPT
    name = model or MODEL
    last_err = None
    while name:
        try:
            if name in REPLICATE_MODELS:
                return _rep_start(name, target_bytes, donor_bytes, prompt), name
            return _gpt_start(name, target_bytes, donor_bytes, prompt), name
        except Exception as e:
            print(f"[face-swap] start {name} failed: {e}")
            last_err = e
            name = next_model(name)
    raise last_err or RuntimeError("нет доступных моделей")


def poll_task(task_id: str) -> dict:
    if task_id.startswith("rep:"):
        return _rep_poll(task_id[4:])
    return _gpt_poll(task_id)


def _match_colors(original, generated, blend_mask):
    """Выравнивает цвет/яркость сгенерированного кропа по кольцу вокруг маски вклейки."""
    import numpy as np
    from PIL import Image, ImageFilter

    w, h = original.size
    k = min(1.0, 256 / max(w, h))
    sz = (max(8, round(w * k)), max(8, round(h * k)))
    o = np.asarray(original.resize(sz, Image.BILINEAR), dtype=np.float32)
    g_small = np.asarray(generated.resize(sz, Image.BILINEAR), dtype=np.float32)
    m_small = blend_mask.resize(sz, Image.BILINEAR)
    inner = np.asarray(m_small, dtype=np.float32) > 200
    outer = np.asarray(m_small.filter(ImageFilter.MaxFilter(7)), dtype=np.float32) > 10
    ring = outer & ~inner
    if ring.sum() < 50:
        ring = ~inner
    if ring.sum() < 50:
        return generated
    diff = (o[ring] - g_small[ring]).mean(axis=0)
    diff = np.clip(diff, -30, 30)
    out = np.asarray(generated, dtype=np.float32) + diff[None, None, :]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def compose(target_b64: str, target_mask_b64: str, result_url: str, with_hair: bool = False) -> str:
    """Вклеивает переписанную область в оригинал с мягким краем."""
    from PIL import Image, ImageFilter

    headers = _rep_headers() if result_url.startswith(REPLICATE_API) else {}
    r = requests.get(result_url, headers=headers, timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"не скачался результат: {r.status_code}")

    original, mask, crop_box = target_region(target_b64, target_mask_b64, with_hair)
    cw, ch = crop_box[2] - crop_box[0], crop_box[3] - crop_box[1]
    generated = Image.open(io.BytesIO(r.content)).convert("RGB").resize((cw, ch), Image.LANCZOS)
    orig_crop = original.crop(crop_box)
    mask_crop = mask.crop(crop_box)

    # Зона вклейки считается на уменьшенной копии (~256 px): MaxFilter/Blur на полном
    # кропе съедали 2+ секунды из 5-секундного лимита функции.
    from PIL import ImageDraw, ImageChops
    face_box = mask_crop.getbbox() or (0, 0, cw, ch)
    face_size = max(face_box[2] - face_box[0], face_box[3] - face_box[1])
    k = min(1.0, 256 / max(cw, ch))
    sw, sh = max(8, round(cw * k)), max(8, round(ch * k))
    small = mask_crop.resize((sw, sh), Image.BILINEAR).point(lambda v: 255 if v > 100 else 0)
    grow_s = max(3, int(face_size * k * (0.9 if with_hair else 0.35)) | 1)
    remaining = grow_s
    while remaining > 1:
        step = min(remaining, 21) | 1
        small = small.filter(ImageFilter.MaxFilter(step))
        remaining -= step - 1
    if with_hair:
        # Причёска донора может быть длиннее/пышнее — открываем овал головы вниз до плеч
        fx0, fy0, fx1, fy1 = [v * k for v in face_box]
        fw, fh = fx1 - fx0, fy1 - fy0
        fcx = (fx0 + fx1) / 2
        head = Image.new("L", (sw, sh), 0)
        ImageDraw.Draw(head).ellipse((fcx - fw * 1.15, fy0 - fh * 0.75, fcx + fw * 1.15, fy1 + fh * 1.1), fill=255)
        small = ImageChops.lighter(small, head)
    feather_s = max(2, int(face_size * k * (0.12 if with_hair else 0.08)))
    edge = Image.new("L", (sw, sh), 0)
    pad = feather_s * 2 + 1
    edge.paste(255, (pad, pad, max(pad + 1, sw - pad), max(pad + 1, sh - pad)))
    small = ImageChops.multiply(small, edge)
    blend = small.resize((cw, ch), Image.BILINEAR)
    soft = small.filter(ImageFilter.GaussianBlur(feather_s)).resize((cw, ch), Image.BILINEAR)

    # Проверка: изменилось ли лицо вообще (сравниваем по исходной маске лица)
    import numpy as np
    inner = np.asarray(mask_crop, dtype=np.uint8) > 128
    if inner.sum() > 50:
        g_arr = np.asarray(generated, dtype=np.float32)[inner]
        o_arr = np.asarray(orig_crop, dtype=np.float32)[inner]
        diff = float(np.abs(g_arr - o_arr).mean())
        print(f"[face-swap] face diff={diff:.2f} url={result_url[:120]}")
        if diff < UNCHANGED_THRESHOLD:
            raise UnchangedResult(f"diff={diff:.2f}")

    generated = _match_colors(orig_crop, generated, blend)

    merged_crop = Image.composite(generated, orig_crop, soft)
    result = original.copy()
    result.paste(merged_crop, crop_box[:2])
    return base64.b64encode(_to_bytes(result, "JPEG", 95)).decode()