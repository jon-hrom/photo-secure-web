'''
Business: API для управления встречами - создание, получение, обновление, удаление
Args: event с httpMethod, body, queryStringParameters
Returns: HTTP response с данными встреч
'''

import json
import psycopg2
import os
from typing import Dict, Any, Optional
from datetime import datetime
from psycopg2.extras import RealDictCursor
import boto3
from botocore.exceptions import ClientError

SCHEMA = 't_p28211681_photo_secure_web'

def send_email(to_email: str, subject: str, html_body: str, from_name: str = 'FotoMix') -> bool:
    """Отправить email через Yandex Cloud Postbox"""
    try:
        access_key_id = os.environ.get('POSTBOX_ACCESS_KEY_ID')
        secret_access_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
        
        if not access_key_id or not secret_access_key:
            print("Error: POSTBOX credentials not set")
            return False
        
        client = boto3.client(
            'sesv2',
            region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key
        )
        
        from_email = f'{from_name} <jon-hrom2012@gmail.com>'
        
        response = client.send_email(
            FromEmailAddress=from_email,
            Destination={'ToAddresses': [to_email]},
            Content={
                'Simple': {
                    'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                    'Body': {'Html': {'Data': html_body, 'Charset': 'UTF-8'}}
                }
            }
        )
        
        print(f"Email sent to {to_email}. MessageId: {response.get('MessageId')}")
        return True
    except ClientError as e:
        print(f"ClientError: {e.response['Error']['Code']} - {e.response['Error']['Message']}")
        return False
    except Exception as e:
        print(f"Email error: {str(e)}")
        return False

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    return psycopg2.connect(dsn)



