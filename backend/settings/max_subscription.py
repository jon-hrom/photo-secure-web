"""Учёт даты оплаты MAX (GREEN-API) и напоминания администратору."""

import os
import json
import urllib.request
import urllib.parse
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional

SCHEMA = 't_p28211681_photo_secure_web'
ADMIN_EMAIL = 'jon-hrom2012@gmail.com'
REMIND_DAYS = (3, 1, 0)


def _row_to_dict(row) -> Dict[str, Any]:
    if not row:
        return {}
    if isinstance(row, dict):
        return row
    keys = ['paid_until', 'note', 'notified_3d_at', 'notified_1d_at', 'notified_0d_at']
    return dict(zip(keys, row))


def get_subscription(conn) -> Dict[str, Any]:
    """Вернуть дату оплаты MAX и сколько дней осталось."""
    cur = conn.cursor()
    cur.execute(f"""
        SELECT paid_until, note, notified_3d_at, notified_1d_at, notified_0d_at
        FROM {SCHEMA}.max_subscription WHERE id = 1
    """)
    data = _row_to_dict(cur.fetchone())
    cur.close()

    paid_until = data.get('paid_until')
    if not paid_until:
        return {'ok': True, 'paid_until': None, 'days_left': None, 'note': data.get('note')}

    days_left = (paid_until - date.today()).days
    return {
        'ok': True,
        'paid_until': paid_until.isoformat(),
        'days_left': days_left,
        'note': data.get('note'),
    }


def save_subscription(conn, paid_until: Optional[str], note: Optional[str]) -> Dict[str, Any]:
    """Сохранить дату следующей оплаты MAX и сбросить отметки напоминаний."""
    cur = conn.cursor()
    cur.execute(f"""
        UPDATE {SCHEMA}.max_subscription
        SET paid_until = %s,
            note = %s,
            notified_3d_at = NULL,
            notified_1d_at = NULL,
            notified_0d_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
    """, (paid_until or None, note or None))
    conn.commit()
    cur.close()
    return get_subscription(conn)


def _send_telegram(text: str) -> bool:
    token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    chat_id = os.environ.get('ADMIN_TELEGRAM_CHAT_ID', '')
    if not token or not chat_id:
        return False
    try:
        url = f'https://api.telegram.org/bot{token}/sendMessage'
        payload = urllib.parse.urlencode({
            'chat_id': chat_id,
            'text': text,
            'parse_mode': 'HTML',
        }).encode()
        with urllib.request.urlopen(urllib.request.Request(url, data=payload), timeout=10) as r:
            return r.status == 200
    except Exception as e:
        print(f'[MAX_SUB] telegram error: {e}')
        return False


def _send_max(text: str) -> bool:
    instance_id = os.environ.get('MAX_INSTANCE_ID', '')
    token = os.environ.get('MAX_TOKEN', '')
    phone = os.environ.get('ADMIN_MAX_PHONE', '')
    if not instance_id or not token or not phone:
        return False
    try:
        media = instance_id[:4] if len(instance_id) >= 4 else '7103'
        url = f'https://{media}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}'
        clean = ''.join(filter(str.isdigit, phone))
        if not clean.startswith('7'):
            clean = '7' + clean.lstrip('8')
        payload = json.dumps({'chatId': f'{clean}@c.us', 'message': text}).encode()
        req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status == 200
    except Exception as e:
        print(f'[MAX_SUB] max error: {e}')
        return False


def _admin_message(conn, text: str) -> None:
    try:
        cur = conn.cursor()
        cur.execute(f"""
            INSERT INTO {SCHEMA}.admin_messages (message_type, message_text, priority, created_at)
            VALUES (%s, %s, %s, %s)
        """, ('warning', text, 'high', datetime.now()))
        conn.commit()
        cur.close()
    except Exception as e:
        print(f'[MAX_SUB] admin message error: {e}')


