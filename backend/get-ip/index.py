import json
import urllib.request


def handler(event, context):
    """Узнать исходящий IP бэкенда"""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    services = [
        'https://api.ipify.org?format=json',
        'https://httpbin.org/ip',
        'https://ifconfig.me/ip',
    ]

    results = {}
    for url in services:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'curl/8.0'})
            with urllib.request.urlopen(req, timeout=5) as resp:
                raw = resp.read().decode('utf-8').strip()
                try:
                    data = json.loads(raw)
                    ip = data.get('ip') or data.get('origin') or raw
                except json.JSONDecodeError:
                    ip = raw
                results[url] = ip
        except Exception as e:
            results[url] = f"error: {str(e)}"

    return {
        'statusCode': 200,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        'body': json.dumps({'outgoing_ip': results})
    }
