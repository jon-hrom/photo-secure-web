"""
IOPaint plugin: SkinRetouch — автоматическая маска дефектов кожи.

Установка на сервер IOPaint:
  1. Скопировать этот файл в папку iopaint/plugins/
  2. Зарегистрировать в iopaint/plugins/__init__.py
  3. Перезапустить IOPaint

Эндпоинт после установки:
  POST /api/v1/run_plugin_gen_mask  {"name": "SkinRetouch", "image": "<base64>"}
"""

import cv2
import numpy as np

try:
    from iopaint.plugins.base_plugin import BasePlugin
except ImportError:
    class BasePlugin:
        name = ""
        support_gen_image = False
        support_gen_mask = False


class SkinRetouchPlugin(BasePlugin):
    name = "SkinRetouch"
    support_gen_image = False
    support_gen_mask = True

    def gen_mask(self, rgb_np: np.ndarray, *args, **kwargs) -> np.ndarray:
        h, w = rgb_np.shape[:2]

        skin = self._detect_skin(rgb_np)
        skin_pct = np.count_nonzero(skin) * 100 / (h * w)
        if skin_pct < 1:
            return np.zeros((h, w), dtype=np.uint8)

        face_skin = self._find_face_regions(skin)
        face_skin = self._exclude_non_skin(rgb_np, face_skin)

        defects = self._detect_defects(rgb_np, face_skin)

        dilate_px = max(3, int(min(h, w) * 0.005))
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_px * 2 + 1, dilate_px * 2 + 1))
        expanded = cv2.dilate(defects, kernel, iterations=1)
        expanded = cv2.min(expanded, face_skin)

        pct = np.count_nonzero(expanded) * 100 / (h * w)
        if pct > 12:
            expanded = self._reduce_mask(rgb_np, face_skin, dilate_px)

        return expanded

    def _detect_skin(self, rgb: np.ndarray) -> np.ndarray:
        r = rgb[:, :, 0].astype(np.float32)
        g = rgb[:, :, 1].astype(np.float32)
        b = rgb[:, :, 2].astype(np.float32)

        y = 0.299 * r + 0.587 * g + 0.114 * b
        cr = (r - y) * 0.713 + 128
        cb = (b - y) * 0.564 + 128

        mask = (
            (y > 60) & (y < 240) &
            (cr > 135) & (cr < 180) &
            (cb > 85) & (cb < 135)
        )
        return (mask.astype(np.uint8) * 255)

    def _find_face_regions(self, skin_mask: np.ndarray) -> np.ndarray:
        h, w = skin_mask.shape
        step = max(1, min(h, w) // 300)
        small = skin_mask[::step, ::step]

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(small, connectivity=4)

        min_area = small.shape[0] * small.shape[1] * 0.003
        face_labels = []
        for i in range(1, num_labels):
            if stats[i, cv2.CC_STAT_AREA] > min_area:
                face_labels.append(i)

        if not face_labels:
            biggest = max(range(1, num_labels), key=lambda i: stats[i, cv2.CC_STAT_AREA], default=0)
            if biggest:
                face_labels = [biggest]
            else:
                return skin_mask

        face_small = np.zeros_like(small)
        for lid in face_labels:
            face_small[labels == lid] = 255

        if step > 1:
            face_full = cv2.resize(face_small, (w, h), interpolation=cv2.INTER_NEAREST)
        else:
            face_full = face_small

        return cv2.min(skin_mask, face_full)

    def _exclude_non_skin(self, rgb: np.ndarray, mask: np.ndarray) -> np.ndarray:
        r = rgb[:, :, 0].astype(np.float32)
        g = rgb[:, :, 1].astype(np.float32)
        b = rgb[:, :, 2].astype(np.float32)

        brightness = (r + g + b) / 3.0
        mask[(brightness < 45) & (mask > 0)] = 0

        redness = r - (g + b) / 2.0
        mask[(redness > 35) & (r > 110) & (mask > 0)] = 0

        maxc = np.maximum(np.maximum(r, g), b)
        minc = np.minimum(np.minimum(r, g), b)
        sat = np.zeros_like(brightness)
        nz = maxc > 0
        sat[nz] = (maxc[nz] - minc[nz]) / maxc[nz]
        mask[(sat < 0.07) & (brightness > 210) & (mask > 0)] = 0

        return mask

    def _detect_defects(self, rgb: np.ndarray, skin_mask: np.ndarray) -> np.ndarray:
        h, w = rgb.shape[:2]
        gray = np.mean(rgb.astype(np.float32), axis=2)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)
        detail = gray - blurred

        skin_px = gray[skin_mask > 0]
        if len(skin_px) < 50:
            return np.zeros((h, w), dtype=np.uint8)

        s_mean = np.mean(skin_px)
        s_std = max(5.0, np.std(skin_px))

        dark = ((gray < s_mean - 1.8 * s_std) & (skin_mask > 0)).astype(np.uint8) * 255

        d_abs = np.abs(detail)
        sd = d_abs[skin_mask > 0]
        d_thr = max(6.0, np.percentile(sd, 93)) if len(sd) > 50 else 10.0
        texture = ((d_abs > d_thr) & (skin_mask > 0)).astype(np.uint8) * 255

        r_ch = rgb[:, :, 0].astype(np.float32)
        g_ch = rgb[:, :, 1].astype(np.float32)
        redness = r_ch - g_ch
        sr = redness[skin_mask > 0]
        if len(sr) > 50:
            r_mean = np.mean(sr)
            r_std = max(3.0, np.std(sr))
            red = ((redness > r_mean + 1.5 * r_std) & (skin_mask > 0)).astype(np.uint8) * 255
        else:
            red = np.zeros((h, w), dtype=np.uint8)

        defects = cv2.max(cv2.max(dark, texture), red)
        defects = cv2.min(defects, skin_mask)

        kernel3 = np.ones((3, 3), np.uint8)
        defects = cv2.erode(defects, kernel3, iterations=1)
        defects = cv2.dilate(defects, kernel3, iterations=1)

        return defects

    def _reduce_mask(self, rgb: np.ndarray, face_skin: np.ndarray, dilate_px: int) -> np.ndarray:
        gray = np.mean(rgb.astype(np.float32), axis=2)
        sp = gray[face_skin > 0]
        sm, ss = np.mean(sp), max(8.0, np.std(sp))
        strict = ((gray < sm - 2.5 * ss) & (face_skin > 0)).astype(np.uint8) * 255

        kernel3 = np.ones((3, 3), np.uint8)
        strict = cv2.erode(strict, kernel3, iterations=1)
        strict = cv2.dilate(strict, kernel3, iterations=1)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_px * 2 + 1, dilate_px * 2 + 1))
        expanded = cv2.dilate(strict, kernel, iterations=1)
        return cv2.min(expanded, face_skin)
