import json
import os
import time
from urllib import request as urlreq
import requests


RETOUCH_BASE_URL = os.environ.get("RETOUCH_BASE_URL", "").rstrip("/")

YC_INSTANCE_ID = os.environ.get("YC_INSTANCE_ID", "")
YC_OAUTH_TOKEN = os.environ.get("YC_OAUTH_TOKEN", "")
IAM_URL = "https://iam.api.cloud.yandex.net/iam/v1/tokens"
COMPUTE_BASE = "https://compute.api.cloud.yandex.net/compute/v1"


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
    }


def _response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body, default=str),
        "isBase64Encoded": False,
    }


def _get_iam_token():
    data = json.dumps({"yandexPassportOauthToken": YC_OAUTH_TOKEN}).encode()
    req = urlreq.Request(IAM_URL, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urlreq.urlopen(req, timeout=10) as r:
        return json.loads(r.read())["iamToken"]


def _yc_http(method, url, headers=None, body=None):
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urlreq.Request(url, data=data, headers=hdrs, method=method)
    with urlreq.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def _get_vm_status(iam):
    return _yc_http(
        "GET",
        f"{COMPUTE_BASE}/instances/{YC_INSTANCE_ID}",
        headers={"Authorization": f"Bearer {iam}"},
    ).get("status", "UNKNOWN")


def _ensure_credentials():
    if not YC_INSTANCE_ID:
        return _response(500, {"error": "YC_INSTANCE_ID not configured"})
    if not YC_OAUTH_TOKEN:
        return _response(500, {"error": "YC_OAUTH_TOKEN not configured"})
    return None


def _handle_wake():
    err = _ensure_credentials()
    if err:
        return err
    try:
        iam = _get_iam_token()
    except Exception as e:
        print(f"[WAKE] IAM error: {e}")
        return _response(500, {"error": f"IAM: {e}"})
    try:
        st = _get_vm_status(iam)
    except Exception as e:
        print(f"[WAKE] Status error: {e}")
        return _response(500, {"error": f"Status: {e}"})
    print(f"[WAKE] VM={st}")
    if st == "STOPPED":
        try:
            op = _yc_http(
                "POST",
                f"{COMPUTE_BASE}/instances/{YC_INSTANCE_ID}:start",
                headers={"Authorization": f"Bearer {iam}"},
            )
            return _response(200, {"action": "starting", "statusBefore": st, "operationId": op.get("id")})
        except Exception as e:
            return _response(500, {"error": f"Start: {e}"})
    if st == "STARTING":
        return _response(200, {"action": "already_starting", "status": st})
    if st == "RUNNING":
        return _response(200, {"action": "already_running", "status": st})
    return _response(200, {"action": "noop", "status": st})


def _probe_health():
    if not RETOUCH_BASE_URL:
        return {"reachable": False, "error": "RETOUCH_BASE_URL is empty"}
    url = RETOUCH_BASE_URL + "/health"
    print(f"[PROBE] Checking health at: {url}")
    try:
        t0 = time.time()
        r = requests.get(url, timeout=(3, 5))
        elapsed = round(time.time() - t0, 3)
        print(f"[PROBE] Health responded: status={r.status_code}, time={elapsed}s, body={r.text[:200]}")
        return {"reachable": True, "status_code": r.status_code, "elapsed_s": elapsed, "body": r.text[:200]}
    except requests.RequestException as e:
        elapsed = round(time.time() - t0, 3)
        print(f"[PROBE] Health FAILED after {elapsed}s: {e}")
        return {"reachable": False, "elapsed_s": elapsed, "error": str(e)}


def handler(event: dict, context) -> dict:
    """Пробуждение сервера ретуши — запуск VM через OAuth и проверка здоровья"""
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": "", "isBase64Encoded": False}

    params = event.get("queryStringParameters", {}) or {}

    if params.get("action") == "wake":
        return _handle_wake()

    if params.get("probe") == "1":
        result = _probe_health()
        return _response(200, {"probe": result})

    return _response(400, {"error": "Unknown action — use ?action=wake or ?probe=1"})