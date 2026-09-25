"""Удаление объектов с фото через GPTunneL Creative Lab.

Как добиваемся органичного результата:
  1. Область, закрашенную кистью, заливаем на копии фото ярким маркером
     (пурпурный) — генеративная модель точно видит, ЧТО убрать.
  2. Промпт просит заполнить маркер продолжением окружающей сцены.
  3. Композит по маске: из ответа модели берём пиксели ТОЛЬКО внутри маски
     (с мягким краем), всё остальное — оригинал без изменений.
"""
import os
import io
import base64
import requests

GPTUNNEL_KEY = os.environ.get("GPTUNNEL_API_KEY", "")
BASE_URL = "https://gptunnel.ru/api/v2/media"

CANDIDATES = {
    "nano-banana": {"params": {"aspect_ratio": "auto"}, "input_key": "image_input"},
    "seedream-4.5": {"params": {"resolution": "2K", "aspect_ratio": "auto"}, "input_key": "image_input"},
    "qwen-image-3": {"params": {"variant": "base", "resolution": "2K", "aspect_ratio": "auto"}, "input_key": "image_input"},
    "grok-imagine": {"params": {"aspect_ratio": "auto"}, "input_key": "image_input"},
    "flux-kontext-pro": {"params": {"aspect_ratio": "auto"}, "input_key": "image"},
}

MODEL = os.environ.get("OBJECT_REMOVE_MODEL", "seedream-4.5")
FALLBACK_MODEL = os.environ.get("OBJECT_REMOVE_FALLBACK_MODEL", "nano-banana")

PRICE = int(os.environ.get("OBJECT_REMOVE_PRICE", "25"))
LABEL = "Удаление объекта"
HINT = "AI дорисует фон так, будто объекта не было"

MARKER = (255, 0, 255)

PROMPT = (
    "The bright magenta areas mark unwanted objects or people. Remove them completely "
    "and fill every magenta pixel with a seamless, photorealistic continuation of the "
    "surrounding scene: background, pavement, grass, trees, water, walls — matching "
    "perspective, lighting, grain, focus and colors. No magenta must remain, no new "
    "people or objects added, no blur patches. Keep everything outside the magenta "
    "areas absolutely identical: same main subject, face, pose, clothes, composition, "
    "framing and size. Do not crop, do not restyle."
)

MAX_SIDE = int(os.environ.get("OBJECT_REMOVE_MAX_SIDE", "2048"))


def _headers():
    return {"Authorization": GPTUNNEL_KEY, "Content-Type": "application/json"}


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


def build_marked(image_b64: str, mask_b64: str) -> str:
    """Копия фото, где выделенная область залита маркером. Возвращает jpeg base64."""
    from PIL import Image, ImageFilter

    original, mask = _load(image_b64, mask_b64)
    # Слегка расширяем: края объекта (тень, контур волос) тоже уходят под маркер
    hard = mask.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(9))
    fill = Image.new("RGB", original.size, MARKER)
    marked = Image.composite(fill, original, hard)
    if max(marked.size) > MAX_SIDE:
        marked.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    buf = io.BytesIO()
    marked.save(buf, format="JPEG", quality=92)
    return base64.b64encode(buf.getvalue()).decode()


def start_task(marked_b64: str, model: str = None) -> str:
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    name = model or MODEL
    cfg = CANDIDATES.get(name, {})
    r = requests.post(
        f"{BASE_URL}/tasks",
        json={
            "model": name,
            "prompt": PROMPT,
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


def poll_task(task_id: str) -> dict:
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


def compose(image_b64: str, mask_b64: str, result_url: str) -> str:
    """Вклеивает дорисованную область в оригинал по маске с мягким краем."""
    from PIL import Image, ImageFilter

    r = requests.get(result_url, timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"не скачался результат: {r.status_code}")

    original, mask = _load(image_b64, mask_b64)
    generated = Image.open(io.BytesIO(r.content)).convert("RGB")
    if generated.size != original.size:
        generated = generated.resize(original.size, Image.LANCZOS)

    # Та же дилатация, что и при маркировке, + мягкий край для незаметного шва
    hard = mask.point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(9))
    soft = hard.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(radius=3))

    merged = Image.composite(generated, original, soft)
    buf = io.BytesIO()
    merged.save(buf, format="JPEG", quality=95)
    return base64.b64encode(buf.getvalue()).decode()
