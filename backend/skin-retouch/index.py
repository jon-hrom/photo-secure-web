"""
Ретушь кожи: AI выравнивает кожу, композит по маске гарантирует, что человек не меняется.
Args: event с httpMethod, queryStringParameters (action=estimate|start|status|compose|catalog|bench), body, headers X-User-Id
Returns: HTTP ответ с ценой, id задачи, готовым изображением или отладкой по моделям
"""
import json
import os
import time
import base64
from typing import Dict, Any

import models
import energy


MAX_IMAGE_BYTES = 20 * 1024 * 1024

# Пресеты силы. Промпт один — «трогай только кожу», различается то,
# насколько сильно результат модели влияет на итоговый кадр.
#
# ВАЖНО о keep_texture. Композит работает через частотное разложение: высокие
# частоты (поры, волоски, ресницы, края) ВСЕГДА берутся из оригинала и не
# смешиваются с картинкой модели. Поэтому keep_texture тут держится высоким
# даже на «Сильной»: чистоту кожи даёт подавление дефектов, а не размытие.
# Низкие значения здесь = общее приглаживание кожи, то самое «мыло».
#
# trust — порог структурной страховки: если модель перерисовала человека,
# её тон берётся слабее.
#
# even_out — арифметическое выравнивание тона. Модель чистит только то, что
# хорошо видит, и стабильно не дочищает дефекты в полутени (скула, зона под
# челюстью, шея). Детектор работает в логарифмическом контрасте, поэтому
# ловит пятна одинаково и на свету, и в тенях.
PRESETS = {
    "light": {
        "strength": 0.55, "keep_texture": 1.00, "trust": 40.0,
        "highlights": 0.35, "even_out": 0.40, "label": "Лёгкая",
    },
    "medium": {
        "strength": 0.80, "keep_texture": 0.95, "trust": 60.0,
        "highlights": 0.60, "even_out": 0.70, "label": "Стандарт",
    },
    # Максимум: кожа как после профессиональной бьюти-ретуши.
    # Ни одного прыща, но поры и резкость кадра сохранены полностью.
    "strong": {
        "strength": 1.00, "keep_texture": 0.86, "trust": 90.0,
        "highlights": 0.85, "even_out": 0.92, "label": "Сильная",
    },
}


def _preset(name: str) -> dict:
    return PRESETS.get(str(name or "medium").lower(), PRESETS["medium"])


def _cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token, X-Session-Id",
        "Access-Control-Max-Age": "86400",
    }


def _response(status_code: int, body: Any):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body, default=str),
        "isBase64Encoded": False,
    }


def _get_user_id(event: dict):
    headers = event.get("headers", {}) or {}
    raw = headers.get("X-User-Id") or headers.get("x-user-id")
    try:
        return int(raw) if raw else None
    except (TypeError, ValueError):
        return None


def _handle_estimate():
    """Цена и доступные уровни силы — до запуска."""
    return _response(200, {
        "price": models.PRICE,
        "model": models.MODEL,
        "label": models.LABEL,
        "hint": models.HINT,
        "presets": [{"key": k, "label": v["label"]} for k, v in PRESETS.items()],
    })


def _handle_balance(user_id):
    """Баланс счёта у провайдера ретуши. Только владельцу сервиса.

    Это деньги компании, а не пользователя, поэтому клиентам не показываем.
    """
    if not energy.is_admin(user_id):
        return _response(403, {"error": "только для администратора"})
    try:
        return _response(200, models.fetch_balance())
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})


def _handle_catalog(user_id):
    """Каталог моделей провайдера с ценами. Только для админа."""
    if not energy.is_admin(user_id):
        return _response(403, {"error": "только для администратора"})
    try:
        return _response(200, {"catalog": models.fetch_catalog()})
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})


