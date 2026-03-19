import json
import os
import time
import requests


YC_INSTANCE_ID = os.environ.get("YC_INSTANCE_ID", "")
YC_SA_KEY_JSON = os.environ.get("YC_SA_KEY_JSON", "")

IAM_URL = "https://iam.api.cloud.yandex.net/iam/v1/tokens"
COMPUTE_BASE = "https://compute.api.cloud.yandex.net/compute/v1"


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
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
    import jwt as pyjwt

    key_data = json.loads(YC_SA_KEY_JSON)
    now = int(time.time())

    payload = {
        "aud": IAM_URL,
        "iss": key_data["service_account_id"],
        "iat": now,
        "exp": now + 3600,
    }

    encoded = pyjwt.encode(
        payload,
        key_data["private_key"],
        algorithm="PS256",
        headers={"kid": key_data["id"]},
    )

    r = requests.post(IAM_URL, json={"jwt": encoded}, timeout=10)
    r.raise_for_status()
    return r.json()["iamToken"]


def _get_instance_status(iam_token):
    r = requests.get(
        f"{COMPUTE_BASE}/instances/{YC_INSTANCE_ID}",
        headers={"Authorization": f"Bearer {iam_token}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json().get("status", "UNKNOWN")


def _start_instance(iam_token):
    r = requests.post(
        f"{COMPUTE_BASE}/instances/{YC_INSTANCE_ID}:start",
        headers={"Authorization": f"Bearer {iam_token}"},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()


def handler(event, context):
    """Запуск (пробуждение) VM сервера ретуши в Yandex Cloud, если она выключена"""
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": "", "isBase64Encoded": False}

    if not YC_INSTANCE_ID:
        return _response(500, {"error": "YC_INSTANCE_ID not configured"})
    if not YC_SA_KEY_JSON:
        return _response(500, {"error": "YC_SA_KEY_JSON not configured"})

    iam = _get_iam_token()
    status = _get_instance_status(iam)
    print(f"[WAKE] VM status: {status}")

    if status == "STOPPED":
        op = _start_instance(iam)
        print(f"[WAKE] Start operation: {op.get('id')}")
        return _response(200, {"action": "starting", "statusBefore": status, "operationId": op.get("id")})

    if status == "STARTING":
        return _response(200, {"action": "already_starting", "status": status})

    if status == "RUNNING":
        return _response(200, {"action": "already_running", "status": status})

    return _response(200, {"action": "noop", "status": status})
