"""Профессиональные пресеты ретуши.

Каждый пресет — набор параметров для всего pipeline композиции:

  AI-слой:
  - strength: сила работы внешнего LaMa-API (0..1)
  - alpha_multiplier: насколько сильно вклеивается AI-результат в кожу
  - max_compose_side: разрешение для композиции
  - preview_side: разрешение для построения маски

  Healing прыщей:
  - heal_passes: число масштабов интерполяции дефектов (0 = выкл)
  - defect_grow_px: расширение маски дефекта (чтобы захватить ореол прыща)
  - defect_sensitivity: чувствительность детектора (percentile), ниже = больше находит

  Frequency separation:
  - tone_radius_ratio: доля от размера кадра для разделения частот
  - tone_strength: 0..1 сила выравнивания тона
  - texture_keep: 0..1 сколько высокочастотной текстуры сохранить
  - blotch_clip: порог амплитуды HF, выше которого деталь считается дефектом

  Цвет:
  - color_even_strength: выравнивание цветовых пятен (0..1)
  - red_cast_strength: снятие локальных покраснений (0..1)
  - micro_texture: возврат пор из оригинала (0..1)

  Финал:
  - sharpen_amount / sharpen_radius: финальный шарп
  - jpeg_quality: качество финального JPEG

Три уровня:
  - light: минимальная ретушь, максимум деталей
  - medium: баланс (по умолчанию)
  - strong: глубокая бьюти-ретушь — кожа без единого дефекта
"""

from typing import Dict, Any


PRESETS: Dict[str, Dict[str, Any]] = {
    "light": {
        "strength": 0.35,
        "alpha_multiplier": 0.55,
        "max_compose_side": 1000,
        "preview_side": 1024,

        "heal_passes": 2,
        "defect_grow_px": 2,
        "defect_sensitivity": 98.5,
        "red_patch_strength": 0.0,
        "spot_strength": 0.25,

        "tone_radius_ratio": 0.006,
        "tone_strength": 0.30,
        "texture_keep": 0.85,
        "blotch_clip": 16.0,

        "color_even_strength": 0.25,
        "red_cast_strength": 0.30,
        "micro_texture": 0.45,

        "sharpen_amount": 0.30,
        "sharpen_radius": 0.8,
        "jpeg_quality": 95,
        "apply_c1_preset": False,
    },
    "medium": {
        "strength": 0.55,
        "alpha_multiplier": 0.85,
        "max_compose_side": 1000,
        "preview_side": 1024,

        "heal_passes": 3,
        "defect_grow_px": 3,
        "defect_sensitivity": 97.0,
        "red_patch_strength": 0.5,
        "spot_strength": 0.55,

        "tone_radius_ratio": 0.008,
        "tone_strength": 0.55,
        "texture_keep": 0.62,
        "blotch_clip": 11.0,

        "color_even_strength": 0.45,
        "red_cast_strength": 0.50,
        "micro_texture": 0.38,

        "sharpen_amount": 0.35,
        "sharpen_radius": 0.8,
        "jpeg_quality": 95,
        "apply_c1_preset": False,
    },
    # МАКСИМУМ: кожа как после профессиональной бьюти-ретуши.
    # Ни одного прыща, идеально ровный тон, но текстура пор сохранена.
    "strong": {
        "strength": 0.85,
        "alpha_multiplier": 1.20,
        "max_compose_side": 1000,
        "preview_side": 1024,

        # Агрессивный healing: 5 масштабов, широкий захват ореола прыща,
        # низкий порог детекции — ловим даже слабые пятна и пост-акне.
        "heal_passes": 5,
        # Три прохода: каждый следующий добивает пятна, пережившие предыдущий.
        "heal_iterations": 3,
        # Россыпь акне не должна приниматься за щетину и оставаться на фото.
        "stubble_guard": False,
        "defect_grow_px": 8,
        "defect_sensitivity": 88.0,
        # Плоские красные пятна и пост-акне тоже лечим.
        "red_patch_strength": 1.4,
        # Россыпь мелких точек и комедонов тоже убираем.
        "spot_strength": 1.5,

        # Сильное выравнивание тона, текстура возвращается отдельно.
        "tone_radius_ratio": 0.014,
        "tone_strength": 0.94,
        "texture_keep": 0.30,
        "blotch_clip": 4.0,

        "color_even_strength": 0.90,
        "red_cast_strength": 1.0,
        "micro_texture": 0.34,

        "sharpen_amount": 0.40,
        "sharpen_radius": 0.9,
        "jpeg_quality": 96,
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