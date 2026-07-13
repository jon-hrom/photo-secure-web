"""
Business: Единый диспетчер проверки уведомлений фотографов. Запускает все проверки
(напоминания о съёмках, дни рождения клиентов, автопродление подписок, заполнение хранилища)
одним вызовом. Работает в двух режимах: cron (каждые 10 мин) и realtime (при активности
фотографа на сайте). Защита от частых запусков: глобальный замок с интервалом 10 минут.
Args: event с httpMethod, body (source: 'cron'|'realtime', force: bool); context
Returns: HTTP ответ со статусом запуска и результатами проверок по каждому каналу
"""

import json
import os
import psycopg2
import requests

SCHEMA = 't_p28211681_photo_secure_web'

# Минимальный интервал между запусками (секунды)
THROTTLE_SECONDS = 10 * 60

# URL проверок-воркеров (диспетчер дёргает их параллельно по смыслу, последовательно по коду)
SHOOTING_REMINDERS_URL = 'https://functions.poehali.dev/de28f751-d390-4a12-9abd-23d70a40b40c'
BIRTHDAY_CHECKER_URL = 'https://functions.poehali.dev/e8f71ffe-1b27-4576-b601-7f01793bd5e2'
RECURRING_CRON_URL = 'https://functions.poehali.dev/3ed78003-2909-425d-9e2c-ec1788b7ef66'
EMAIL_NOTIFICATIONS_URL = 'https://functions.poehali.dev/26301a69-7e80-461b-bc17-2ad62cd57d4f'

CRON_TOKEN = os.environ.get('CRON_TOKEN', '')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def try_acquire_lock(force: bool, source: str):
    """Атомарно занимает замок, если прошло >= THROTTLE_SECONDS с последнего запуска.
    Возвращает (acquired: bool, seconds_since_last: float|None)."""
    conn = get_db()
    try:
        conn.autocommit = False
        with conn.cursor() as cur:
            # Блокируем строку замка, чтобы параллельные realtime-вызовы не прошли одновременно
            cur.execute(f"""
                SELECT last_run_at,
                       EXTRACT(EPOCH FROM (NOW() - last_run_at)) AS secs
                FROM {SCHEMA}.notifications_tick_lock
                WHERE id = 1
                FOR UPDATE
            """)
            row = cur.fetchone()
            secs = float(row[1]) if row and row[1] is not None else None

            if not force and secs is not None and secs < THROTTLE_SECONDS:
                conn.rollback()
                return False, secs

            cur.execute(f"""
                UPDATE {SCHEMA}.notifications_tick_lock
                SET last_run_at = NOW(), last_source = %s, runs_count = COALESCE(runs_count, 0) + 1
                WHERE id = 1
            """, (source[:20],))
            conn.commit()
            return True, secs
    finally:
        conn.close()


def call_worker(name: str, url: str, payload: dict, timeout: int = 25):
    """Вызывает воркер-проверку. Ошибки не критичны — собираем в результат."""
    try:
        headers = {'Content-Type': 'application/json'}
        if CRON_TOKEN:
            headers['X-Cron-Token'] = CRON_TOKEN
        r = requests.post(url, json=payload, headers=headers, timeout=timeout)
        ok = 200 <= r.status_code < 300
        return {'ok': ok, 'status': r.status_code}
    except Exception as e:
        print(f'[TICK] worker {name} error: {e}')
        return {'ok': False, 'error': str(e)}


def run_all_checks():
    """Запускает все проверки уведомлений по всем фотографам."""
    results = {}
    results['shooting_reminders'] = call_worker('shooting_reminders', SHOOTING_REMINDERS_URL, {})
    results['birthdays'] = call_worker('birthdays', BIRTHDAY_CHECKER_URL, {'action': 'cron_run'})
    results['recurring'] = call_worker('recurring', RECURRING_CRON_URL, {})
    results['storage_warnings'] = call_worker('storage_warnings', EMAIL_NOTIFICATIONS_URL, {})
    return results


def handler(event, context):
    method = event.get('httpMethod', 'POST').upper()
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': '', 'isBase64Encoded': False}

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            body = {}

    source = body.get('source', 'cron')
    force = bool(body.get('force', False))

    # Cron может форсировать запуск через токен (минуя throttle)
    headers = event.get('headers') or {}
    token = headers.get('X-Cron-Token') or headers.get('x-cron-token') or ''
    if CRON_TOKEN and token == CRON_TOKEN:
        force = True
        source = 'cron'

    # Отмечаем присутствие пользователя на сайте (heartbeat) для ЛЮБОГО способа входа
    # (email/VK/Yandex/Telegram). По last_seen_at строится онлайн-статус в админке.
    # Делаем это ДО throttle — чтобы присутствие фиксировалось при каждом пинге.
    user_id_hdr = headers.get('X-User-Id') or headers.get('x-user-id')
    if user_id_hdr and str(user_id_hdr).isdigit():
        try:
            conn = get_db()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        f"UPDATE {SCHEMA}.users SET last_seen_at = NOW() WHERE id = %s",
                        (int(user_id_hdr),)
                    )
                conn.commit()
            finally:
                conn.close()
        except Exception as e:
            print(f'[TICK] last_seen_at update failed: {e}')

    acquired, secs = try_acquire_lock(force, source)

    if not acquired:
        wait = int(THROTTLE_SECONDS - (secs or 0))
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'success': True,
                'ran': False,
                'reason': 'throttled',
                'seconds_since_last': int(secs) if secs is not None else None,
                'next_run_in': max(0, wait),
            }),
            'isBase64Encoded': False,
        }

    results = run_all_checks()

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'success': True,
            'ran': True,
            'source': source,
            'results': results,
        }),
        'isBase64Encoded': False,
    }