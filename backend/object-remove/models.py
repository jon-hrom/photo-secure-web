"""Удаление объектов с фото.

Основной путь — настоящие mask-inpainting модели на Replicate:
  1. bria/eraser — специализированная модель удаления объектов/людей
     (получает фото + маску, дорисовывает фон по окружению, вне маски пиксели не трогает).
  2. black-forest-labs/flux-fill-pro — запасная, генеративная дорисовка по маске.
Последний резерв — GPTunneL (nano-banana) с пурпурной разметкой, если Replicate недоступен.

В конце всегда композит по маске с мягким краем: вне маски — оригинал 1:1.
"""
import os
import io
import base64
import requests

# ---------- GPTunneL (резерв) ----------
GPTUNNEL_KEY = os.environ.get("GPTUNNEL_API_KEY", "")
BASE_URL = "https://gptunnel.ru/api/v2/media"

CANDIDATES = {
    "nano-banana": {"params": {"aspect_ratio": "auto"}, "input_key": "image_input"},
    "seedream-4.5": {"params": {"resolution": "2K", "aspect_ratio": "auto"}, "input_key": "image_input"},
}

# ---------- Replicate (основной путь) ----------
REPLICATE_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "")
REPLICATE_API = "https://api.replicate.com/v1"
REPLICATE_MODELS = {
    "bria-eraser": "bria/eraser",
    "flux-fill-pro": "black-forest-labs/flux-fill-pro",
}

FILL_PROMPT = (
    "empty background, seamless continuation of the surrounding scene: fountain water jets, "
    "trees, park, pavement, same lighting, same depth of field and bokeh, photorealistic, "
    "no people, no person, no new objects"
)

_CHAIN_REPLICATE = ["bria-eraser", "flux-fill-pro", "nano-banana"]
_CHAIN_GPTUNNEL = ["nano-banana", "seedream-4.5"]


def _chain():
    return _CHAIN_REPLICATE if REPLICATE_TOKEN else _CHAIN_GPTUNNEL


MODEL = os.environ.get("OBJECT_REMOVE_MODEL") or _chain()[0]
FALLBACK_MODEL = _chain()[-1]


def next_model(current: str):
    """Следующая модель в цепочке после неудачи, либо None."""
    chain = _chain()
    if current in chain:
        i = chain.index(current)
        return chain[i + 1] if i + 1 < len(chain) else None
    return None


PRICE = int(os.environ.get("OBJECT_REMOVE_PRICE", "25"))
LABEL = "Удаление объекта"
HINT = "AI дорисует фон так, будто объекта не было"

MARKER = (255, 0, 255)

PROMPT = (
    "Magenta marks unwanted people/objects. Remove them and fill every magenta pixel "
    "with a seamless photorealistic continuation of the surrounding background, matching "
    "perspective, light, blur and colors. No magenta left. Keep everything else identical, "
    "no crop."
)

MAX_SIDE = int(os.environ.get("OBJECT_REMOVE_MAX_SIDE", "2048"))

# Запрет на выдумывание предметов: без него модель ставила на месте человека
# тумбы/постаменты вместо продолжения газона и фонтана.
STRICT_TAIL = (
    " Do NOT invent new objects: no stands, boxes, pillars, walls, benches, furniture, people."
    " Only continue textures entering the area from its edges."
)


def _headers():
    return {"Authorization": GPTUNNEL_KEY, "Content-Type": "application/json"}


def _rep_headers():
    return {"Authorization": f"Bearer {REPLICATE_TOKEN}"}


