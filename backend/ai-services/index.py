"""
Сводка по AI-сервисам для админки: актуальный прайс GPTunneL (с вашей скидкой),
баланс и какие модели используются инструментами проекта и почём.
Args: event с httpMethod, queryStringParameters (action=gptunnel|raw), headers X-User-Id
Returns: JSON с прайсом, балансом и таблицей инструментов
"""
import os
import json
from typing import Any, Dict

import requests

import energy

KEY = os.environ.get("GPTUNNEL_API_KEY", "")
MEDIA_MODELS = "https://gptunnel.ru/api/v2/media/models"
CHAT_MODELS = "https://gptunnel.ru/v1/models"
BALANCE_URLS = ["https://gptunnel.ru/v1/balance"]

# Какие модели GPTunneL использует каждый инструмент проекта.
# params — с какими параметрами модель вызывается (от них зависит цена).
# energy — сколько ⚡ берём с пользователя (1 ⚡ = 1 ₽).
TOOLS = [
    {"tool": "Убрать лого с фото", "step": "Поиск логотипа", "model": "gpt-4o", "kind": "chat",
     "energy": 25, "role": "основная", "tokens": (1100, 400),
     "note": "цена за токены; за запрос — примерно (≈1100 входящих + 400 исходящих)"},
    {"tool": "Убрать лого с фото", "step": "Стирание", "model": "seedream-4.5", "params": {"resolution": "2K"},
     "energy": 25, "role": "основная"},
    {"tool": "Удалить объект с фото", "step": "Стирание", "model": "nano-banana",
     "energy": 25, "role": "резерв", "note": "основной путь — Replicate, сюда уходит, если он недоступен"},
    {"tool": "Удалить объект с фото", "step": "Стирание", "model": "seedream-4.5", "params": {"resolution": "2K"},
     "energy": 25, "role": "резерв"},
    {"tool": "Перенос лица", "step": "Перенос", "model": "nano-banana-pro", "params": {"resolution": "2K"},
     "energy": 30, "role": "основная"},
    {"tool": "Перенос лица", "step": "Перенос", "model": "nano-banana-2", "params": {"resolution": "2K"},
     "energy": 30, "role": "резерв"},
    {"tool": "Перенос лица", "step": "Перенос", "model": "nano-banana", "energy": 30, "role": "резерв"},
    {"tool": "Ретушь фото", "step": "Ретушь кожи", "model": "grok-imagine", "energy": 15, "role": "основная"},
    {"tool": "Ретушь фото", "step": "Ретушь кожи", "model": "qwen-image-3",
     "params": {"variant": "base", "resolution": "2K"}, "energy": 15, "role": "резерв",
     "note": "если основная отклонила фото по модерации"},
    {"tool": "Ретушь фото", "step": "Поиск зон кожи", "model": "gpt-4o", "kind": "chat", "energy": 15,
     "role": "основная", "tokens": (900, 300),
     "note": "цена за токены; за запрос — примерно (≈900 входящих + 300 исходящих)"},
    {"tool": "Ретушь фото", "step": "Стройность / перерисовка", "model": "nano-banana-pro",
     "params": {"resolution": "2K"}, "energy": 25, "role": "основная"},
    {"tool": "Ретушь фото", "step": "Стройность / перерисовка", "model": "nano-banana-2",
     "params": {"resolution": "2K"}, "energy": 25, "role": "резерв"},
    {"tool": "Увеличить разрешение", "step": "2K", "model": "nano-banana-pro", "params": {"resolution": "2K"},
     "energy": 30, "role": "основная"},
    {"tool": "Увеличить разрешение", "step": "4K", "model": "nano-banana-pro", "params": {"resolution": "4K"},
     "energy": 45, "role": "основная"},
    {"tool": "Увеличить разрешение", "step": "8K", "model": "nano-banana-pro", "params": {"resolution": "4K"},
     "energy": 50, "role": "основная", "note": "модель рисует 4K, до 8K доводится без доплаты"},
]


def _headers():
    return {"Authorization": KEY, "Content-Type": "application/json"}


def _response(code: int, body: Any):
    return {
        "statusCode": code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
        "isBase64Encoded": False,
    }


def _get(url: str):
    r = requests.get(url, headers=_headers(), timeout=20)
    if r.status_code != 200:
        raise RuntimeError(f"{url}: HTTP {r.status_code} {r.text[:200]}")
    return r.json()


