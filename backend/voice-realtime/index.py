"""Выдаёт браузеру безопасную конфигурацию для сессии голосового агента
Yandex Realtime API. Постоянный API-ключ остаётся на сервере и клиенту не передаётся.

Секреты: YANDEX_AI_STUDIO_API_KEY (ключ AI Studio), YANDEX_GPT_FOLDER_ID (каталог).

Возвращает:
- folder_id — каталог Yandex Cloud;
- модель и параметры голоса по умолчанию;
- признак готовности (configured), если секреты заданы.

Эфемерная авторизация (короткоживущий токен для WebSocket из браузера) будет
добавлена сюда же, когда сервисному аккаунту выданы роли для Realtime-моделей.
"""

import json
import os
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')

    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
        'Access-Control-Max-Age': '86400',
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    user_id = (event.get('headers', {}) or {}).get('X-User-Id') \
        or (event.get('headers', {}) or {}).get('x-user-id')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', **cors},
            'body': json.dumps({'error': 'unauthorized'}),
        }

    # Отдельный ключ AI Studio для голосовых агентов (Realtime).
    # Fallback на YANDEX_GPT_API_KEY — на случай общего сервисного аккаунта.
    api_key = os.environ.get('YANDEX_AI_STUDIO_API_KEY', '').strip() \
        or os.environ.get('YANDEX_GPT_API_KEY', '').strip()
    folder_id = os.environ.get('YANDEX_GPT_FOLDER_ID', '').strip()
    configured = bool(api_key and folder_id)

    body = {
        'configured': configured,
        'folder_id': folder_id if configured else None,
        'model': 'speech-realtime-250923',
        'voice': 'marina',
        'language': 'ru-RU',
        'sample_rate': 24000,
    }
    if not configured:
        body['message'] = 'Не заданы секреты YANDEX_AI_STUDIO_API_KEY / YANDEX_GPT_FOLDER_ID'

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', **cors},
        'body': json.dumps(body),
    }