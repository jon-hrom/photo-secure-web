"""Реестр моделей inpaint и авто-роутер: по статистике маски выбираем движок и цену."""
import os
import base64
import requests

REPLICATE_API_TOKEN = os.environ.get("REPLICATE_API_TOKEN", "")
REPLICATE_MODEL = "black-forest-labs/flux-fill-pro"
REPLICATE_URL = f"https://api.replicate.com/v1/models/{REPLICATE_MODEL}/predictions"

RETOUCH_BASIC_USER = os.environ.get("RETOUCH_BASIC_USER", "admin")
RETOUCH_BASIC_PASS = os.environ.get("RETOUCH_BASIC_PASS", "")
INPAINT_URL = "https://io.foto-mix.ru/api/v1/inpaint"

PRO_PROMPT = (
    "clean photo without any logo, watermark or text; "
    "seamlessly reconstruct the covered area so it naturally continues "
    "the surrounding background, skin, clothing and texture; photorealistic, sharp, no artifacts"
)

# tier -> описание. price — целые единицы энергии (1 ⚡ = 25 ₽)
TIERS = {
    "fast": {
        "engine": "lama",
        "price": 0,
        "label": "Быстрое стирание",
        "hint": "лого на простом фоне",
        "ldm_steps": 20,
        "hd_strategy": "Crop",
    },
    "quality": {
        "engine": "lama",
        "price": 0,
        "label": "Аккуратное стирание",
        "hint": "крупное лого или текстурный фон",
        "ldm_steps": 50,
        "hd_strategy": "Resize",
    },
    "pro": {
        "engine": "replicate",
        "price": 1,
        "label": "Реконструкция AI",
        "hint": "лого поверх человека — дорисовываем детали",
    },
}

DEFAULT_TIER = "fast"


def route(stats: dict) -> str:
    """Выбирает тир по статистике маски, посчитанной на клиенте.

    stats: mask_ratio (доля площади), ring_std (контраст фона вокруг маски),
           skin_ratio (доля «кожи» вокруг маски), face_hint (детектор нашёл лицо в зоне маски).
    """
    mask_ratio = float(stats.get("mask_ratio") or 0)
    ring_std = float(stats.get("ring_std") or 0)
    skin_ratio = float(stats.get("skin_ratio") or 0)
    face_hint = bool(stats.get("face_hint"))

    # Лого на человеке — единственный кейс, где LAMA мылит и нужна дорисовка.
    if face_hint or skin_ratio >= 0.28:
        return "pro"

    score = 0
    if mask_ratio > 0.05:
        score += 2
    elif mask_ratio > 0.015:
        score += 1
    if ring_std > 42:
        score += 2
    elif ring_std > 26:
        score += 1

    if score >= 4:
        return "pro"
    if score >= 2:
        return "quality"
    return "fast"


def resolve(stats: dict):
    """Возвращает (tier_name, tier_dict) с фолбэком, если провайдер не настроен."""
    tier = route(stats or {})
    if TIERS[tier]["engine"] == "replicate" and not REPLICATE_API_TOKEN:
        tier = "quality"
    return tier, TIERS[tier]


def run_lama(image_b64: str, mask_b64: str, tier: dict):
    body = {
        "image": image_b64,
        "mask": mask_b64,
        "ldm_steps": int(tier.get("ldm_steps", 20)),
        "hd_strategy": tier.get("hd_strategy", "Crop"),
        "hd_strategy_crop_trigger_size": 1024,
        "hd_strategy_crop_margin": 160,
        "hd_strategy_resize_limit": 2048,
    }
    r = requests.post(
        INPAINT_URL, json=body, auth=(RETOUCH_BASIC_USER, RETOUCH_BASIC_PASS), timeout=300
    )
    if r.status_code != 200:
        raise RuntimeError(f"inpaint returned {r.status_code}: {r.text[:200]}")
    return base64.b64encode(r.content).decode()


def run_replicate(image_b64: str, mask_b64: str, tier: dict):
    if not REPLICATE_API_TOKEN:
        raise RuntimeError("REPLICATE_API_TOKEN не задан")
    payload = {
        "input": {
            "image": f"data:image/jpeg;base64,{image_b64}",
            "mask": f"data:image/png;base64,{mask_b64}",
            "prompt": PRO_PROMPT,
            "steps": 50,
            "guidance": 30,
            "safety_tolerance": 2,
            "output_format": "jpg",
        }
    }
    r = requests.post(
        REPLICATE_URL,
        json=payload,
        headers={
            "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
            "Content-Type": "application/json",
            "Prefer": "wait=60",
        },
        timeout=300,
    )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"replicate returned {r.status_code}: {r.text[:200]}")
    data = r.json()

    status = data.get("status")
    poll_url = (data.get("urls") or {}).get("get")
    tries = 0
    while status in ("starting", "processing") and poll_url and tries < 60:
        import time

        time.sleep(3)
        tries += 1
        pr = requests.get(
            poll_url, headers={"Authorization": f"Bearer {REPLICATE_API_TOKEN}"}, timeout=30
        )
        if pr.status_code != 200:
            break
        data = pr.json()
        status = data.get("status")

    if status != "succeeded":
        raise RuntimeError(f"replicate {status}: {str(data.get('error'))[:200]}")

    out = data.get("output")
    if isinstance(out, list):
        out = out[0] if out else None
    if not out:
        raise RuntimeError("replicate вернул пустой результат")

    img = requests.get(out, timeout=120)
    if img.status_code != 200:
        raise RuntimeError(f"не скачался результат: {img.status_code}")
    return base64.b64encode(img.content).decode()


def run(tier_name: str, tier: dict, image_b64: str, mask_b64: str):
    if tier["engine"] == "replicate":
        return run_replicate(image_b64, mask_b64, tier)
    return run_lama(image_b64, mask_b64, tier)
