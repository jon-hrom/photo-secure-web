"""
Business: Отправляет клиентам галерей напоминание оставить отзыв через 2 дня после
входа, если отзыв так и не оставлен. Каналы: Email и MAX (Green-API). В конце текста —
прямая ссылка на портфолио фотографа с отзывами. Запускается по cron через notifications-tick.
Args: event с httpMethod, body; context (object с request_id)
Returns: HTTP-ответ со статистикой обработки (sent / skipped / failed)
"""

import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional

import psycopg2
import requests

SCHEMA = 't_p28211681_photo_secure_web'
PORTFOLIO_BASE = 'https://foto-mix.ru/p/'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Cron-Token',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
}


def get_db():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def normalize_phone(phone: str) -> str:
    clean = ''.join(filter(str.isdigit, phone or ''))
    if not clean:
        return ''
    if not clean.startswith('7') and not clean.startswith('375'):
        clean = '7' + clean.lstrip('8')
    return clean


def portfolio_url(slug: str) -> str:
    return f'{PORTFOLIO_BASE}{slug}/otzyvy'


def extract_first_name(full_name: str) -> str:
    # ФИО хранится в формате "Фамилия Имя [Отчество]" — имя это второе слово.
    parts = (full_name or '').strip().split()
    if len(parts) >= 2:
        return parts[1]
    return parts[0] if parts else ''


def build_message(full_name: str, slug: str) -> str:
    name = extract_first_name(full_name)
    hello = f'{name}, здравствуйте!' if name else 'Здравствуйте!'
    link = portfolio_url(slug)
    return (
        f'{hello} 💛\n\n'
        'Прошло немного времени после нашей съёмки, а вы так и не оставили отзыв. '
        'Будем очень благодарны, если поделитесь парой тёплых слов — это вдохновляет '
        'и помогает создавать для вас ещё более красивые работы.\n\n'
        f'Оставить отзыв можно здесь:\n{link}'
    )


def build_email_html(full_name: str, slug: str) -> str:
    name = extract_first_name(full_name)
    hello = f'{name}, здравствуйте!' if name else 'Здравствуйте!'
    link = portfolio_url(slug)
    return f'''
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937;">
      <h2 style="color:#7c3aed;">{hello} 💛</h2>
      <p style="font-size:15px;line-height:1.6;">
        Прошло немного времени после нашей съёмки, а вы так и не оставили отзыв.
        Будем очень благодарны, если поделитесь парой тёплых слов — это вдохновляет
        и помогает создавать для вас ещё более красивые работы.
      </p>
      <p style="text-align:center;margin:28px 0;">
        <a href="{link}" style="background:#7c3aed;color:#fff;text-decoration:none;
           padding:12px 28px;border-radius:10px;font-weight:600;display:inline-block;">
           Оставить отзыв
        </a>
      </p>
      <p style="font-size:13px;color:#6b7280;">Если кнопка не работает, откройте ссылку: {link}</p>
    </div>
    '''


