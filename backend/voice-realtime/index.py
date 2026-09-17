"""Голосовой агент Yandex Realtime API: конфигурация + серверный мост.

Зачем мост: Realtime требует HTTP-заголовок `Authorization`, а браузер не может
задать заголовки при WebSocket-подключении (стандарт WebSocket API этого не
позволяет, подпротоколы и query-параметры Yandex не принимает). Поэтому браузер
общается с этой функцией по обычному HTTPS, а она сама держит WebSocket к Yandex
и возвращает ответ агента. Ключ при этом остаётся на сервере.

Действия (POST body.action):
- 'config'  — вернуть параметры сессии (по умолчанию, также любой GET);
- 'turn'    — один ход диалога: принимает запись речи (PCM16 base64) или текст,
              возвращает текст и аудио ответа агента.

Секреты: YANDEX_AI_STUDIO_API_KEY (ключ AI Studio), YANDEX_GPT_FOLDER_ID (каталог).

Переменные окружения (необязательные):
- YANDEX_REALTIME_WS_URL — базовый wss-адрес Realtime API;
- YANDEX_REALTIME_MODEL — идентификатор модели;
- YANDEX_REALTIME_PROMPT_ID — id промпта агента из AI Studio.
"""

import base64
import json
import os
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Tuple, List

DEFAULT_WS_URL = 'wss://ai.api.cloud.yandex.net/v1/realtime'
DEFAULT_MODEL = 'speech-realtime-260528/latest'
IAM_URL = 'https://iam.api.cloud.yandex.net/iam/v1/tokens'

# ID промпта голосового агента из AI Studio (session.update -> session.prompt.id).
# В нём заданы инструкции, голос и сценарий диалога.
DEFAULT_PROMPT_ID = 'aipk6k5aj2d5pjc2f92h'

SAMPLE_RATE = 24000

# Ответ функции уходит одним JSON, а аудио в base64 раздувается в ~1.4 раза.
# Слишком длинная реплика не проходит через шлюз (502), поэтому режем звук:
# 20 секунд речи с запасом хватает на реплику диалога.
MAX_AUDIO_SECONDS = 20
MAX_AUDIO_BYTES = SAMPLE_RATE * 2 * MAX_AUDIO_SECONDS

_CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
}


