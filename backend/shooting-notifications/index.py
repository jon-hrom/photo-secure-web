"""
API для отправки уведомлений о съёмках через MAX (WhatsApp)
Отправляет уведомления клиенту и фотографу при создании/изменении проекта
"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import requests
import telebot

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'
BOT_USERNAME = 'FotooMixx_bot'


def escape_sql(value):
    """Безопасное экранирование для Simple Query Protocol"""
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def get_db_connection():
    """Создание подключения к БД"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def get_max_credentials():
    """Получить GREEN-API credentials из переменных окружения"""
    instance_id = os.environ.get('MAX_INSTANCE_ID', '')
    token = os.environ.get('MAX_TOKEN', '')
    return {
        'instance_id': instance_id,
        'token': token
    }


def send_via_green_api(instance_id: str, token: str, phone: str, message: str) -> dict:
    """Отправить сообщение через GREEN-API"""
    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"
    
    clean_phone = ''.join(filter(str.isdigit, phone))
    if not clean_phone.startswith('7'):
        clean_phone = '7' + clean_phone.lstrip('8')
    
    payload = {
        "chatId": f"{clean_phone}@c.us",
        "message": message
    }
    
    print(f'[SHOOTING_NOTIF] Sending to {clean_phone}@c.us')
    
    response = requests.post(url, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


def check_max_account_cached(conn, phone: str) -> dict:
    """Проверить по кэшу, есть ли у номера аккаунт MAX. Возвращает {'known': bool, 'exists': bool}."""
    if not conn or not phone:
        return {'known': False, 'exists': True}
    clean_phone = ''.join(filter(str.isdigit, str(phone)))
    if clean_phone.startswith('8'):
        clean_phone = '7' + clean_phone[1:]
    if not clean_phone.startswith('7'):
        clean_phone = '7' + clean_phone
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT exists_flag FROM {SCHEMA}.max_account_cache WHERE phone = {escape_sql(clean_phone)}"
            )
            row = cur.fetchone()
        if not row:
            return {'known': False, 'exists': True}
        exists_flag = row['exists_flag'] if isinstance(row, dict) else row[0]
        return {'known': True, 'exists': bool(exists_flag)}
    except Exception as e:
        print(f'[SHOOTING_NOTIF] max cache check error: {e}')
        return {'known': False, 'exists': True}


def send_via_telegram(telegram_id: str, message: str) -> dict:
    """Отправить сообщение через Telegram (plain text, без HTML)."""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not bot_token:
        return {'error': 'Telegram bot token not configured'}
    
    try:
        bot = telebot.TeleBot(bot_token)
        result = bot.send_message(
            chat_id=telegram_id,
            text=message,
            disable_web_page_preview=True
        )
        return {'success': True, 'message_id': result.message_id}
    except Exception as e:
        print(f'[SHOOTING_NOTIF] Telegram error: {str(e)}')
        return {'error': str(e)}


