"""
Админ-аудит пользователя ("Самописец").

Логи действий пользователя (что открывал, что нажимал), согласия и продления
хранятся ТОЛЬКО в S3 (Yandex Object Storage) в папке пользователя рядом с его фото:
    uploads/{user_id}/audit/activity.jsonl
Каждое событие — отдельная строка JSON (append). Базу данных логами не раздуваем.

Действия:
  POST action=log            — приём события активности (пишет в S3), доступно самому пользователю
  GET  action=users          — список/поиск пользователей (только админ + пароль)
  GET  action=user_audit     — согласия из БД по пользователю (только админ + пароль)
  GET  action=audit_days     — карта активности по дням (для календаря), из S3
  GET  action=audit_day      — события за конкретный день (YYYY-MM-DD), из S3
  GET  action=audit_xlsx     — выгрузка всех событий в .xlsx (base64), из S3
  POST action=audit_verify   — проверка пароля панели самописцев

Пароль панели: секрет AUDIT_PANEL_PASSWORD. Время в отчётах — UTC+4.
"""
import json
import os
import io
import base64
from datetime import datetime, timezone, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p28211681_photo_secure_web')

# Тот же S3, где лежат фото пользователя (foto-mix / storage.yandexcloud.net)
S3_BUCKET = 'foto-mix'
S3_ENDPOINT = 'https://storage.yandexcloud.net'

# Смещение для отображения времени в отчётах (UTC+4 = МСК+1)
TZ_OFFSET = timezone(timedelta(hours=4))

HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Audit-Password',
}


def _resp(status, body):
    return {
        'statusCode': status,
        'headers': HEADERS,
        'isBase64Encoded': False,
        'body': json.dumps(body, default=str),
    }


def _s3():
    return boto3.client(
        's3',
        endpoint_url=S3_ENDPOINT,
        region_name='ru-central1',
        aws_access_key_id=os.environ['YC_S3_KEY_ID'],
        aws_secret_access_key=os.environ['YC_S3_SECRET'],
        config=Config(signature_version='s3v4'),
    )


def _audit_key(user_id) -> str:
    return f'uploads/{int(user_id)}/audit/activity.jsonl'


def _is_admin(cur, user_id):
    if not user_id:
        return False
    try:
        cur.execute(f"SELECT role FROM {SCHEMA}.users WHERE id = %s", (int(user_id),))
        row = cur.fetchone()
        return bool(row and row['role'] == 'admin')
    except Exception:
        return False


def _check_panel_password(headers) -> bool:
    expected = os.environ.get('AUDIT_PANEL_PASSWORD', '')
    if not expected:
        return False
    got = headers.get('X-Audit-Password') or headers.get('x-audit-password') or ''
    return got == expected


def _append_event(user_id, record: dict):
    """Дописать одно событие в jsonl-файл пользователя в S3."""
    s3 = _s3()
    key = _audit_key(user_id)
    existing = b''
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        existing = obj['Body'].read()
    except ClientError as e:
        if e.response.get('Error', {}).get('Code') not in ('NoSuchKey', '404', 'NoSuchBucket'):
            print(f'[audit] get error: {e}')
    line = (json.dumps(record, ensure_ascii=False) + '\n').encode('utf-8')
    if existing and not existing.endswith(b'\n'):
        existing += b'\n'
    body = existing + line
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=body, ContentType='application/x-ndjson')


def _read_events(user_id):
    """Прочитать все события пользователя из S3. Возвращает список dict."""
    s3 = _s3()
    key = _audit_key(user_id)
    try:
        obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
        raw = obj['Body'].read().decode('utf-8', errors='replace')
    except ClientError:
        return []
    events = []
    for ln in raw.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        try:
            events.append(json.loads(ln))
        except Exception:
            continue
    return events


