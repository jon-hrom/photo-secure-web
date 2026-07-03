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
                  AND (us.expires_at IS NULL OR us.expires_at > CURRENT_TIMESTAMP)
                ORDER BY us.expires_at DESC NULLS LAST, us.created_at DESC
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

            # Текущий фактический тариф пользователя
            cur.execute(f"""
                SELECT plan_id FROM {SCHEMA}.users WHERE id = {user_id}
            """)
            urow = cur.fetchone()
            current_plan_id = int(urow['plan_id']) if urow and urow.get('plan_id') is not None else None

            # Оплаченный платный тариф с НЕистёкшим сроком, к которому можно
            # вернуться бесплатно (клиент оплатил, но временно ушёл на другой/бесплатный).
            cur.execute(f"""
                SELECT us.plan_id, sp.name AS plan_name, us.expires_at, us.custom_quota_gb,
                       sp.quota_gb, sp.max_clients
                FROM {SCHEMA}.user_subscriptions us
                LEFT JOIN {SCHEMA}.storage_plans sp ON sp.id = us.plan_id
                WHERE us.user_id = {user_id}
                  AND us.status = 'active'
                  AND us.payment_status = 'completed'
                  AND us.price_paid_rub > 0
                  AND us.expires_at IS NOT NULL
                  AND us.expires_at > CURRENT_TIMESTAMP
                ORDER BY us.expires_at DESC
                LIMIT 1
            """)
            paid = cur.fetchone()
            resumable_paid = None
            if paid and paid['plan_id'] != current_plan_id:
                resumable_paid = {
                    'plan_id': int(paid['plan_id']),
                    'plan_name': paid['plan_name'],
                    'expires_at': paid['expires_at'],
                    'quota_gb': float(paid['quota_gb']) if paid.get('quota_gb') is not None else None,
                    'max_clients': int(paid['max_clients']) if paid.get('max_clients') is not None else None,
                }

            return resp(200, {
                'success': True,
                'subscription': dict(sub) if sub else None,
                'recurring': dict(rec) if rec else None,
                'auto_renew': bool(rec),
                'current_plan_id': current_plan_id,
                'resumable_paid': resumable_paid,
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