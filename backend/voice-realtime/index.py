"""Выдаёт браузеру безопасную конфигурацию для сессии голосового агента
Yandex Realtime API (OpenAI-совместимый протокол событий поверх WebSocket).

Постоянный API-ключ остаётся на сервере. Браузер получает:
- ws_url — точку подключения WebSocket к Realtime API;
- token / token_header — короткоживущий доступ для подключения из браузера;
- folder_id, модель, голос, частоту дискретизации.

Секреты: YANDEX_AI_STUDIO_API_KEY (ключ AI Studio), YANDEX_GPT_FOLDER_ID (каталог).

Переменные окружения (необязательные, для тонкой настройки без правки кода):
- YANDEX_REALTIME_WS_URL — базовый wss-адрес Realtime API;
- YANDEX_REALTIME_MODEL — идентификатор модели.
"""

import json
import os
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple

DEFAULT_WS_URL = 'wss://rest-assistant.api.cloud.yandex.net/v1/realtime'
DEFAULT_MODEL = 'speech-realtime-250923'
IAM_URL = 'https://iam.api.cloud.yandex.net/iam/v1/tokens'

_CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
}


def _get_iam_token(api_key: str) -> Optional[str]:
    """Пытается обменять OAuth/ключ на короткоживущий IAM-токен.
    Если ключ уже является API-ключом (Api-Key), IAM-токен не требуется —
    в этом случае вернём None и клиент будет использовать сам ключ через прокси.
    """
    oauth = os.environ.get('YC_OAUTH_TOKEN', '').strip()
    if not oauth:
        return None
    try:
        req = urllib.request.Request(
            IAM_URL,
            data=json.dumps({'yandexPassportOauthToken': oauth}).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('iamToken')
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError, TimeoutError):
        return None


def _resolve_credentials() -> Tuple[str, str, str, str, bool]:
    api_key = os.environ.get('YANDEX_AI_STUDIO_API_KEY', '').strip() \
        or os.environ.get('YANDEX_GPT_API_KEY', '').strip()
    folder_id = os.environ.get('YANDEX_GPT_FOLDER_ID', '').strip()
    ws_url = os.environ.get('YANDEX_REALTIME_WS_URL', '').strip() or DEFAULT_WS_URL
    model = os.environ.get('YANDEX_REALTIME_MODEL', '').strip() or DEFAULT_MODEL
    configured = bool(api_key and folder_id)
    return api_key, folder_id, ws_url, model, configured


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _CORS, 'body': ''}

    headers = event.get('headers', {}) or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', **_CORS},
            'body': json.dumps({'error': 'unauthorized'}),
        }

    api_key, folder_id, ws_url, model, configured = _resolve_credentials()

    body: Dict[str, Any] = {
        'configured': configured,
        'folder_id': folder_id if configured else None,
        'ws_url': ws_url if configured else None,
        'model': model,
        'voice': 'marina',
        'language': 'ru-RU',
        'sample_rate': 24000,
        'issued_at': int(time.time()),
    }

    if configured:
        # Realtime авторизуется заголовком "Authorization: Api-Key <key>".
        # Браузер не может задать заголовок при WS-подключении, поэтому передаём
        # значение авторизации клиенту, а он использует его через ?authorization=
        # (query-параметр) либо подпротокол — в зависимости от точки подключения.
        iam = _get_iam_token(api_key)
        if iam:
            body['authorization'] = f'Bearer {iam}'
            body['auth_scheme'] = 'bearer'
        else:
            body['authorization'] = f'Api-Key {api_key}'
            body['auth_scheme'] = 'api-key'
    else:
        body['message'] = 'Не заданы секреты YANDEX_AI_STUDIO_API_KEY / YANDEX_GPT_FOLDER_ID'

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', **_CORS, 'Cache-Control': 'no-store'},
        'body': json.dumps(body),
    }