def _num(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return None


def _variants(m: dict):
    """Все варианты цены модели: [(условие, базовая цена, ваша цена)]."""
    disc = float(m.get("discount_percent") or 0)
    k = 1 - disc / 100
    p = m.get("pricing") or {}
    t = p.get("type")
    out = []
    if t == "fixed" and p.get("cost") is not None:
        out.append(({}, _num(p["cost"]), _num(float(p["cost"]) * k)))
    elif t == "per_resolution" and p.get("rates"):
        key = p.get("rateBy") or "resolution"
        for val, cost in p["rates"].items():
            out.append(({key: val}, _num(cost), _num(float(cost) * k)))
    elif t == "matrix" and p.get("tiers"):
        for tier in p["tiers"]:
            out.append((tier.get("condition") or {}, _num(tier.get("cost")), _num(float(tier.get("cost") or 0) * k)))
    if not out and m.get("price") is not None:
        price = float(m["price"])
        base = price / k if k > 0 else price
        out.append(({}, _num(base), _num(price)))
    return out


def _price_for(m: dict, params: dict):
    vs = _variants(m)
    if not vs:
        return None, None
    params = params or {}
    for cond, base, mine in vs:
        if cond and all(str(params.get(a)) == str(b) for a, b in cond.items()):
            return base, mine
    for cond, base, mine in vs:
        if not cond:
            return base, mine
    return vs[0][1], vs[0][2]


def _chat_price(c: dict):
    """Цена текстовой модели за 1000 токенов (вход/выход), как отдаёт API."""
    def pick(*keys):
        for key in keys:
            if c.get(key) is not None:
                return _num(c[key])
        return None
    return {
        "input": pick("cost_context", "cost_per_1000_input", "price_input"),
        "output": pick("cost_completion", "cost_per_1000_output", "price_output"),
    }


def _balance():
    for url in BALANCE_URLS:
        try:
            d = _get(url)
        except Exception:
            continue
        if isinstance(d, dict):
            for key in ("balance", "amount", "credits"):
                if key in d:
                    return _num(d[key])
            inner = d.get("data")
            if isinstance(inner, dict):
                for key in ("balance", "amount"):
                    if key in inner:
                        return _num(inner[key])
    return None


def _gptunnel():
    media = _get(MEDIA_MODELS).get("models") or []
    by_id = {m["id"]: m for m in media}

    chat = {}
    try:
        cd = _get(CHAT_MODELS)
        for c in cd.get("data") or cd.get("models") or []:
            chat[c.get("id")] = c
    except Exception as e:
        print(f"[ai-services] chat models: {e}")

    tools = []
    for t in TOOLS:
        row = {k: t.get(k) for k in ("tool", "step", "model", "role", "energy", "note")}
        row["params"] = t.get("params") or {}
        if t.get("kind") == "chat":
            c = chat.get(t["model"]) or {}
            pr = _chat_price(c)
            row.update(kind="chat", price_in_1k=pr["input"], price_out_1k=pr["output"], available=bool(c))
            tk = t.get("tokens")
            if tk and pr["input"] is not None and pr["output"] is not None:
                row["my_price"] = _num(tk[0] / 1000 * pr["input"] + tk[1] / 1000 * pr["output"])
                row["approx"] = True
        else:
            m = by_id.get(t["model"])
            base, mine = _price_for(m, t.get("params")) if m else (None, None)
            row.update(kind="media", base_price=base, my_price=mine, available=bool(m),
                       discount=_num(m.get("discount_percent")) if m else None,
                       deprecated=bool(m and m.get("deprecated")))
            if mine is not None and t.get("energy"):
                row["margin"] = _num(t["energy"] - mine)
        tools.append(row)

    used = {t["model"] for t in TOOLS}
    catalog = []
    for m in media:
        for cond, base, mine in _variants(m):
            catalog.append({
                "model": m["id"],
                "type": m.get("type"),
                "variant": ", ".join(f"{v}" for v in cond.values()) if cond else "",
                "base_price": base,
                "my_price": mine,
                "discount": _num(m.get("discount_percent")),
                "unit": m.get("price_unit"),
                "used": m["id"] in used,
                "deprecated": bool(m.get("deprecated")),
            })
    catalog.sort(key=lambda r: (not r["used"], r["type"] or "", r["model"], r["my_price"] or 0))

    return {
        "service": "GPTunneL",
        "site": "https://gptunnel.ru",
        "balance": _balance(),
        "tools": tools,
        "catalog": catalog,
        "models_total": len(media),
    }


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Прайс и использование AI-сервисов — только для администратора."""
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
            "Access-Control-Max-Age": "86400"}, "body": "", "isBase64Encoded": False}

    headers = event.get("headers") or {}
    user_id = headers.get("X-User-Id") or headers.get("x-user-id")
    if not energy.is_admin(user_id):
        return _response(403, {"error": "только для администратора"})
    if not KEY:
        return _response(500, {"error": "не задан ключ GPTUNNEL_API_KEY"})

    action = (event.get("queryStringParameters") or {}).get("action", "gptunnel")
    try:
        if action == "gptunnel":
            return _response(200, _gptunnel())
        if action == "raw":
            out = {}
            for name, url in (("chat", CHAT_MODELS), ("balance", BALANCE_URLS[0])):
                try:
                    d = _get(url)
                    s = json.dumps(d, ensure_ascii=False)
                    out[name] = s[:3000]
                except Exception as e:
                    out[name] = f"ERR {e}"
            return _response(200, out)
    except Exception as e:
        print(f"[ai-services] {e}")
        return _response(502, {"error": str(e)[:300]})
    return _response(400, {"error": "unknown action"})
