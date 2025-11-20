'''
Business: API для управления встречами - создание, получение, обновление, удаление
Args: event с httpMethod, body, queryStringParameters
Returns: HTTP response с данными встреч
'''

import json
import psycopg2
import os
from typing import Dict, Any
from datetime import datetime

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
