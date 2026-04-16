import io
import base64
import numpy as np
from PIL import Image, ImageFilter


def _detect_skin_color(img_arr):
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)

    y = 0.299 * r + 0.587 * g + 0.114 * b
    cr = (r - y) * 0.713 + 128
    cb = (b - y) * 0.564 + 128

    skin = (
        (y > 60) & (y < 240) &
        (cr > 135) & (cr < 180) &
        (cb > 85) & (cb < 135)
    )

    return skin.astype(np.uint8) * 255


def _find_face_regions(skin_mask):
    h, w = skin_mask.shape

    step = max(1, min(h, w) // 300)
    small = skin_mask[::step, ::step]
    sh, sw = small.shape

    labels = np.zeros((sh, sw), dtype=np.int32)
    label_id = 0
    label_sizes = {}

    visited = set()
    for y0 in range(0, sh, 4):
        for x0 in range(0, sw, 4):
            if small[y0, x0] > 0 and (y0, x0) not in visited:
                label_id += 1
                stack = [(y0, x0)]
                count = 0
                while stack:
                    cy, cx = stack.pop()
                    if (cy, cx) in visited:
                        continue
                    if cy < 0 or cy >= sh or cx < 0 or cx >= sw:
                        continue
                    if small[cy, cx] == 0:
                        continue
                    visited.add((cy, cx))
                    labels[cy, cx] = label_id
                    count += 1
                    if count > 200000:
                        break
                    for dy, dx in [(-2, 0), (2, 0), (0, -2), (0, 2)]:
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < sh and 0 <= nx < sw and (ny, nx) not in visited and small[ny, nx] > 0:
                            stack.append((ny, nx))
                label_sizes[label_id] = count

    if not label_sizes:
        return skin_mask

    min_face = (sh * sw) * 0.001
    face_labels = [lid for lid, cnt in label_sizes.items() if cnt > min_face]

    if not face_labels:
        biggest = max(label_sizes, key=label_sizes.get)
        face_labels = [biggest]

    face_small = np.zeros((sh, sw), dtype=np.uint8)
    for lid in face_labels:
        face_small[labels == lid] = 255

    if step > 1:
        face_pil = Image.fromarray(face_small, mode='L').resize((w, h), Image.NEAREST)
        face_mask = np.array(face_pil)
    else:
        face_mask = face_small

    result = np.minimum(skin_mask, face_mask)
    print(f"[SKIN MASK] Face regions: {len(face_labels)}, {np.count_nonzero(result)*100/(h*w):.1f}%")
    return result


def _exclude_non_skin(img_arr, mask):
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)

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


def _detect_defects(img_arr, skin_mask):
    h, w = img_arr.shape[:2]
    gray = np.mean(img_arr.astype(np.float32), axis=2)

    img_pil = Image.fromarray(img_arr)
    blurred = np.mean(np.array(img_pil.filter(ImageFilter.GaussianBlur(radius=3.0))).astype(np.float32), axis=2)
    detail = gray - blurred

    skin_px = gray[skin_mask > 0]
    if len(skin_px) < 50:
        return np.zeros((h, w), dtype=np.uint8)

    s_mean = np.mean(skin_px)
    s_std = max(5, np.std(skin_px))

    dark = ((gray < s_mean - 1.8 * s_std) & (skin_mask > 0)).astype(np.uint8) * 255

    d_abs = np.abs(detail)
    sd = d_abs[skin_mask > 0]
    d_thr = max(6, np.percentile(sd, 93)) if len(sd) > 50 else 10
    texture = ((d_abs > d_thr) & (skin_mask > 0)).astype(np.uint8) * 255

    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    redness = r - g
    sr = redness[skin_mask > 0]
    if len(sr) > 50:
        r_mean = np.mean(sr)
        r_std = max(3, np.std(sr))
        red = ((redness > r_mean + 1.5 * r_std) & (skin_mask > 0)).astype(np.uint8) * 255
    else:
        red = np.zeros((h, w), dtype=np.uint8)

    defects = np.maximum(np.maximum(dark, texture), red)
    defects = np.minimum(defects, skin_mask)

    defects_pil = Image.fromarray(defects, mode='L')
    defects = np.array(defects_pil.filter(ImageFilter.MinFilter(3)))
    defects_pil2 = Image.fromarray(defects, mode='L')
    defects = np.array(defects_pil2.filter(ImageFilter.MaxFilter(3)))

    cnt = np.count_nonzero(defects)
    print(f"[SKIN MASK] Defects: {cnt}px, dark<{s_mean-1.8*s_std:.0f}, detail>{d_thr:.1f}")
    return defects


def _dilate_mask(mask, px):
    if px <= 0:
        return mask
    m = Image.fromarray(mask, mode='L')
    for _ in range(max(1, px // 2)):
        m = m.filter(ImageFilter.MaxFilter(min(px * 2 + 1, 11)))
    return np.array(m)


def build_auto_mask(image_bytes):
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')

    img_arr = np.array(img)
    h, w = img_arr.shape[:2]
    print(f"[SKIN MASK] Image: {w}x{h}")

    skin_color = _detect_skin_color(img_arr)
    pct = np.count_nonzero(skin_color) * 100 / (h * w)
    print(f"[SKIN MASK] Skin color: {pct:.1f}%")

    if pct < 1:
        print("[SKIN MASK] No skin — empty mask")
        return _mask_to_b64(np.zeros((h, w), dtype=np.uint8))

    face_skin = _find_face_regions(skin_color)
    face_skin = _exclude_non_skin(img_arr, face_skin)

    defects = _detect_defects(img_arr, face_skin)

    dilate_px = max(5, int(min(h, w) * 0.01))
    expanded = _dilate_mask(defects, dilate_px)
    expanded = np.minimum(expanded, face_skin)

    total = np.count_nonzero(expanded)
    pct = total * 100 / (h * w)
    print(f"[SKIN MASK] Final: {total}px ({pct:.2f}%), dilate={dilate_px}")

    if pct > 12:
        print("[SKIN MASK] Too large, reducing")
        gray = np.mean(img_arr.astype(np.float32), axis=2)
        sp = gray[face_skin > 0]
        sm, ss = np.mean(sp), max(8, np.std(sp))
        strict = ((gray < sm - 2.5 * ss) & (face_skin > 0)).astype(np.uint8) * 255
        strict_pil = Image.fromarray(strict, mode='L')
        strict = np.array(strict_pil.filter(ImageFilter.MinFilter(3)))
        strict_pil2 = Image.fromarray(strict, mode='L')
        strict = np.array(strict_pil2.filter(ImageFilter.MaxFilter(3)))
        expanded = _dilate_mask(strict, dilate_px)
        expanded = np.minimum(expanded, face_skin)
        pct = np.count_nonzero(expanded) * 100 / (h * w)
        print(f"[SKIN MASK] Reduced: {pct:.2f}%")

    return _mask_to_b64(expanded)


def _mask_to_b64(mask_array):
    m = Image.fromarray(mask_array, mode='L')
    buf = io.BytesIO()
    m.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')