def fetch_catalog() -> dict:
    r = requests.get(f"{BASE_URL}/models", headers=_headers(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    return r.json()


def _load(image_b64: str, mask_b64: str):
    from PIL import Image
    original = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
    mask = Image.open(io.BytesIO(base64.b64decode(mask_b64))).convert("L")
    if mask.size != original.size:
        mask = mask.resize(original.size, Image.LANCZOS)
    return original, mask


def _hard_mask(mask, grow: int = 9):
    from PIL import ImageFilter
    # Расширяем: края объекта (тень, контур волос, ореол) тоже уходят под маску
    return mask.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(grow))


def _to_bytes(img, fmt: str, quality: int = 93) -> bytes:
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.save(buf, format="JPEG", quality=quality)
    else:
        img.save(buf, format=fmt)
    return buf.getvalue()


def build_marked(image_b64: str, mask_b64: str) -> str:
    """Для GPTunneL: копия фото, где выделенная область залита маркером."""
    from PIL import Image

    original, mask = _load(image_b64, mask_b64)
    fill = Image.new("RGB", original.size, MARKER)
    marked = Image.composite(fill, original, _hard_mask(mask))
    if max(marked.size) > MAX_SIDE:
        marked.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    return base64.b64encode(_to_bytes(marked, "JPEG", 92)).decode()


# ---------- Replicate ----------
def _rep_upload(data: bytes, filename: str, ctype: str) -> str:
    r = requests.post(
        f"{REPLICATE_API}/files",
        headers=_rep_headers(),
        files={"content": (filename, data, ctype)},
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Replicate upload {r.status_code}: {r.text[:300]}")
    url = (r.json().get("urls") or {}).get("get")
    if not url:
        raise RuntimeError("Replicate не вернул ссылку на файл")
    return url


def _rep_start(model: str, image_b64: str, mask_b64: str) -> str:
    from PIL import Image

    if not REPLICATE_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN не задан")
    original, mask = _load(image_b64, mask_b64)
    hard = _hard_mask(mask, 11 if model == "flux-fill-pro" else 9)
    if max(original.size) > MAX_SIDE:
        scale = MAX_SIDE / max(original.size)
        size = (round(original.width * scale), round(original.height * scale))
        original = original.resize(size, Image.LANCZOS)
        hard = hard.resize(size, Image.NEAREST)

    img_url = _rep_upload(_to_bytes(original, "JPEG", 95), "image.jpg", "image/jpeg")
    mask_url = _rep_upload(_to_bytes(hard, "PNG"), "mask.png", "image/png")

    if model == "bria-eraser":
        inp = {"image": img_url, "mask": mask_url, "mask_type": "manual"}
    else:
        inp = {
            "image": img_url, "mask": mask_url, "prompt": FILL_PROMPT,
            "steps": 50, "guidance": 30, "output_format": "png", "prompt_upsampling": False,
        }

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
    out = {"status": "processing", "url": None, "error": None, "blocked": False}
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
        err = str(data.get("error") or "модель не справилась")
        out.update(status="failed", error=err[:300], blocked="sensitive" in err.lower() or "nsfw" in err.lower())
    return out


# ---------- GPTunneL ----------
def _gpt_start(model: str, image_b64: str, mask_b64: str) -> str:
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    marked_b64 = build_marked(image_b64, mask_b64)
    cfg = CANDIDATES.get(model, {})
    prompt = PROMPT + STRICT_TAIL
    r = requests.post(
        f"{BASE_URL}/tasks",
        json={
            "model": model,
            "prompt": prompt,
            "params": cfg.get("params", {"aspect_ratio": "auto"}),
            "inputs": {cfg.get("input_key", "image_input"): [f"data:image/jpeg;base64,{marked_b64}"]},
        },
        headers=_headers(),
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    task_id = r.json().get("id")
    if not task_id:
        raise RuntimeError("GPTunneL не вернул id задачи")
    return task_id


def _gpt_poll(task_id: str) -> dict:
    r = requests.get(f"{BASE_URL}/tasks/{task_id}", headers=_headers(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    data = r.json()
    status = data.get("status")
    out = {"status": status, "url": None, "error": None, "blocked": False}
    if status == "done":
        results = data.get("result") or []
        if not results:
            out["status"] = "failed"
            out["error"] = "пустой результат"
        else:
            out["url"] = results[0].get("url")
    elif status == "failed":
        err = data.get("error") or {}
        out["error"] = err.get("message") or "модель не справилась"
        title = str(err.get("title") or "")
        out["blocked"] = "SENSITIVE" in title.upper() or "sensitive" in str(out["error"]).lower()
    return out


# ---------- Общий интерфейс ----------
def start_task(image_b64: str, mask_b64: str, model: str = None) -> str:
    name = model or MODEL
    if name in REPLICATE_MODELS:
        return _rep_start(name, image_b64, mask_b64)
    return _gpt_start(name, image_b64, mask_b64)


def start_with_fallback(image_b64: str, mask_b64: str, model: str = None):
    """Запускает модель; если старт не удался — пробует следующие по цепочке."""
    name = model or MODEL
    last_err = None
    while name:
        try:
            return start_task(image_b64, mask_b64, name), name
        except Exception as e:
            last_err = e
            name = next_model(name)
    raise last_err or RuntimeError("нет доступных моделей")


def poll_task(task_id: str) -> dict:
    if task_id.startswith("rep:"):
        return _rep_poll(task_id[4:])
    return _gpt_poll(task_id)


def _match_colors(original, generated, hard):
    """Убирает сдвиг цвета/яркости дорисовки: по кольцу вокруг маски считаем
    разницу оригинал−генерация и плавно переносим её внутрь маски."""
    import numpy as np
    from PIL import Image, ImageFilter

    w, h = original.size
    scale = 512 / max(w, h)
    sw, sh = max(1, round(w * scale)), max(1, round(h * scale))
    o = np.asarray(original.resize((sw, sh), Image.BILINEAR), dtype=np.float32)
    g = np.asarray(generated.resize((sw, sh), Image.BILINEAR), dtype=np.float32)
    m_small = hard.resize((sw, sh), Image.BILINEAR)
    inner = np.asarray(m_small, dtype=np.float32) > 127
    outer = np.asarray(m_small.filter(ImageFilter.MaxFilter(15)), dtype=np.float32) > 127
    ring = (outer & ~inner).astype(np.float32)
    if ring.sum() < 20:
        return generated

    radius = max(8, round(max(sw, sh) / 20))

    def box(a, r, axis):
        pad = [(0, 0)] * a.ndim
        pad[axis] = (r + 1, r)
        c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
        n = a.shape[axis]
        hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
        lo = np.take(c, np.arange(0, n), axis=axis)
        return ((hi - lo) / (2 * r + 1)).astype(np.float32)

    def blur(arr):
        r = max(1, radius // 2)
        out = arr.astype(np.float32)
        for _ in range(3):  # 3 прохода box-фильтра ≈ гаусс
            out = box(box(out, r, 0), r, 1)
        return out

    wsum = blur(ring) + 1e-4
    corr = np.zeros_like(o)
    for c in range(3):
        diff = (o[..., c] - g[..., c]) * ring
        corr[..., c] = blur(diff) / wsum
    # Где кольцо далеко — коррекция затухает
    fade = np.clip(wsum / (wsum.max() * 0.15), 0, 1)
    corr *= fade[..., None]
    corr = np.clip(corr, -40, 40)

    corr_img = [Image.fromarray(corr[..., c], mode="F").resize((w, h), Image.BILINEAR) for c in range(3)]
    corr_full = np.stack([np.asarray(ci, dtype=np.float32) for ci in corr_img], axis=-1)
    out = np.asarray(generated, dtype=np.float32) + corr_full
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def compose(image_b64: str, mask_b64: str, result_url: str) -> str:
    """Вклеивает дорисованную область в оригинал по маске с мягким краем."""
    from PIL import Image, ImageFilter

    headers = _rep_headers() if result_url.startswith(REPLICATE_API) else {}
    r = requests.get(result_url, headers=headers, timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"не скачался результат: {r.status_code}")

    original, mask = _load(image_b64, mask_b64)
    generated = Image.open(io.BytesIO(r.content)).convert("RGB")
    if generated.size != original.size:
        generated = generated.resize(original.size, Image.LANCZOS)

    hard = _hard_mask(mask)
    generated = _match_colors(original, generated, hard)
    soft = hard.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(radius=6))

    merged = Image.composite(generated, original, soft)
    return base64.b64encode(_to_bytes(merged, "JPEG", 95)).decode()