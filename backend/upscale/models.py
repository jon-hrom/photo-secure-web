"""Увеличение разрешения через nano-banana-pro (GPTunneL).

Модель получает фото (дополненное до стандартного формата кадра, чтобы не было
растяжений и сдвигов), рисует его в 2K/4K. Мы находим в ответе точное положение
исходного кадра (подбор сдвига и масштаба), а сам итог собирает браузер:
из ответа модели берутся только мелкие детали, которых нет в оригинале, всё
остальное (цвет, свет, формы, композиция) остаётся пиксель в пиксель исходным.
"""
import os
import io
import base64
import requests

GPTUNNEL_KEY = os.environ.get("GPTUNNEL_API_KEY", "")
GPT_BASE = "https://gptunnel.ru/api/v2/media"
MODEL = os.environ.get("UPSCALE_MODEL", "nano-banana-pro")

PRICES = {
    "orig": int(os.environ.get("UPSCALE_PRICE_ORIG", "20")),
    "2k": int(os.environ.get("UPSCALE_PRICE_2K", "30")),
    "4k": int(os.environ.get("UPSCALE_PRICE_4K", "45")),
    "8k": int(os.environ.get("UPSCALE_PRICE_8K", "50")),
}
# 8K модель не рисует — берём её максимум 4K, остальное — точное масштабирование
MODEL_RES = {"orig": "2K", "2k": "2K", "4k": "4K", "8k": "4K"}
LABEL = "Увеличение разрешения"

INPUT_MAX_SIDE = 2048

PROMPT = (
    "Upscale this exact photo to a higher resolution. Reproduce it one-to-one: identical framing, "
    "composition, people, faces, expressions, hair, clothes, colours, lighting, background and every "
    "object in exactly the same place and size. Do not add, remove, move, restyle, beautify or retouch "
    "anything, do not change the face or body. Only restore natural fine detail and sharpness "
    "that a higher-resolution camera would capture. Keep any blurred background areas blurred."
)

ASPECTS = {"1:1": 1.0, "2:3": 2 / 3, "3:2": 3 / 2, "3:4": 3 / 4, "4:3": 4 / 3,
           "4:5": 4 / 5, "5:4": 5 / 4, "9:16": 9 / 16, "16:9": 16 / 9, "21:9": 21 / 9}


def _headers():
    return {"Authorization": GPTUNNEL_KEY, "Content-Type": "application/json"}


def open_rgb(data: bytes):
    from PIL import Image
    return Image.open(io.BytesIO(data)).convert("RGB")


def pad_plan(w: int, h: int):
    """Холст стандартного формата минимальной площади, куда кадр входит без масштабирования."""
    best = None
    for name, r in ASPECTS.items():
        if w / h >= r:
            PW, PH = w, int(round(w / r))
        else:
            PW, PH = int(round(h * r)), h
        PW, PH = max(PW, w), max(PH, h)
        if best is None or PW * PH < best[1] * best[2]:
            best = (name, PW, PH)
    name, PW, PH = best
    return name, PW, PH, (PW - w) // 2, (PH - h) // 2


def build_model_input(img):
    """Кадр по центру холста стандартного формата; поля — размытое продолжение краёв."""
    import numpy as np
    from PIL import Image, ImageFilter
    name, PW, PH, ox, oy = pad_plan(img.width, img.height)
    if (PW, PH) == img.size:
        canvas = img
    else:
        a = np.asarray(img)
        pad = ((oy, PH - img.height - oy), (ox, PW - img.width - ox), (0, 0))
        canvas = Image.fromarray(np.pad(a, pad, mode="edge")).filter(ImageFilter.GaussianBlur(12))
        canvas.paste(img, (ox, oy))
    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=95)
    return buf.getvalue(), name


