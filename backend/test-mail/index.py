"""
Business: Временный тест доставки письма на support@foto-mix.ru через Yandex Postbox
Args: event - dict с httpMethod; context - объект с request_id
Returns: HTTP-ответ с результатом отправки (MessageId или текст ошибки)
"""

import json
import os
import boto3
from botocore.exceptions import ClientError


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET')

    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    access_key_id = os.environ.get('POSTBOX_ACCESS_KEY_ID')
    secret_access_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')

    result = {
        'has_credentials': bool(access_key_id and secret_access_key),
        'from': 'FotoMix <info@foto-mix.ru>',
        'to': 'support@foto-mix.ru',
    }

    if not access_key_id or not secret_access_key:
        result['error'] = 'POSTBOX credentials not set'
        return {'statusCode': 200, 'headers': {**cors, 'Content-Type': 'application/json'},
                'body': json.dumps(result, ensure_ascii=False)}

    try:
        client = boto3.client(
            'sesv2',
            region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )
        response = client.send_email(
            FromEmailAddress='FotoMix <info@foto-mix.ru>',
            Destination={'ToAddresses': ['support@foto-mix.ru']},
            Content={
                'Simple': {
                    'Subject': {'Data': 'Тест доставки FotoMix', 'Charset': 'UTF-8'},
                    'Body': {'Html': {'Data': '<p>Это тестовое письмо для проверки доставки на support@foto-mix.ru</p>', 'Charset': 'UTF-8'}},
                }
            },
        )
        result['success'] = True
        result['message_id'] = response.get('MessageId')
    except ClientError as e:
        result['success'] = False
        result['error'] = str(e)
        result['error_code'] = e.response.get('Error', {}).get('Code')
        result['error_message'] = e.response.get('Error', {}).get('Message')
    except Exception as e:
        result['success'] = False
        result['error'] = str(e)

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(result, ensure_ascii=False),
    }
