'''
Анализ лиц нейросетью YuNet: находит лица и 5 ключевых точек
(правый глаз, левый глаз, нос, углы рта) даже при повороте головы.
На основе этого считаем резкость ПО ЛИЦУ и определяем состояние глаз.
'''

import base64
import gzip
import os
import tempfile
from typing import List, Tuple, Optional

import cv2
import numpy as np

from yunet_model import MODEL_GZ_B64

_model_path_cache = None


def _ensure_model() -> Optional[str]:
    '''
    Кладёт файл модели во временную папку.
    Облако разворачивает только .py, поэтому бинарник едет внутри кода.
    '''
    global _model_path_cache
    if _model_path_cache and os.path.exists(_model_path_cache):
        return _model_path_cache

    local = os.path.join(os.path.dirname(__file__), 'face_detection_yunet.onnx')
    if os.path.exists(local):
        _model_path_cache = local
        return local

    try:
        path = os.path.join(tempfile.gettempdir(), 'face_detection_yunet.onnx')
        if not os.path.exists(path):
            with open(path, 'wb') as f:
                f.write(gzip.decompress(base64.b64decode(MODEL_GZ_B64)))
            print(f'[FACE] Model unpacked to {path}')
        _model_path_cache = path
        return path
    except Exception as e:
        print(f'[FACE] Failed to unpack model: {e}')
        return None

# Вердикты состояния глаз
EYES_OPEN = 'open'
EYES_CLOSED = 'closed'
EYES_UNCERTAIN = 'uncertain'

_detector = None


def _get_detector(size: Tuple[int, int]):
    '''Создаёт (или переиспользует) детектор лиц YuNet под нужный размер кадра.'''
    global _detector
    model_path = _ensure_model()
    if not model_path:
        return None
    if _detector is None:
        _detector = cv2.FaceDetectorYN.create(
            model=model_path,
            config='',
            input_size=size,
            score_threshold=0.6,
            nms_threshold=0.3,
            top_k=50,
        )
    else:
        _detector.setInputSize(size)
    return _detector


def detect_faces(img: np.ndarray) -> List[dict]:
    '''
    Находит лица нейросетью. Для каждого лица возвращает рамку,
    уверенность и координаты глаз.
    '''
    h, w = img.shape[:2]
    try:
        detector = _get_detector((w, h))
        if detector is None:
            print('[FACE] YuNet model file missing, skipping neural detection')
            return []

        _, faces = detector.detect(img)
        if faces is None:
            return []

        result = []
        for f in faces:
            x, y, fw, fh = int(f[0]), int(f[1]), int(f[2]), int(f[3])
            x = max(0, x)
            y = max(0, y)
            fw = min(fw, w - x)
            fh = min(fh, h - y)
            if fw <= 0 or fh <= 0:
                continue
            result.append({
                'box': (x, y, fw, fh),
                'right_eye': (float(f[4]), float(f[5])),
                'left_eye': (float(f[6]), float(f[7])),
                'nose': (float(f[8]), float(f[9])),
                'score': float(f[14]),
            })
        print(f'[FACE] YuNet detected {len(result)} face(s)')
        return result
    except Exception as e:
        print(f'[FACE] YuNet detection failed: {e}')
        return []


def face_sharpness(img: np.ndarray, face: dict) -> float:
    '''
    Резкость ПО ЛИЦУ, а не по всему кадру.
    Портрет с размытым фоном больше не считается мыльным.
    Значение нормируется на размер лица, чтобы не зависеть от масштаба.
    '''
    x, y, w, h = face['box']
    # Берём центральную часть лица (глаза/нос) — там больше всего деталей
    pad_x = int(w * 0.1)
    pad_y = int(h * 0.1)
    x0 = max(0, x + pad_x)
    y0 = max(0, y + pad_y)
    x1 = min(img.shape[1], x + w - pad_x)
    y1 = min(img.shape[0], y + h - pad_y)
    if x1 - x0 < 10 or y1 - y0 < 10:
        return 0.0

    roi = img[y0:y1, x0:x1]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY) if len(roi.shape) == 3 else roi

    # ВАЖНО: только уменьшаем, никогда не растягиваем.
    # Растянутое мелкое лицо всегда выглядит мыльным — это давало
    # массовые ложные отбраковки на групповых кадрах.
    side = min(gray.shape[0], gray.shape[1])
    if side > 200:
        scale = 200.0 / side
        gray = cv2.resize(gray, (0, 0), fx=scale, fy=scale, interpolation=cv2.INTER_AREA)

    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def face_is_measurable(img: np.ndarray, face: dict) -> bool:
    '''
    Можно ли доверять оценке резкости по этому лицу.
    На мелких лицах (дальний план, групповое фото) деталей мало,
    и любая оценка будет случайной — такие лица не проверяем.
    '''
    _, _, w, h = face['box']
    return min(w, h) >= 90


def eye_patch(img_gray: np.ndarray, center: Tuple[float, float], face_w: int) -> Optional[np.ndarray]:
    '''Вырезает квадратный участок вокруг глаза по координатам от нейросети.'''
    cx, cy = int(center[0]), int(center[1])
    r = max(6, int(face_w * 0.16))
    x0 = max(0, cx - r)
    y0 = max(0, cy - r)
    x1 = min(img_gray.shape[1], cx + r)
    y1 = min(img_gray.shape[0], cy + r)
    if x1 - x0 < 8 or y1 - y0 < 8:
        return None
    return img_gray[y0:y1, x0:x1]


def _eye_openness(patch: np.ndarray) -> Optional[float]:
    '''
    Оценивает раскрытость глаза: отношение высоты тёмной области
    (зрачок + радужка) к её ширине. У открытого глаза зрачок круглый,
    у закрытого/полуприкрытого остаётся узкая полоска ресниц.
    Возвращает None, если оценить нельзя.
    '''
    if patch is None or patch.size == 0:
        return None

    patch = cv2.resize(patch, (48, 48), interpolation=cv2.INTER_CUBIC)
    patch = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(4, 4)).apply(patch)
    patch = cv2.GaussianBlur(patch, (3, 3), 0)

    # Тёмные пиксели = зрачок и радужка
    _, binary = cv2.threshold(patch, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    biggest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(biggest)
    if area < 12:
        return None

    _, _, bw, bh = cv2.boundingRect(biggest)
    if bw <= 0:
        return None

    return float(bh) / float(bw)


def eyes_state(img: np.ndarray, face: dict) -> Tuple[str, str]:
    '''
    Определяет состояние глаз по точкам нейросети.
    Работает и при повороте головы — координаты глаз известны заранее,
    поэтому взгляд в сторону НЕ считается браком.

    Returns: (вердикт, пояснение для логов)
    '''
    x, y, w, h = face['box']
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img

    ratios = []
    for name in ('right_eye', 'left_eye'):
        patch = eye_patch(gray, face[name], w)
        r = _eye_openness(patch)
        if r is not None:
            ratios.append(r)

    if not ratios:
        return EYES_UNCERTAIN, 'не удалось разглядеть глаза'

    best = max(ratios)
    detail = f'раскрытость={best:.2f} (по {len(ratios)} глазам)'

    # Открытый глаз: тёмная область почти круглая (высота ~ ширина)
    if best >= 0.62:
        return EYES_OPEN, detail
    # Закрытый или моргание: осталась узкая полоска
    if best <= 0.38:
        return EYES_CLOSED, detail
    return EYES_UNCERTAIN, detail