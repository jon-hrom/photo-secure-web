"""
Передача клиентов/проектов между фотографами.

Поддерживает действия (action в query или body):
- create       — отправить передачу
- list_outgoing — мои исходящие
- list_incoming — мои входящие (pending)
- accept       — принять передачу (атомарно переносит данные)
- reject       — отказаться
- cancel       — отменить (только отправитель, пока pending)
- mark_seen    — пометить как просмотренное

Все операции через Simple Query Protocol (psycopg2).
"""

import json
import os
from typing import Dict, Any, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import requests

DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = 't_p28211681_photo_secure_web'


def esc(value) -> str:
    if value is None:
        return 'NULL'
    if isinstance(value, bool):
        return 'TRUE' if value else 'FALSE'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def norm_phone(p: str) -> str:
    if not p:
        return ''
    digits = ''.join(filter(str.isdigit, p))
    if not digits:
        return ''
    if digits.startswith('8'):
        digits = '7' + digits[1:]
    if not digits.startswith('7') and len(digits) == 10:
        digits = '7' + digits
    return digits


def db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def cors_headers() -> dict:
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
        'Access-Control-Max-Age': '86400',
        'Content-Type': 'application/json',
    }


def ok(data: dict, status: int = 200) -> dict:
    return {'statusCode': status, 'headers': cors_headers(), 'body': json.dumps(data, default=str, ensure_ascii=False)}


def err(message: str, status: int = 400) -> dict:
    return ok({'error': message}, status)


def find_recipient_user(conn, lookup_type: str, lookup_value: str) -> Optional[dict]:
    """Найти пользователя по email или телефону."""
    with conn.cursor() as cur:
        if lookup_type == 'email':
            cur.execute(
                f"SELECT id, email, phone, display_name, max_phone, max_connected, telegram_chat_id "
                f"FROM {SCHEMA}.users WHERE LOWER(email) = LOWER({esc(lookup_value)}) LIMIT 1"
            )
        else:
            phone = norm_phone(lookup_value)
            if not phone:
                return None
            cur.execute(
                f"SELECT id, email, phone, display_name, max_phone, max_connected, telegram_chat_id "
                f"FROM {SCHEMA}.users "
                f"WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = {esc(phone)} "
                f"   OR regexp_replace(COALESCE(max_phone, ''), '[^0-9]', '', 'g') = {esc(phone)} "
                f"   OR regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g') = {esc(phone)} "
                f"LIMIT 1"
            )
        row = cur.fetchone()
        return dict(row) if row else None


def get_sender_info(conn, user_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT id, email, phone, display_name, name FROM {SCHEMA}.users WHERE id = {esc(user_id)} LIMIT 1"
        )
        row = cur.fetchone()
        return dict(row) if row else {}


def send_max_message(phone: str, message: str) -> dict:
    instance_id = os.environ.get('MAX_INSTANCE_ID', '')
    token = os.environ.get('MAX_TOKEN', '')
    if not instance_id or not token or not phone:
        return {'sent': False, 'reason': 'no_credentials_or_phone'}
    media_server = instance_id[:4] if len(instance_id) >= 4 else '7103'
    url = f"https://{media_server}.api.green-api.com/v3/waInstance{instance_id}/sendMessage/{token}"
    clean_phone = norm_phone(phone)
    try:
        r = requests.post(url, json={'chatId': f'{clean_phone}@c.us', 'message': message}, timeout=10)
        return {'sent': r.ok, 'status': r.status_code}
    except Exception as e:
        return {'sent': False, 'error': str(e)}


