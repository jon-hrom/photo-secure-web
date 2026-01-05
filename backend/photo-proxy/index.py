import json

def handler(event: dict, context) -> dict:
    '''Редирект для скачивания файлов из Yandex Object Storage (обход CORS через редирект)'''
    
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
    
    # Возвращаем 302 редирект на оригинальный файл
    # Браузер скачает файл напрямую (обходит CORS для download атрибута)
    return {
        'statusCode': 302,
        'headers': {
            'Location': file_url,
            'Access-Control-Allow-Origin': '*'
        },
        'body': '',
        'isBase64Encoded': False
    }