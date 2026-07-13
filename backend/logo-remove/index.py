import json
import os
import base64
from typing import Dict, Any
import requests


RETOUCH_BASIC_USER = os.environ.get("RETOUCH_BASIC_USER", "admin")
RETOUCH_BASIC_PASS = os.environ.get("RETOUCH_BASIC_PASS", "")
DETECT_URL = "https://io.foto-mix.ru/api/v2/detect_logo"
INPAINT_URL = "https://io.foto-mix.ru/api/v1/inpaint"

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


def _handle_inpaint(payload: dict):
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

    body = {
        "image": image_b64,
        "mask": mask_b64,
        "ldm_steps": int(payload.get("ldm_steps", 20)),
        "hd_strategy": "Crop",
        "hd_strategy_crop_trigger_size": 1024,
        "hd_strategy_crop_margin": 128,
        "hd_strategy_resize_limit": 2048,
    }

    try:
        r = requests.post(INPAINT_URL, json=body, auth=_auth(), timeout=300)
    except requests.Timeout:
        return _response(504, {"error": "inpaint timeout"})
    except requests.RequestException as e:
        return _response(502, {"error": f"inpaint unreachable: {e}"})

    if r.status_code != 200:
        return _response(r.status_code, {"error": f"inpaint returned {r.status_code}", "detail": r.text[:300]})

    result_b64 = base64.b64encode(r.content).decode()
    return _response(200, {"image": result_b64})


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Удаление логотипов с фото: AI-детекция + LAMA inpaint."""
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
    if action == "inpaint":
        return _handle_inpaint(payload)

    return _response(400, {"error": "unknown action (use ?action=detect or ?action=inpaint)"})