def send_email_invite(to_email: str, sender_name: str, client_name: str, comment: str) -> dict:
    """Отправить приглашение незарегистрированному фотографу."""
    try:
        EMAIL_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0'
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px;">
          <h2 style="color:#7c3aed;">Вам передают клиента в foto-mix</h2>
          <p>Фотограф <b>{sender_name}</b> хочет передать вам клиента <b>{client_name}</b>.</p>
          {f'<p style="background:#f3f4f6;padding:12px;border-radius:8px;">Комментарий: {comment}</p>' if comment else ''}
          <p>Чтобы принять передачу — зарегистрируйтесь в foto-mix по ссылке ниже. После регистрации передача появится в вашем кабинете.</p>
          <p><a href="https://foto-mix.ru/register" style="background:#7c3aed;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Зарегистрироваться</a></p>
          <p style="color:#6b7280;font-size:12px;">Передача действительна 7 дней.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
          <p style="color:#9ca3af;font-size:12px;">🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!</p>
        </div>
        """
        requests.post(EMAIL_API, json={
            'action': 'send-booking-notification',
            'to_email': to_email,
            'client_name': sender_name,
            'html_body': html,
            'subject': f'Передача клиента в foto-mix от {sender_name}'
        }, timeout=10)
        return {'sent': True}
    except Exception as e:
        return {'sent': False, 'error': str(e)}


def create_transfer(conn, user_id: str, body: dict) -> dict:
    scope = body.get('scope', 'client')
    if scope not in ('client', 'project'):
        return err('Invalid scope')
    client_id = body.get('client_id')
    project_id = body.get('project_id') if scope == 'project' else None
    if not client_id:
        return err('client_id is required')
    if scope == 'project' and not project_id:
        return err('project_id is required for scope=project')

    lookup_type = body.get('lookup_type')  # 'email' | 'phone'
    lookup_value = (body.get('lookup_value') or '').strip()
    if lookup_type not in ('email', 'phone') or not lookup_value:
        return err('lookup_type/lookup_value required')

    comment = body.get('comment') or ''

    with conn.cursor() as cur:
        # Проверим, что клиент принадлежит отправителю
        cur.execute(
            f"SELECT id, name FROM {SCHEMA}.clients WHERE id = {esc(client_id)} AND user_id = {esc(user_id)}"
        )
        client_row = cur.fetchone()
        if not client_row:
            return err('Client not found or not owned by sender', 404)
        client_name = client_row['name']

        project_name = None
        if project_id:
            cur.execute(
                f"SELECT id, name FROM {SCHEMA}.client_projects "
                f"WHERE id = {esc(project_id)} AND client_id = {esc(client_id)}"
            )
            p = cur.fetchone()
            if not p:
                return err('Project not found', 404)
            project_name = p['name']

    sender = get_sender_info(conn, user_id)
    recipient = find_recipient_user(conn, lookup_type, lookup_value)
    recipient_user_id = str(recipient['id']) if recipient else None

    # Самому себе нельзя
    if recipient_user_id and recipient_user_id == str(user_id):
        return err('Нельзя передать клиента самому себе')

    # Создаём запись
    with conn.cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO {SCHEMA}.client_transfers (
                sender_user_id, sender_name, sender_phone, sender_email,
                recipient_user_id, recipient_lookup_type, recipient_lookup_value,
                scope, client_id, project_id,
                client_name_snapshot, project_name_snapshot,
                comment, status
            ) VALUES (
                {esc(user_id)}, {esc(sender.get('display_name') or sender.get('name') or sender.get('email'))},
                {esc(sender.get('phone'))}, {esc(sender.get('email'))},
                {esc(recipient_user_id)}, {esc(lookup_type)}, {esc(lookup_value)},
                {esc(scope)}, {esc(client_id)}, {esc(project_id)},
                {esc(client_name)}, {esc(project_name)},
                {esc(comment)}, 'pending'
            ) RETURNING id, created_at, expires_at
            """
        )
        row = cur.fetchone()
        transfer_id = row['id']
        conn.commit()

    # Уведомление получателю
    sender_label = sender.get('display_name') or sender.get('name') or sender.get('email') or 'Фотограф'
    notif_text = (
        f"📦 Передача клиента в foto-mix\n\n"
        f"От: {sender_label}\n"
        f"Клиент: {client_name}\n"
        + (f"Проект: {project_name}\n" if project_name else "")
        + (f"\nКомментарий: {comment}\n" if comment else "")
        + f"\nОткройте foto-mix, чтобы принять или отказаться."
        + "\n\n———\n🤖 Сообщение сформировано автоматической системой для фотографов Foto-mix.ru, отвечать на это сообщение не нужно!"
    )

    invite_via = None
    if recipient:
        phone_for_max = recipient.get('max_phone') or recipient.get('phone')
        if phone_for_max:
            res = send_max_message(phone_for_max, notif_text)
            if res.get('sent'):
                invite_via = 'max'
        if not invite_via and recipient.get('email'):
            send_email_invite(recipient['email'], sender_label, client_name, comment)
            invite_via = 'email'
        if not invite_via:
            invite_via = 'in_app'
    else:
        # Незарегистрированный — приглашаем
        if lookup_type == 'email':
            send_email_invite(lookup_value, sender_label, client_name, comment)
            invite_via = 'email'
        else:
            send_max_message(lookup_value, notif_text + "\n\nЗарегистрируйтесь на foto-mix.ru, чтобы принять.")
            invite_via = 'max'

    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE {SCHEMA}.client_transfers "
            f"SET invite_sent_via = {esc(invite_via)}, invite_sent_at = CURRENT_TIMESTAMP "
            f"WHERE id = {transfer_id}"
        )
        conn.commit()

    return ok({
        'success': True,
        'transfer_id': transfer_id,
        'recipient_found': recipient is not None,
        'invite_sent_via': invite_via,
    })