def _local_dt(ts_iso: str):
    """ISO-строку UTC -> datetime в UTC+4."""
    try:
        dt = datetime.fromisoformat(ts_iso.replace('Z', '+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(TZ_OFFSET)
    except Exception:
        return None


def handler(event: dict, context) -> dict:
    '''Самописец: приём событий в S3 и админ-панель просмотра/выгрузки.'''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return _resp(200, {})

    headers = event.get('headers') or {}
    user_id = headers.get('X-User-Id') or headers.get('x-user-id') or ''
    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', '')

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            body = {}
    if not action:
        action = body.get('action', '')

    # -------- ЗАПИСЬ СОБЫТИЯ В S3 (доступно самому пользователю) --------
    if action == 'log':
        uid = body.get('user_id') or user_id
        if not uid:
            return _resp(200, {'ok': False})
        ip = (event.get('requestContext') or {}).get('identity', {}).get('sourceIp', '')
        ua = headers.get('User-Agent') or headers.get('user-agent') or ''
        record = {
            'ts': datetime.now(timezone.utc).isoformat(),
            'type': str(body.get('event_type', 'action'))[:50],
            'act': str(body.get('act') or body.get('action_name') or '')[:255],
            'page': (str(body.get('page_path'))[:512] if body.get('page_path') else None),
            'details': body.get('details'),
            'ip': ip,
        }
        try:
            _append_event(uid, record)
        except Exception as e:
            print(f'[audit] append failed: {e}')
            return _resp(200, {'ok': False})
        return _resp(200, {'ok': True})

    # -------- ПРОВЕРКА ПАРОЛЯ ПАНЕЛИ --------
    if action == 'audit_verify':
        got = body.get('password') or headers.get('X-Audit-Password') or headers.get('x-audit-password') or ''
        expected = os.environ.get('AUDIT_PANEL_PASSWORD', '')
        ok = bool(expected) and got == expected
        return _resp(200, {'ok': ok})

    # Всё остальное — только для админа И с верным паролем панели
    conn = psycopg2.connect(os.environ['DATABASE_URL'], cursor_factory=RealDictCursor)
    cur = conn.cursor()
    try:
        if not _is_admin(cur, user_id):
            return _resp(403, {'error': 'Нет доступа'})
        if not _check_panel_password(headers):
            return _resp(401, {'error': 'Требуется пароль панели'})

        # -------- СПИСОК ПОЛЬЗОВАТЕЛЕЙ (поиск) --------
        if action == 'users':
            q = (qs.get('q') or '').strip()
            if q:
                like = f'%{q}%'
                cur.execute(
                    f"SELECT id, COALESCE(name, display_name, email, phone, '') AS display, "
                    f"email, phone, role, created_at, last_login "
                    f"FROM {SCHEMA}.users "
                    f"WHERE CAST(id AS TEXT) = %s OR email ILIKE %s OR phone ILIKE %s "
                    f"OR name ILIKE %s OR display_name ILIKE %s "
                    f"ORDER BY id DESC LIMIT 50",
                    (q, like, like, like, like),
                )
            else:
                cur.execute(
                    f"SELECT id, COALESCE(name, display_name, email, phone, '') AS display, "
                    f"email, phone, role, created_at, last_login "
                    f"FROM {SCHEMA}.users ORDER BY id DESC LIMIT 50"
                )
            return _resp(200, {'users': cur.fetchall()})

        # -------- СОГЛАСИЯ ПО ПОЛЬЗОВАТЕЛЮ (из БД) --------
        if action == 'user_audit':
            target = qs.get('target_id') or body.get('target_id')
            if not target:
                return _resp(400, {'error': 'Не указан пользователь'})
            target = int(target)

            cur.execute(
                f"SELECT id, name, display_name, email, phone, role, created_at, registered_at, "
                f"last_login, ip_address, user_agent, is_blocked, blocked_reason, plan_id "
                f"FROM {SCHEMA}.users WHERE id = %s",
                (target,),
            )
            user = cur.fetchone()
            if not user:
                return _resp(404, {'error': 'Пользователь не найден'})

            cur.execute(
                f"SELECT lc.slug, lc.version, lc.accepted_at, lc.ip_address, ld.title "
                f"FROM {SCHEMA}.legal_consents lc "
                f"LEFT JOIN {SCHEMA}.legal_documents ld ON ld.slug = lc.slug "
                f"WHERE lc.user_id = %s ORDER BY lc.accepted_at DESC",
                (target,),
            )
            legal_consents = cur.fetchall()

            cur.execute(
                f"SELECT plan_id, plan_name, amount_rub, duration_months, consent_text, "
                f"ip_address, user_agent, offer_version, created_at "
                f"FROM {SCHEMA}.recurring_consent_log "
                f"WHERE user_id = %s ORDER BY created_at DESC",
                (target,),
            )
            recurring_consents = cur.fetchall()

            return _resp(200, {
                'user': user,
                'legal_consents': legal_consents,
                'recurring_consents': recurring_consents,
            })

        # -------- КАРТА АКТИВНОСТИ ПО ДНЯМ (из S3, время UTC+4) --------
        if action == 'audit_days':
            target = qs.get('target_id') or body.get('target_id')
            if not target:
                return _resp(400, {'error': 'Не указан пользователь'})
            events = _read_events(target)
            days = {}
            for ev in events:
                dt = _local_dt(ev.get('ts', ''))
                if not dt:
                    continue
                day = dt.strftime('%Y-%m-%d')
                days[day] = days.get(day, 0) + 1
            return _resp(200, {'days': days, 'total': len(events)})

        # -------- СОБЫТИЯ ЗА ДЕНЬ (из S3, время UTC+4) --------
        if action == 'audit_day':
            target = qs.get('target_id') or body.get('target_id')
            day = qs.get('day') or body.get('day')
            if not target or not day:
                return _resp(400, {'error': 'Нужны target_id и day'})
            events = _read_events(target)
            out = []
            for ev in events:
                dt = _local_dt(ev.get('ts', ''))
                if not dt or dt.strftime('%Y-%m-%d') != day:
                    continue
                out.append({
                    'time': dt.strftime('%H:%M:%S'),
                    'ts_local': dt.strftime('%Y-%m-%d %H:%M:%S'),
                    'type': ev.get('type'),
                    'act': ev.get('act'),
                    'page': ev.get('page'),
                    'details': ev.get('details'),
                    'ip': ev.get('ip'),
                })
            out.sort(key=lambda x: x['ts_local'])
            return _resp(200, {'day': day, 'events': out})

        # -------- ВЫГРУЗКА .XLSX (из S3, время UTC+4) --------
        if action == 'audit_xlsx':
            target = qs.get('target_id') or body.get('target_id')
            if not target:
                return _resp(400, {'error': 'Не указан пользователь'})
            events = _read_events(target)

            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            ws.title = 'Самописец'
            ws.append(['Дата и время (UTC+4)', 'Тип', 'Действие', 'Страница', 'Детали', 'IP'])

            rows = []
            for ev in events:
                dt = _local_dt(ev.get('ts', ''))
                rows.append((
                    dt.strftime('%Y-%m-%d %H:%M:%S') if dt else (ev.get('ts') or ''),
                    ev.get('type') or '',
                    ev.get('act') or '',
                    ev.get('page') or '',
                    (json.dumps(ev.get('details'), ensure_ascii=False) if ev.get('details') is not None else ''),
                    ev.get('ip') or '',
                ))
            rows.sort(key=lambda r: r[0])
            for r in rows:
                ws.append(list(r))

            widths = [22, 12, 40, 30, 40, 16]
            for i, w in enumerate(widths, start=1):
                ws.column_dimensions[chr(64 + i)].width = w

            buf = io.BytesIO()
            wb.save(buf)
            buf.seek(0)
            b64 = base64.b64encode(buf.read()).decode('ascii')
            return _resp(200, {'filename': f'samopisec_user_{int(target)}.xlsx', 'xlsx_base64': b64, 'count': len(rows)})

        return _resp(400, {'error': 'Неизвестное действие'})
    except Exception as e:
        conn.rollback()
        print(f'[admin-user-audit] error: {e}')
        return _resp(500, {'error': 'Внутренняя ошибка'})
    finally:
        cur.close()
        conn.close()
