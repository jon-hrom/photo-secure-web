"""
Увеличение разрешения фото (2K/4K/8K) через nano-banana-pro без изменения содержимого.
Args: event с httpMethod, queryStringParameters (action=estimate|start|status), body, headers X-User-Id
Returns: HTTP ответ с ценами, id задачи или ссылкой на результат и положением кадра
"""
import os
import json
import base64
from typing import Dict, Any

import boto3
import requests

import models
import energy

MAX_IMAGE_B64 = 15 * 1024 * 1024
SIZES = ("orig", "2k", "4k", "8k")


def _s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def _cdn(key: str) -> str:
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


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


def _estimate():
    return _response(200, {
        "tier": "ai",
        "prices": models.PRICES,
        "price": models.PRICES["4k"],
        "label": models.LABEL,
        "model": models.MODEL,
    })


def context_id(payload: dict) -> str:
    import uuid
    return uuid.uuid4().hex


def _input_key(payload: dict, task_id: str) -> str:
    """Где лежит исходник: новый запуск передаёт input_key, старые — по task_id."""
    k = str(payload.get("input_key") or "")
    if k.startswith("upscale/staging/") and k.endswith(".jpg") and ".." not in k:
        return k
    return f"upscale/{task_id}/input.jpg"


def _handle_start(payload: dict, user_id):
    size = str(payload.get("size") or "").lower()
    if size not in SIZES:
        return _response(400, {"error": "size must be orig, 2k, 4k or 8k"})
    image_b64 = payload.get("image")
    if not image_b64:
        return _response(400, {"error": "image (base64) is required"})
    if len(image_b64) > MAX_IMAGE_B64:
        return _response(413, {"error": "image too large"})
    if not user_id:
        return _response(401, {"error": "X-User-Id required"})
    try:
        img = models.open_rgb(base64.b64decode(image_b64))
    except Exception as e:
        return _response(400, {"error": f"не удалось прочитать фото: {str(e)[:200]}"})

    price = models.PRICES[size]
    balance = energy.get_balance(user_id)
    if balance < price:
        return _response(402, {"error": "Недостаточно энергии", "needed": price, "energy_balance": balance})

    # Исходник для поиска положения кадра в ответе модели кладём в хранилище параллельно
    # с запуском задачи — так запуск укладывается во время ожидания функции.
    from concurrent.futures import ThreadPoolExecutor
    raw = base64.b64decode(image_b64)
    pool = ThreadPoolExecutor(max_workers=1)
    staged_key = f"upscale/staging/{context_id(payload)}.jpg"
    upload = pool.submit(_s3().put_object, Bucket="files", Key=staged_key, Body=raw, ContentType="image/jpeg")

    model_input, aspect = models.build_model_input(img)
    try:
        task_id = models.start_task(model_input, aspect, size, int(payload.get("orig_side") or 0))
    except Exception as e:
        print(f"[upscale] start failed: {e}")
        return _response(502, {"error": str(e)[:300]})

    upload.result()

    ok, balance, err = energy.spend(user_id, price, f"Стабилизация фото ({task_id})" if size == "orig" else f"Увеличение разрешения {size.upper()} ({task_id})")
    if not ok:
        print(f"[upscale] spend after start failed: {err}")
        if err == "insufficient_energy":
            return _response(402, {"error": "Недостаточно энергии", "needed": price, "energy_balance": balance})
        return _response(500, {"error": err or "energy error"})

    print(f"[upscale] started {models.MODEL} {size} aspect={aspect} input={img.size} task={task_id}")
    return _response(200, {"task_id": task_id, "input_key": staged_key, "charged": price, "energy_balance": balance})


def _handle_status(payload: dict, user_id):
    task_id = str(payload.get("task_id") or "")
    size = str(payload.get("size") or "4k").lower()
    if not task_id:
        return _response(400, {"error": "task_id is required"})
    price = models.PRICES.get(size, models.PRICES["4k"])

    try:
        state = models.poll_task(task_id)
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})

    if state["status"] in ("queued", "running", "processing", "pending", "starting", "created", None):
        return _response(200, {"status": "processing"})

    if state["status"] != "done":
        print(f"[upscale] task {task_id} failed: {state.get('error')}")
        if user_id:
            energy.refund_once(user_id, price, f"Возврат: увеличение разрешения не удалось ({task_id})")
        return _response(200, {"status": "failed", "error": state.get("error") or "модель не справилась",
                               "refunded": price})

    try:
        from concurrent.futures import ThreadPoolExecutor
        s3 = _s3()
        pool = ThreadPoolExecutor(max_workers=2)
        inp_f = pool.submit(lambda: s3.get_object(Bucket="files", Key=_input_key(payload, task_id))["Body"].read())
        r = requests.get(state["url"], timeout=120)
        if r.status_code != 200:
            raise RuntimeError(f"не скачался результат: {r.status_code}")
        res = models.open_rgb(r.content)
        key = f"upscale/{task_id}/result.jpg"
        if r.content[:2] == b"\xff\xd8":
            body_bytes = r.content
        else:
            import io
            buf = io.BytesIO()
            res.save(buf, format="JPEG", quality=95)
            body_bytes = buf.getvalue()
        up_f = pool.submit(s3.put_object, Bucket="files", Key=key, Body=body_bytes, ContentType="image/jpeg",
                           CacheControl="public, max-age=86400")
        place = models.locate(res, models.open_rgb(inp_f.result()))
        up_f.result()
    except Exception as e:
        print(f"[upscale] finish failed: {e}")
        if user_id:
            energy.refund_once(user_id, price, f"Возврат: ошибка сборки увеличения ({task_id})")
        return _response(200, {"status": "failed", "error": str(e)[:300], "refunded": price})

    body = {"status": "done", "url": _cdn(key), "place": place, "charged": price, "label": models.LABEL}
    if user_id:
        body["energy_balance"] = energy.get_balance(user_id)
    return _response(200, body)


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Увеличение разрешения фото до 2K/4K/8K через nano-banana-pro с оплатой энергией."""
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
        return _estimate()
    if action == "start":
        return _handle_start(payload, user_id)
    if action == "status":
        return _handle_status(payload, user_id)
    return _response(400, {"error": "unknown action (use ?action=estimate|start|status)"})