def list_incoming(conn, user_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, sender_user_id, sender_name, sender_phone, sender_email,
                   scope, client_id, project_id,
                   client_name_snapshot, project_name_snapshot,
                   comment, status, created_at, expires_at, seen_by_recipient_at
            FROM {SCHEMA}.client_transfers
            WHERE recipient_user_id = {esc(user_id)} AND status = 'pending'
              AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
            """
        )
        rows = [dict(r) for r in cur.fetchall()]
    return ok({'transfers': rows})


def list_outgoing(conn, user_id: str) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, recipient_user_id, recipient_lookup_type, recipient_lookup_value,
                   scope, client_id, project_id,
                   client_name_snapshot, project_name_snapshot,
                   comment, reply_comment, status, created_at, responded_at, expires_at
            FROM {SCHEMA}.client_transfers
            WHERE sender_user_id = {esc(user_id)}
            ORDER BY created_at DESC
            LIMIT 100
            """
        )
        rows = [dict(r) for r in cur.fetchall()]
    return ok({'transfers': rows})


def mark_seen(conn, user_id: str, transfer_id) -> dict:
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE {SCHEMA}.client_transfers "
            f"SET seen_by_recipient_at = CURRENT_TIMESTAMP "
            f"WHERE id = {esc(transfer_id)} AND recipient_user_id = {esc(user_id)}"
        )
        conn.commit()
    return ok({'success': True})


def transfer_client_full(conn, transfer: dict, new_user_id: str):
    """Перенос всей карточки клиента — меняем владельца (user_id + photographer_id) только в таблице clients.
    Все связанные данные (проекты, фото, оплаты, переписка, документы, комментарии) принадлежат
    клиенту через client_id и автоматически переезжают вместе с ним. В client_messages есть
    photographer_id — он тоже обновляется."""
    client_id = transfer['client_id']
    schema = SCHEMA
    # new_user_id для clients.user_id (VARCHAR), photographer_id — integer
    try:
        new_photographer_id = int(new_user_id)
    except (ValueError, TypeError):
        new_photographer_id = None

    with conn.cursor() as cur:
        # Главная запись клиента — меняем владельца
        if new_photographer_id is not None:
            cur.execute(
                f"UPDATE {schema}.clients "
                f"SET user_id = {esc(new_user_id)}, photographer_id = {new_photographer_id}, "
                f"    updated_at = CURRENT_TIMESTAMP "
                f"WHERE id = {esc(client_id)}"
            )
            # Сообщения — обновим photographer_id (поле сменит "автора-фотографа")
            cur.execute(
                f"UPDATE {schema}.client_messages "
                f"SET photographer_id = {new_photographer_id} "
                f"WHERE client_id = {esc(client_id)}"
            )
        else:
            cur.execute(
                f"UPDATE {schema}.clients "
                f"SET user_id = {esc(new_user_id)}, updated_at = CURRENT_TIMESTAMP "
                f"WHERE id = {esc(client_id)}"
            )