def start_task(input_jpeg: bytes, aspect: str, size: str, orig_side: int = 0) -> str:
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    b64 = base64.b64encode(input_jpeg).decode()
    r = requests.post(
        f"{GPT_BASE}/tasks",
        json={
            "model": MODEL,
            "prompt": PROMPT,
            "params": {"resolution": "4K" if size == "orig" and orig_side > 2600 else MODEL_RES[size], "aspect_ratio": aspect, "output_format": "png"},
            "inputs": {"image_input": [f"data:image/jpeg;base64,{b64}"]},
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
    r = requests.get(f"{GPT_BASE}/tasks/{task_id}", headers=_headers(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    data = r.json()
    status = data.get("status")
    out = {"status": status, "url": None, "error": None}
    if status == "done":
        results = data.get("result") or []
        if not results or not results[0].get("url"):
            out.update(status="failed", error="пустой результат")
        else:
            out["url"] = results[0]["url"]
    elif status == "failed":
        err = data.get("error") or {}
        out["error"] = err.get("message") or "модель не справилась"
    return out


def _gray(img, size):
    import numpy as np
    from PIL import Image
    g = np.asarray(img.convert("L").resize(size, Image.BILINEAR), dtype=np.float32)
    return g - g.mean()


def _score(src, k, box, ref, size):
    """Средняя разница между оригиналом и участком ответа (box — в координатах полного ответа)."""
    import numpy as np
    from PIL import Image
    x, y, w, h = box
    bx0, by0, bx1, by1 = x * k, y * k, (x + w) * k, (y + h) * k
    if bx0 >= 0 and by0 >= 0 and bx1 <= src.width and by1 <= src.height:
        crop = src.resize(size, Image.BILINEAR, box=(bx0, by0, bx1, by1))
    else:
        crop = src.transform(size, Image.EXTENT, (bx0, by0, bx1, by1), Image.BILINEAR)
    g = np.asarray(crop, dtype=np.float32)
    g -= g.mean()
    return float(np.abs(g - ref).mean())


def _search(pyr, inp, box, ref_side, steps=2, scale_steps=1):
    """Перебор сдвига/масштаба с шагом в 1 пиксель текущего уровня пирамиды."""
    rk = ref_side / max(inp.size)
    size = (max(8, round(inp.width * rk)), max(8, round(inp.height * rk)))
    ref = _gray(inp, size)
    x0, y0, w0, h0 = box
    k_need = size[0] / w0
    src, k = next(((im, kk) for im, kk in pyr if kk >= k_need * 0.9), pyr[-1])
    px = w0 / size[0]
    best = (_score(src, k, box, ref, size), box)
    cx, cy = x0 + w0 / 2, y0 + h0 / 2
    # сначала сдвиг, затем ширина и высота отдельно (модель может слегка сжать одну ось)
    for yi in range(-steps, steps + 1):
        for xi in range(-steps, steps + 1):
            cand = (x0 + px * xi, y0 + px * yi, w0, h0)
            sc = _score(src, k, cand, ref, size)
            if sc < best[0]:
                best = (sc, cand)
    bx, by, _, _ = best[1]
    cx, cy = bx + w0 / 2, by + h0 / 2
    for hi in range(-scale_steps, scale_steps + 1):
        for wi in range(-scale_steps, scale_steps + 1):
            w, h = w0 + 2 * px * wi, h0 + 2 * px * hi
            cand = (cx - w / 2, cy - h / 2, w, h)
            sc = _score(src, k, cand, ref, size)
            if sc < best[0]:
                best = (sc, cand)
    return best


def locate(res, inp):
    """Где в ответе модели лежит исходный кадр: (x, y, w, h) в пикселях ответа + оценка расхождения."""
    from PIL import Image
    _, PW, PH, ox, oy = pad_plan(inp.width, inp.height)
    sx, sy = res.width / PW, res.height / PH
    box = (ox * sx, oy * sy, inp.width * sx, inp.height * sy)
    gray = res.convert("L")
    pyr = []
    for side in (160, 320, 640, 1280, 2048):
        k = min(1.0, side / max(res.size))
        pyr.append((gray.resize((max(1, round(res.width * k)), max(1, round(res.height * k))), Image.BILINEAR), k))
    score = None
    for ref_side, steps in ((96, 4), (192, 2), (384, 2), (768, 2), (1024, 1)):
        if ref_side > max(inp.size) * 1.2:
            ref_side = max(inp.size)
        score, box = _search(pyr, inp, box, ref_side, steps)
        for _ in range(4):
            s2, b2 = _search(pyr, inp, box, ref_side, 1)
            if b2 == box:
                break
            score, box = s2, b2
    x, y, w, h = box
    print(f"[upscale] result={res.size} input={inp.size} box=({x:.1f},{y:.1f},{w:.1f},{h:.1f}) diff={score:.2f}")
    return {"x": x, "y": y, "w": w, "h": h, "width": res.width, "height": res.height, "diff": round(score, 2)}
