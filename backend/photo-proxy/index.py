import json
import urllib.request
import urllib.parse

def handler(event: dict, context) -> dict:
    '''Прокси для скачивания файлов из Yandex Object Storage (обход CORS)'''
    
    method = event.get('httpMethod', 'GET')
    
    # CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    # Получаем URL из query параметра
    query_params = event.get('queryStringParameters') or {}
    file_url = query_params.get('url')
    
    if not file_url:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Missing url parameter'}),
            'isBase64Encoded': False
        }
    
    # Проверяем что это Yandex Storage URL
    if 'storage.yandexcloud.net' not in file_url:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Only Yandex Storage URLs allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        # Скачиваем файл с сервера (без CORS проверок)
        req = urllib.request.Request(file_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as response:
            file_data = response.read()
            content_type = response.headers.get('Content-Type', 'application/octet-stream')
        
        import base64
        encoded_data = base64.b64encode(file_data).decode('utf-8')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': content_type,
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'attachment'
            },
            'body': encoded_data,
            'isBase64Encoded': True
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': f'Proxy failed: {str(e)}'}),
            'isBase64Encoded': False
        }
