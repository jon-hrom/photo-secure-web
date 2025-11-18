'''
Business: Send email notifications about storage usage to users
Args: event with httpMethod, body, queryStringParameters; context with request_id
Returns: HTTP response with statusCode, headers, body
'''

import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL')
BASE_URL = os.environ.get('BASE_URL', 'https://yoursite.com')
SCHEMA = 't_p28211681_photo_secure_web'

def get_db_connection():
    return psycopg2.connect(DATABASE_URL)

def get_smtp_settings() -> Dict[str, str]:
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT setting_key, setting_value FROM {SCHEMA}.site_settings
                WHERE setting_key IN ('smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'email_notifications_enabled')
            ''')
            rows = cur.fetchall()
            settings = {row['setting_key']: row['setting_value'] for row in rows}
            
            if not all(k in settings for k in ['smtp_host', 'smtp_user', 'smtp_password']):
                return None
            
            if settings.get('email_notifications_enabled') != 'true':
                return None
                
            return settings
    finally:
        conn.close()

def send_email(to_email: str, subject: str, html_body: str, smtp_settings: Dict[str, str]) -> bool:
    msg = MIMEMultipart('alternative')
    msg['From'] = smtp_settings['smtp_user']
    msg['To'] = to_email
    msg['Subject'] = subject
    
    html_part = MIMEText(html_body, 'html', 'utf-8')
    msg.attach(html_part)
    
    try:
        smtp_host = smtp_settings['smtp_host']
        smtp_port = int(smtp_settings.get('smtp_port', '587'))
        smtp_user = smtp_settings['smtp_user']
        smtp_password = smtp_settings['smtp_password']
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f'Email send error: {e}')
        return False

def get_storage_warning_html(user_name: str, used_gb: float, limit_gb: float, percent: float) -> str:
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }}
            .warning-box {{ background: #fff3cd; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; }}
            .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }}
            .stats {{ background: white; padding: 15px; border-radius: 5px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>⚠️ Хранилище заканчивается</h1>
            </div>
            <div class="content">
                <p>Здравствуйте, {user_name}!</p>
                
                <div class="warning-box">
                    <strong>Внимание!</strong> Ваше хранилище заполнено на {percent:.1f}%
                </div>
                
                <div class="stats">
                    <p><strong>Использовано:</strong> {used_gb:.2f} ГБ из {limit_gb} ГБ</p>
                    <p><strong>Осталось:</strong> {(limit_gb - used_gb):.2f} ГБ</p>
                </div>
                
                <p>Чтобы продолжить загружать файлы, рекомендуем увеличить объём хранилища:</p>
                
                <a href="{BASE_URL}/upgrade-plan" class="button">Выбрать тариф</a>
                
                <p style="margin-top: 30px; color: #666; font-size: 14px;">
                    Если у вас есть вопросы, ответьте на это письмо.
                </p>
            </div>
        </div>
    </body>
    </html>
    '''

def check_and_notify_users(event: Dict[str, Any]) -> Dict[str, Any]:
    smtp_settings = get_smtp_settings()
    
    if not smtp_settings:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'error': 'Email notifications disabled or SMTP not configured',
                'notified_users': 0
            })
        }
    
    conn = get_db_connection()
    notified_count = 0
    
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f'''
                SELECT 
                    u.id, 
                    COALESCE(u.email, vk.email) as email,
                    COALESCE(vk.full_name, 'Пользователь') as user_name,
                    COALESCE(u.custom_quota_gb, sp.quota_gb, 5.0) as quota_gb,
                    COALESCE(SUM(so.bytes), 0) as used_bytes,
                    u.last_storage_warning_at
                FROM {SCHEMA}.users u
                LEFT JOIN {SCHEMA}.vk_users vk ON u.id = vk.user_id
                LEFT JOIN {SCHEMA}.storage_plans sp ON u.plan_id = sp.id
                LEFT JOIN {SCHEMA}.storage_objects so ON u.id = so.user_id AND so.status = 'active'
                WHERE u.is_active = true AND (u.email IS NOT NULL OR vk.email IS NOT NULL)
                GROUP BY u.id, u.email, vk.email, vk.full_name, u.custom_quota_gb, sp.quota_gb, u.last_storage_warning_at
            ''')
            users = cur.fetchall()
            
            for user in users:
                if not user['email']:
                    continue
                    
                used_gb = float(user['used_bytes']) / (1024 ** 3)
                quota_gb = float(user['quota_gb'])
                percent = (used_gb / quota_gb * 100) if quota_gb > 0 else 0
                
                if percent >= 90:
                    last_warning = user.get('last_storage_warning_at')
                    
                    should_send = True
                    if last_warning:
                        from datetime import datetime, timedelta
                        if datetime.now() - last_warning < timedelta(days=3):
                            should_send = False
                    
                    if should_send:
                        user_name = user['user_name'] or 'Пользователь'
                        html = get_storage_warning_html(user_name, used_gb, quota_gb, percent)
                        
                        if send_email(user['email'], '⚠️ Хранилище заполнено на 90%', html, smtp_settings):
                            cur.execute(f'''
                                UPDATE {SCHEMA}.users
                                SET last_storage_warning_at = CURRENT_TIMESTAMP
                                WHERE id = %s
                            ''', (user['id'],))
                            conn.commit()
                            notified_count += 1
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'notified_users': notified_count
            })
        }
    finally:
        conn.close()

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method == 'POST':
        return check_and_notify_users(event)
    
    return {
        'statusCode': 404,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Not found'})
    }