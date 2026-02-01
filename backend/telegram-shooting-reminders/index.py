"""
API для отправки напоминаний о съёмках через Telegram за день до события
Работает как cron-задача, проверяет предстоящие съёмки
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import telebot

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'


def get_db_connection():
    """Создание подключения к БД"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def send_via_telegram(telegram_id: str, message: str) -> dict:
    """Отправить сообщение через Telegram"""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not bot_token:
        return {'error': 'Telegram bot token not configured'}
    
    try:
        bot = telebot.TeleBot(bot_token)
        result = bot.send_message(
            chat_id=telegram_id,
            text=message,
            parse_mode='HTML',
            disable_web_page_preview=True
        )
        return {'success': True, 'message_id': result.message_id}
    except Exception as e:
        print(f'[TELEGRAM_REMINDER] Error: {str(e)}')
        return {'error': str(e)}


def format_date_ru(date_str: str) -> str:
    """Форматировать дату в русский формат"""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', ''))
        months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except:
        return date_str


def get_tomorrow_shootings():
    """Получить съёмки на завтра"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        query = f"""
            SELECT 
                p.id as project_id,
                p.name as project_name,
                p.start_date,
                p.shooting_time,
                p.shooting_address,
                p.shooting_duration,
                p.description,
                c.id as client_id,
                c.name as client_name,
                c.phone as client_phone,
                c.telegram_id as client_telegram_id,
                u.id as photographer_id,
                u.display_name as photographer_name,
                u.phone as photographer_phone,
                u.telegram_id as photographer_telegram_id
            FROM {SCHEMA}.projects p
            JOIN {SCHEMA}.clients c ON p.client_id = c.id
            JOIN {SCHEMA}.users u ON p.user_id = u.id
            WHERE DATE(p.start_date) = '{tomorrow}'
            AND p.status != 'cancelled'
        """
        
        cursor.execute(query)
        result = cursor.fetchall()
        conn.close()
        return result
    except Exception as e:
        print(f'[TELEGRAM_REMINDER] Database error: {str(e)}')
        return []


def send_client_reminder(project: dict) -> dict:
    """Отправить напоминание клиенту"""
    if not project.get('client_telegram_id'):
        return {'skipped': 'No Telegram ID'}
    
    date_str = format_date_ru(project['start_date'])
    time_str = project.get('shooting_time', '10:00')
    if time_str and ':' in time_str:
        time_parts = time_str.split(':')
        time_str = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}"
    
    address = project.get('shooting_address', 'Адрес не указан')
    photographer_name = project.get('photographer_name', 'Фотограф')
    photographer_phone = project.get('photographer_phone', 'не указан')
    
    message = f"""📸 <b>Напоминание о съёмке завтра!</b>

🎬 Услуга: {project['project_name']}
📅 Дата: {date_str}
🕐 Время: {time_str}
📍 Место: {address}

👤 Фотограф: {photographer_name}
📞 Телефон: {photographer_phone}

Не забудьте взять с собой всё необходимое!
До встречи завтра! 😊"""
    
    return send_via_telegram(project['client_telegram_id'], message)


def send_photographer_reminder(project: dict) -> dict:
    """Отправить напоминание фотографу"""
    if not project.get('photographer_telegram_id'):
        return {'skipped': 'No Telegram ID'}
    
    date_str = format_date_ru(project['start_date'])
    time_str = project.get('shooting_time', '10:00')
    if time_str and ':' in time_str:
        time_parts = time_str.split(':')
        time_str = f"{time_parts[0].zfill(2)}:{time_parts[1].zfill(2)}"
    
    address = project.get('shooting_address', 'Адрес не указан')
    client_name = project.get('client_name', 'Клиент')
    client_phone = project.get('client_phone', 'не указан')
    duration = int(project.get('shooting_duration', 120) / 60)
    
    message = f"""📸 <b>Напоминание о съёмке завтра!</b>

🎬 Проект: {project['project_name']}
📅 Дата: {date_str}
🕐 Время: {time_str}
⏱ Длительность: {duration} ч
📍 Место: {address}

👤 Клиент: {client_name}
📞 Телефон: {client_phone}

Не забудьте проверить оборудование! 📷"""
    
    return send_via_telegram(project['photographer_telegram_id'], message)


def handler(event: dict, context) -> dict:
    """
    Отправка напоминаний о съёмках через Telegram за день до события
    """
    method = event.get('httpMethod', 'POST')
    
    # CORS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Получаем съёмки на завтра
        shootings = get_tomorrow_shootings()
        
        results = {
            'total': len(shootings),
            'client_notifications': [],
            'photographer_notifications': []
        }
        
        for shooting in shootings:
            # Отправляем клиенту
            client_result = send_client_reminder(shooting)
            results['client_notifications'].append({
                'project_id': shooting['project_id'],
                'client_name': shooting['client_name'],
                'result': client_result
            })
            
            # Отправляем фотографу
            photographer_result = send_photographer_reminder(shooting)
            results['photographer_notifications'].append({
                'project_id': shooting['project_id'],
                'photographer_name': shooting['photographer_name'],
                'result': photographer_result
            })
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(results, ensure_ascii=False)
        }
        
    except Exception as e:
        print(f'[TELEGRAM_REMINDER] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }