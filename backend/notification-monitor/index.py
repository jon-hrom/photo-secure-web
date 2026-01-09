"""
API для мониторинга уведомлений в админке
Получение логов push-уведомлений и списка устройств
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'


def escape_sql(value):
    """Безопасное экранирование для Simple Query Protocol"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def get_db_connection():
    """Создание подключения к БД"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def handler(event: dict, context) -> dict:
    """
    Мониторинг системы уведомлений для администраторов
    """
    method = event.get('httpMethod', 'GET')
    
    # CORS
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
    
    query_params = event.get('queryStringParameters', {})
    action = query_params.get('action', 'get-push-logs')
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # Получить логи push-уведомлений
        if action == 'get-push-logs':
            limit = int(query_params.get('limit', 100))
            
            query = f"""
                SELECT 
                    id, user_id, device_token, notification_type, title, body,
                    status, error_message, sent_at, delivered_at,
                    related_project_id, related_client_id
                FROM {SCHEMA}.push_notifications_log
                ORDER BY sent_at DESC
                LIMIT {escape_sql(limit)}
            """
            cur.execute(query)
            logs = cur.fetchall()
            
            result = []
            for log in logs:
                result.append({
                    'id': log['id'],
                    'userId': log['user_id'],
                    'deviceToken': log['device_token'],
                    'notificationType': log['notification_type'],
                    'title': log['title'],
                    'body': log['body'],
                    'status': log['status'],
                    'errorMessage': log['error_message'],
                    'sentAt': log['sent_at'].isoformat() if log['sent_at'] else None,
                    'deliveredAt': log['delivered_at'].isoformat() if log['delivered_at'] else None,
                    'relatedProjectId': log['related_project_id'],
                    'relatedClientId': log['related_client_id']
                })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'logs': result}),
                'isBase64Encoded': False
            }
        
        # Получить все iOS устройства
        elif action == 'get-all-ios-devices':
            query = f"""
                SELECT 
                    id, user_id, device_token, device_name, device_model,
                    os_version, app_version, is_active, last_used_at, created_at
                FROM {SCHEMA}.ios_push_tokens
                ORDER BY last_used_at DESC
            """
            cur.execute(query)
            devices = cur.fetchall()
            
            result = []
            for device in devices:
                result.append({
                    'id': device['id'],
                    'userId': device['user_id'],
                    'deviceToken': device['device_token'][:20] + '...',  # Скрываем полный токен
                    'deviceName': device['device_name'],
                    'deviceModel': device['device_model'],
                    'osVersion': device['os_version'],
                    'appVersion': device['app_version'],
                    'isActive': device['is_active'],
                    'lastUsedAt': device['last_used_at'].isoformat() if device['last_used_at'] else None,
                    'createdAt': device['created_at'].isoformat() if device['created_at'] else None
                })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'devices': result}),
                'isBase64Encoded': False
            }
        
        # Получить статистику уведомлений
        elif action == 'get-stats':
            query = f"""
                SELECT 
                    notification_type,
                    status,
                    COUNT(*) as count
                FROM {SCHEMA}.push_notifications_log
                WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days'
                GROUP BY notification_type, status
            """
            cur.execute(query)
            stats_raw = cur.fetchall()
            
            stats = {}
            for row in stats_raw:
                notif_type = row['notification_type']
                if notif_type not in stats:
                    stats[notif_type] = {}
                stats[notif_type][row['status']] = row['count']
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'stats': stats}),
                'isBase64Encoded': False
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'error': 'Invalid action'}),
                'isBase64Encoded': False
            }
    
    except Exception as e:
        print(f'[NOTIFICATION_MONITOR] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()