def _email_html(days_left: int, paid_until: date) -> str:
    if days_left > 0:
        headline = f'Подписка MAX заканчивается через {days_left} дн.'
        color = '#f59e0b'
    elif days_left == 0:
        headline = 'Подписка MAX заканчивается сегодня'
        color = '#ef4444'
    else:
        headline = f'Подписка MAX не оплачена {abs(days_left)} дн.'
        color = '#ef4444'

    return f'''<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f3f4f6;">
  <div style="max-width:560px;margin:0 auto;padding:20px;">
    <div style="background:{color};padding:26px;border-radius:12px 12px 0 0;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:21px;">{headline}</h1>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;">
      <p style="margin:0 0 6px;color:#6b7280;font-size:13px;text-transform:uppercase;">Оплачено до</p>
      <p style="margin:0 0 20px;color:#111827;font-size:20px;font-weight:600;">{paid_until.strftime('%d.%m.%Y')}</p>
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Без оплаты перестанут отправляться MAX-уведомления фотографам о новых сообщениях клиентов.
      </p>
      <div style="text-align:center;">
        <a href="https://console.green-api.com" style="display:inline-block;background:{color};color:#fff;text-decoration:none;padding:13px 30px;border-radius:8px;font-weight:600;">Оплатить в GREEN-API</a>
      </div>
      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;text-align:center;">
        Автоматическое напоминание Foto-Mix · {datetime.now().strftime('%d.%m.%Y %H:%M')}
      </p>
    </div>
  </div>
</body></html>'''


def check_and_notify(conn, send_email_fn) -> Dict[str, Any]:
    """Проверить срок и разослать напоминания за 3 дня, за сутки и в день окончания."""
    cur = conn.cursor()
    cur.execute(f"""
        SELECT paid_until, note, notified_3d_at, notified_1d_at, notified_0d_at
        FROM {SCHEMA}.max_subscription WHERE id = 1
    """)
    data = _row_to_dict(cur.fetchone())
    cur.close()

    paid_until = data.get('paid_until')
    if not paid_until:
        return {'ok': True, 'sent': False, 'reason': 'no_date'}

    days_left = (paid_until - date.today()).days
    if days_left > REMIND_DAYS[0]:
        return {'ok': True, 'sent': False, 'days_left': days_left}

    # Какая веха сработала: 3 дня, сутки, день окончания (и просрочка)
    if days_left >= 3:
        column, label = 'notified_3d_at', 'за 3 дня'
    elif days_left >= 1:
        column, label = 'notified_1d_at', 'за сутки'
    else:
        column, label = 'notified_0d_at', 'в день окончания'

    already = data.get(column)
    if already == date.today():
        return {'ok': True, 'sent': False, 'reason': 'already_sent_today', 'days_left': days_left}

    if days_left > 0:
        short = f'Подписка MAX заканчивается через {days_left} дн. — {paid_until.strftime("%d.%m.%Y")}'
    elif days_left == 0:
        short = f'Подписка MAX заканчивается сегодня ({paid_until.strftime("%d.%m.%Y")})'
    else:
        short = f'Подписка MAX просрочена на {abs(days_left)} дн. — MAX-уведомления не работают'

    text = f'⚠️ {short}. Оплатите в GREEN-API: https://console.green-api.com'

    sent = {'email': False, 'telegram': False, 'max': False}
    try:
        sent['email'] = bool(send_email_fn(
            ADMIN_EMAIL,
            f'⚠️ {short}',
            _email_html(days_left, paid_until),
            'FotoMix MAX Alert',
        ))
    except Exception as e:
        print(f'[MAX_SUB] email error: {e}')

    sent['telegram'] = _send_telegram(text)
    sent['max'] = _send_max(text)
    _admin_message(conn, text)

    cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.max_subscription SET {column} = CURRENT_DATE WHERE id = 1")
    conn.commit()
    cur.close()

    print(f'[MAX_SUB] notified {label}, days_left={days_left}, channels={sent}')
    return {'ok': True, 'sent': True, 'stage': label, 'days_left': days_left, 'channels': sent}
