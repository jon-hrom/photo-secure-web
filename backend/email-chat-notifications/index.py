import json
import os
import psycopg2
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

def handler(event: dict, context) -> dict:
    '''Отправка email-уведомлений о новых сообщениях в чате'''
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    try:
        dsn = os.environ.get('DATABASE_URL')
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        
        if method == 'POST':
            body = json.loads(event.get('body', '{}'))
            photographer_id = body.get('photographer_id')
            client_name = body.get('client_name', 'Клиент')
            message_preview = body.get('message_preview', '')
            
            if not photographer_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'photographer_id required'})
                }
            
            # Получаем email фотографа  
            cur.execute("""
                SELECT email, username 
                FROM t_p28211681_photo_secure_web.users 
                WHERE id = %s
            """, (photographer_id,))
            
            row = cur.fetchone()
            if not row or not row[0]:
                cur.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Photographer email not found'})
                }
            
            photographer_email = row[0]
            photographer_name = row[1]
            
            # Отправляем email
            sent = send_email(
                to_email=photographer_email,
                photographer_name=photographer_name,
                client_name=client_name,
                message_preview=message_preview
            )
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': sent})
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
        
    except Exception as e:
        print(f'Error in email notifications: {str(e)}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }

def send_email(to_email: str, photographer_name: str, client_name: str, message_preview: str) -> bool:
    '''Отправка email через SMTP'''
    try:
        smtp_host = os.environ.get('SMTP_HOST', 'smtp.yandex.ru')
        smtp_port = int(os.environ.get('SMTP_PORT', '465'))
        smtp_user = os.environ.get('SMTP_USER')
        smtp_pass = os.environ.get('SMTP_PASSWORD')
        
        if not smtp_user or not smtp_pass:
            print('[EMAIL] SMTP credentials not configured')
            return False
        
        msg = MIMEMultipart('alternative')
        msg['From'] = f'Photo Secure <{smtp_user}>'
        msg['To'] = to_email
        msg['Subject'] = f'Новое сообщение от {client_name}'
        
        text_body = f'''
Здравствуйте, {photographer_name}!

У вас новое сообщение от клиента {client_name}.

{message_preview}

Чтобы ответить, войдите в админ-панель Photo Secure.
        '''
        
        html_body = f'''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2563eb;">Новое сообщение в чате</h2>
        <p>Здравствуйте, {photographer_name}!</p>
        <p>У вас новое сообщение от клиента <strong>{client_name}</strong>.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;">{message_preview}</p>
        </div>
        <p>Чтобы ответить, войдите в админ-панель Photo Secure.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="font-size: 12px; color: #6b7280;">
            Это автоматическое уведомление от Photo Secure Web
        </p>
    </div>
</body>
</html>
        '''
        
        msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))
        
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        
        print(f'[EMAIL] Sent to {to_email}')
        return True
        
    except Exception as e:
        print(f'[EMAIL] Error sending: {str(e)}')
        import traceback
        traceback.print_exc()
        return False