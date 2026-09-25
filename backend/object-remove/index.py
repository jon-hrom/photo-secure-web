"""
Удаление лишних объектов/людей с фото: пользователь закрашивает кистью, AI дорисовывает фон.
Args: event с httpMethod, queryStringParameters (action=estimate|inpaint|status|catalog), body, headers X-User-Id
Returns: HTTP ответ с ценой, id задачи или готовым изображением
"""
import json
import base64
from typing import Dict, Any

import models
import energy


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


def _validate(payload: dict):
    image_b64 = payload.get("image")
    mask_b64 = payload.get("mask")
    if not image_b64 or not mask_b64:
        return None, None, _response(400, {"error": "image and mask (base64) are required"})
    try:
        base64.b64decode(image_b64)
        base64.b64decode(mask_b64)
    except Exception:
        return None, None, _response(400, {"error": "invalid base64"})
    if len(image_b64) > MAX_IMAGE_BYTES or len(mask_b64) > MAX_IMAGE_BYTES:
        return None, None, _response(413, {"error": "image or mask too large"})
    return image_b64, mask_b64, None


def _handle_estimate():
    return _response(200, {"tier": "ai", "price": models.PRICE, "label": models.LABEL, "hint": models.HINT})


def _handle_inpaint(payload: dict, user_id):
    image_b64, mask_b64, err_resp = _validate(payload)
    if err_resp:
        return err_resp
    if not user_id:
        return _response(401, {"error": "X-User-Id required"})

    try:
        marked = models.build_marked(image_b64, mask_b64)
    except Exception as e:
        return _response(400, {"error": f"не удалось прочитать фото: {str(e)[:200]}"})

    price = models.PRICE
    ok, balance, err = energy.spend(user_id, price, f"Удалить объект — {models.LABEL}")
    if not ok:
        if err == "insufficient_energy":
            return _response(402, {"error": "Недостаточно энергии", "needed": price, "energy_balance": balance})
        return _response(500, {"error": err or "energy error"})

    try:
        task_id = models.start_task(marked)
    except Exception as e:
        energy.refund(user_id, price, "Возврат: не удалось запустить удаление объекта")
        return _response(502, {"error": str(e)[:300], "refunded": price})

    return _response(200, {"task_id": task_id, "model": models.MODEL, "charged": price, "energy_balance": balance})


def _handle_status(payload: dict, user_id):
    task_id = payload.get("task_id")
    if not task_id:
        return _response(400, {"error": "task_id is required"})
    model_used = payload.get("model") or models.MODEL

    try:
        state = models.poll_task(task_id)
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})

    if state["status"] in ("queued", "running", "processing", "pending"):
        return _response(200, {"status": "processing"})

    image_b64, mask_b64, err_resp = _validate(payload)
    if err_resp:
        return err_resp

    if state["status"] == "failed":
        # Отказ модерации основной модели — перезапускаем на запасной без доплаты
        if model_used != models.FALLBACK_MODEL:
            try:
                marked = models.build_marked(image_b64, mask_b64)
                new_id = models.start_task(marked, models.FALLBACK_MODEL)
                return _response(200, {"status": "processing", "task_id": new_id, "model": models.FALLBACK_MODEL})
            except Exception:
                pass
        if user_id:
            energy.refund(user_id, models.PRICE, "Возврат: удаление объекта не удалось")
        return _response(200, {"status": "failed", "error": state["error"] or "не удалось удалить объект",
                               "refunded": models.PRICE})

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


def _handle_catalog(user_id):
    if not energy.is_admin(user_id):
        return _response(403, {"error": "только для администратора"})
    try:
        return _response(200, {"catalog": models.fetch_catalog()})
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Удаление объектов с фото по маске кисти с оплатой энергией."""
    method = event.get("httpMethod", "POST")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": "", "isBase64Encoded": False}
    if method != "POST":
        return _response(405, {"error": "method not allowed"})

    params = event.get("queryStringParameters", {}) or {}
    action = params.get("action", "estimate")

    try:
        body_raw = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            body_raw = base64.b64decode(body_raw).decode("utf-8")
        payload = json.loads(body_raw.strip() or "{}")
    except Exception as e:
        return _response(400, {"error": f"invalid JSON body: {e}"})

    user_id = _get_user_id(event)
    if action == "estimate":
        return _handle_estimate()
    if action == "inpaint":
        return _handle_inpaint(payload, user_id)
    if action == "status":
        return _handle_status(payload, user_id)
    if action == "catalog":
        return _handle_catalog(user_id)

    return _response(400, {"error": "unknown action (use ?action=estimate|inpaint|status)"})
