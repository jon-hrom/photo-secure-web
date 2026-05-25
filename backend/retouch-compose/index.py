"""Cloud Function retouch-compose — тяжёлая обработка изображений ретуши.

Принимает по HTTP результат от внешнего AI-сервера ретуши и (опционально)
делает композицию с оригиналом по маске кожи. Это вынесено из retouch
чтобы retouch не падала по таймауту деплоя из-за тяжёлых зависимостей
(numpy + Pillow + boto3).

MVP-этап 1: pass-through. Принимает retouched_b64, возвращает его же.
Логика _compose_with_original_by_mask будет добавлена в следующем шаге.

Endpoint:
  POST /  Body: {"in_key": str, "retouched_b64": str, "preset": "medium"}
  Response: {"result_b64": str, "size_bytes": int, "composed": bool}
"""

import json
import os
import io
import base64
import time
from typing import Dict, Any

import boto3
from botocore.client import Config


COMPOSE_VERSION = "v1-2026-05-25-pass-through-mvp"
print(f"[RETOUCH-COMPOSE] Version: {COMPOSE_VERSION}")

S3_BUCKET = "foto-mix"


def _get_s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4'),
    )


def _cors_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
            'Access-Control-Max-Age': '86400',
            'Content-Type': 'application/json',
        },
        'body': json.dumps(body, default=str),
        'isBase64Encoded': False,
    }


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """HTTP-обработчик композиции ретуши.

    Args:
        event: dict с httpMethod, body, headers
        context: объект с request_id, function_name

    Returns:
        HTTP response с result_b64.
    """
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return _cors_response(200, {})

    if method == 'GET':
        return _cors_response(200, {
            'service': 'retouch-compose',
            'version': COMPOSE_VERSION,
            'status': 'ok',
        })

    if method != 'POST':
        return _cors_response(405, {'error': 'Method not allowed'})

    try:
        body_raw = event.get('body', '{}') or '{}'
        if event.get('isBase64Encoded'):
            body_raw = base64.b64decode(body_raw).decode('utf-8')
        body = json.loads(body_raw) if isinstance(body_raw, str) else body_raw

        in_key = body.get('in_key') or ''
        retouched_b64 = body.get('retouched_b64') or ''
        preset_name = body.get('preset') or 'medium'

        if not retouched_b64:
            return _cors_response(400, {'error': 'retouched_b64 required'})

        try:
            retouched_bytes = base64.b64decode(retouched_b64)
        except Exception as e:
            return _cors_response(400, {'error': f'invalid base64: {e}'})

        t_start = time.time()
        print(f"[RETOUCH-COMPOSE] in_key={in_key} size={len(retouched_bytes)} preset={preset_name}")

        # === MVP ЭТАП 1: pass-through ===
        # Полная логика _compose_with_original_by_mask (бленд по маске кожи,
        # erosion, feather, skin smooth, red-cast removal) будет добавлена
        # в следующем шаге. Сейчас просто возвращаем retouched_bytes.
        composed_bytes = retouched_bytes
        composed = False

        elapsed_ms = int((time.time() - t_start) * 1000)
        print(f"[RETOUCH-COMPOSE] done composed={composed} elapsed={elapsed_ms}ms")

        return _cors_response(200, {
            'result_b64': base64.b64encode(composed_bytes).decode('ascii'),
            'size_bytes': len(composed_bytes),
            'composed': composed,
            'preset': preset_name,
            'elapsed_ms': elapsed_ms,
            'version': COMPOSE_VERSION,
        })

    except Exception as e:
        import traceback
        print(f"[RETOUCH-COMPOSE] ERROR: {e}")
        traceback.print_exc()
        return _cors_response(500, {'error': str(e)})
