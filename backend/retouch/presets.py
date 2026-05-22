"""Профессиональные пресеты ретуши.

Каждый пресет — это набор параметров для всего pipeline:
  - strength: сила работы внешнего LaMa-API (0..1)
  - max_compose_side: разрешение для композиции (выше = меньше "туманки", больше памяти)
  - preview_side: разрешение для построения маски
  - denoise_strength: сила скин-денойза (0 = выключить)
  - skin_smooth_multiplier: множитель силы сглаживания кожи
  - sharpen_amount: сила финального шарпинга (0 = выключить)
  - sharpen_radius: радиус шарпинга (px)
  - protect_expand_ratio: доля от размера лица для расширения protect-маски глаз/губ/зубов
  - background_protect: возвращать ли оригинальные пиксели фона (защита от серого фона)
  - dodge_burn_strength: сила микроконтраста (Dodge&Burn) на скулах/носу/подбородке (0 = выкл)
  - jpeg_quality: качество финального JPEG
  - apply_c1_preset: применять ли Capture One цветокоррекцию

Три уровня:
  - light: минимальная ретушь, максимум деталей
  - medium: баланс (по умолчанию)
  - strong: глубокая ретушь для проблемной кожи
"""

from typing import Dict, Any


PRESETS: Dict[str, Dict[str, Any]] = {
    "light": {
        "strength": 0.35,
        "max_compose_side": 1800,
        "preview_side": 1024,
        "denoise_strength": 0.0,
        "skin_smooth_multiplier": 0.5,
        "sharpen_amount": 0.35,
        "sharpen_radius": 0.8,
        "background_protect": False,
        "dodge_burn_strength": 0.0,
        "jpeg_quality": 95,
        "apply_c1_preset": False,
    },
    "medium": {
        "strength": 0.55,
        "max_compose_side": 1800,
        "preview_side": 1024,
        "denoise_strength": 0.15,
        "skin_smooth_multiplier": 0.85,
        "sharpen_amount": 0.45,
        "sharpen_radius": 0.8,
        "background_protect": False,
        "dodge_burn_strength": 0.0,
        "jpeg_quality": 95,
        "apply_c1_preset": False,
    },
    "strong": {
        "strength": 0.80,
        "max_compose_side": 1800,
        "preview_side": 1024,
        "denoise_strength": 0.30,
        "skin_smooth_multiplier": 1.15,
        "sharpen_amount": 0.55,
        "sharpen_radius": 0.9,
        "background_protect": False,
        "dodge_burn_strength": 0.0,
        "jpeg_quality": 95,
        "apply_c1_preset": False,
    },
}


def get_preset(name: str) -> Dict[str, Any]:
    """Возвращает конфиг пресета. Неизвестный pres → medium."""
    if not name:
        return PRESETS["medium"]
    key = str(name).strip().lower()
    return PRESETS.get(key, PRESETS["medium"])


def normalize_preset_name(name: str) -> str:
    """Приводит имя пресета к валидному значению."""
    if not name:
        return "medium"
    key = str(name).strip().lower()
    return key if key in PRESETS else "medium"