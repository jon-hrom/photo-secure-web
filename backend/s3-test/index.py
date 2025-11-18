import json
import os
from typing import Dict, Any
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Тестирование подключения к S3 REG.Cloud и проверка конфигурации
    Args: event - dict with httpMethod, queryStringParameters
    Returns: HTTP response with connection status and diagnostics
    '''
    method: str = event.get('httpMethod', 'GET')
    
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
    
    # Получаем параметры из environment
    s3_endpoint = os.environ.get('REG_S3_ENDPOINT')
    s3_access_key = os.environ.get('REG_S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('REG_S3_SECRET_KEY')
    s3_bucket = os.environ.get('REG_S3_BUCKET')
    
    diagnostics = {
        'config': {
            'endpoint': s3_endpoint or 'NOT SET',
            'access_key_present': bool(s3_access_key),
            'secret_key_present': bool(s3_secret_key),
            'bucket': s3_bucket or 'NOT SET'
        },
        'tests': []
    }
    
    # Проверяем наличие всех параметров
    if not all([s3_endpoint, s3_access_key, s3_secret_key, s3_bucket]):
        diagnostics['tests'].append({
            'name': 'Configuration Check',
            'status': 'FAILED',
            'message': 'Missing required S3 configuration in environment variables'
        })
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(diagnostics, indent=2),
            'isBase64Encoded': False
        }
    
    try:
        # Создаем S3 клиент
        s3_client = boto3.client(
            's3',
            endpoint_url=s3_endpoint,
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key,
            config=Config(signature_version='s3v4')
        )
        
        diagnostics['tests'].append({
            'name': 'S3 Client Creation',
            'status': 'SUCCESS',
            'message': 'S3 client created successfully'
        })
        
        # Тест 1: Проверка доступа к бакету
        try:
            response = s3_client.head_bucket(Bucket=s3_bucket)
            diagnostics['tests'].append({
                'name': 'Bucket Access',
                'status': 'SUCCESS',
                'message': f'Successfully accessed bucket: {s3_bucket}',
                'details': {
                    'bucket': s3_bucket,
                    'http_status': response['ResponseMetadata']['HTTPStatusCode']
                }
            })
        except ClientError as e:
            error_code = e.response['Error']['Code']
            diagnostics['tests'].append({
                'name': 'Bucket Access',
                'status': 'FAILED',
                'message': f'Cannot access bucket: {s3_bucket}',
                'error': error_code,
                'details': str(e)
            })
        
        # Тест 2: Список объектов в бакете (первые 5)
        try:
            response = s3_client.list_objects_v2(Bucket=s3_bucket, MaxKeys=5)
            object_count = response.get('KeyCount', 0)
            objects = [obj['Key'] for obj in response.get('Contents', [])]
            
            diagnostics['tests'].append({
                'name': 'List Objects',
                'status': 'SUCCESS',
                'message': f'Successfully listed objects in bucket',
                'details': {
                    'object_count': object_count,
                    'sample_objects': objects
                }
            })
        except ClientError as e:
            diagnostics['tests'].append({
                'name': 'List Objects',
                'status': 'FAILED',
                'message': 'Cannot list objects in bucket',
                'error': e.response['Error']['Code'],
                'details': str(e)
            })
        
        # Тест 3: Генерация presigned URL
        try:
            test_key = 'test/connection-check.txt'
            url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': s3_bucket,
                    'Key': test_key,
                    'ContentType': 'text/plain'
                },
                ExpiresIn=300
            )
            
            diagnostics['tests'].append({
                'name': 'Generate Presigned URL',
                'status': 'SUCCESS',
                'message': 'Successfully generated presigned URL',
                'details': {
                    'url_length': len(url),
                    'expires_in': 300
                }
            })
        except ClientError as e:
            diagnostics['tests'].append({
                'name': 'Generate Presigned URL',
                'status': 'FAILED',
                'message': 'Cannot generate presigned URL',
                'error': e.response['Error']['Code'],
                'details': str(e)
            })
        
        # Подсчет успешных тестов
        passed = sum(1 for test in diagnostics['tests'] if test['status'] == 'SUCCESS')
        failed = sum(1 for test in diagnostics['tests'] if test['status'] == 'FAILED')
        
        diagnostics['summary'] = {
            'total_tests': len(diagnostics['tests']),
            'passed': passed,
            'failed': failed,
            'connection_status': 'HEALTHY' if failed == 0 else 'DEGRADED' if passed > 0 else 'FAILED'
        }
        
        status_code = 200 if failed == 0 else 500
        
        return {
            'statusCode': status_code,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(diagnostics, indent=2),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        diagnostics['tests'].append({
            'name': 'General Error',
            'status': 'FAILED',
            'message': 'Unexpected error during S3 diagnostics',
            'error': str(e)
        })
        
        diagnostics['summary'] = {
            'total_tests': len(diagnostics['tests']),
            'passed': 0,
            'failed': len(diagnostics['tests']),
            'connection_status': 'FAILED'
        }
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(diagnostics, indent=2),
            'isBase64Encoded': False
        }
