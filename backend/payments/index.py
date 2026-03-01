import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import requests

DB_SCHEMA = 't_p28211681_photo_secure_web'


def format_method_name(method: str) -> str:
    methods = {
        'cash': 'Наличные',
        'card': 'Карта',
        'transfer': 'Перевод'
    }
    return methods.get(method, method)


def send_whatsapp_notification(user_id: str, client_phone: str, message: str, green_api_instance_id: str = '', green_api_token: str = '') -> bool:
    """Отправить WhatsApp через GREEN-API (используя credentials фотографа или дефолтные)"""
    instance_id = green_api_instance_id or os.environ.get('MAX_INSTANCE_ID', '')
    token = green_api_token or os.environ.get('MAX_TOKEN', '')

    if not instance_id or not token:
        print('[PAYMENT_NOTIF] No GREEN-API credentials')
        return False

    clean_phone = ''.join(filter(str.isdigit, client_phone))
    if not clean_phone.startswith('7'):
        clean_phone = '7' + clean_phone.lstrip('8')

    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"

    try:
        response = requests.post(url, json={
            "chatId": f"{clean_phone}@c.us",
            "message": message
        }, timeout=10)
        response.raise_for_status()
        print(f'[PAYMENT_NOTIF] WhatsApp sent to {clean_phone}')
        return True
    except Exception as e:
        print(f'[PAYMENT_NOTIF] WhatsApp error: {e}')
        return False


def send_telegram_notification(telegram_chat_id: str, message: str) -> bool:
    """Отправить Telegram уведомление"""
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not bot_token or not telegram_chat_id:
        return False

    try:
        import telebot
        bot = telebot.TeleBot(bot_token)
        bot.send_message(
            chat_id=telegram_chat_id,
            text=message,
            parse_mode='HTML',
            disable_web_page_preview=True
        )
        print(f'[PAYMENT_NOTIF] Telegram sent to {telegram_chat_id}')
        return True
    except Exception as e:
        print(f'[PAYMENT_NOTIF] Telegram error: {e}')
        return False


def send_email_notification(to_email: str, subject: str, html_body: str) -> bool:
    """Отправить email через settings API"""
    try:
        email_api = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0'
        response = requests.post(email_api, json={
            'action': 'send-booking-notification',
            'to_email': to_email,
            'client_name': '',
            'html_body': html_body,
            'subject': subject
        }, headers={'Content-Type': 'application/json'}, timeout=15)
        print(f'[PAYMENT_NOTIF] Email sent to {to_email}: {response.status_code}')
        return response.status_code == 200
    except Exception as e:
        print(f'[PAYMENT_NOTIF] Email error: {e}')
        return False


