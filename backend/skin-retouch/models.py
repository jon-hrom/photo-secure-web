"""Ретушь кожи через GPTunneL Creative Lab.

Задача инструмента: выровнять кожу (убрать прыщи, покраснения, пост-акне,
жирный блеск), НЕ меняя человека — черты лица, форму тела, позу, фон, свет.

Как это достигается:
  1. Жёсткий prompt «только кожа, ничего больше».
  2. Композит по маске кожи: из результата модели берутся пиксели ТОЛЬКО
     там, где найдена кожа. Всё остальное (глаза, губы, волосы, одежда,
     фон, контуры) остаётся строго оригинальным — модель физически не может
     «переделать» человека.
  3. Сохранение микротекстуры: часть высоких частот оригинала возвращается
     поверх результата, чтобы кожа не выглядела пластиковой.
  4. Регулировка силы: strength 0..1 — доля подмешивания результата.
"""
import os
import io
import base64
import requests

GPTUNNEL_KEY = os.environ.get("GPTUNNEL_API_KEY", "")
BASE_URL = "https://gptunnel.ru/api/v2/media"

# Кандидаты для ретуши. cost_rub — ориентир себестоимости за 1 генерацию
# по прайсу провайдера; уточняется через action=catalog (реальный каталог API).
CANDIDATES = {
    "qwen-image-3": {
        "label": "Qwen Image 3",
        "params": {"variant": "base", "resolution": "2K", "aspect_ratio": "auto"},
        "input_key": "image_input",
        "cost_rub": 6.0,
    },
    "grok-imagine": {
        "label": "Grok Imagine",
        "params": {"aspect_ratio": "auto"},
        "input_key": "image_input",
        "cost_rub": 6.0,
    },
    "nano-banana": {
        "label": "Nano Banana (Gemini 2.5 Flash Image)",
        "params": {"aspect_ratio": "auto"},
        "input_key": "image_input",
        "cost_rub": 8.0,
    },
    "flux-kontext-pro": {
        "label": "FLUX Kontext Pro",
        "params": {"aspect_ratio": "auto"},
        "input_key": "image",
        "cost_rub": 8.0,
    },
    "seedream-4.5": {
        "label": "Seedream 4.5",
        "params": {"resolution": "2K", "aspect_ratio": "auto"},
        "input_key": "image_input",
        "cost_rub": 8.0,
    },
}

# Рабочая модель. Меняется переменной окружения без правки кода.
# Выбрано по результатам сравнения на портретах с акне: grok-imagine даёт
# чистую кожу, не меняет черты лица и сохраняет кадрирование — при этом
# самая низкая цена провайдера (6 ₽ за генерацию).
MODEL = os.environ.get("SKIN_RETOUCH_MODEL", "grok-imagine")

# Запасная модель на случай, когда основная отклоняет фото по модерации.
# У grok-imagine модерация strict: на портретах (особенно крупный план
# лица, подростки, открытые плечи) она регулярно отвечает SENSITIVE_CONTENT.
# У qwen-image-3 модерация auto и та же цена 6 ₽ — переключаемся на неё.
FALLBACK_MODEL = os.environ.get("SKIN_RETOUCH_FALLBACK_MODEL", "qwen-image-3")

# Цена для пользователя в энергии (1 ⚡ = 1 ₽). Выставим после замера
# себестоимости — пока держим ориентир.
PRICE = int(os.environ.get("SKIN_RETOUCH_PRICE", "15"))
# Рабочий размер кадра при сборке. Ограничение продиктовано лимитами
# функции: 5 секунд и 256 МБ. На 2400 px полный конвейер (композит +
# пересвет + выравнивание) укладывался в 4.6 с — то есть впритык, и
# на чуть более сложном кадре ловил 504/502. На 1800 px запас двукратный,
# а разница в детализации на глаз незаметна: фото всё равно уходит
# в соцсети и на печать 10x15.
MAX_COMPOSE_SIDE = int(os.environ.get("SKIN_RETOUCH_MAX_SIDE", "1800"))
LABEL = "Ретушь кожи"
HINT = "AI выровняет кожу, не меняя черты лица и фигуру"

