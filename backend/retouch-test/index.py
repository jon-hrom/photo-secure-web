import json
import os
import base64
import boto3
from botocore.client import Config
import requests


"""Тестовая функция для прямого вызова io.foto-mix.ru/api/v2/submit с реальным фото"""

API_BASE = "https://io.foto-mix.ru/api/v2"
RETOUCH_BASIC_USER = os.environ.get("RETOUCH_BASIC_USER", "admin")
RETOUCH_BASIC_PASS = os.environ.get("RETOUCH_BASIC_PASS", "")
S3_BUCKET = "foto-mix"


def _auth_header():
    auth_str = base64.b64encode(f"{RETOUCH_BASIC_USER}:{RETOUCH_BASIC_PASS}".encode()).decode()
    return f"Basic {auth_str}"


def _get_s3_client():
    return boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        region_name='ru-central1',
        aws_access_key_id=os.environ.get('YC_S3_KEY_ID'),
        aws_secret_access_key=os.environ.get('YC_S3_SECRET'),
        config=Config(signature_version='s3v4')
    )


def handler(event, context):
    """Тестирование прямого вызова ретуши на io.foto-mix.ru"""
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}

    if method == 'GET' and 'task_id' in params:
        api_task_id = params['task_id']
        resp = requests.get(
            f"{API_BASE}/status/{api_task_id}",
            headers={'Authorization': _auth_header()},
            timeout=(5, 30)
        )
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'api_status_code': resp.status_code,
                'api_response': resp.json() if resp.status_code == 200 else resp.text[:500]
            })
        }

    if method == 'POST':
        s3_key = "uploads/12/1774345008/IMGA1401.jpg"
        s3_client = _get_s3_client()
        obj = s3_client.get_object(Bucket=S3_BUCKET, Key=s3_key)
        image_bytes = obj['Body'].read()
        image_b64 = base64.b64encode(image_bytes).decode()

        payload = {
            'image': image_b64,
            'strength': 0.6,
            'enhance_face': False
        }

        resp = requests.post(
            f"{API_BASE}/submit",
            headers={
                'Content-Type': 'application/json',
                'Authorization': _auth_header()
            },
            json=payload,
            timeout=(30, 120)
        )

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'image_size_bytes': len(image_bytes),
                'base64_length': len(image_b64),
                'api_status_code': resp.status_code,
                'api_response': resp.json() if resp.status_code in (200, 201, 202) else resp.text[:500]
            })
        }

    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({'info': 'POST to submit, GET?task_id=xxx to check status'})
    }