def transfer_project_only(conn, transfer: dict, new_user_id: str):
    """Перенос только одного проекта: создаём клиента-двойника у получателя (если нет такого) и переносим проект + связанные данные."""
    sender_user_id = transfer['sender_user_id']
    client_id = transfer['client_id']
    project_id = transfer['project_id']
    schema = SCHEMA
    try:
        new_photographer_id = int(new_user_id)
    except (ValueError, TypeError):
        new_photographer_id = None

    with conn.cursor() as cur:
        # Получим данные исходного клиента
        cur.execute(f"SELECT * FROM {schema}.clients WHERE id = {esc(client_id)}")
        src_client = cur.fetchone()
        if not src_client:
            raise Exception('Source client not found')

        # Ищем существующего клиента у получателя по email/phone
        recipient_client_id = None
        if src_client.get('email'):
            cur.execute(
                f"SELECT id FROM {schema}.clients "
                f"WHERE user_id = {esc(new_user_id)} AND LOWER(email) = LOWER({esc(src_client['email'])}) LIMIT 1"
            )
            r = cur.fetchone()
            if r:
                recipient_client_id = r['id']
        if not recipient_client_id and src_client.get('phone'):
            cur.execute(
                f"SELECT id FROM {schema}.clients "
                f"WHERE user_id = {esc(new_user_id)} "
                f"AND regexp_replace(COALESCE(phone,''),'[^0-9]','','g') = regexp_replace({esc(src_client['phone'])},'[^0-9]','','g') "
                f"LIMIT 1"
            )
            r = cur.fetchone()
            if r:
                recipient_client_id = r['id']

        if not recipient_client_id:
            # Создаём нового клиента у получателя (копия карточки)
            photo_id_expr = str(new_photographer_id) if new_photographer_id is not None else 'NULL'
            cur.execute(
                f"""
                INSERT INTO {schema}.clients
                (user_id, photographer_id, name, phone, email, address, vk_profile, birthdate, vk_username)
                VALUES ({esc(new_user_id)}, {photo_id_expr},
                        {esc(src_client.get('name'))}, {esc(src_client.get('phone'))},
                        {esc(src_client.get('email'))}, {esc(src_client.get('address'))},
                        {esc(src_client.get('vk_profile'))}, {esc(src_client.get('birthdate'))},
                        {esc(src_client.get('vk_username'))})
                RETURNING id
                """
            )
            recipient_client_id = cur.fetchone()['id']

        # Переносим проект
        cur.execute(
            f"UPDATE {schema}.client_projects SET client_id = {esc(recipient_client_id)} "
            f"WHERE id = {esc(project_id)}"
        )
        # Платежи и возвраты по проекту
        cur.execute(
            f"UPDATE {schema}.client_payments "
            f"SET client_id = {esc(recipient_client_id)} "
            f"WHERE project_id = {esc(project_id)}"
        )
        cur.execute(
            f"UPDATE {schema}.client_refunds "
            f"SET client_id = {esc(recipient_client_id)} "
            f"WHERE project_id = {esc(project_id)}"
        )
        # Папки фото клиента переезжают на нового client_id (фото внутри папок — через upload_folder_id, перепривязка не нужна)
        cur.execute(
            f"UPDATE {schema}.client_upload_folders "
            f"SET client_id = {esc(recipient_client_id)} "
            f"WHERE client_id = {esc(client_id)}"
        )


def write_history(conn, transfer: dict, status: str):
    sender_user_id = transfer['sender_user_id']
    recipient_user_id = transfer['recipient_user_id']
    scope = transfer['scope']
    with conn.cursor() as cur:
        # Запись отправителю
        cur.execute(
            f"""
            INSERT INTO {SCHEMA}.client_transfer_history
            (user_id, role, transfer_id, counterparty_name, counterparty_user_id,
             client_name, project_name, scope, status, note)
            VALUES ({esc(sender_user_id)}, 'sender', {esc(transfer['id'])},
                    {esc(transfer.get('recipient_lookup_value'))}, {esc(recipient_user_id)},
                    {esc(transfer.get('client_name_snapshot'))}, {esc(transfer.get('project_name_snapshot'))},
                    {esc(scope)}, {esc(status)}, {esc(transfer.get('reply_comment'))})
            """
        )
        if recipient_user_id:
            cur.execute(
                f"""
                INSERT INTO {SCHEMA}.client_transfer_history
                (user_id, role, transfer_id, counterparty_name, counterparty_user_id,
                 client_name, project_name, scope, status, note)
                VALUES ({esc(recipient_user_id)}, 'recipient', {esc(transfer['id'])},
                        {esc(transfer.get('sender_name'))}, {esc(sender_user_id)},
                        {esc(transfer.get('client_name_snapshot'))}, {esc(transfer.get('project_name_snapshot'))},
                        {esc(scope)}, {esc(status)}, {esc(transfer.get('comment'))})
                """
            )
        conn.commit()


def notify_sender_about_response(transfer: dict, accepted: bool, reply: str):
    sender_phone = transfer.get('sender_phone')
    if not sender_phone:
        return
    client = transfer.get('client_name_snapshot') or 'клиента'
    verb = 'принял' if accepted else 'отказался от'
    msg = (
        f"📦 foto-mix: ваша передача\n\n"
        f"Фотограф {verb} {client}.\n"
    )
    if reply:
        msg += f"\nКомментарий: {reply}\n"
    send_max_message(sender_phone, msg)


