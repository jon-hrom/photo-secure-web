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
  - skin_texture_amount: наложение ЭТАЛОННОЙ текстуры пор на всю кожу
      (в единицах яркости; 0 = выкл). Работает там, где своей текстуры
      уже не осталось — после сильного healing кожа становится пластиковой.
  - skin_texture_scale: масштаб зерна пор (1.0 = как в эталоне)

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
        # Лёгкая ретушь почти не трогает поры — эталон нужен чуть-чуть,
        # только на вылизанных участках.
        "skin_texture_amount": 3.0,
        "skin_texture_scale": 1.0,

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
        "red_cast_passes": 2,
        "final_red_strength": 0.5,
        "final_red_passes": 1,
        "micro_texture": 0.38,
        "skin_texture_amount": 5.5,
        "skin_texture_scale": 1.0,

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
        # Рабочее разрешение выше: на 1000px мелкие точки и рубчики от акне
        # занимают 1-2px и тонут в интерполяции — детектор их не видит.
        "max_compose_side": 1400,
        "preview_side": 1024,

        # Агрессивный healing: 5 масштабов, широкий захват ореола прыща,
        # низкий порог детекции — ловим даже слабые пятна и пост-акне.
        "heal_passes": 5,
        # Четыре прохода: каждый следующий добивает пятна, пережившие предыдущий.
        "heal_iterations": 4,
        # Россыпь акне не должна приниматься за щетину и оставаться на фото.
        "stubble_guard": False,
        "defect_grow_px": 8,
        "defect_sensitivity": 84.0,
        # Плоские красные пятна и пост-акне тоже лечим.
        "red_patch_strength": 1.8,
        # Россыпь мелких точек, комедонов и рубчиков тоже убираем.
        "spot_strength": 2.0,
        # Почти до самого контура лица: красные точки у края щеки раньше
        # отсекались защитой края маски.
        "edge_guard": 0.55,

        # Сильное выравнивание тона, текстура возвращается отдельно.
        "tone_radius_ratio": 0.014,
        "tone_strength": 0.96,
        # Ниже texture_keep и blotch_clip = рельеф рубчиков-углублений
        # срезается вместе с остаточными точками.
        "texture_keep": 0.22,
        "blotch_clip": 2.5,

        "color_even_strength": 0.95,
        "red_cast_strength": 1.0,
        # Один проход снимает лишь верхушку красноты; три добивают точки
        # до тона кожи. Яркость при этом не меняется — компенсация по G/B.
        "red_cast_passes": 3,
        # И финальный проход уже на полном разрешении: точки 2-4px на
        # рабочей копии 1400px усреднялись в фон и оставались красными.
        "final_red_strength": 1.0,
        "final_red_passes": 3,
        # Возврат пор из оригинала уменьшен: вместе с порами возвращались
        # ямки от акне. Вместо них кладём ЭТАЛОННУЮ текстуру — она ровная
        # и без дефектов, поэтому её можно дать по всей коже.
        "micro_texture": 0.24,
        # Сила подобрана по референсу: в эталонном бьюти-снимке зерно кожи
        # на чистой щеке даёт std ≈ 13 единиц яркости. Берём чуть меньше —
        # часть текстуры возвращает micro_texture из самого кадра.
        "skin_texture_amount": 9.0,
        "skin_texture_scale": 1.0,
        # Гасим мелкий рельеф кожи уже на ПОЛНОМ разрешении: точки и
        # рубчики-углубления, невидимые на рабочих 1400px, иначе приезжают
        # обратно из оригинала вместе с переносом разницы.
        "full_hf_damp": 0.75,

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