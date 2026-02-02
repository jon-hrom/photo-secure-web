"""
Business: Cron-функция для автоматической отправки напоминаний о съёмках за 24ч, 5ч, 1ч
Args: event с trigger="timer" или manual call
Returns: HTTP response со статистикой отправленных уведомлений
"""

import json
import os
from typing import Dict, Any
import requests

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """Cron handler для отправки напоминаний"""
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    telegram_notif_url = 'https://functions.poehali.dev/9768a392-3928-4880-bccc-dd33983ce097'
    
    results = {
        '24h': {'sent': 0, 'success': False},
        '5h': {'sent': 0, 'success': False},
        '1h': {'sent': 0, 'success': False}
    }
    
    # Отправка напоминаний за 24 часа
    try:
        response = requests.post(telegram_notif_url, json={
            'action': 'send_reminders',
            'hours_before': 24
        }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            results['24h'] = {
                'sent': data.get('sent_count', 0),
                'success': data.get('success', False),
                'projects': data.get('projects_count', 0)
            }
            print(f"[CRON] 24h reminders: {results['24h']}")
    except Exception as e:
        print(f"[CRON] Error sending 24h reminders: {e}")
    
    # Отправка напоминаний за 5 часов
    try:
        response = requests.post(telegram_notif_url, json={
            'action': 'send_reminders',
            'hours_before': 5
        }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            results['5h'] = {
                'sent': data.get('sent_count', 0),
                'success': data.get('success', False),
                'projects': data.get('projects_count', 0)
            }
            print(f"[CRON] 5h reminders: {results['5h']}")
    except Exception as e:
        print(f"[CRON] Error sending 5h reminders: {e}")
    
    # Отправка напоминаний за 1 час
    try:
        response = requests.post(telegram_notif_url, json={
            'action': 'send_reminders',
            'hours_before': 1
        }, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            results['1h'] = {
                'sent': data.get('sent_count', 0),
                'success': data.get('success', False),
                'projects': data.get('projects_count', 0)
            }
            print(f"[CRON] 1h reminders: {results['1h']}")
    except Exception as e:
        print(f"[CRON] Error sending 1h reminders: {e}")
    
    total_sent = results['24h']['sent'] + results['5h']['sent'] + results['1h']['sent']
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': True,
            'total_sent': total_sent,
            'details': results
        }),
        'isBase64Encoded': False
    }