def create_telegram_invite(conn, client_id: int, photographer_id: int, client_phone: str) -> str:
    """Создать invite-ссылку для Telegram и вернуть URL"""
    import secrets as sec
    invite_code = sec.token_urlsafe(16)
    expires_at = (datetime.utcnow() + timedelta(days=30)).isoformat()
    
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE {SCHEMA}.telegram_invites
            SET is_used = TRUE
            WHERE client_id = {client_id} AND is_used = FALSE
        """)
        cur.execute(f"""
            INSERT INTO {SCHEMA}.telegram_invites
            (invite_code, client_id, photographer_id, client_phone, expires_at)
            VALUES ({escape_sql(invite_code)}, {client_id}, {photographer_id},
                    {escape_sql(client_phone)}, {escape_sql(expires_at)})
        """)
        conn.commit()
    
    return f"https://t.me/{BOT_USERNAME}?start={invite_code}"


def format_duration(minutes) -> str:
    """Форматировать длительность в часы и минуты"""
    if not minutes:
        return "2 ч"
    minutes = int(minutes)
    if minutes < 60:
        return f"{minutes} мин"
    hours = minutes // 60
    remaining = minutes % 60
    if remaining == 0:
        return f"{hours} ч"
    return f"{hours} ч {remaining} мин"


def format_date_ru(date_str: str) -> str:
    """Форматировать дату в русский формат (15 января 2025)"""
    try:
        dt = datetime.fromisoformat(date_str.replace('Z', ''))
        months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
                  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
        return f"{dt.day} {months[dt.month - 1]} {dt.year}"
    except:
        return date_str


def send_client_notification(project_data: dict, client_data: dict, photographer_data: dict, conn=None, payment_data: dict = None) -> dict:
    """Отправить уведомление клиенту о съёмке. Пытается MAX/WhatsApp, затем Telegram."""
    instance_id = photographer_data.get('green_api_instance_id') or ''
    token = photographer_data.get('green_api_token') or ''
    if not instance_id or not token:
        creds = get_max_credentials()
    else:
        creds = {'instance_id': instance_id, 'token': token}
    
    # Формируем сообщение для клиента
    photographer_name = photographer_data.get('display_name') or photographer_data.get('email', 'Фотограф')
    photographer_phone = photographer_data.get('phone', 'не указан')
    
    date_str = format_date_ru(project_data.get('startDate', ''))
    time_str = project_data.get('shooting_time', '10:00')
    # Ensure time is in HH:MM format (handle HH:MM:SS format)
    if time_str and ':' in time_str:
        time_parts = time_str.split(':')
        hours = time_parts[0]
        minutes = time_parts[1] if len(time_parts) > 1 else '00'
        time_str = f"{hours.zfill(2)}:{minutes.zfill(2)}"
    address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    description = project_data.get('description', '')
    duration_minutes = project_data.get('shooting_duration', 120)
    duration_str = format_duration(duration_minutes)
    
    shooting_style = project_data.get('shooting_style_name', '')
    
    message_parts = [
        f"📸 Новая бронь на фотосессию от foto-mix",
        "",
        f"🎬 Услуга: {project_name}",
        f"📅 Дата: {date_str}",
        f"🕐 Время: {time_str}",
        f"⏱ Длительность: {duration_str}",
        f"📍 Место: {address}"
    ]
    
    if shooting_style:
        message_parts.append(f"🎨 Стиль съёмки: {shooting_style}")
    
    # Детализация состава заказа: съёмка, фотокниги, печать фото
    detail_lines = []

    try:
        rate = float(project_data.get('hourly_rate') or 0)
    except (ValueError, TypeError):
        rate = 0
    if rate > 0 and duration_minutes:
        shooting_sum = (float(duration_minutes) / 60.0) * rate
        detail_lines.append(f"   • Съёмка ({duration_str}): {shooting_sum:,.0f} ₽")

    try:
        pb_count = int(project_data.get('photobook_count') or 0)
    except (ValueError, TypeError):
        pb_count = 0
    try:
        pb_price = float(project_data.get('photobook_price') or 0)
    except (ValueError, TypeError):
        pb_price = 0
    if pb_count > 0 and pb_price > 0:
        detail_lines.append(f"   • Фотокнига: {pb_count} × {pb_price:,.0f} ₽ = {pb_count * pb_price:,.0f} ₽")

    photo_items = project_data.get('photo_items') or []
    if isinstance(photo_items, str):
        try:
            photo_items = json.loads(photo_items)
        except (ValueError, TypeError):
            photo_items = []
    if isinstance(photo_items, list):
        for it in photo_items:
            if not isinstance(it, dict):
                continue
            fmt = str(it.get('format', '')).strip()
            try:
                qty = int(it.get('qty') or 0)
            except (ValueError, TypeError):
                qty = 0
            try:
                price = float(it.get('price') or 0)
            except (ValueError, TypeError):
                price = 0
            if fmt and (qty > 0 or price > 0):
                detail_lines.append(f"   • Фото {fmt}: {qty} × {price:,.0f} ₽ = {qty * price:,.0f} ₽")

    if detail_lines:
        message_parts.append("")
        message_parts.append("🧾 Состав заказа:")
        message_parts.extend(detail_lines)

    budget = float(project_data.get('budget', 0))
    if budget > 0:
        if payment_data:
            prepaid = float(payment_data.get('prepaid', 0))
            if prepaid > 0:
                remaining = budget - prepaid
                message_parts.extend([
                    "",
                    f"💰 Стоимость: {budget:,.0f} ₽",
                    f"✅ Предоплата: {prepaid:,.0f} ₽",
                    f"💳 Остаток: {remaining:,.0f} ₽"
                ])
            else:
                message_parts.append(f"\n💰 Стоимость: {budget:,.0f} ₽")
        else:
            message_parts.append(f"\n💰 Стоимость: {budget:,.0f} ₽")

    if description:
        message_parts.append(f"\n📝 Пожелания: {description}")
    
    message_parts.extend([
        "",
        f"👤 Фотограф: {photographer_name}",
        f"📞 Телефон фотографа: {photographer_phone}",
        "",
        "Если у вас есть вопросы или нужно перенести съёмку, свяжитесь с фотографом.",
    ])
    
    if conn and not client_data.get('telegram_chat_id'):
        try:
            invite_url = create_telegram_invite(
                conn,
                client_data.get('id'),
                photographer_data.get('id'),
                client_data.get('phone', '')
            )
            message_parts.extend([
                "",
                "💬 Подключите Telegram для удобных уведомлений:",
                invite_url,
            ])
            print(f'[SHOOTING_NOTIF] Telegram invite added for client {client_data.get("id")}')
        except Exception as e:
            print(f'[SHOOTING_NOTIF] Failed to create telegram invite: {e}')
    
    message_parts.extend([
        "",
        "До встречи на съёмке! 📷",
        "",
        "———",
        "🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!"
    ])
    
    message = "\n".join(message_parts)
    
    results = {}
    sent_ok = False
    sent_channel = None
    wa_status = None       # 'sent' | 'delivered' | 'read' | 'failed'
    wa_error = None
    wa_id = None
    tg_status = None
    tg_error = None
    tg_id = None
    
    # Отправляем в WhatsApp/MAX если есть телефон и подключение
    if creds.get('instance_id') and creds.get('token') and client_data.get('phone'):
        try:
            result = send_via_green_api(
                creds['instance_id'],
                creds['token'],
                client_data['phone'],
                message
            )
            wa_id = result.get('idMessage')
            results['whatsapp'] = {'success': True, 'message_id': wa_id}
            sent_ok = True
            sent_channel = 'whatsapp'
            # Проверяем реальный статус доставки
            try:
                check_res = check_green_delivery_status(creds['instance_id'], creds['token'], wa_id)
                wa_status = check_res.get('status', 'sent')
                if wa_status == 'failed':
                    wa_error = f"GREEN-API status: {check_res.get('raw', '')}"
            except Exception as ce:
                print(f'[SHOOTING_NOTIF] WhatsApp status check error: {ce}')
                wa_status = 'sent'
        except Exception as e:
            err = str(e)[:300]
            print(f'[SHOOTING_NOTIF] WhatsApp error (client): {err}')
            results['whatsapp'] = {'error': err}
            wa_status = 'failed'
            wa_error = err
    elif not creds.get('instance_id') or not creds.get('token'):
        results['whatsapp'] = {'error': 'MAX/WhatsApp не подключён у фотографа'}
        wa_status = 'failed'
        wa_error = 'MAX/WhatsApp не подключён у фотографа'
    elif not client_data.get('phone'):
        wa_status = 'failed'
        wa_error = 'У клиента не указан телефон'
    
    # Отправляем в Telegram если есть telegram_chat_id или telegram_id
    tg_target = client_data.get('telegram_chat_id') or client_data.get('telegram_id')
    if tg_target:
        telegram_result = send_via_telegram(str(tg_target), message)
        results['telegram'] = telegram_result
        if telegram_result.get('success') or telegram_result.get('ok'):
            sent_ok = True
            sent_channel = sent_channel or 'telegram'
            tg_status = 'delivered'
            tg_id = str(telegram_result.get('message_id') or '') or None
        else:
            tg_status = 'failed'
            tg_error = str(telegram_result.get('error') or 'Не удалось отправить в Telegram')[:300]
    
    # Логируем ВСЕ попытки отправки в client_messages (даже неудачные), чтобы было видно историю
    if conn and client_data.get('id') and photographer_data.get('id'):
        try:
            with conn.cursor() as cur:
                if wa_status is not None:
                    cur.execute("""
                        INSERT INTO t_p28211681_photo_secure_web.client_messages
                        (client_id, photographer_id, sender_type, content, type, author, message_date,
                         is_delivered, delivery_status, delivery_error, external_message_id)
                        VALUES (%s, %s, 'photographer', %s, 'whatsapp', 'Система', NOW(),
                                %s, %s, %s, %s)
                    """, (
                        int(client_data['id']),
                        int(photographer_data['id']),
                        message,
                        wa_status in ('delivered', 'read'),
                        wa_status,
                        wa_error,
                        wa_id,
                    ))
                if tg_status is not None:
                    cur.execute("""
                        INSERT INTO t_p28211681_photo_secure_web.client_messages
                        (client_id, photographer_id, sender_type, content, type, author, message_date,
                         is_delivered, delivery_status, delivery_error, external_message_id)
                        VALUES (%s, %s, 'photographer', %s, 'telegram', 'Система', NOW(),
                                %s, %s, %s, %s)
                    """, (
                        int(client_data['id']),
                        int(photographer_data['id']),
                        message,
                        tg_status in ('delivered', 'read'),
                        tg_status,
                        tg_error,
                        tg_id,
                    ))
                conn.commit()
                print(f'[SHOOTING_NOTIF] Saved to client_messages (client_id={client_data["id"]}, wa={wa_status}, tg={tg_status})')
        except Exception as e:
            print(f'[SHOOTING_NOTIF] Failed to save to client_messages: {e}')
            try:
                conn.rollback()
            except Exception:
                pass

    # Сводка доставки клиенту — используется в уведомлении фотографу
    no_max_account = bool(wa_error and 'noAccount' in str(wa_error)) or (wa_status == 'failed' and wa_error and 'аккаунт' in str(wa_error).lower())
    max_cache = check_max_account_cached(conn, client_data.get('phone'))
    if max_cache['known'] and not max_cache['exists']:
        no_max_account = True
    results['delivery_summary'] = {
        'delivered': bool(sent_ok),
        'channel': sent_channel,
        'wa_status': wa_status,
        'wa_error': wa_error,
        'tg_status': tg_status,
        'no_max_account': no_max_account,
    }

    return results if results else {'error': 'No contact methods available'}


def check_green_delivery_status(instance_id: str, token: str, id_message: str, max_attempts: int = 3) -> dict:
    """Проверить реальный статус доставки сообщения GREEN-API по idMessage."""
    import time
    if not instance_id or not token or not id_message:
        return {'status': 'unknown', 'raw': 'no_id'}
    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/getMessage/{token}/{id_message}"
    last_status = 'unknown'
    last_raw = ''
    for attempt in range(max_attempts):
        try:
            time.sleep(0.7 if attempt == 0 else 1.2)
            resp = requests.get(url, timeout=8)
            if resp.status_code != 200:
                last_raw = f'HTTP {resp.status_code}'
                continue
            data = resp.json() or {}
            raw_status = (data.get('statusMessage') or data.get('status') or '').strip()
            last_raw = raw_status or 'empty'
            if raw_status == 'read':
                return {'status': 'read', 'raw': raw_status}
            if raw_status == 'delivered':
                return {'status': 'delivered', 'raw': raw_status}
            if raw_status == 'sent':
                last_status = 'sent'
                continue
            if raw_status in ('failed', 'noAccount', 'notInGroup', 'yellowCard'):
                return {'status': 'failed', 'raw': raw_status}
        except Exception as e:
            last_raw = str(e)[:120]
            continue
    return {'status': last_status, 'raw': last_raw}


def send_photographer_notification(project_data: dict, client_data: dict, photographer_data: dict, payment_data: dict = None, client_delivery: dict = None) -> dict:
    """Отправить уведомление фотографу о съёмке. Использует MAX/WhatsApp если подключён, иначе Telegram.
    client_delivery — сводка доставки уведомления клиенту (по каким каналам дошло, установлен ли MAX)."""
    instance_id = photographer_data.get('green_api_instance_id') or ''
    token = photographer_data.get('green_api_token') or ''
    if not instance_id or not token:
        creds = get_max_credentials()
    else:
        creds = {'instance_id': instance_id, 'token': token}
    
    # Формируем сообщение для фотографа
    client_name = client_data.get('name', 'Клиент')
    client_phone = client_data.get('phone', 'не указан')
    client_email = client_data.get('email', 'не указан')
    client_address = client_data.get('address', '')
    
    date_str = format_date_ru(project_data.get('startDate', ''))
    time_str = project_data.get('shooting_time', '10:00')
    # Ensure time is in HH:MM format (handle HH:MM:SS format)
    if time_str and ':' in time_str:
        time_parts = time_str.split(':')
        hours = time_parts[0]
        minutes = time_parts[1] if len(time_parts) > 1 else '00'
        time_str = f"{hours.zfill(2)}:{minutes.zfill(2)}"
    shooting_address = project_data.get('shooting_address', 'Адрес не указан')
    project_name = project_data.get('name', 'Съёмка')
    description = project_data.get('description', '')
    budget = float(project_data.get('budget', 0))
    duration_minutes = project_data.get('shooting_duration', 120)
    duration_str = format_duration(duration_minutes)
    
    shooting_style = project_data.get('shooting_style_name', '')
    
    message_parts = [
        f"📸 Новый заказ!",
        "",
        f"📅 Дата съёмки: {date_str}",
        f"🕐 Время: {time_str}",
        f"⏱ Длительность: {duration_str}",
        f"📍 Место: {shooting_address}"
    ]
    
    if shooting_style:
        message_parts.append(f"🎨 Стиль: {shooting_style}")
    
    message_parts.extend([
        "",
        f"👤 Клиент: {client_name}",
        f"📞 Телефон: {client_phone}"
    ])
    
    if client_email and client_email != 'не указан':
        message_parts.append(f"📧 Email: {client_email}")
    
    if client_address:
        message_parts.append(f"🏠 Адрес клиента: {client_address}")
    
    # Добавляем финансовую информацию
    if payment_data:
        prepaid = float(payment_data.get('prepaid', 0))
        remaining = budget - prepaid
        
        message_parts.extend([
            "",
            f"💰 Стоимость съёмки: {budget:,.0f} ₽"
        ])
        
        if prepaid > 0:
            message_parts.extend([
                f"✅ Предоплата: {prepaid:,.0f} ₽",
                f"💳 Остаток к получению: {remaining:,.0f} ₽"
            ])
        else:
            message_parts.append(f"💳 К оплате: {budget:,.0f} ₽")
    
    if description:
        message_parts.extend([
            "",
            f"📝 Пожелания: {description}"
        ])

    # Блок статуса доставки уведомления клиенту
    if client_delivery:
        channel_names = {'whatsapp': 'MAX/WhatsApp', 'telegram': 'Telegram'}
        if client_delivery.get('no_max_account'):
            message_parts.extend([
                "",
                "⚠️ ВНИМАНИЕ: у клиента НЕ установлен MAX на этом номере.",
            ])
            if client_delivery.get('delivered'):
                ch = channel_names.get(client_delivery.get('channel'), client_delivery.get('channel') or 'другой канал')
                message_parts.append(f"✅ Но уведомление доставлено клиенту через {ch}.")
            else:
                message_parts.append("❌ Уведомление клиенту НЕ доставлено ни по одному каналу!")
                message_parts.append("👉 Свяжитесь с клиентом лично (звонок / ВК / email).")
        elif client_delivery.get('delivered'):
            ch = channel_names.get(client_delivery.get('channel'), client_delivery.get('channel') or 'мессенджер')
            message_parts.extend([
                "",
                f"✅ Клиент уведомлён через {ch}.",
            ])
        else:
            message_parts.extend([
                "",
                "❌ Уведомление клиенту НЕ доставлено! Свяжитесь с клиентом лично.",
            ])

    message_parts.extend([
        "",
        "🎯 Удачной съёмки!"
    ])
    
    message = "\n".join(message_parts)
    
    results = {}
    sent_ok = False
    
    # Отправляем в WhatsApp/MAX если есть телефон и подключение
    if creds.get('instance_id') and creds.get('token') and photographer_data.get('phone'):
        try:
            result = send_via_green_api(
                creds['instance_id'],
                creds['token'],
                photographer_data['phone'],
                message
            )
            results['whatsapp'] = {'success': True, 'message_id': result.get('idMessage')}
            sent_ok = True
        except Exception as e:
            print(f'[SHOOTING_NOTIF] WhatsApp error (photographer): {str(e)}')
            results['whatsapp'] = {'error': str(e)}
    elif not creds.get('instance_id') or not creds.get('token'):
        results['whatsapp'] = {'error': 'MAX/WhatsApp не подключён'}
    
    # Fallback в Telegram если у фотографа привязан Telegram
    tg_chat = photographer_data.get('telegram_chat_id') or photographer_data.get('telegram_id')
    if tg_chat:
        tg_result = send_via_telegram(str(tg_chat), message)
        results['telegram'] = tg_result
        if tg_result.get('success') or tg_result.get('ok'):
            sent_ok = True
    
    if sent_ok:
        return results
    return results if results else {'error': 'No contact methods available'}


def _send_text_to_client(message: str, client_data: dict, photographer_data: dict, conn=None) -> dict:
    """Базовая отправка произвольного текста клиенту (MAX/WhatsApp → Telegram) + лог в client_messages."""
    instance_id = photographer_data.get('green_api_instance_id') or ''
    token = photographer_data.get('green_api_token') or ''
    creds = {'instance_id': instance_id, 'token': token} if instance_id and token else get_max_credentials()

    results = {}
    wa_status = None
    wa_error = None
    wa_id = None
    tg_status = None
    tg_error = None
    tg_id = None

    if creds.get('instance_id') and creds.get('token') and client_data.get('phone'):
        try:
            result = send_via_green_api(creds['instance_id'], creds['token'], client_data['phone'], message)
            wa_id = result.get('idMessage')
            results['whatsapp'] = {'success': True, 'message_id': wa_id}
            wa_status = 'sent'
        except Exception as e:
            err = str(e)[:300]
            results['whatsapp'] = {'error': err}
            wa_status = 'failed'
            wa_error = err
    elif not creds.get('instance_id') or not creds.get('token'):
        results['whatsapp'] = {'error': 'MAX/WhatsApp не подключён у фотографа'}
        wa_status = 'failed'
        wa_error = 'MAX/WhatsApp не подключён у фотографа'

    tg_target = client_data.get('telegram_chat_id') or client_data.get('telegram_id')
    if tg_target:
        tg_result = send_via_telegram(str(tg_target), message)
        results['telegram'] = tg_result
        if tg_result.get('success') or tg_result.get('ok'):
            tg_status = 'delivered'
            tg_id = str(tg_result.get('message_id') or '') or None
        else:
            tg_status = 'failed'
            tg_error = str(tg_result.get('error') or 'Не удалось отправить в Telegram')[:300]

    if conn and client_data.get('id') and photographer_data.get('id'):
        try:
            with conn.cursor() as cur:
                if wa_status is not None:
                    cur.execute("""
                        INSERT INTO t_p28211681_photo_secure_web.client_messages
                        (client_id, photographer_id, sender_type, content, type, author, message_date,
                         is_delivered, delivery_status, delivery_error, external_message_id)
                        VALUES (%s, %s, 'photographer', %s, 'whatsapp', 'Система', NOW(), %s, %s, %s, %s)
                    """, (int(client_data['id']), int(photographer_data['id']), message,
                          wa_status in ('delivered', 'read'), wa_status, wa_error, wa_id))
                if tg_status is not None:
                    cur.execute("""
                        INSERT INTO t_p28211681_photo_secure_web.client_messages
                        (client_id, photographer_id, sender_type, content, type, author, message_date,
                         is_delivered, delivery_status, delivery_error, external_message_id)
                        VALUES (%s, %s, 'photographer', %s, 'telegram', 'Система', NOW(), %s, %s, %s, %s)
                    """, (int(client_data['id']), int(photographer_data['id']), message,
                          tg_status in ('delivered', 'read'), tg_status, tg_error, tg_id))
                conn.commit()
        except Exception as e:
            print(f'[SHOOTING_NOTIF] cancel log error: {e}')
            try:
                conn.rollback()
            except Exception:
                pass

    return results if results else {'error': 'No contact methods available'}


def _send_text_to_photographer(message: str, photographer_data: dict) -> dict:
    """Базовая отправка произвольного текста фотографу (MAX/WhatsApp → Telegram)."""
    instance_id = photographer_data.get('green_api_instance_id') or ''
    token = photographer_data.get('green_api_token') or ''
    creds = {'instance_id': instance_id, 'token': token} if instance_id and token else get_max_credentials()

    results = {}
    if creds.get('instance_id') and creds.get('token') and photographer_data.get('phone'):
        try:
            result = send_via_green_api(creds['instance_id'], creds['token'], photographer_data['phone'], message)
            results['whatsapp'] = {'success': True, 'message_id': result.get('idMessage')}
        except Exception as e:
            results['whatsapp'] = {'error': str(e)[:300]}
    elif not creds.get('instance_id') or not creds.get('token'):
        results['whatsapp'] = {'error': 'MAX/WhatsApp не подключён'}

    tg_chat = photographer_data.get('telegram_chat_id') or photographer_data.get('telegram_id')
    if tg_chat:
        results['telegram'] = send_via_telegram(str(tg_chat), message)

    return results if results else {'error': 'No contact methods available'}


def send_cancellation_to_client(project_data: dict, client_data: dict, photographer_data: dict, conn=None, reserve_amount: float = 0) -> dict:
    """Заботливое сообщение клиенту об отмене съёмки."""
    photographer_name = photographer_data.get('display_name') or photographer_data.get('email', 'Фотограф')
    photographer_phone = photographer_data.get('phone', 'не указан')
    client_name = client_data.get('name', '')
    project_name = project_data.get('name', 'съёмка')
    date_str = format_date_ru(project_data.get('startDate', '')) if project_data.get('startDate') else ''
    reason = (project_data.get('cancel_reason') or '').strip()

    greeting = f"Здравствуйте, {client_name}!" if client_name else "Здравствуйте!"
    parts = [
        greeting,
        "",
        f"К сожалению, фотосъёмка «{project_name}»{(' от ' + date_str) if date_str else ''} не состоится 😔",
    ]
    if reason:
        parts.append(f"Причина: {reason}.")
    parts.extend([
        "",
        "Нам очень жаль, что так вышло. Это не отменяет нашего желания поработать с вами — мы будем рады организовать съёмку в другой удобный для вас день.",
    ])
    if reserve_amount and reserve_amount > 0:
        parts.extend([
            "",
            f"💼 Ваша предоплата {reserve_amount:,.0f} ₽ сохранена в резерве и будет учтена при следующей съёмке — ничего не потеряется.",
        ])
    parts.extend([
        "",
        f"Если захотите выбрать новую дату или у вас появятся вопросы — просто напишите фотографу.",
        f"👤 Фотограф: {photographer_name}",
        f"📞 Телефон: {photographer_phone}",
        "",
        "Спасибо за понимание и до новых встреч! 📷",
        "",
        "———",
        "🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!",
    ])
    return _send_text_to_client("\n".join(parts), client_data, photographer_data, conn)


def send_cancellation_to_photographer(project_data: dict, client_data: dict, photographer_data: dict, reserve_amount: float = 0) -> dict:
    """Уведомление фотографу об отмене съёмки."""
    client_name = client_data.get('name', 'Клиент')
    client_phone = client_data.get('phone', 'не указан')
    project_name = project_data.get('name', 'съёмка')
    date_str = format_date_ru(project_data.get('startDate', '')) if project_data.get('startDate') else ''
    reason = (project_data.get('cancel_reason') or '').strip()

    parts = [
        "⚠️ Съёмка отменена",
        "",
        f"🎬 Услуга: {project_name}",
    ]
    if date_str:
        parts.append(f"📅 Дата: {date_str}")
    parts.extend([
        f"👤 Клиент: {client_name}",
        f"📞 Телефон: {client_phone}",
    ])
    if reason:
        parts.append("")
        parts.append(f"📝 Причина: {reason}")
    if reserve_amount and reserve_amount > 0:
        parts.append("")
        parts.append(f"💼 Предоплата {reserve_amount:,.0f} ₽ перенесена в резерв клиента.")
    parts.extend([
        "",
        "Клиенту отправлено уведомление об отмене.",
    ])
    return _send_text_to_photographer("\n".join(parts), photographer_data)


def handler(event: dict, context) -> dict:
    """
    Отправка уведомлений о съёмках через MAX мессенджер
    """
    method = event.get('httpMethod', 'POST')
    
    # CORS
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    user_id = event.get('headers', {}).get('X-User-Id') or event.get('headers', {}).get('x-user-id')
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Missing X-User-Id header'})
        }
    
    try:
        body_str = event.get('body', '{}')
        if not body_str or body_str.strip() == '':
            body_str = '{}'
        body = json.loads(body_str)
        project_id = body.get('project_id')
        client_id = body.get('client_id')
        notify_client = body.get('notify_client', True)
        notify_photographer = body.get('notify_photographer', True)
        notification_type = body.get('notification_type', 'booking')
        
        if not project_id or not client_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'project_id and client_id required'})
            }
        
        conn = get_db_connection()
        
        try:
            # Получаем данные проекта из clients API
            CLIENTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d'
            import urllib.request
            
            req = urllib.request.Request(
                f'{CLIENTS_API}?userId={user_id}',
                headers={'X-User-Id': user_id}
            )
            
            with urllib.request.urlopen(req) as response:
                clients_data = json.loads(response.read().decode())
            
            # Находим проект и клиента
            project_data = None
            client_data = None
            
            for client in clients_data:
                if client.get('id') == client_id:
                    client_data = client
                    for proj in client.get('projects', []):
                        if proj.get('id') == project_id:
                            project_data = proj
                            break
                    break
            
            if not project_data or not client_data:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Project or client not found'})
                }
            
            # Получаем данные фотографа, стиль съёмки и платежи
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT id, email, phone, display_name,
                           green_api_instance_id, green_api_token,
                           telegram_chat_id, telegram_id
                    FROM {SCHEMA}.users
                    WHERE id = {escape_sql(user_id)}
                """)
                photographer_row = cur.fetchone()
                
                if not photographer_row:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Photographer not found'})
                    }
                
                photographer_data = dict(photographer_row)
                
                # Получаем название стиля съёмки, если указан
                shooting_style_id = project_data.get('shootingStyleId')
                if shooting_style_id:
                    cur.execute(f"""
                        SELECT name FROM {SCHEMA}.shooting_styles
                        WHERE id = {escape_sql(shooting_style_id)}
                    """)
                    style_row = cur.fetchone()
                    if style_row:
                        project_data['shooting_style_name'] = style_row['name']
                
                # Получаем информацию о платежах
                payment_data = None
                cur.execute(f"""
                    SELECT 
                        COALESCE(SUM(amount), 0) as total_paid
                    FROM {SCHEMA}.client_payments
                    WHERE project_id = {escape_sql(project_id)}
                      AND status = 'completed'
                """)
                payment_row = cur.fetchone()
                
                if payment_row:
                    budget = float(project_data.get('budget', 0))
                    prepaid = float(payment_row['total_paid'])
                    payment_data = {
                        'budget': budget,
                        'prepaid': prepaid
                    }
            
            results = {}

            if notification_type == 'cancellation':
                # Сумма предоплаты, ушедшей в резерв (= оплачено по проекту)
                reserve_amount = float(payment_data['prepaid']) if payment_data else 0.0
                if notify_client:
                    results['client_notification'] = send_cancellation_to_client(
                        project_data, client_data, photographer_data, conn, reserve_amount)
                if notify_photographer:
                    results['photographer_notification'] = send_cancellation_to_photographer(
                        project_data, client_data, photographer_data, reserve_amount)
            else:
                # Отправляем уведомление клиенту
                client_delivery = None
                if notify_client:
                    client_result = send_client_notification(project_data, client_data, photographer_data, conn, payment_data)
                    results['client_notification'] = client_result
                    if isinstance(client_result, dict):
                        client_delivery = client_result.get('delivery_summary')
                
                # Отправляем уведомление фотографу (со сводкой доставки клиенту)
                if notify_photographer:
                    photographer_result = send_photographer_notification(project_data, client_data, photographer_data, payment_data, client_delivery)
                    results['photographer_notification'] = photographer_result
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'results': results
                })
            }
            
        finally:
            conn.close()
            
    except Exception as e:
        print(f'[SHOOTING_NOTIF] Error: {str(e)}')
        import traceback
        print(traceback.format_exc())
        
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }