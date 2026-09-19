"""Стирание логотипов через GPTunneL Creative Lab: задача + опрос + композит по маске."""
import os
import io
import base64
import requests

GPTUNNEL_KEY = os.environ.get("GPTUNNEL_API_KEY", "")
BASE_URL = "https://gptunnel.ru/api/v2/media"
CHAT_URL = "https://gptunnel.ru/v1/chat/completions"

# Модель зрения для поиска лого. Дешёвая: ~0.4 ₽ за кадр в режиме detail=low.
VISION_MODEL = os.environ.get("LOGO_VISION_MODEL", "gpt-4o")
VISION_DETAIL = os.environ.get("LOGO_VISION_DETAIL", "high")

DETECT_PROMPT = """Ты детектор водяных знаков на фотографиях.
Найди ВСЕ водяные знаки, логотипы, подписи фотостоков и наложенный поверх фото текст.
Не отмечай надписи, которые являются частью самой сцены (вывески, номера, принты на одежде).

Система координат: изображение — сетка 1000x1000 независимо от реального размера.
Точка (0,0) — левый верхний угол, (1000,1000) — правый нижний.

Верни ТОЛЬКО JSON, без markdown и пояснений:
{"whole": false, "boxes": [{"x0":100,"y0":200,"x1":400,"y1":250}]}

- Каждый box — прямоугольник вокруг ОДНОГО знака: x0,y0 — левый верхний угол,
  x1,y1 — правый нижний. Рамка должна плотно охватывать знак целиком, с небольшим запасом.
- Проверь ВСЕ области кадра, включая углы и края: подписи авторов часто стоят
  в нижнем правом или нижнем левом углу мелким шрифтом.
- Полупрозрачные и повторяющиеся знаки тоже считаются — перечисли каждый отдельно.
- whole — true, если знаки повторяются плиткой по всему кадру (как у фотостоков).
- Знаков нет: {"whole": false, "boxes": []}"""

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


def detect_logo(image_b64: str) -> dict:
    """Ищет водяные знаки через vision-модель и рисует маску.

    Возвращает {mask (base64 png), boxes, whole, width, height}.
    """
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")

    from PIL import Image, ImageDraw

    original = Image.open(io.BytesIO(base64.b64decode(image_b64)))
    width, height = original.size

    # Модель смотрит уменьшенную копию — точность та же, цена в разы ниже
    small = original.convert("RGB").copy()
    small.thumbnail((768, 768), Image.LANCZOS)
    buf = io.BytesIO()
    small.save(buf, format="JPEG", quality=85)
    small_b64 = base64.b64encode(buf.getvalue()).decode()

    r = requests.post(
        CHAT_URL,
        json={
            "model": VISION_MODEL,
            "messages": [{
                "role": "user",
                "content": [
                    {"type": "text", "text": DETECT_PROMPT},
                    {"type": "image_url", "image_url": {
                        "url": f"data:image/jpeg;base64,{small_b64}", "detail": VISION_DETAIL}},
                ],
            }],
            "max_tokens": 1200,
            "temperature": 0,
        },
        headers={"Authorization": GPTUNNEL_KEY, "Content-Type": "application/json"},
        timeout=120,
    )
    if r.status_code != 200:
        raise RuntimeError(f"детектор {r.status_code}: {r.text[:200]}")

    import json as _json
    import re

    content = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content", "")
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        raise RuntimeError("детектор вернул неожиданный ответ")
    parsed = _json.loads(match.group(0))

    boxes = parsed.get("boxes") or []
    whole = bool(parsed.get("whole"))

    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    drawn = 0
    for b in boxes:
        try:
            x0 = float(b.get("x0", 0)) / 1000 * width
            y0 = float(b.get("y0", 0)) / 1000 * height
            x1 = float(b.get("x1", 0)) / 1000 * width
            y1 = float(b.get("y1", 0)) / 1000 * height
        except (TypeError, ValueError):
            continue
        if x1 <= x0 or y1 <= y0:
            continue
        # Модели зрения дают координаты приблизительно, поэтому расширяем рамку:
        # лучше захватить лишнее (это дорисуется), чем оставить край знака.
        pad = max((x1 - x0) * 0.06, (y1 - y0) * 0.35, 8)
        draw.rectangle(
            [max(0, x0 - pad), max(0, y0 - pad),
             min(width, x1 + pad), min(height, y1 + pad)],
            fill=255,
        )
        drawn += 1

    out = io.BytesIO()
    mask.save(out, format="PNG")
    return {
        "mask": base64.b64encode(out.getvalue()).decode(),
        "boxes": drawn,
        "whole": whole,
        "width": width,
        "height": height,
    }


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