def _handle_start(payload: dict, user_id):
    """Списывает энергию и ставит задачу ретуши в очередь."""
    image_b64 = payload.get("image")
    if not image_b64:
        return _response(400, {"error": "image (base64) is required"})
    try:
        raw = base64.b64decode(image_b64)
    except Exception:
        return _response(400, {"error": "invalid base64 image"})
    if len(raw) > MAX_IMAGE_BYTES:
        return _response(413, {"error": f"image too large (max {MAX_IMAGE_BYTES // 1024 // 1024} MB)"})

    if not user_id:
        return _response(401, {"error": "X-User-Id required"})

    price = models.PRICE
    ok, balance, err = energy.spend(user_id, price, f"{models.LABEL} — AI")
    if not ok:
        if err == "insufficient_energy":
            return _response(402, {
                "error": "Недостаточно энергии",
                "needed": price,
                "energy_balance": balance,
            })
        return _response(500, {"error": err or "energy error"})

    try:
        task_id = models.start_task(image_b64)
    except Exception as e:
        energy.refund(user_id, price, "Возврат: не удалось запустить ретушь")
        return _response(502, {"error": str(e)[:300], "refunded": price})

    return _response(200, {
        "task_id": task_id,
        "charged": price,
        "energy_balance": balance,
    })


def _handle_regions(payload: dict):
    """Боксы с людьми для ограничения зоны ретуши.

    Вынесено в отдельный вызов: вместе со стартом задачи это не укладывалось
    в лимит времени функции. Фронт дёргает его параллельно с ожиданием
    результата, а ошибка тут не критична — без боксов маска работает по кадру.
    """
    image_b64 = payload.get("image")
    if not image_b64:
        return _response(400, {"error": "image (base64) is required"})
    return _response(200, {"regions": models.detect_skin_regions(image_b64) or []})


def _handle_status(payload: dict, user_id):
    """Проверяет готовность задачи у провайдера. Сборку НЕ делает.

    Раньше этот же вызов скачивал результат и собирал композит. Три
    операции в одном запросе (опрос + скачивание + сборка) не помещались
    в лимит времени функции, и готовая ретушь обрывалась по таймауту —
    пользователь видел ошибку, хотя фото было готово. Теперь сборка живёт
    в отдельном вызове compose.
    """
    task_id = payload.get("task_id")
    if not task_id:
        return _response(400, {"error": "task_id is required"})

    try:
        state = models.poll_task(task_id)
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})

    if state["status"] in ("queued", "running"):
        return _response(200, {"status": "processing"})

    if state["status"] == "failed":
        # Основная модель отклонила фото по модерации — это не поломка.
        # Молча перезапускаем на запасной модели с мягкой модерацией,
        # повторно энергию не списываем: пользователь уже заплатил.
        image_b64 = payload.get("image")
        if state.get("blocked") and image_b64 and not payload.get("retried"):
            try:
                new_task = models.start_task(image_b64, model=models.FALLBACK_MODEL)
                return _response(200, {
                    "status": "processing",
                    "task_id": new_task,
                    "retried": True,
                })
            except Exception as e:
                print(f"[SKIN] fallback start failed: {e}")

        if user_id:
            energy.refund(user_id, models.PRICE, "Возврат: ретушь не удалась")
        return _response(200, {
            "status": "failed",
            "error": state["error"] or "не удалось отретушировать",
            "refunded": models.PRICE,
        })

    body = {"status": "ready", "url": state["url"]}
    if state.get("cost") is not None:
        body["provider_cost"] = state["cost"]
    return _response(200, body)


def _handle_abandon(payload: dict, user_id):
    """Фронт перестал ждать задачу — возвращаем энергию.

    Раньше при исчерпании времени ожидания энергия оставалась списанной:
    задача жива у провайдера, но пользователь результата уже не увидит.
    Перед возвратом ещё раз спрашиваем провайдера: если результат всё-таки
    готов, отдаём его — платить за успешную работу не грех, а вот терять
    готовое фото обидно.
    """
    task_id = payload.get("task_id")
    if not task_id:
        return _response(400, {"error": "task_id is required"})
    if not user_id:
        return _response(401, {"error": "X-User-Id required"})

    try:
        state = models.poll_task(task_id)
        if state["status"] == "done" and state.get("url"):
            return _response(200, {"status": "ready", "url": state["url"]})
    except Exception as e:
        print(f"[SKIN] abandon poll failed: {e}")

    refunded = energy.refund_once(
        user_id, models.PRICE, f"Возврат: ретушь не дождалась результата (задача {task_id})"
    )
    return _response(200, {
        "status": "refunded",
        "refunded": models.PRICE if refunded else 0,
        "energy_balance": energy.get_balance(user_id),
    })