def build_payment_email_html(photographer_name: str, project_name: str, payment_amount: float, total_paid: float, total_budget: float, remaining: float, method: str) -> str:
    """HTML шаблон письма о предоплате"""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #1a1a1a; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #1a1a1a; padding: 40px 20px; }}
    .header {{ text-align: center; margin-bottom: 30px; color: #ffffff; }}
    .header h1 {{ margin: 0; font-size: 28px; font-weight: 600; }}
    .icon {{ font-size: 48px; margin-bottom: 15px; }}
    .info-block {{ border-radius: 12px; padding: 20px 25px; margin: 12px 0; }}
    .green {{ background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }}
    .blue {{ background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }}
    .purple {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }}
    .orange {{ background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }}
    .info-label {{ font-weight: 600; color: #ffffff; margin-bottom: 8px; font-size: 14px; opacity: 0.95; }}
    .info-value {{ color: #ffffff; font-size: 18px; font-weight: 500; line-height: 1.4; }}
    .summary {{ background: linear-gradient(135deg, #232526 0%, #414345 100%); border: 1px solid #555; border-radius: 12px; padding: 25px; margin: 20px 0; }}
    .summary-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #444; }}
    .summary-row:last-child {{ border-bottom: none; font-weight: bold; font-size: 20px; }}
    .summary-label {{ color: #aaa; font-size: 15px; }}
    .summary-value {{ color: #ffffff; font-size: 15px; font-weight: 600; }}
    .highlight {{ background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 24px !important; }}
    .remaining {{ color: {'#38ef7d' if remaining == 0 else '#fee140'}; font-size: 20px !important; }}
    .footer {{ margin-top: 40px; text-align: center; color: #888; font-size: 12px; line-height: 1.6; }}
    .footer a {{ color: #667eea; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">{"✅" if remaining == 0 else "💳"}</div>
      <h1>{"Оплата полностью внесена!" if remaining == 0 else "Предоплата получена"}</h1>
    </div>
    <div class="info-block green">
      <div class="info-label">👤 Фотограф</div>
      <div class="info-value">{photographer_name or 'foto-mix'}</div>
    </div>
    <div class="info-block purple">
      <div class="info-label">📋 Услуга</div>
      <div class="info-value">{project_name}</div>
    </div>
    <div class="info-block blue">
      <div class="info-label">💳 Внесено сейчас</div>
      <div class="info-value">{payment_amount:,.0f} ₽ ({format_method_name(method)})</div>
    </div>
    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">💰 Общая стоимость</span>
        <span class="summary-value">{total_budget:,.0f} ₽</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">✅ Оплачено всего</span>
        <span class="summary-value highlight">{total_paid:,.0f} ₽</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">{"✅ Полностью оплачено" if remaining == 0 else "⏳ Остаток к оплате"}</span>
        <span class="summary-value remaining">{remaining:,.0f} ₽</span>
      </div>
    </div>
    <div class="footer">
      До встречи на съёмке! 📷<br><br>
      Сообщение сформировано автоматически системой учёта клиентов<br>
      <a href="https://foto-mix.ru">foto-mix.ru</a>
    </div>
  </div>
</body>
</html>"""


def get_client_project_data(cur, client_id: int, project_id: int):
    """Получить данные клиента, проекта и фотографа"""
    cur.execute(f'''
        SELECT 
            c.phone,
            c.email,
            c.telegram_chat_id,
            c.name as client_name,
            p.name as project_name,
            p.budget,
            u.full_name as photographer_name,
            u.phone as photographer_phone,
            u.green_api_instance_id,
            u.green_api_token
        FROM {DB_SCHEMA}.clients c
        JOIN {DB_SCHEMA}.client_projects p ON p.client_id = c.id AND p.id = %s
        JOIN {DB_SCHEMA}.users u ON c.user_id = u.id
        WHERE c.id = %s
    ''', (project_id, client_id))
    return cur.fetchone()


def send_payment_notifications(cur, user_id: str, client_id: int, project_id: int, payment_amount: float, method: str):
    """Отправить уведомления о платеже по всем каналам (WhatsApp, Telegram, Email)"""
    row = get_client_project_data(cur, client_id, project_id)
    if not row:
        print('[PAYMENT_NOTIF] No client/project data found')
        return

    client_phone = row[0]
    client_email = row[1]
    telegram_chat_id = row[2]
    client_name = row[3]
    project_name = row[4] or 'Услуги фотографа'
    total_budget = float(row[5] or 0)
    photographer_name = row[6] or 'Ваш фотограф'
    photographer_phone = row[7] or ''
    green_api_instance_id = row[8] or ''
    green_api_token = row[9] or ''

    cur.execute(f'''
        SELECT COALESCE(SUM(amount), 0)
        FROM {DB_SCHEMA}.client_payments
        WHERE project_id = %s AND client_id = %s
    ''', (project_id, client_id))

    total_paid = float(cur.fetchone()[0])
    remaining = max(0, total_budget - total_paid)

    is_fully_paid = remaining == 0

    if is_fully_paid:
        wa_header = "✅ Оплата полностью внесена!"
    else:
        wa_header = "💳 Предоплата получена"

    whatsapp_message = f"""{wa_header}

📋 Услуга: {project_name}
👤 Фотограф: {photographer_name}

💳 Внесено сейчас: {payment_amount:,.0f} ₽ ({format_method_name(method)})

📊 Итого по оплате:
━━━━━━━━━━━━━━━━
💰 Общая стоимость: {total_budget:,.0f} ₽
✅ Оплачено всего: {total_paid:,.0f} ₽
{"✅ Полностью оплачено!" if is_fully_paid else f"⏳ Остаток к оплате: {remaining:,.0f} ₽"}
━━━━━━━━━━━━━━━━

{"Спасибо за полную оплату! До встречи на съёмке! 📷" if is_fully_paid else "До встречи на съёмке! 📷"}

—
Сообщение сформировано автоматически системой учёта клиентов для фотографов foto-mix.ru"""

    if client_phone:
        send_whatsapp_notification(user_id, client_phone, whatsapp_message, green_api_instance_id, green_api_token)

    if telegram_chat_id:
        tg_message = f"""{"✅ <b>Оплата полностью внесена!</b>" if is_fully_paid else "💳 <b>Предоплата получена</b>"}

📋 Услуга: {project_name}
👤 Фотограф: {photographer_name}

💳 Внесено сейчас: <b>{payment_amount:,.0f} ₽</b> ({format_method_name(method)})

📊 <b>Итого по оплате:</b>
💰 Общая стоимость: {total_budget:,.0f} ₽
✅ Оплачено всего: <b>{total_paid:,.0f} ₽</b>
{"✅ Полностью оплачено!" if is_fully_paid else f"⏳ Остаток к оплате: <b>{remaining:,.0f} ₽</b>"}

{"Спасибо за полную оплату! " if is_fully_paid else ""}До встречи на съёмке! 📷"""
        send_telegram_notification(telegram_chat_id, tg_message)

    if client_email:
        subject = "✅ Оплата полностью внесена!" if is_fully_paid else f"💳 Предоплата получена — {project_name}"
        html = build_payment_email_html(
            photographer_name, project_name, payment_amount,
            total_paid, total_budget, remaining, method
        )
        send_email_notification(client_email, subject, html)


def build_refund_email_html(photographer_name: str, project_name: str, refund_amount: float, total_paid: float, total_budget: float, remaining: float) -> str:
    """HTML шаблон письма о возврате средств"""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #1a1a1a; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #1a1a1a; padding: 40px 20px; }}
    .header {{ text-align: center; margin-bottom: 30px; color: #ffffff; }}
    .header h1 {{ margin: 0; font-size: 28px; font-weight: 600; }}
    .icon {{ font-size: 48px; margin-bottom: 15px; }}
    .info-block {{ border-radius: 12px; padding: 20px 25px; margin: 12px 0; }}
    .green {{ background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }}
    .blue {{ background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }}
    .purple {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }}
    .orange {{ background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%); }}
    .info-label {{ font-weight: 600; color: #ffffff; margin-bottom: 8px; font-size: 14px; opacity: 0.95; }}
    .info-value {{ color: #ffffff; font-size: 18px; font-weight: 500; line-height: 1.4; }}
    .summary {{ background: linear-gradient(135deg, #232526 0%, #414345 100%); border: 1px solid #555; border-radius: 12px; padding: 25px; margin: 20px 0; }}
    .summary-row {{ display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #444; }}
    .summary-row:last-child {{ border-bottom: none; font-weight: bold; font-size: 20px; }}
    .summary-label {{ color: #aaa; font-size: 15px; }}
    .summary-value {{ color: #ffffff; font-size: 15px; font-weight: 600; }}
    .refund-highlight {{ color: #ffd200; font-size: 24px !important; }}
    .remaining {{ color: #fee140; font-size: 20px !important; }}
    .welcome {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px 25px; margin: 20px 0; text-align: center; }}
    .welcome-text {{ color: #ffffff; font-size: 16px; line-height: 1.6; }}
    .footer {{ margin-top: 40px; text-align: center; color: #888; font-size: 12px; line-height: 1.6; }}
    .footer a {{ color: #667eea; text-decoration: none; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">🔄</div>
      <h1>Возврат средств</h1>
    </div>
    <div class="info-block green">
      <div class="info-label">👤 Фотограф</div>
      <div class="info-value">{photographer_name or 'foto-mix'}</div>
    </div>
    <div class="info-block purple">
      <div class="info-label">📋 Услуга</div>
      <div class="info-value">{project_name}</div>
    </div>
    <div class="info-block orange">
      <div class="info-label">🔄 Сумма возврата</div>
      <div class="info-value">{refund_amount:,.0f} ₽</div>
    </div>
    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">💰 Общая стоимость</span>
        <span class="summary-value">{total_budget:,.0f} ₽</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">✅ Оплачено после возврата</span>
        <span class="summary-value refund-highlight">{total_paid:,.0f} ₽</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">⏳ Остаток к оплате</span>
        <span class="summary-value remaining">{remaining:,.0f} ₽</span>
      </div>
    </div>
    <div class="welcome">
      <div class="welcome-text">
        Будем рады видеть вас на наших съёмках! 📸<br>
        Если у вас есть вопросы — свяжитесь с фотографом.
      </div>
    </div>
    <div class="footer">
      Сообщение сформировано автоматически системой учёта клиентов<br>
      <a href="https://foto-mix.ru">foto-mix.ru</a>
    </div>
  </div>
</body>
</html>"""


def send_refund_notifications(cur, user_id: str, client_id: int, project_id: int, refund_amount: float):
    """Отправить уведомления о возврате средств по всем каналам"""
    row = get_client_project_data(cur, client_id, project_id)
    if not row:
        print('[REFUND_NOTIF] No client/project data found')
        return

    client_phone = row[0]
    client_email = row[1]
    telegram_chat_id = row[2]
    client_name = row[3]
    project_name = row[4] or 'Услуги фотографа'
    total_budget = float(row[5] or 0)
    photographer_name = row[6] or 'Ваш фотограф'
    photographer_phone = row[7] or ''
    green_api_instance_id = row[8] or ''
    green_api_token = row[9] or ''

    cur.execute(f'''
        SELECT COALESCE(SUM(amount), 0)
        FROM {DB_SCHEMA}.client_payments
        WHERE project_id = %s AND client_id = %s
    ''', (project_id, client_id))

    total_paid = float(cur.fetchone()[0])
    remaining = max(0, total_budget - total_paid)

    whatsapp_message = f"""🔄 Возврат средств

📋 Услуга: {project_name}
👤 Фотограф: {photographer_name}

🔄 Сумма возврата: {refund_amount:,.0f} ₽

📊 Итого по оплате:
━━━━━━━━━━━━━━━━
💰 Общая стоимость: {total_budget:,.0f} ₽
✅ Оплачено после возврата: {total_paid:,.0f} ₽
⏳ Остаток к оплате: {remaining:,.0f} ₽
━━━━━━━━━━━━━━━━

Будем рады видеть вас на наших съёмках! 📸
Если у вас есть вопросы — свяжитесь с фотографом.

—
Сообщение сформировано автоматически системой учёта клиентов для фотографов foto-mix.ru"""

    if client_phone:
        send_whatsapp_notification(user_id, client_phone, whatsapp_message, green_api_instance_id, green_api_token)

    if telegram_chat_id:
        tg_message = f"""🔄 <b>Возврат средств</b>

📋 Услуга: {project_name}
👤 Фотограф: {photographer_name}

🔄 Сумма возврата: <b>{refund_amount:,.0f} ₽</b>

📊 <b>Итого по оплате:</b>
💰 Общая стоимость: {total_budget:,.0f} ₽
✅ Оплачено после возврата: <b>{total_paid:,.0f} ₽</b>
⏳ Остаток к оплате: <b>{remaining:,.0f} ₽</b>

Будем рады видеть вас на наших съёмках! 📸"""
        send_telegram_notification(telegram_chat_id, tg_message)

    if client_email:
        subject = f"🔄 Возврат средств — {project_name}"
        html = build_refund_email_html(
            photographer_name, project_name, refund_amount,
            total_paid, total_budget, remaining
        )
        send_email_notification(client_email, subject, html)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Управление платежами: получение, добавление, удаление с уведомлениями клиенту'''
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }

    if method == 'GET':
        params = event.get('queryStringParameters') or {}
        user_id = params.get('userId')
        project_id = params.get('projectId')

        if not user_id or not project_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId and projectId required'}),
                'isBase64Encoded': False
            }

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(f'''
                    SELECT pay.id, pay.amount, pay.payment_date as date, pay.method, pay.project_id as "projectId"
                    FROM {DB_SCHEMA}.client_payments pay
                    JOIN {DB_SCHEMA}.client_projects p ON pay.project_id = p.id
                    JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE c.user_id = %s AND pay.project_id = %s
                    ORDER BY pay.payment_date DESC
                ''', (user_id, project_id))

                payments = cur.fetchall()

                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps([dict(p) for p in payments], default=str),
                    'isBase64Encoded': False
                }
        finally:
            conn.close()

    if method == 'POST':
        body_data = json.loads(event.get('body', '{}'))
        user_id = body_data.get('userId')
        project_id = body_data.get('projectId')
        amount = body_data.get('amount')
        method_type = body_data.get('method', 'cash')
        date = body_data.get('date')

        if not user_id or not project_id or not amount:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId, projectId and amount required'}),
                'isBase64Encoded': False
            }

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor() as cur:
                cur.execute(f'''
                    SELECT 1 FROM {DB_SCHEMA}.client_projects p
                    JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE p.id = %s AND c.user_id = %s
                ''', (project_id, user_id))

                if not cur.fetchone():
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Access denied'}),
                        'isBase64Encoded': False
                    }

                cur.execute(f'''
                    SELECT c.id as client_id
                    FROM {DB_SCHEMA}.client_projects p
                    JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE p.id = %s
                ''', (project_id,))

                client_row = cur.fetchone()
                if not client_row:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Project not found'}),
                        'isBase64Encoded': False
                    }

                client_id = client_row[0]

                cur.execute(f'''
                    INSERT INTO {DB_SCHEMA}.client_payments (project_id, client_id, amount, method, payment_date)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                ''', (project_id, client_id, amount, method_type, date))

                payment_id = cur.fetchone()[0]
                conn.commit()

                try:
                    send_payment_notifications(cur, str(user_id), client_id, int(project_id), float(amount), method_type)
                except Exception as e:
                    print(f'[PAYMENT_NOTIF] Notification error (non-critical): {e}')

                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True, 'id': payment_id}),
                    'isBase64Encoded': False
                }
        finally:
            conn.close()

    if method == 'DELETE':
        body_data = json.loads(event.get('body', '{}'))
        user_id = body_data.get('userId')
        payment_id = body_data.get('paymentId')

        if not user_id or not payment_id:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'userId and paymentId required'}),
                'isBase64Encoded': False
            }

        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        try:
            with conn.cursor() as cur:
                cur.execute(f'''
                    SELECT pay.amount, pay.project_id, pay.client_id
                    FROM {DB_SCHEMA}.client_payments pay
                    JOIN {DB_SCHEMA}.client_projects p ON pay.project_id = p.id
                    JOIN {DB_SCHEMA}.clients c ON p.client_id = c.id
                    WHERE pay.id = %s AND c.user_id = %s
                ''', (payment_id, user_id))

                payment_row = cur.fetchone()
                if not payment_row:
                    return {
                        'statusCode': 403,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Access denied'}),
                        'isBase64Encoded': False
                    }

                cur.execute(f'DELETE FROM {DB_SCHEMA}.client_payments WHERE id = %s', (payment_id,))
                conn.commit()

                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': True}),
                    'isBase64Encoded': False
                }
        finally:
            conn.close()

    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'}),
        'isBase64Encoded': False
    }