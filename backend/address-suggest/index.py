"""
Подсказки адресов и организаций через Яндекс Геосаджест.
Ищет улицы, дома, а также ТЦ, студии и кафе по названию.
"""

import json
import os
import urllib.parse
import urllib.request

GEOSUGGEST_URL = 'https://suggest-maps.yandex.ru/v1/suggest'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def resp(status: int, body: dict) -> dict:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False),
        'isBase64Encoded': False,
    }


def build_item(item: dict) -> dict:
    """Приводит ответ Яндекса к простому виду для фронтенда."""
    title = (item.get('title') or {}).get('text') or ''
    subtitle = (item.get('subtitle') or {}).get('text') or ''
    address = item.get('address') or {}
    formatted = address.get('formatted_address') or ''
    tags = item.get('tags') or []

    # Организация (ТЦ, кафе, студия) — у неё есть название, отличное от адреса.
    # Обычный адрес: заголовок совпадает с началом адреса, дублировать не нужно.
    is_place = 'business' in tags
    if not is_place and formatted and title:
        is_place = title.lower() not in formatted.lower()

    if is_place and formatted:
        # «Аэрохолл» + «Тольятти, улица Баныкина, 74»
        value = f'{title}, {formatted}'
    elif formatted:
        value = formatted
    elif subtitle:
        value = f'{title}, {subtitle}'
    else:
        value = title

    return {
        'title': title,
        'subtitle': subtitle or formatted,
        'value': value,
        'is_place': is_place,
    }


def handler(event: dict, context) -> dict:
    """
    Возвращает подсказки адресов по введённому тексту.
    Параметры: query (строка поиска), city (необязательный город для уточнения).
    """
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    api_key = os.environ.get('YANDEX_GEOSUGGEST_API_KEY', '')
    if not api_key:
        return resp(200, {'suggestions': [], 'error': 'NO_API_KEY'})

    params = event.get('queryStringParameters') or {}
    query = (params.get('query') or '').strip()
    city = (params.get('city') or '').strip()

    if len(query) < 3:
        return resp(200, {'suggestions': []})

    # Город в начале запроса сильно повышает точность подсказок
    full_query = f'{city}, {query}' if city and city.lower() not in query.lower() else query

    request_params = {
        'apikey': api_key,
        'text': full_query,
        'lang': 'ru',
        'results': '8',
        'print_address': '1',
        'types': 'geo,biz',
    }

    url = f'{GEOSUGGEST_URL}?{urllib.parse.urlencode(request_params)}'

    try:
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; FotoMix/1.0; +https://foto-mix.ru)',
            'Referer': 'https://foto-mix.ru/',
        })
        with urllib.request.urlopen(req, timeout=4) as response:
            data = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', errors='ignore')[:400]
        key_len = len(api_key)
        key_hint = f'{api_key[:4]}...{api_key[-3:]}' if key_len > 8 else 'too_short'
        print(f'[GEOSUGGEST] HTTP {e.code}: {detail}')
        print(f'[GEOSUGGEST] key_len={key_len} key_hint={key_hint} dashes={api_key.count("-")}')
        code = 'BAD_API_KEY' if e.code in (401, 403) else 'UPSTREAM_ERROR'
        return resp(200, {'suggestions': [], 'error': code})
    except Exception as e:
        print(f'[GEOSUGGEST] Error: {e}')
        return resp(200, {'suggestions': [], 'error': 'UPSTREAM_ERROR'})

    results = data.get('results') or []
    suggestions = [build_item(item) for item in results]
    suggestions = [s for s in suggestions if s['value']]

    return resp(200, {'suggestions': suggestions})