"""
Business: Определяет страну посетителя по IP для показа предупреждения о VPN (не из России)
Args: event - dict с httpMethod, headers, requestContext
      context - object с request_id
Returns: HTTP response dict с country_code, country, is_russia
"""

import json
import os
import urllib.request
import urllib.error


def get_real_ip(event: dict) -> str:
    headers = event.get('headers') or {}
    xff = headers.get('X-Forwarded-For') or headers.get('x-forwarded-for') or ''
    if xff:
        return xff.split(',')[0].strip()
    identity = (event.get('requestContext') or {}).get('identity') or {}
    return identity.get('sourceIp', '') or ''


def lookup_country(ip: str) -> dict:
    api_key = os.environ.get('TWOIP_API_KEY', '')
    if not ip or not api_key:
        return {}
    try:
        url = f"https://api.2ip.io/{ip}?token={api_key}&lang=ru"
        req = urllib.request.Request(url, headers={'User-Agent': 'foto-mix.ru/1.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            return {
                'country': data.get('country', ''),
                'country_code': (data.get('code') or '').upper(),
                'emoji': data.get('emoji', ''),
            }
    except Exception as e:
        print(f"[GEO-CHECK] Error for {ip}: {type(e).__name__} - {e}")
        return {}


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET')

    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    ip = get_real_ip(event)
    geo = lookup_country(ip)

    country_code = geo.get('country_code', '')
    # Если гео не удалось определить — не показываем предупреждение (is_russia=True)
    is_russia = (country_code == '') or (country_code == 'RU')

    body = {
        'country_code': country_code,
        'country': geo.get('country', ''),
        'emoji': geo.get('emoji', ''),
        'is_russia': is_russia,
    }

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(body, ensure_ascii=False),
    }