def _get_iam_token(api_key: str) -> Optional[str]:
    """Пытается обменять OAuth-токен на короткоживущий IAM-токен.
    Если OAuth не задан — работаем самим API-ключом (Api-Key).
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


def _auth_header(api_key: str) -> str:
    iam = _get_iam_token(api_key)
    return f'Bearer {iam}' if iam else f'Api-Key {api_key}'


def _model_uri(model: str, folder_id: str) -> str:
    # Realtime принимает модель только полным URI gpt://<folder>/<model>.
    # Короткое имя вызывает "Invalid model URI" и разрыв соединения (код 1008).
    return model if model.startswith('gpt://') else f'gpt://{folder_id}/{model}'


def _session_payload(prompt_id: str, user_name: str, voice: str) -> Dict[str, Any]:
    """Сессия агента. Realtime требует переменную промпта в ОБОИХ видах —
    и с фигурными скобками, и без: иначе сервер отвечает Internal error.
    """
    session: Dict[str, Any] = {
        'modalities': ['audio', 'text'],
        'voice': voice,
        'input_audio_format': {'type': 'audio/pcm', 'rate': SAMPLE_RATE},
        'output_audio_format': {'type': 'audio/pcm', 'rate': SAMPLE_RATE},
        'input_audio_transcription': {'enabled': True},
        # Живой диалог: короткие реплики по одному вопросу за раз.
        # Заодно ответ быстрее доходит до браузера.
        'max_response_output_tokens': 220,
    }
    if prompt_id:
        session['prompt'] = {
            'id': prompt_id,
            'variables': {'{{user_name}}': user_name, 'user_name': user_name},
        }
    return session


def _run_turn(
    ws_url: str,
    auth: str,
    model_uri: str,
    session: Dict[str, Any],
    history: List[Dict[str, Any]],
    audio_b64: str,
    text: str,
) -> Dict[str, Any]:
    """Один ход диалога через WebSocket к Yandex Realtime.

    Возвращает распознанную речь пользователя, текст ответа агента и его аудио.
    Держим соединение только на время хода — Realtime отвечает за ~1 секунду.
    """
    from websocket import create_connection  # websocket-client, синхронный клиент

    url = f'{ws_url}?model={model_uri}'
    ws = create_connection(url, header=[f'Authorization: {auth}'], timeout=30)

    user_text = ''
    agent_text = ''
    audio_chunks: List[bytes] = []
    audio_bytes = 0
    error: Optional[str] = None

    try:
        ws.recv()  # session.created

        ws.send(json.dumps({'type': 'session.update', 'session': session}))

        # Восстанавливаем предыдущие реплики: Realtime не хранит состояние
        # между подключениями, поэтому контекст диалога передаём заново.
        for item in history[-20:]:
            role = item.get('role')
            content = (item.get('text') or '').strip()
            if not role or not content:
                continue
            ws.send(json.dumps({
                'type': 'conversation.item.create',
                'item': {
                    'type': 'message',
                    'role': role,
                    'content': [{
                        'type': 'input_text' if role == 'user' else 'output_text',
                        'text': content,
                    }],
                },
            }))

        if audio_b64:
            # Голос пользователя: шлём запись кусками и закрываем буфер вручную,
            # т.к. серверный VAD в режиме одного хода не нужен.
            raw = base64.b64decode(audio_b64)
            step = 32000
            for i in range(0, len(raw), step):
                ws.send(json.dumps({
                    'type': 'input_audio_buffer.append',
                    'audio': base64.b64encode(raw[i:i + step]).decode('ascii'),
                }))
            ws.send(json.dumps({'type': 'input_audio_buffer.commit'}))
        elif text:
            ws.send(json.dumps({
                'type': 'conversation.item.create',
                'item': {
                    'type': 'message',
                    'role': 'user',
                    'content': [{'type': 'input_text', 'text': text}],
                },
            }))

        ws.send(json.dumps({'type': 'response.create'}))

        deadline = time.time() + 25
        while time.time() < deadline:
            try:
                msg = ws.recv()
            except Exception:
                break
            if not msg:
                continue
            try:
                evt = json.loads(msg)
            except ValueError:
                continue

            etype = evt.get('type')

            if etype == 'error':
                error = (evt.get('error') or {}).get('message') or 'Ошибка Realtime API'
                break
            if etype in ('response.output_audio.delta', 'response.audio.delta'):
                delta = evt.get('delta')
                if delta and audio_bytes < MAX_AUDIO_BYTES:
                    chunk = base64.b64decode(delta)
                    audio_chunks.append(chunk)
                    audio_bytes += len(chunk)
            elif etype in ('response.output_audio_transcript.delta',
                           'response.audio_transcript.delta',
                           'response.output_text.delta'):
                agent_text += evt.get('delta') or ''
            elif etype in ('response.output_audio_transcript.done',
                           'response.output_text.done'):
                if not agent_text:
                    agent_text = evt.get('text') or evt.get('transcript') or ''
            elif etype == 'conversation.item.input_audio_transcription.completed':
                user_text = evt.get('transcript') or user_text
            elif etype == 'response.done':
                break
    finally:
        try:
            ws.close()
        except Exception:
            pass

    audio_out = b''.join(audio_chunks)
    return {
        'user_text': user_text.strip(),
        'agent_text': agent_text.strip(),
        'audio': base64.b64encode(audio_out).decode('ascii') if audio_out else '',
        'sample_rate': SAMPLE_RATE,
        'error': error,
    }


def _json_response(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', **_CORS, 'Cache-Control': 'no-store'},
        'body': json.dumps(body, ensure_ascii=False),
        'isBase64Encoded': False,
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Отдаёт конфигурацию голосового агента и проксирует ход диалога к Yandex Realtime."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': _CORS, 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers', {}) or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return _json_response(401, {'error': 'unauthorized'})

    body_raw = event.get('body') or '{}'
    try:
        req = json.loads(body_raw) if body_raw.strip() else {}
    except ValueError:
        req = {}
    if not isinstance(req, dict):
        req = {}

    action = req.get('action') or 'config'

    api_key, folder_id, ws_url, model, configured = _resolve_credentials()
    prompt_id = os.environ.get('YANDEX_REALTIME_PROMPT_ID', '').strip() or DEFAULT_PROMPT_ID

    if action == 'turn':
        if not configured:
            return _json_response(200, {
                'error': 'Не заданы секреты YANDEX_AI_STUDIO_API_KEY / YANDEX_GPT_FOLDER_ID',
            })

        audio_b64 = req.get('audio') or ''
        text = (req.get('text') or '').strip()
        if not audio_b64 and not text:
            return _json_response(400, {'error': 'Нужен audio или text'})

        history = req.get('history') or []
        if not isinstance(history, list):
            history = []
        user_name = (req.get('user_name') or '').strip()
        voice = (req.get('voice') or 'marina').strip()

        session = _session_payload(prompt_id, user_name, voice)

        try:
            result = _run_turn(
                ws_url=ws_url,
                auth=_auth_header(api_key),
                model_uri=_model_uri(model, folder_id),
                session=session,
                history=history,
                audio_b64=audio_b64,
                text=text,
            )
        except Exception as e:
            print(f'[VOICE] turn failed: {e}')
            return _json_response(200, {'error': f'Не удалось получить ответ агента: {e}'})

        return _json_response(200, result)

    # action == 'config'
    body: Dict[str, Any] = {
        'configured': configured,
        'folder_id': folder_id if configured else None,
        'ws_url': ws_url if configured else None,
        'model': _model_uri(model, folder_id) if configured else model,
        'prompt_id': prompt_id,
        'voice': 'marina',
        'language': 'ru-RU',
        'sample_rate': SAMPLE_RATE,
        # Браузер не может подключиться к Realtime напрямую (нужен HTTP-заголовок
        # Authorization), поэтому диалог идёт через эту же функцию: action='turn'.
        'transport': 'proxy',
        'issued_at': int(time.time()),
    }
    if not configured:
        body['message'] = 'Не заданы секреты YANDEX_AI_STUDIO_API_KEY / YANDEX_GPT_FOLDER_ID'

    return _json_response(200, body)