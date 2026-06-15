"""
Приём вебхуков green-api (MAX) о статусах доставки исходящих сообщений.
Сохраняет статусы (sent/delivered/read/noAccount и т.п.) в БД и обновляет лог отправок.
Документация: https://green-api.com/v3/docs/api/receiving/technology-webhook-endpoint/
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        'isBase64Encoded': False,
        'body': json.dumps(body),
    }


def handler(event: dict, context) -> dict:
    '''Принимает вебхуки green-api о статусах доставки MAX-сообщений и сохраняет их.'''
    method = event.get('httpMethod', 'POST')
    if method == 'OPTIONS':
        return _resp(200, {})
    if method == 'GET':
        return _resp(200, {'ok': True})

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            body = {}

    type_webhook = body.get('typeWebhook', '')

    # Нас интересуют только статусы исходящих сообщений
    if type_webhook != 'outgoingMessageStatus':
        return _resp(200, {'ignored': type_webhook or 'unknown'})

    message_id = body.get('idMessage') or ''
    status = body.get('status') or 'unknown'
    chat_id = body.get('chatId') or body.get('senderData', {}).get('chatId') or ''
    phone = str(chat_id).replace('@c.us', '') if chat_id else None

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(
            f"INSERT INTO {SCHEMA}.max_delivery_events "
            f"(message_id, chat_id, phone, status, type_webhook, raw, received_at) "
            f"VALUES (%s, %s, %s, %s, %s, %s, NOW())",
            (message_id, chat_id, phone, status, type_webhook, json.dumps(body)),
        )
        # Обновляем итоговый статус в логе отправки по idMessage
        if message_id:
            cur.execute(
                f"UPDATE {SCHEMA}.max_service_logs "
                f"SET delivery_status = %s, delivery_updated_at = NOW() "
                f"WHERE message_id = %s",
                (status, message_id),
            )
            # Если у номера noAccount — поправим кэш аккаунта
            if status == 'noAccount' and phone:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.max_account_cache (phone, exists_flag, chat_id, checked_at) "
                    f"VALUES (%s, FALSE, '', NOW()) "
                    f"ON CONFLICT (phone) DO UPDATE SET exists_flag = FALSE, checked_at = NOW()",
                    (phone,),
                )
        conn.commit()
    except Exception as e:
        print(f'[max-webhook] db error: {e}')
        conn.rollback()
    finally:
        cur.close()
        conn.close()

    return _resp(200, {'success': True})