def get_smtp_settings() -> Optional[Dict[str, str]]:
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                SELECT setting_key, setting_value FROM {SCHEMA}.site_settings
                WHERE setting_key IN ('smtp_host','smtp_port','smtp_user','smtp_password','email_notifications_enabled')
            ''')
            rows = cur.fetchall()
        settings = {r[0]: r[1] for r in rows}
        if not all(k in settings for k in ('smtp_host', 'smtp_user', 'smtp_password')):
            return None
        if settings.get('email_notifications_enabled') != 'true':
            return None
        return settings
    finally:
        conn.close()


def send_email(to_email: str, subject: str, html_body: str, smtp: Dict[str, str]) -> bool:
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = f'FotoMix <{smtp["smtp_user"]}>'
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(html_body, 'html', 'utf-8'))
        host = smtp['smtp_host']
        port = int(smtp.get('smtp_port', '587'))
        with smtplib.SMTP(host, port, timeout=15) as server:
            server.starttls()
            server.login(smtp['smtp_user'], smtp['smtp_password'])
            server.send_message(msg)
        return True
    except Exception as e:
        print(f'[REVIEW-CRON] email error to {to_email}: {e}')
        return False


def send_max(phone: str, message: str) -> bool:
    instance_id = os.environ.get('MAX_INSTANCE_ID', '')
    token = os.environ.get('MAX_TOKEN', '')
    if not instance_id or not token:
        return False
    clean = normalize_phone(phone)
    if not clean:
        return False
    try:
        media = instance_id[:4] if len(instance_id) >= 4 else '7103'
        url = f'https://{media}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}'
        r = requests.post(url, json={'chatId': f'{clean}@c.us', 'message': message}, timeout=12)
        if 200 <= r.status_code < 300:
            return True
        print(f'[REVIEW-CRON] max status {r.status_code}: {r.text[:200]}')
        return False
    except Exception as e:
        print(f'[REVIEW-CRON] max error to {phone}: {e}')
        return False


def review_exists(cur, reminder) -> bool:
    """Проверяет, оставил ли клиент отзыв (по client_id/gallery_code или контактам)."""
    client_id = reminder['client_id']
    gallery_code = reminder['gallery_code']
    phone = reminder.get('phone') or ''
    email = reminder.get('email') or ''
    cur.execute(f'''
        SELECT 1 FROM {SCHEMA}.portfolio_reviews
        WHERE (
            (client_id IS NOT NULL AND client_id = %s)
            OR (gallery_code = %s AND client_id = %s)
            OR (%s <> '' AND client_phone = %s)
            OR (%s <> '' AND LOWER(client_email) = LOWER(%s))
        )
        LIMIT 1
    ''', (client_id, gallery_code, client_id, phone, phone, email, email))
    return cur.fetchone() is not None


def process_reminders() -> Dict[str, int]:
    stats = {'sent': 0, 'skipped_review': 0, 'failed': 0, 'processed': 0}
    smtp = get_smtp_settings()
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(f'''
                SELECT r.id, r.client_id, r.gallery_code, r.photographer_id, r.portfolio_slug,
                       r.full_name, r.phone, r.email
                FROM {SCHEMA}.review_reminders r
                LEFT JOIN {SCHEMA}.portfolios p ON p.slug = r.portfolio_slug
                WHERE r.status = 'pending' AND r.send_at <= NOW()
                  AND COALESCE(p.review_reminders_enabled, TRUE) = TRUE
                  AND COALESCE(p.is_published, TRUE) = TRUE
                ORDER BY r.send_at
                LIMIT 50
            ''')
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]

        for rem in rows:
            stats['processed'] += 1
            with conn.cursor() as cur:
                # Отзыв уже оставлен — не беспокоим
                if review_exists(cur, rem):
                    cur.execute(
                        f"UPDATE {SCHEMA}.review_reminders SET status='cancelled', processed_at=NOW() WHERE id=%s",
                        (rem['id'],)
                    )
                    conn.commit()
                    stats['skipped_review'] += 1
                    continue

                slug = rem['portfolio_slug']
                full_name = rem.get('full_name') or ''
                channels = []

                if rem.get('email') and smtp:
                    if send_email(rem['email'], 'Будем рады вашему отзыву 💛',
                                  build_email_html(full_name, slug), smtp):
                        channels.append('email')

                if rem.get('phone'):
                    if send_max(rem['phone'], build_message(full_name, slug)):
                        channels.append('max')

                if channels:
                    cur.execute(
                        f"UPDATE {SCHEMA}.review_reminders SET status='sent', channels_sent=%s, processed_at=NOW() WHERE id=%s",
                        (','.join(channels), rem['id'])
                    )
                    stats['sent'] += 1
                else:
                    cur.execute(
                        f"UPDATE {SCHEMA}.review_reminders SET status='skipped', processed_at=NOW() WHERE id=%s",
                        (rem['id'],)
                    )
                    stats['failed'] += 1
                conn.commit()
    finally:
        conn.close()
    return stats


def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'POST').upper()
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': '', 'isBase64Encoded': False}

    try:
        stats = process_reminders()
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({'success': True, 'stats': stats}),
            'isBase64Encoded': False,
        }
    except Exception as e:
        print(f'[REVIEW-CRON] fatal: {e}')
        return {
            'statusCode': 500,
            'headers': CORS,
            'body': json.dumps({'success': False, 'error': str(e)}),
            'isBase64Encoded': False,
        }