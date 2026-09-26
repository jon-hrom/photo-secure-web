"""
Перенос лица с фото-донора на целевое фото с сохранением стиля целевого кадра.
Args: event с httpMethod, queryStringParameters (action=estimate|swap|status), body, headers X-User-Id
Returns: HTTP ответ с ценой, id задачи или готовым изображением
"""
import json
import base64
from typing import Dict, Any

import models
import energy


MAX_IMAGE_BYTES = 20 * 1024 * 1024
FIELDS = ("donor", "donor_mask", "target", "target_mask")


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
    vals = []
    for f in FIELDS:
        v = payload.get(f)
        if not v:
            return None, _response(400, {"error": f"{f} (base64) is required"})
        if len(v) > MAX_IMAGE_BYTES:
            return None, _response(413, {"error": f"{f} too large"})
        try:
            base64.b64decode(v)
        except Exception:
            return None, _response(400, {"error": f"invalid base64 in {f}"})
        vals.append(v)
    return vals, None


def _handle_swap(payload: dict, user_id):
    vals, err_resp = _validate(payload)
    if err_resp:
        return err_resp
    if not user_id:
        return _response(401, {"error": "X-User-Id required"})
    try:
        models.validate_inputs(*vals)
    except Exception as e:
        return _response(400, {"error": f"не удалось прочитать фото: {str(e)[:200]}"})

    price = models.PRICE
    # Сначала только проверяем баланс, списываем ПОСЛЕ успешного запуска задачи:
    # если запуск оборвётся по таймауту, энергия не должна пропасть.
    balance = energy.get_balance(user_id)
    if balance < price:
        return _response(402, {"error": "Недостаточно энергии", "needed": price, "energy_balance": balance})

    try:
        task_id, model_used = models.start_with_fallback(*vals)
    except Exception as e:
        print(f"[face-swap] start failed: {e}")
        return _response(502, {"error": str(e)[:300]})

    ok, balance, err = energy.spend(user_id, price, f"Перенос лица ({task_id})")
    if not ok:
        print(f"[face-swap] spend after start failed: {err}")
        if err == "insufficient_energy":
            return _response(402, {"error": "Недостаточно энергии", "needed": price, "energy_balance": balance})
        return _response(500, {"error": err or "energy error"})

    print(f"[face-swap] started {model_used} task={task_id}")
    return _response(200, {"task_id": task_id, "model": model_used, "charged": price, "energy_balance": balance})


def _handle_status(payload: dict, user_id):
    task_id = payload.get("task_id")
    if not task_id:
        return _response(400, {"error": "task_id is required"})
    model_used = payload.get("model") or models.MODEL

    try:
        state = models.poll_task(task_id)
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})

    if state["status"] in ("queued", "running", "processing", "pending", "starting"):
        return _response(200, {"status": "processing"})

    vals, err_resp = _validate(payload)
    if err_resp:
        return err_resp

    if state["status"] == "failed":
        print(f"[face-swap] {model_used} failed: {state.get('error')}")
        nxt = models.next_model(model_used)
        if nxt:
            try:
                new_id, new_model = models.start_with_fallback(*vals, model=nxt)
                return _response(200, {"status": "processing", "task_id": new_id, "model": new_model})
            except Exception as e:
                print(f"[face-swap] fallback failed: {e}")
        if user_id:
            energy.refund_once(user_id, models.PRICE, f"Возврат: перенос лица не удался ({task_id})")
        return _response(200, {"status": "failed", "error": state["error"] or "не удалось перенести лицо",
                               "refunded": models.PRICE})

    try:
        result_b64 = models.compose(vals[2], vals[3], state["url"])
    except models.UnchangedResult as e:
        attempt = int(payload.get("attempt") or 1)
        print(f"[face-swap] {model_used} returned unchanged face ({e}), attempt {attempt}")
        nxt = models.next_model(model_used) or (model_used if attempt < 2 else None)
        if nxt:
            try:
                new_id, new_model = models.start_with_fallback(*vals, model=nxt)
                return _response(200, {"status": "processing", "task_id": new_id, "model": new_model,
                                       "attempt": attempt + 1})
            except Exception as ex:
                print(f"[face-swap] retry failed: {ex}")
        if user_id:
            energy.refund_once(user_id, models.PRICE, f"Возврат: лицо не изменилось ({task_id})")
        return _response(200, {"status": "failed", "refunded": models.PRICE,
                               "error": "AI не заменил лицо. Энергия возвращена. Попробуйте закрасить лицо "
                                        "на обоих фото чуть шире (вместе с подбородком и лбом) и повторить."})
    except Exception as e:
        print(f"[face-swap] compose failed: {e}")
        if user_id:
            energy.refund_once(user_id, models.PRICE, f"Возврат: ошибка сборки переноса лица ({task_id})")
        return _response(200, {"status": "failed", "error": str(e)[:300], "refunded": models.PRICE})

    balance = energy.get_balance(user_id) if user_id else None
    body = {"status": "done", "image": result_b64, "label": models.LABEL, "charged": models.PRICE}
    if balance is not None:
        body["energy_balance"] = balance
    return _response(200, body)


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Перенос лица донора на целевое фото по маскам кисти с оплатой энергией."""
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
        return _response(200, {"tier": "ai", "price": models.PRICE, "label": models.LABEL, "hint": models.HINT})
    if action == "swap":
        return _handle_swap(payload, user_id)
    if action == "status":
        return _handle_status(payload, user_id)
    return _response(400, {"error": "unknown action (use ?action=estimate|swap|status)"})