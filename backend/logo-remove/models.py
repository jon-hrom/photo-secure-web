"""Стирание логотипов через GPTunneL Creative Lab: задача + опрос + композит по маске."""
import os
import io
import base64
import requests

GPTUNNEL_KEY = os.environ.get("GPTUNNEL_API_KEY", "")
BASE_URL = "https://gptunnel.ru/api/v2/media"

# Модель редактирования. Цена провайдера — 8 ₽ за генерацию.
MODEL = "seedream-4.5"
MODEL_PARAMS = {"resolution": "2K", "aspect_ratio": "auto"}

# Цена для пользователя в единицах энергии (1 ⚡ = 1 ₽)
PRICE = 25
LABEL = "Стирание логотипа"
HINT = "AI дорисует то, что было под лого"

PROMPT = (
    "Remove the watermark, logo and any overlaid text from this photo completely. "
    "Reconstruct what is underneath — skin, clothing texture, background — so it looks "
    "like the watermark was never there. Keep everything else absolutely identical: "
    "same people, same faces, same poses, same colors, same composition, same lighting, "
    "same framing. Do not restyle, do not crop, do not regenerate the image."
)


def _headers():
    return {"Authorization": GPTUNNEL_KEY, "Content-Type": "application/json"}


def start_task(image_b64: str) -> str:
    """Создаёт задачу стирания. Возвращает id задачи."""
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    r = requests.post(
        f"{BASE_URL}/tasks",
        json={
            "model": MODEL,
            "prompt": PROMPT,
            "params": MODEL_PARAMS,
            "inputs": {"image_input": [f"data:image/jpeg;base64,{image_b64}"]},
        },
        headers=_headers(),
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:200]}")
    data = r.json()
    task_id = data.get("id")
    if not task_id:
        raise RuntimeError("GPTunneL не вернул id задачи")
    return task_id


def poll_task(task_id: str) -> dict:
    """Возвращает {status, url, error}."""
    r = requests.get(f"{BASE_URL}/tasks/{task_id}", headers=_headers(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:200]}")
    data = r.json()
    status = data.get("status")
    out = {"status": status, "url": None, "error": None}
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
    return out


def compose(original_b64: str, mask_b64: str, result_url: str) -> str:
    """Берёт из результата только область маски и вклеивает в оригинал.

    Генеративная модель отдаёт весь кадр заново — вне маски он может незаметно
    «поплыть». Композит гарантирует: меняется только то, что закрасил пользователь.
    """
    from PIL import Image, ImageFilter

    r = requests.get(result_url, timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"не скачался результат: {r.status_code}")

    original = Image.open(io.BytesIO(base64.b64decode(original_b64))).convert("RGB")
    generated = Image.open(io.BytesIO(r.content)).convert("RGB")
    mask = Image.open(io.BytesIO(base64.b64decode(mask_b64))).convert("L")

    if generated.size != original.size:
        generated = generated.resize(original.size, Image.LANCZOS)
    if mask.size != original.size:
        mask = mask.resize(original.size, Image.LANCZOS)

    # мягкий край, чтобы стык не читался
    mask = mask.filter(ImageFilter.GaussianBlur(radius=2))

    merged = Image.composite(generated, original, mask)
    buf = io.BytesIO()
    merged.save(buf, format="JPEG", quality=95)
    return base64.b64encode(buf.getvalue()).decode()