def _handle_compose(payload: dict, user_id):
    """Скачивает готовый результат и собирает финальный кадр по маске кожи."""
    url = payload.get("url")
    image_b64 = payload.get("image")
    if not url:
        return _response(400, {"error": "url is required"})
    if not image_b64:
        return _response(400, {"error": "image is required to compose result"})

    preset = _preset(payload.get("preset"))
    regions = payload.get("regions") or None

    started = time.time()
    try:
        result_bytes = models.download(url)
        downloaded = time.time()
        result_b64 = models.compose(
            image_b64,
            result_bytes,
            strength=preset["strength"],
            keep_texture=preset["keep_texture"],
            regions=regions,
            trust_threshold=preset["trust"],
            highlight_recovery=preset["highlights"],
            even_out=preset["even_out"],
        )
        print(f"[SKIN] compose ok: download={downloaded - started:.2f}s "
              f"blend={time.time() - downloaded:.2f}s")
    except Exception as e:
        if user_id:
            energy.refund(user_id, models.PRICE, "Возврат: ошибка сборки ретуши")
        return _response(200, {"status": "failed", "error": str(e)[:300], "refunded": models.PRICE})

    body = {
        "status": "done",
        "image": result_b64,
        "label": models.LABEL,
        "charged": models.PRICE,
        "preset": preset["label"],
    }
    if user_id:
        body["energy_balance"] = energy.get_balance(user_id)
    return _response(200, body)


def _handle_bench(payload: dict, user_id):
    """Пробный прогон конкретной модели без списания энергии. Админ-only.

    Нужен, чтобы сравнить качество и реальную себестоимость кандидатов
    перед тем, как назначить цену в молниях.
    """
    if not energy.is_admin(user_id):
        return _response(403, {"error": "только для администратора"})

    task_id = payload.get("task_id")
    # Второй вызов с task_id — забрать готовый результат и реальную цену.
    if task_id:
        try:
            state = models.poll_task(task_id)
        except Exception as e:
            return _response(502, {"error": str(e)[:300]})
        if state["status"] in ("queued", "running"):
            return _response(200, {"status": "processing"})
        if state["status"] == "failed":
            return _response(200, {"status": "failed", "error": state["error"]})
        body = {"status": "done", "url": state["url"], "cost": state.get("cost")}
        image_b64 = payload.get("image")
        if image_b64:
            preset = _preset(payload.get("preset"))
            try:
                body["image"] = models.compose(
                    image_b64, models.download(state["url"]),
                    strength=preset["strength"],
                    keep_texture=preset["keep_texture"],
                    regions=payload.get("regions") or None,
                    trust_threshold=preset["trust"],
                    highlight_recovery=preset["highlights"],
                    even_out=preset["even_out"],
                )
            except Exception as e:
                body["compose_error"] = str(e)[:300]
        return _response(200, body)

    model = payload.get("model") or models.MODEL
    image_b64 = payload.get("image")
    if not image_b64:
        return _response(400, {"error": "image (base64) is required"})
    try:
        new_id = models.start_task(image_b64, model=model)
    except Exception as e:
        return _response(502, {"error": str(e)[:300]})
    return _response(200, {"task_id": new_id, "model": model,
                           "candidates": {k: v["cost_rub"] for k, v in models.CANDIDATES.items()}})


def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """Ретушь кожи через AI с защитой внешности композитом по маске."""
    method = event.get("httpMethod", "POST")
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": _cors_headers(), "body": "", "isBase64Encoded": False}

    if method != "POST":
        return _response(405, {"error": "method not allowed"})

    params = event.get("queryStringParameters", {}) or {}
    action = params.get("action", "estimate")

    try:
        body_raw = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            body_raw = base64.b64decode(body_raw).decode("utf-8")
        payload = json.loads(body_raw.strip() or "{}")
    except Exception as e:
        return _response(400, {"error": f"invalid JSON body: {e}"})

    user_id = _get_user_id(event)

    if action == "estimate":
        return _handle_estimate()
    if action == "start":
        return _handle_start(payload, user_id)
    if action == "status":
        return _handle_status(payload, user_id)
    if action == "abandon":
        return _handle_abandon(payload, user_id)
    if action == "compose":
        return _handle_compose(payload, user_id)
    if action == "regions":
        return _handle_regions(payload)
    if action == "balance":
        return _handle_balance(user_id)
    if action == "catalog":
        return _handle_catalog(user_id)
    if action == "bench":
        return _handle_bench(payload, user_id)

    return _response(400, {"error": "unknown action (use ?action=estimate|start|status|regions|balance|catalog|bench)"})