def accept_transfer(conn, user_id: str, body: dict) -> dict:
    transfer_id = body.get('transfer_id')
    reply = body.get('reply_comment') or ''
    if not transfer_id:
        return err('transfer_id required')

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT * FROM {SCHEMA}.client_transfers "
            f"WHERE id = {esc(transfer_id)} AND recipient_user_id = {esc(user_id)} "
            f"AND status = 'pending' FOR UPDATE"
        )
        transfer = cur.fetchone()
        if not transfer:
            return err('Transfer not found or already processed', 404)
        transfer = dict(transfer)

    try:
        if transfer['scope'] == 'client':
            transfer_client_full(conn, transfer, user_id)
        else:
            transfer_project_only(conn, transfer, user_id)

        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE {SCHEMA}.client_transfers "
                f"SET status = 'accepted', responded_at = CURRENT_TIMESTAMP, "
                f"    reply_comment = {esc(reply)} "
                f"WHERE id = {esc(transfer_id)}"
            )
            conn.commit()

        transfer['reply_comment'] = reply
        try:
            write_history(conn, transfer, 'accepted')
        except Exception as he:
            print(f'[TRANSFER] history write failed: {he}')
            conn.rollback()
        try:
            notify_sender_about_response(transfer, accepted=True, reply=reply)
        except Exception as ne:
            print(f'[TRANSFER] notify failed: {ne}')
        return ok({'success': True, 'status': 'accepted'})
    except Exception as e:
        import traceback
        print(f'[TRANSFER] accept failed: {e}')
        print(traceback.format_exc())
        conn.rollback()
        return err(f'Transfer failed: {str(e)}', 500)


def reject_transfer(conn, user_id: str, body: dict) -> dict:
    transfer_id = body.get('transfer_id')
    reply = body.get('reply_comment') or ''
    if not transfer_id:
        return err('transfer_id required')

    with conn.cursor() as cur:
        cur.execute(
            f"SELECT * FROM {SCHEMA}.client_transfers "
            f"WHERE id = {esc(transfer_id)} AND recipient_user_id = {esc(user_id)} "
            f"AND status = 'pending'"
        )
        transfer = cur.fetchone()
        if not transfer:
            return err('Transfer not found or already processed', 404)
        transfer = dict(transfer)

        cur.execute(
            f"UPDATE {SCHEMA}.client_transfers "
            f"SET status = 'rejected', responded_at = CURRENT_TIMESTAMP, "
            f"    reply_comment = {esc(reply)} "
            f"WHERE id = {esc(transfer_id)}"
        )
        conn.commit()

    transfer['reply_comment'] = reply
    write_history(conn, transfer, 'rejected')
    notify_sender_about_response(transfer, accepted=False, reply=reply)
    return ok({'success': True, 'status': 'rejected'})


def cancel_transfer(conn, user_id: str, body: dict) -> dict:
    transfer_id = body.get('transfer_id')
    if not transfer_id:
        return err('transfer_id required')
    with conn.cursor() as cur:
        cur.execute(
            f"UPDATE {SCHEMA}.client_transfers "
            f"SET status = 'cancelled', responded_at = CURRENT_TIMESTAMP "
            f"WHERE id = {esc(transfer_id)} AND sender_user_id = {esc(user_id)} "
            f"  AND status = 'pending'"
        )
        affected = cur.rowcount
        conn.commit()
    if affected == 0:
        return err('Transfer not found or already processed', 404)
    return ok({'success': True})


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Передача клиентов между фотографами. Действия: create, list_incoming, list_outgoing, accept, reject, cancel, mark_seen."""
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors_headers(), 'body': ''}

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id')
    if not user_id:
        return err('Missing X-User-Id header', 401)

    qs = event.get('queryStringParameters') or {}
    action = qs.get('action')

    body_raw = event.get('body') or '{}'
    try:
        body = json.loads(body_raw) if body_raw else {}
    except Exception:
        body = {}
    if not action:
        action = body.get('action')

    if not action:
        return err('action required (create|list_incoming|list_outgoing|accept|reject|cancel|mark_seen)')

    conn = db()
    try:
        if action == 'create':
            return create_transfer(conn, user_id, body)
        if action == 'list_incoming':
            return list_incoming(conn, user_id)
        if action == 'list_outgoing':
            return list_outgoing(conn, user_id)
        if action == 'accept':
            return accept_transfer(conn, user_id, body)
        if action == 'reject':
            return reject_transfer(conn, user_id, body)
        if action == 'cancel':
            return cancel_transfer(conn, user_id, body)
        if action == 'mark_seen':
            return mark_seen(conn, user_id, body.get('transfer_id'))
        return err(f'Unknown action: {action}')
    finally:
        conn.close()