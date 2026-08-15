'''
Уведомления фотографу о событиях в его галерее:
кто и когда зарегистрировался по ссылке и кто загрузил фото.
Шлём в Telegram (если привязан) и на e-mail, плюс пишем в журнал событий.
'''
import os
from datetime import datetime, timedelta

import requests

SCHEMA = 't_p28211681_photo_secure_web'

EVENT_TITLES = {
    'client_registered': 'Новый клиент в галерее',
    'client_uploaded': 'Клиент загрузил фото',
}


def _send_telegram(chat_id: str, text: str) -> bool:
    token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not token or not chat_id:
        return False
    try:
        r = requests.post(
            f'https://api.telegram.org/bot{token}/sendMessage',
            json={
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML',
                'disable_web_page_preview': True,
            },
            timeout=8,
        )
        return r.status_code == 200
    except Exception as e:
        print(f'[GALLERY_NOTIFY] telegram error: {e}')
        return False


def _send_email(to_email: str, subject: str, html: str) -> bool:
    access_key = os.environ.get('POSTBOX_ACCESS_KEY_ID')
    secret_key = os.environ.get('POSTBOX_SECRET_ACCESS_KEY')
    if not to_email or not access_key or not secret_key:
        return False
    try:
        import boto3
        client = boto3.client(
            'sesv2',
            region_name='ru-central1',
            endpoint_url='https://postbox.cloud.yandex.net',
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
        )
        client.send_email(
            FromEmailAddress='FotoMix <info@foto-mix.ru>',
            Destination={'ToAddresses': [to_email]},
            Content={'Simple': {
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {'Html': {'Data': html, 'Charset': 'UTF-8'}},
            }},
        )
        return True
    except Exception as e:
        print(f'[GALLERY_NOTIFY] email error: {e}')
        return False


def _get_owner(cur, short_code: str):
    cur.execute(
        f'''
        SELECT u.id, u.email, u.telegram_chat_id, u.telegram_id,
               COALESCE(pf.folder_name, '') AS folder_name
        FROM {SCHEMA}.folder_short_links fsl
        JOIN {SCHEMA}.users u ON u.id = fsl.user_id
        LEFT JOIN {SCHEMA}.photo_folders pf ON pf.id = fsl.folder_id
        WHERE fsl.short_code = %s
        LIMIT 1
        ''',
        (short_code,),
    )
    return cur.fetchone()


def _recently_notified(cur, short_code: str, client_id, event_type: str, minutes: int) -> bool:
    '''Не спамим фотографа: одинаковое событие по клиенту шлём не чаще, чем раз в N минут.'''
    if not client_id:
        return False
    since = datetime.utcnow() - timedelta(minutes=minutes)
    cur.execute(
        f'''
        SELECT 1 FROM {SCHEMA}.gallery_event_notifications
        WHERE short_code = %s AND client_id = %s AND event_type = %s AND created_at > %s
        LIMIT 1
        ''',
        (short_code, client_id, event_type, since),
    )
    return cur.fetchone() is not None


def notify_photographer(cur, short_code: str, event_type: str,
                        client_id=None, client_name: str = '',
                        details: str = '', throttle_minutes: int = 0) -> None:
    '''Сообщает фотографу о событии в галерее. Ошибки не роняют основной запрос.'''
    try:
        if throttle_minutes and _recently_notified(cur, short_code, client_id, event_type, throttle_minutes):
            return

        owner = _get_owner(cur, short_code)
        if not owner:
            return
        user_id, email, tg_chat_id, tg_id, folder_name = owner

        cur.execute(
            f'''
            INSERT INTO {SCHEMA}.gallery_event_notifications
            (user_id, short_code, event_type, client_id, client_name, folder_name, details)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ''',
            (user_id, short_code, event_type, client_id, client_name or '', folder_name or '', details or ''),
        )

        title = EVENT_TITLES.get(event_type, 'Событие в галерее')
        when = (datetime.utcnow() + timedelta(hours=3)).strftime('%d.%m.%Y %H:%M')
        who = client_name or 'Гость'
        link = f'https://foto-mix.ru/g/{short_code}'

        lines = [f'<b>{title}</b>', '']
        lines.append(f'Клиент: {who}')
        if folder_name:
            lines.append(f'Папка: {folder_name}')
        if details:
            lines.append(details)
        lines.append(f'Время: {when} (МСК)')
        lines.append('')
        lines.append(f'Галерея: {link}')
        text = '\n'.join(lines)

        chat = tg_chat_id or tg_id
        if chat:
            _send_telegram(str(chat), text)

        if email:
            html = (
                f'<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">'
                f'<h2 style="margin:0 0 12px">{title}</h2>'
                f'<p style="margin:4px 0">Клиент: <b>{who}</b></p>'
                + (f'<p style="margin:4px 0">Папка: {folder_name}</p>' if folder_name else '')
                + (f'<p style="margin:4px 0">{details}</p>' if details else '')
                + f'<p style="margin:4px 0">Время: {when} (МСК)</p>'
                f'<p style="margin:16px 0"><a href="{link}" '
                f'style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:8px;'
                f'text-decoration:none">Открыть галерею</a></p></div>'
            )
            _send_email(email, title, html)
    except Exception as e:
        print(f'[GALLERY_NOTIFY] failed: {e}')