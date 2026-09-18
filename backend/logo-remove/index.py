"""
Удаление логотипов с фото: AI-детекция, авто-выбор модели inpaint, списание энергии.
Args: event с httpMethod, queryStringParameters (action=detect|estimate|inpaint), body, headers X-User-Id
Returns: HTTP ответ с маской, оценкой цены или готовым изображением
"""
import json
import os
import base64
from typing import Dict, Any
import requests

import models
import energy


RETOUCH_BASIC_USER = os.environ.get("RETOUCH_BASIC_USER", "admin")
RETOUCH_BASIC_PASS = os.environ.get("RETOUCH_BASIC_PASS", "")
DETECT_URL = "https://io.foto-mix.ru/api/v2/detect_logo"

MAX_IMAGE_BYTES = 20 * 1024 * 1024


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
        "Access-Control-Max-Age": "86400",
    }


def _response(status_code: int, body: Any):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body, default=str),
        "isBase64Encoded": False,
    }


def _auth():
    return (RETOUCH_BASIC_USER, RETOUCH_BASIC_PASS)


def _get_user_id(event: dict):
    headers = event.get("headers", {}) or {}
    raw = headers.get("X-User-Id") or headers.get("x-user-id")
    try:
        return int(raw) if raw else None
    except (TypeError, ValueError):
        return None


def _handle_detect(payload: dict):
    image_b64 = payload.get("image")
    if not image_b64:
        return _response(400, {"error": "image (base64) is required"})
    try:
        raw = base64.b64decode(image_b64)
    except Exception:
        return _response(400, {"error": "invalid base64 image"})
    if len(raw) > MAX_IMAGE_BYTES:
        return _response(413, {"error": f"image too large (max {MAX_IMAGE_BYTES // 1024 // 1024} MB)"})

    try:
        r = requests.post(DETECT_URL, json={"image": image_b64}, auth=_auth(), timeout=90)
    except requests.Timeout:
        return _response(504, {"error": "detector timeout"})
    except requests.RequestException as e:
        return _response(502, {"error": f"detector unreachable: {e}"})

    if r.status_code != 200:
        return _response(r.status_code, {"error": f"detector returned {r.status_code}", "detail": r.text[:300]})

    try:
        data = r.json()
    except Exception:
        return _response(502, {"error": "detector returned non-JSON"})

    if data.get("error"):
        return _response(500, {"error": data["error"]})

    return _response(200, {
        "mask": data.get("mask"),
        "width": data.get("width"),
        "height": data.get("height"),
        "ocr_pixels": data.get("ocr_pixels", 0),
        "yolo_pixels": data.get("yolo_pixels", 0),
        "face_pixels": data.get("face_pixels", 0),
    })


def _handle_estimate(payload: dict):
    """Оценка до запуска: какой движок сработает и сколько спишется энергии."""
    stats = payload.get("stats") or {}
    tier_name, tier = models.resolve(stats)
    return _response(200, {
        "tier": tier_name,
        "price": tier["price"],
        "label": tier["label"],
        "hint": tier["hint"],
    })


def _handle_inpaint(payload: dict, user_id):
    image_b64 = payload.get("image")
    mask_b64 = payload.get("mask")
    if not image_b64 or not mask_b64:
        return _response(400, {"error": "image and mask (base64) are required"})
    try:
        raw_img = base64.b64decode(image_b64)
        raw_mask = base64.b64decode(mask_b64)
    except Exception:
        return _response(400, {"error": "invalid base64"})
    if len(raw_img) > MAX_IMAGE_BYTES or len(raw_mask) > MAX_IMAGE_BYTES:
        return _response(413, {"error": "image or mask too large"})

    tier_name, tier = models.resolve(payload.get("stats") or {})
    price = int(tier["price"])

    charged = 0
    if price > 0:
        if not user_id:
            return _response(401, {"error": "X-User-Id required"})
        ok, balance, err = energy.spend(user_id, price, f"Убрать лого — {tier['label']}")
        if not ok:
            if err == "insufficient_energy":
                return _response(402, {
                    "error": "Недостаточно энергии",
                    "needed": price,
                    "energy_balance": balance,
                })
            return _response(500, {"error": err or "energy error"})
        charged = price

    try:
        result_b64 = models.run(tier_name, tier, image_b64, mask_b64)
    except Exception as e:
        if charged:
            energy.refund(user_id, charged, f"Возврат: ошибка стирания лого ({tier['label']})")
        return _response(502, {"error": str(e)[:300], "refunded": charged})

    balance = energy.get_balance(user_id) if (user_id and charged) else None
    body = {"image": result_b64, "tier": tier_name, "label": tier["label"], "charged": charged}
    if balance is not None:
        body["energy_balance"] = balance
    return _response(200, body)


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Удаление логотипов: детекция, авто-роутинг модели, inpaint с оплатой энергией."""
    method = event.get("httpMethod", "POST")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": "", "isBase64Encoded": False}

    if method != "POST":
        return _response(405, {"error": "method not allowed"})

    params = event.get("queryStringParameters", {}) or {}
    action = params.get("action", "detect")

    try:
        body_raw = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            body_raw = base64.b64decode(body_raw).decode("utf-8")
        payload = json.loads(body_raw)
    except Exception as e:
        return _response(400, {"error": f"invalid JSON body: {e}"})

    if action == "detect":
        return _handle_detect(payload)
    if action == "estimate":
        return _handle_estimate(payload)
    if action == "inpaint":
        return _handle_inpaint(payload, _get_user_id(event))

    return _response(400, {"error": "unknown action (use ?action=detect|estimate|inpaint)"})
