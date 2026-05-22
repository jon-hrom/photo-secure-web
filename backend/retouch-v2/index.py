'''Минимальный bootstrap retouch-v2 — для регистрации функции в реестре проекта.
После того как платформа выдаст URL, заменим этим файлом полную версию retouch.
'''
import json


def handler(event: dict, context) -> dict:
    '''Заглушка retouch-v2: возвращает 503, пока не загружена полная версия.'''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'unauthorized'}),
        }

    return {
        'statusCode': 503,
        'headers': {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'},
        'body': json.dumps({
            'error': 'retouch-v2 bootstrap',
            'message': 'Функция ещё не активирована, попробуйте позже',
        }),
    }