# Провайдер ограничивает промпт 800 символами — держим его коротким,
# но с явным списком запретов: иначе модель «улучшает» внешность.
#
# Формулировка намеренно категоричная («EVERY», «ZERO», «completely clear»):
# мягкие просьбы вроде «reduce acne» модель понимает как «слегка подчистить»
# и оставляет россыпь мелких пятен — именно это и было видно на фото.
PROMPT = (
    "High-end beauty retouching of the skin. Remove EVERY blemish: all acne, pimples, "
    "whiteheads, blackheads, post-acne marks, scars, red inflamed spots, blotchy redness, "
    "irritation and under-eye circles. The skin must end up completely clear and even, "
    "zero pimples left anywhere, like professional magazine retouching. "
    "Also tame blown-out oily shine on forehead, nose and cheeks, restoring natural tone. "
    "Keep realistic skin pores and fine texture, never plastic or blurred. "
    "Change ONLY skin. Same person, same face shape and features, same eyes, nose, lips, "
    "eyebrows, hair, same body, pose, clothes, background, lighting, colors, framing, size. "
    "Do not reshape or slim anything, do not change age, do not add makeup, do not crop."
)


CHAT_URL = "https://gptunnel.ru/v1/chat/completions"
VISION_MODEL = os.environ.get("SKIN_VISION_MODEL", "gpt-4o")

REGION_PROMPT = """Ты находишь на фотографии открытые участки кожи людей.
Верни прямоугольники, покрывающие лицо, шею, плечи, руки и другие открытые
участки кожи каждого человека. Не отмечай одежду, фон, предметы, цветы, животных.

Система координат: изображение — сетка 1000x1000 независимо от реального размера.
(0,0) — левый верхний угол, (1000,1000) — правый нижний.

Верни ТОЛЬКО JSON без markdown:
{"boxes": [{"x0":100,"y0":50,"x1":700,"y1":600}]}

Людей нет: {"boxes": []}"""


def _headers():
    return {"Authorization": GPTUNNEL_KEY, "Content-Type": "application/json"}


def detect_skin_regions(image_b64: str):
    """Боксы с открытой кожей людей (0..1 от размера кадра).

    Нужен, чтобы ретушь не трогала фон и предметы телесного цвета.
    При любой ошибке возвращает None — тогда работаем по всей картинке.
    """
    if not GPTUNNEL_KEY:
        return None
    try:
        import json as _json
        import re
        from PIL import Image

        original = Image.open(io.BytesIO(base64.b64decode(image_b64))).convert("RGB")
        small = original.copy()
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
                        {"type": "text", "text": REGION_PROMPT},
                        {"type": "image_url", "image_url": {
                            "url": f"data:image/jpeg;base64,{small_b64}", "detail": "low"}},
                    ],
                }],
                "max_tokens": 600,
                "temperature": 0,
            },
            headers=_headers(),
            timeout=90,
        )
        if r.status_code != 200:
            print(f"[SKIN] detect {r.status_code}: {r.text[:200]}")
            return None
        content = ((r.json().get("choices") or [{}])[0].get("message") or {}).get("content", "")
        match = re.search(r"\{.*\}", content, re.S)
        if not match:
            return None
        boxes = _json.loads(match.group(0)).get("boxes") or []
        out = []
        for b in boxes:
            try:
                x0 = float(b["x0"]) / 1000.0
                y0 = float(b["y0"]) / 1000.0
                x1 = float(b["x1"]) / 1000.0
                y1 = float(b["y1"]) / 1000.0
            except (KeyError, TypeError, ValueError):
                continue
            if x1 > x0 and y1 > y0:
                out.append((x0, y0, x1, y1))
        return out or None
    except Exception as e:
        print(f"[SKIN] detect failed: {e}")
        return None


def fetch_balance() -> dict:
    """Баланс лицевого счёта у провайдера ретуши (в рублях).

    Ключ живёт только на сервере, поэтому фронт спрашивает баланс через нас.
    """
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    r = requests.get("https://gptunnel.ru/v1/balance", headers=_headers(), timeout=30)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:200]}")
    data = r.json()
    return {
        "balance": data.get("balance"),
        "credit_limit": data.get("creditLimit"),
        "topup_url": "https://gptunnel.ru/billing",
    }


