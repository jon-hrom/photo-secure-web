"""
Удаление логотипов с фото: AI-детекция области, стирание через GPTunneL, списание энергии.
Args: event с httpMethod, queryStringParameters (action=detect|estimate|inpaint|status), body, headers X-User-Id
Returns: HTTP ответ с маской, ценой, id задачи или готовым изображением
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


def _get_user_id(event: dict):
    headers = event.get("headers", {}) or {}
    raw = headers.get("X-User-Id") or headers.get("x-user-id")
    try:
        return int(raw) if raw else None
    except (TypeError, ValueError):
        return None


def _handle_detect(payload: dict):
    """Ищет логотип на фото и возвращает маску — область для стирания."""
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
        r = requests.post(
            DETECT_URL,
            json={"image": image_b64},
            auth=(RETOUCH_BASIC_USER, RETOUCH_BASIC_PASS),
            timeout=90,
        )
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
    """Цена до запуска — одна модель, фиксированная стоимость."""
    return _response(200, {
        "tier": "ai",
        "price": models.PRICE,
        "label": models.LABEL,
        "hint": models.HINT,
    })


def _handle_inpaint(payload: dict, user_id):
    """Списывает энергию и ставит задачу стирания в очередь GPTunneL."""
    image_b64 = payload.get("image")
    mask_b64 = payload.get("mask")
    if not image_b64 or not mask_b64:
        return _response(400, {"error": "image and mask (base64) are required"})
    try:
        base64.b64decode(image_b64)
        base64.b64decode(mask_b64)
    except Exception:
        return _response(400, {"error": "invalid base64"})
    if len(image_b64) > MAX_IMAGE_BYTES or len(mask_b64) > MAX_IMAGE_BYTES:
        return _response(413, {"error": "image or mask too large"})

    price = models.PRICE
    if not user_id:
        return _response(401, {"error": "X-User-Id required"})

    ok, balance, err = energy.spend(user_id, price, f"Убрать лого — {models.LABEL}")
    if not ok:
        if err == "insufficient_energy":
            return _response(402, {
                "error": "Недостаточно энергии",
                "needed": price,
                "energy_balance": balance,
            })
        return _response(500, {"error": err or "energy error"})

    try:
        task_id = models.start_task(image_b64)
    except Exception as e:
        energy.refund(user_id, price, f"Возврат: не удалось запустить стирание лого")
        return _response(502, {"error": str(e)[:300], "refunded": price})

    return _response(200, {"task_id": task_id, "charged": price, "energy_balance": balance})


def _handle_status(payload: dict, user_id):
    """Проверяет готовность задачи, собирает результат по маске."""
    task_id = payload.get("task_id")
    if not task_id:
        return _response(400, {"error": "task_id is required"})

    try:
        state = models.poll_task(task_id)
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})

    if state["status"] in ("queued", "running"):
        return _response(200, {"status": "processing"})

    if state["status"] == "failed":
        if user_id:
            energy.refund(user_id, models.PRICE, "Возврат: стирание лого не удалось")
        return _response(200, {
            "status": "failed",
            "error": state["error"] or "не удалось убрать лого",
            "refunded": models.PRICE,
        })

    image_b64 = payload.get("image")
    mask_b64 = payload.get("mask")
    if not image_b64 or not mask_b64:
        return _response(400, {"error": "image and mask are required to compose result"})

    try:
        result_b64 = models.compose(image_b64, mask_b64, state["url"])
    except Exception as e:
        if user_id:
            energy.refund(user_id, models.PRICE, "Возврат: ошибка сборки результата")
        return _response(200, {"status": "failed", "error": str(e)[:300], "refunded": models.PRICE})

    balance = energy.get_balance(user_id) if user_id else None
    body = {"status": "done", "image": result_b64, "label": models.LABEL, "charged": models.PRICE}
    if balance is not None:
        body["energy_balance"] = balance
    return _response(200, body)


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Удаление логотипов: детекция области, стирание через GPTunneL с оплатой энергией."""
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
        payload = json.loads(body_raw.strip() or "{}")
    except Exception as e:
        return _response(400, {"error": f"invalid JSON body: {e}"})

    if action == "detect":
        return _handle_detect(payload)
    if action == "estimate":
        return _handle_estimate(payload)
    if action == "inpaint":
        return _handle_inpaint(payload, _get_user_id(event))
    if action == "status":
        return _handle_status(payload, _get_user_id(event))

    return _response(400, {"error": "unknown action (use ?action=detect|estimate|inpaint|status)"})