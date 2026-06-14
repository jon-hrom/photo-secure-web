'''
Внутренняя валюта "Энергия": получение баланса и истории транзакций пользователя.
Args: event с httpMethod, queryStringParameters (action), headers X-User-Id; context
Returns: HTTP ответ с балансом энергии или историей пополнений
'''
import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor

SCHEMA = 't_p28211681_photo_secure_web'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET').upper()
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': '', 'isBase64Encoded': False}

    headers = event.get('headers', {})
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'X-User-Id required'}), 'isBase64Encoded': False}
    user_id = int(user_id)

    params = event.get('queryStringParameters', {}) or {}
    action = params.get('action', 'balance')

    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            if action == 'history':
                cur.execute(f"""
                    SELECT id, amount, type, rub_amount, description, created_at
                    FROM {SCHEMA}.energy_transactions
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    LIMIT 50
                """, (user_id,))
                rows = [dict(r) for r in cur.fetchall()]
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'transactions': rows}, default=str), 'isBase64Encoded': False}

            cur.execute(f"SELECT energy_balance FROM {SCHEMA}.users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            balance = int(row['energy_balance']) if row else 0
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'energy_balance': balance}), 'isBase64Encoded': False}
    finally:
        conn.close()