def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            user_id = query_params.get('userId')
            
            if not user_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'userId is required'}),
                    'isBase64Encoded': False
                }
            
            cur.execute("""
                SELECT 
                    id,
                    title,
                    description,
                    location,
                    meeting_date,
                    client_name,
                    client_phone,
                    client_email,
                    notification_enabled,
                    status,
                    created_at
                FROM t_p28211681_photo_secure_web.meetings
                WHERE creator_id = %s
                ORDER BY meeting_date ASC
            """, (user_id,))
            
            appointments = []
            for row in cur.fetchall():
                appointments.append({
                    'id': row[0],
                    'title': row[1],
                    'description': row[2],
                    'location': row[3],
                    'date': row[4].isoformat() if row[4] else None,
                    'clientName': row[5],
                    'clientPhone': row[6],
                    'clientEmail': row[7],
                    'notificationEnabled': row[8] if row[8] is not None else True,
                    'status': row[9] or 'scheduled',
                    'createdAt': row[10].isoformat() if row[10] else None
                })
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps(appointments),
                'isBase64Encoded': False
            }
        
        if method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            
            user_id = body_data.get('userId')
            title = body_data.get('title')
            description = body_data.get('description', '')
            location = body_data.get('location', '')
            meeting_date = body_data.get('date')
            client_name = body_data.get('clientName')
            client_phone = body_data.get('clientPhone')
            client_email = body_data.get('clientEmail', '')
            notification_enabled = body_data.get('notificationEnabled', True)
            
            if not user_id or not title or not meeting_date or not client_name:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'userId, title, date and clientName are required'}),
                    'isBase64Encoded': False
                }
            
            cur.execute("""
                INSERT INTO t_p28211681_photo_secure_web.meetings 
                (creator_id, title, description, location, meeting_date, client_name, client_phone, client_email, notification_enabled, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'scheduled')
                RETURNING id, created_at
            """, (user_id, title, description, location, meeting_date, client_name, client_phone, client_email, notification_enabled))
            
            result = cur.fetchone()
            appointment_id = result[0]
            created_at = result[1]
            
            conn.commit()
            
            if notification_enabled and client_email:
                meeting_datetime = datetime.fromisoformat(meeting_date.replace('Z', '+00:00')) if isinstance(meeting_date, str) else meeting_date
                formatted_date = meeting_datetime.strftime('%d.%m.%Y в %H:%M')
                
                html_body = f'''
                <!DOCTYPE html>
                <html><head><meta charset="utf-8"></head>
                <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
                        <h1 style="color: white; margin: 0;">📅 Новая встреча</h1>
                    </div>
                    <div style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
                        <p>Здравствуйте, {client_name}!</p>
                        <p>Вы записаны на встречу:</p>
                        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <p><strong>Тема:</strong> {title}</p>
                            <p><strong>Дата и время:</strong> {formatted_date}</p>
                            {f'<p><strong>Место:</strong> {location}</p>' if location else ''}
                            {f'<p><strong>Описание:</strong> {description}</p>' if description else ''}
                        </div>
                        <p style="color: #666; font-size: 14px;">Мы отправим вам напоминание за день до встречи.</p>
                    </div>
                    <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
                        <p>© 2024 Foto-Mix. Все права защищены.</p>
                    </div>
                </body></html>
                '''
                send_email(client_email, f'Встреча: {title}', html_body, 'FotoMix')
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'id': appointment_id,
                    'title': title,
                    'description': description,
                    'location': location,
                    'date': meeting_date,
                    'clientName': client_name,
                    'clientPhone': client_phone,
                    'clientEmail': client_email,
                    'notificationEnabled': notification_enabled,
                    'status': 'scheduled',
                    'createdAt': created_at.isoformat() if created_at else None
                }),
                'isBase64Encoded': False
            }
        
        if method == 'PUT':
            body_data = json.loads(event.get('body', '{}'))
            
            appointment_id = body_data.get('id')
            user_id = body_data.get('userId')
            
            if not appointment_id or not user_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'id and userId are required'}),
                    'isBase64Encoded': False
                }
            
            update_fields = []
            params = []
            
            if 'title' in body_data:
                update_fields.append('title = %s')
                params.append(body_data['title'])
            if 'description' in body_data:
                update_fields.append('description = %s')
                params.append(body_data['description'])
            if 'location' in body_data:
                update_fields.append('location = %s')
                params.append(body_data['location'])
            if 'date' in body_data:
                update_fields.append('meeting_date = %s')
                params.append(body_data['date'])
            if 'clientName' in body_data:
                update_fields.append('client_name = %s')
                params.append(body_data['clientName'])
            if 'clientPhone' in body_data:
                update_fields.append('client_phone = %s')
                params.append(body_data['clientPhone'])
            if 'clientEmail' in body_data:
                update_fields.append('client_email = %s')
                params.append(body_data['clientEmail'])
            if 'notificationEnabled' in body_data:
                update_fields.append('notification_enabled = %s')
                params.append(body_data['notificationEnabled'])
            if 'status' in body_data:
                update_fields.append('status = %s')
                params.append(body_data['status'])
            
            if not update_fields:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'No fields to update'}),
                    'isBase64Encoded': False
                }
            
            update_fields.append('updated_at = CURRENT_TIMESTAMP')
            params.extend([appointment_id, user_id])
            
            query = f"""
                UPDATE t_p28211681_photo_secure_web.meetings 
                SET {', '.join(update_fields)}
                WHERE id = %s AND creator_id = %s
                RETURNING id
            """
            
            cur.execute(query, params)
            result = cur.fetchone()
            
            if not result:
                cur.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Appointment not found'}),
                    'isBase64Encoded': False
                }
            
            conn.commit()
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': True, 'id': appointment_id}),
                'isBase64Encoded': False
            }
        
        if method == 'DELETE':
            query_params = event.get('queryStringParameters') or {}
            appointment_id = query_params.get('id')
            user_id = query_params.get('userId')
            
            if not appointment_id or not user_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'id and userId are required'}),
                    'isBase64Encoded': False
                }
            
            cur.execute("""
                DELETE FROM t_p28211681_photo_secure_web.meetings
                WHERE id = %s AND creator_id = %s
                RETURNING id
            """, (appointment_id, user_id))
            
            result = cur.fetchone()
            
            if not result:
                cur.close()
                conn.close()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({'error': 'Appointment not found'}),
                    'isBase64Encoded': False
                }
            
            conn.commit()
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({'success': True, 'id': int(appointment_id)}),
                'isBase64Encoded': False
            }
        
        cur.close()
        conn.close()
        
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        if cur:
            cur.close()
        if conn:
            conn.close()
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }