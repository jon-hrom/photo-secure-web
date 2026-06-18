"""
Business: Управление подпиской пользователя — получить статус автопродления и отключить его в ЛК
Args: event - dict с httpMethod, headers (X-User-Id), queryStringParameters, body
      context - object с request_id
Returns: HTTP response dict со статусом подписки/автопродления
"""

import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = 't_p28211681_photo_secure_web'

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
}


def resp(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, default=str),
        'isBase64Encoded': False,
    }


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], cursor_factory=RealDictCursor)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return resp(401, {'error': 'Требуется авторизация'})
    user_id = int(user_id)

    conn = get_conn()
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute(f"""
                SELECT us.id, us.plan_id, sp.name AS plan_name, us.expires_at,
                       us.locked_price_rub, us.duration_months, us.auto_renew, us.status
                FROM {SCHEMA}.user_subscriptions us
                LEFT JOIN {SCHEMA}.storage_plans sp ON sp.id = us.plan_id
                WHERE us.user_id = {user_id} AND us.status = 'active'
                ORDER BY us.created_at DESC
                LIMIT 1
            """)
            sub = cur.fetchone()

            cur.execute(f"""
                SELECT id, plan_id, duration_months, locked_price_rub, next_charge_at, status
                FROM {SCHEMA}.recurring_subscriptions
                WHERE user_id = {user_id} AND status = 'active'
                ORDER BY created_at DESC
                LIMIT 1
            """)
            rec = cur.fetchone()

            return resp(200, {
                'success': True,
                'subscription': dict(sub) if sub else None,
                'recurring': dict(rec) if rec else None,
                'auto_renew': bool(rec) ,
            })

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            action = body.get('action', '')

            if action == 'cancel_auto_renew':
                cur.execute(f"""
                    UPDATE {SCHEMA}.recurring_subscriptions
                    SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = {user_id} AND status = 'active'
                """)
                cur.execute(f"""
                    UPDATE {SCHEMA}.user_subscriptions
                    SET auto_renew = FALSE, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = {user_id} AND status = 'active'
                """)
                conn.commit()
                return resp(200, {
                    'success': True,
                    'message': 'Автопродление отключено. Доступ сохранится до конца оплаченного периода.',
                })

            return resp(400, {'error': 'Неизвестное действие'})

        return resp(405, {'error': 'Method not allowed'})
    finally:
        cur.close()
        conn.close()