def fetch_catalog() -> dict:
    """Реальный каталог моделей провайдера с ценами — для подбора модели."""
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    r = requests.get(f"{BASE_URL}/models", headers=_headers(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    return r.json()


def start_task(image_b64: str, model: str = None, prompt: str = None) -> str:
    """Создаёт задачу ретуши. Возвращает id задачи."""
    if not GPTUNNEL_KEY:
        raise RuntimeError("GPTUNNEL_API_KEY не задан")
    name = model or MODEL
    cfg = CANDIDATES.get(name, {})
    # У разных моделей вход называется по-разному: image_input или image.
    input_key = cfg.get("input_key", "image_input")
    r = requests.post(
        f"{BASE_URL}/tasks",
        json={
            "model": name,
            "prompt": prompt or PROMPT,
            "params": cfg.get("params", {}),
            "inputs": {input_key: [f"data:image/jpeg;base64,{image_b64}"]},
        },
        headers=_headers(),
        timeout=120,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    data = r.json()
    task_id = data.get("id")
    if not task_id:
        raise RuntimeError("GPTunneL не вернул id задачи")
    return task_id


def poll_task(task_id: str) -> dict:
    """Возвращает {status, url, error, cost}."""
    r = requests.get(f"{BASE_URL}/tasks/{task_id}", headers=_headers(), timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"GPTunneL {r.status_code}: {r.text[:300]}")
    data = r.json()
    status = data.get("status")
    out = {"status": status, "url": None, "error": None, "blocked": False,
           "cost": data.get("cost")}
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
        # Отказ модерации — не поломка, а особенность конкретной модели.
        # Помечаем отдельно, чтобы перезапустить задачу на запасной модели.
        title = str(err.get("title") or "")
        out["blocked"] = (
            "SENSITIVE" in title.upper()
            or "sensitive content" in str(out["error"]).lower()
        )
    return out


def download(url: str) -> bytes:
    r = requests.get(url, timeout=180)
    if r.status_code != 200:
        raise RuntimeError(f"не скачался результат: {r.status_code}")
    return r.content


def compose(original_b64: str, result_bytes: bytes, strength: float = 0.8,
            keep_texture: float = 0.35, regions=None,
            trust_threshold: float = 40.0, highlight_recovery: float = 0.6,
            even_out: float = 0.6) -> str:
    """Собирает финал: результат модели только на коже, остальное — оригинал.

    strength          — сила ретуши 0..1 (доля результата на коже)
    keep_texture      — сколько микротекстуры оригинала вернуть поверх (0..1)
    trust_threshold   — порог геометрической страховки (выше = больше свободы)
    highlight_recovery — сила восстановления пересвета на коже (0..1)
    even_out          — сила финального выравнивания тона, добивает дефекты
                        в тенях, которые модель не увидела (0..1)
    regions      — боксы с людьми, вне их ретушь не применяется
    """
    import gc
    import skin
    from PIL import Image

    original = Image.open(io.BytesIO(base64.b64decode(original_b64))).convert("RGB")

    # Страховка по памяти: функция живёт в 256 МБ, и кадр больше ~2400 px
    # по длинной стороне в неё уже не помещается вместе с результатом.
    if max(original.size) > MAX_COMPOSE_SIDE:
        original.thumbnail((MAX_COMPOSE_SIDE, MAX_COMPOSE_SIDE), Image.LANCZOS)

    generated = Image.open(io.BytesIO(result_bytes)).convert("RGB")
    if generated.size != original.size:
        generated = generated.resize(original.size, Image.LANCZOS)

    merged = skin.blend_skin(original, generated, strength=strength,
                             keep_texture=keep_texture, regions=regions,
                             trust_threshold=trust_threshold,
                             highlight_recovery=highlight_recovery,
                             even_out=even_out)

    # Исходники больше не нужны: держать их в памяти вместе с результатом
    # и base64-строкой — лишние сотни мегабайт при лимите функции 256 МБ.
    original.close()
    generated.close()
    del original, generated
    gc.collect()

    buf = io.BytesIO()
    merged.save(buf, format="JPEG", quality=92, subsampling=0, optimize=True)
    merged.close()
    return base64.b64encode(buf.getvalue()).decode()