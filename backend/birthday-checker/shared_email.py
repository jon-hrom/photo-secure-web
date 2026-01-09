'''
Shared email utility for birthday notifications
'''

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os

SCHEMA = 't_p28211681_photo_secure_web'

def get_smtp_settings() -> Optional[Dict[str, str]]:
    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        return None
    
    conn = psycopg2.connect(db_url)
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

def send_email(to_email: str, subject: str, html_body: str, from_name: str = 'FotoMix') -> bool:
    smtp_settings = get_smtp_settings()
    
    if not smtp_settings:
        print('Email notifications disabled or SMTP not configured')
        return False
    
    msg = MIMEMultipart('alternative')
    msg['From'] = f'{from_name} <{smtp_settings["smtp_user"]}>'
    msg['To'] = to_email
    msg['Subject'] = subject
    
    html_part = MIMEText(html_body, 'html', 'utf-8')
    msg.attach(html_part)
    
    try:
        smtp_host = smtp_settings['smtp_host']
        smtp_port = int(smtp_settings.get('smtp_port', '587'))
        smtp_user = smtp_settings['smtp_user']
        smtp_password = smtp_settings['smtp_password']
        
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        print(f'Email sent successfully to {to_email}')
        return True
    except Exception as e:
        print(f'Email send error: {e}')
        return False
