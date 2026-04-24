import io
import os
import base64
import numpy as np
import requests
from PIL import Image, ImageFilter


FACE_PARSE_URL = os.environ.get(
    "FACE_PARSE_URL",
    "https://io.foto-mix.ru/api/v2/face_parse",
)
FACE_PARSE_USER = os.environ.get("RETOUCH_BASIC_USER", "admin")
FACE_PARSE_PASS = os.environ.get("RETOUCH_BASIC_PASS", "")
FACE_PARSE_TIMEOUT = float(os.environ.get("FACE_PARSE_TIMEOUT", "15"))


def _call_ai_face_parse(image_bytes, mode="skin"):
    """Вызывает ИИ-сегментацию на сервере retouch (SegFormer).
    Возвращает np.uint8 маску (0/255) или None при любой ошибке — тогда
    вызывающий код откатится на эвристику.
    """
    if not FACE_PARSE_PASS:
        return None
    try:
        b64 = base64.b64encode(image_bytes).decode('ascii')
        r = requests.post(
            FACE_PARSE_URL,
            auth=(FACE_PARSE_USER, FACE_PARSE_PASS),
            json={"image": b64, "mode": mode},
            timeout=FACE_PARSE_TIMEOUT,
        )
        if r.status_code != 200:
            print(f"[AI MASK] bad status {r.status_code}: {r.text[:200]}")
            return None
        data = r.json()
        mask_bytes = base64.b64decode(data["mask"])
        mask_img = Image.open(io.BytesIO(mask_bytes)).convert("L")
        mask_arr = np.array(mask_img)
        stats = data.get("stats", {})
        print(
            f"[AI MASK] mode={mode} cov={stats.get('coverage_pct')}% "
            f"infer={stats.get('inference_ms')}ms "
            f"device={stats.get('device')}"
        )
        return mask_arr
    except Exception as e:
        print(f"[AI MASK] call failed: {e}")
        return None


def _detect_skin_color(img_arr):
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)

    y = 0.299 * r + 0.587 * g + 0.114 * b
    cr = (r - y) * 0.713 + 128
    cb = (b - y) * 0.564 + 128

    # Кожа всегда ТЁПЛАЯ: r > g > b (красный > зелёный > синий).
    # Это критично для отсеивания оливкового/зелёного фона, где g > r.
    warm = (r > g - 2) & (g > b - 5) & (r > b + 5)

    # YCrCb диапазон (чуть уже чем было, чтобы фон не проходил).
    skin = (
        (y > 30) & (y < 245) &
        (cr > 133) & (cr < 190) &
        (cb > 77) & (cb < 135) &
        warm
    )

    # Блики на коже (белые/молочные от света): очень яркие + тёплые.
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.where(maxc > 0, (maxc - minc) / np.maximum(maxc, 1.0), 0.0)
    highlight = (y > 210) & (sat < 0.15) & warm

    return (skin | highlight).astype(np.uint8) * 255


def _find_face_regions(skin_mask):
    h, w = skin_mask.shape

    # ПРЕДВАРИТЕЛЬНЫЙ closing: мягко склеиваем разорванные тенями половины лица.
    # Радиус подобран так, чтобы маска не расползлась в чёлку/нос:
    # Max чуть больше Min — результирующее расширение ~2–3px.
    pre_r_max = max(4, int(min(h, w) * 0.008))
    pre_r_min = max(3, int(min(h, w) * 0.006))
    pre_pil = Image.fromarray(skin_mask, mode='L')
    pre_pil = pre_pil.filter(ImageFilter.MaxFilter(min(pre_r_max * 2 + 1, 13)))
    pre_pil = pre_pil.filter(ImageFilter.MinFilter(min(pre_r_min * 2 + 1, 11)))
    skin_mask = np.array(pre_pil)

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

    # Берём ТОЛЬКО самый большой connected-компонент. Если одежда+кожа
    # связаны через шею, это тоже один компонент, но дальше ограничим bbox'ом.
    biggest = max(label_sizes, key=label_sizes.get)
    face_labels = [biggest]

    face_small = np.zeros((sh, sw), dtype=np.uint8)
    for lid in face_labels:
        face_small[labels == lid] = 255

    if step > 1:
        face_pil = Image.fromarray(face_small, mode='L').resize((w, h), Image.NEAREST)
        face_small_up = np.array(face_pil)
    else:
        face_small_up = face_small

    # Заполняем дыры (тени, глаза, рот, ЩЕТИНА) через агрессивный closing.
    # Радиус closing зависит от размера кадра — на крупных планах щетинистые
    # "дыры" в маске достигают 20-30px, нужно большое MaxFilter.
    close_r = max(9, int(min(h, w) * 0.025))
    close_k = min(close_r * 2 + 1, 51)
    if close_k % 2 == 0:
        close_k += 1
    face_closed_pil = Image.fromarray(face_small_up, mode='L')
    # Расширяем (закрываем дыры от щетины и теней)
    face_closed_pil = face_closed_pil.filter(ImageFilter.MaxFilter(close_k))
    # Сжимаем обратно, но чуть меньше — чтобы маска осталась с запасом.
    shrink_k = max(5, close_k - 6)
    if shrink_k % 2 == 0:
        shrink_k += 1
    face_closed_pil = face_closed_pil.filter(ImageFilter.MinFilter(shrink_k))
    blur_r = max(3, min(h, w) // 200)
    face_closed_pil = face_closed_pil.filter(ImageFilter.GaussianBlur(radius=blur_r))
    face_closed = np.array(face_closed_pil)
    face_closed = np.where(face_closed > 64, 255, 0).astype(np.uint8)

    # ГЕОГРАФИЧЕСКОЕ ОГРАНИЧЕНИЕ: находим bbox ЛИЦА по плотности skin-пикселей
    # в горизонтальных полосах. Лицо — это полоса с максимальной концентрацией
    # кожи; одежда ниже неё — широкая зона с пробелами.
    col_density = np.sum(face_closed > 0, axis=1) / max(1, w)
    # Лицо: горизонтальные ряды с плотностью кожи 20–80% ширины кадра.
    face_rows = np.where((col_density > 0.10) & (col_density < 0.85))[0]
    if len(face_rows) > 10:
        top = int(face_rows[0])
        # Нижняя граница лица — последний ряд с приличной плотностью, но не "одежда".
        # Одежда обычно даёт плотность >0.5 сплошняком на большой высоте.
        # Ищем "провал" после лица: резкое увеличение плотности (воротник)
        # или сужение после широкой части (шея→плечи).
        peak_row = int(face_rows[np.argmax(col_density[face_rows])])
        peak_density = float(col_density[peak_row])
        # Нижний край: после пика плотность падает (подбородок→шея), потом снова
        # растёт (одежда). Находим первый локальный минимум после пика.
        bottom = h
        for y in range(peak_row + 10, h - 5):
            # Зона шеи: плотность снизилась относительно пика.
            if col_density[y] < peak_density * 0.35:
                # Дальше ищем рост (начало одежды) — это и есть граница.
                for y2 in range(y, min(h, y + int(h * 0.15))):
                    if col_density[y2] > peak_density * 0.7:
                        bottom = y
                        break
                if bottom != h:
                    break
        # Если не нашли — ограничим 90% от высоты кадра, минус зона явной одежды.
        if bottom == h:
            bottom = min(h, peak_row + int((peak_row - top) * 1.3))

        # Горизонтально — bbox головы с запасом 5%.
        col_sums = np.sum(face_closed[top:bottom] > 0, axis=0)
        col_nz = np.where(col_sums > 0)[0]
        if len(col_nz) > 0:
            left = max(0, int(col_nz[0]) - int(w * 0.02))
            right = min(w, int(col_nz[-1]) + int(w * 0.02))
        else:
            left, right = 0, w

        bbox_mask = np.zeros_like(face_closed)
        bbox_mask[top:bottom, left:right] = 255
        face_closed = np.minimum(face_closed, bbox_mask)
        print(f"[SKIN MASK] Face bbox: y=[{top},{bottom}] x=[{left},{right}], peak_row={peak_row}")

    # Финальная маска: используем расширенную face_closed (с залитой щетиной),
    # а skin_mask — только для проверки что там вообще есть кожа поблизости.
    # НЕ умножаем на skin_mask, чтобы щетина попала в маску.
    result = face_closed
    print(f"[SKIN MASK] Face regions: {len(face_labels)}, {np.count_nonzero(result)*100/(h*w):.1f}%")
    return result


def _exclude_non_skin(img_arr, mask):
    """Вычищаем из маски всё, что заведомо НЕ кожа.
    ВАЖНО: прыщи (красноватые пятна) НЕ отсекаем — они нужны для ретуши.
    """
    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)

    brightness = (r + g + b) / 3.0
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    sat = np.zeros_like(brightness)
    nz = maxc > 0
    sat[nz] = (maxc[nz] - minc[nz]) / maxc[nz]

    # 1) Тёмные — волосы брюнет, зрачки. Порог понижен, чтобы тени на
    # переносице и под глазами оставались в маске кожи.
    mask[(brightness < 35) & (mask > 0)] = 0

    # 2) Серо-белые зоны — одежда, фон, засветы без цвета (R≈G≈B).
    # Смягчили: sat<0.08 (вместо 0.12) — иначе кожа в тени (низкая sat)
    # ошибочно вырезается.
    neutral = (sat < 0.08) & (brightness > 140)
    mask[neutral & (mask > 0)] = 0

    # 3) Только ОЧЕНЬ пересвеченная одежда/фон — практически ахроматичная
    # (R≈G≈B) + выше 230. Блики на коже (sat немного выше или яркость ниже)
    # оставляем в маске, чтобы ретушь их сгладила.
    mask[(sat < 0.04) & (brightness > 230) & (mask > 0)] = 0

    # 4) Волосы русые/светлые: высокая насыщенность + доминирующий жёлто-коричневый
    #    (R>G>B с большим разрывом). У кожи разрыв меньше.
    yellow_hair = (r - b > 35) & (g - b > 18) & (brightness < 195) & (sat > 0.20)
    mask[yellow_hair & (mask > 0)] = 0

    # 4b) Тёмно-русые/каштановые волосы: средняя яркость, тёплый коричневый
    brown_hair = (r > g) & (g > b) & (r - b > 25) & (brightness < 140) & (sat > 0.18)
    mask[brown_hair & (mask > 0)] = 0

    # 5) Холодные оттенки (синева) — не кожа
    bluish = (b > r) | (b > g + 15)
    mask[bluish & (mask > 0)] = 0

    # 5b) ГУБЫ: сильный красный с высокой сатурацией и заметно более
    # низкой яркостью, чем остальная кожа. Отсекаем, иначе красные губы
    # попадают в маску дефектов (ложный «прыщ»).
    lips = (r - g > 20) & (r - b > 30) & (sat > 0.28) & (brightness < 190)
    mask[lips & (mask > 0)] = 0

    # 6) Зелёные оттенки — не кожа
    greenish = (g > r + 10) & (g > b + 15)
    mask[greenish & (mask > 0)] = 0

    return mask


def _local_stats(values, skin_mask, tile=64):
    """Локальное среднее/std по тайлам с ПЕРЕКРЫТИЕМ, затем апсемпл +
    сильное гауссово сглаживание. Так граница между тайлами перестаёт
    проявляться в маске как резкая "ступенька" на лице.
    """
    h, w = values.shape
    # Перекрывающиеся тайлы: шаг = tile/2, окно = tile.
    step = max(16, tile // 2)
    ty = max(1, (h + step - 1) // step)
    tx = max(1, (w + step - 1) // step)

    means = np.zeros((ty, tx), dtype=np.float32)
    stds = np.zeros((ty, tx), dtype=np.float32)

    for i in range(ty):
        for j in range(tx):
            cy = i * step
            cx = j * step
            y1 = max(0, cy - tile // 2)
            y2 = min(h, cy + tile // 2 + step)
            x1 = max(0, cx - tile // 2)
            x2 = min(w, cx + tile // 2 + step)
            block_vals = values[y1:y2, x1:x2]
            block_mask = skin_mask[y1:y2, x1:x2] > 0
            if np.count_nonzero(block_mask) > 30:
                v = block_vals[block_mask]
                means[i, j] = np.mean(v)
                stds[i, j] = max(5, np.std(v))
            else:
                means[i, j] = np.nan
                stds[i, j] = np.nan

    # Итеративно заполним NaN соседями — избегаем «дырок» там, где
    # тайл пустой (вне маски лица), чтобы после blur не было тёмных пятен.
    valid = ~np.isnan(means)
    if np.any(valid):
        g_mean_fill = float(np.mean(means[valid]))
        g_std_fill = float(np.mean(stds[valid]))
    else:
        g_mean_fill = float(np.mean(values))
        g_std_fill = max(5.0, float(np.std(values)))
    means[~valid] = g_mean_fill
    stds[~valid] = g_std_fill

    # Апсемпл: через uint16 mode 'I;16' — гарантированно работает в PIL.
    # Масштаб ×100 сохраняет 2 знака точности (значения статистики 0..255).
    def _upsample(arr_small, out_w, out_h):
        arr16 = np.clip(arr_small * 100.0, 0, 65535).astype(np.uint16)
        img = Image.fromarray(arr16, mode='I;16').resize((out_w, out_h), Image.BILINEAR)
        return np.array(img, dtype=np.float32) / 100.0

    mean_img = _upsample(means, w, h)
    std_img = _upsample(stds, w, h)

    # Сглаживание через собственную separable-гауссову свёртку numpy —
    # избегаем проблем с режимом 'F' в PIL и гарантированно убираем
    # "ступеньки" на границах тайлов.
    smooth_r = max(16, tile // 2)
    mean_img = _gaussian_blur_np(mean_img, smooth_r)
    std_img = _gaussian_blur_np(std_img, smooth_r)
    return mean_img, std_img


def _gaussian_blur_np(arr, radius):
    """Быстрый сепарабельный гауссов блюр на numpy (без SciPy)."""
    if radius <= 0:
        return arr.astype(np.float32)
    sigma = float(radius) / 2.0
    k = int(max(3, radius * 2 + 1))
    x = np.arange(k, dtype=np.float32) - (k - 1) / 2.0
    kernel = np.exp(-(x * x) / (2.0 * sigma * sigma))
    kernel /= kernel.sum()
    # Конволюция по строкам, потом по столбцам.
    pad = (k - 1) // 2
    a = arr.astype(np.float32)
    # По оси X
    ap = np.pad(a, ((0, 0), (pad, pad)), mode='edge')
    tmp = np.zeros_like(a)
    for i, w in enumerate(kernel):
        tmp += ap[:, i:i + a.shape[1]] * w
    # По оси Y
    ap2 = np.pad(tmp, ((pad, pad), (0, 0)), mode='edge')
    out = np.zeros_like(a)
    for i, w in enumerate(kernel):
        out += ap2[i:i + a.shape[0], :] * w
    return out


def _dog_response(channel, sigma_small, sigma_large):
    """Difference of Gaussians: даёт пик на blob'ах ~sigma_small диаметра.
    Положительные значения = яркие/красные пятна, отрицательные = тёмные.
    Ровная краснота, щетина и шум на этом масштабе ≈ 0.
    """
    s = _gaussian_blur_np(channel, max(1, int(sigma_small)))
    L = _gaussian_blur_np(channel, max(1, int(sigma_large)))
    return s - L


def _detect_defects(img_arr, skin_mask):
    """Детектор прыщей через blob-отклик (DoG).
    Принципы:
    - Прыщ = ЛОКАЛЬНЫЙ ПИК красноты или яркостного провала размером 3-15px.
    - Ровная краснота кожи, ухо, шея, щетина, шум — НЕ дают пика на этом
      масштабе и в маску не попадают.
    - Каждый найденный пик расширяется в круг ~ радиуса blob'а.
    """
    h, w = img_arr.shape[:2]
    skin_bin = (skin_mask > 0)
    if int(np.count_nonzero(skin_bin)) < 50:
        return np.zeros((h, w), dtype=np.uint8)

    r = img_arr[:, :, 0].astype(np.float32)
    g = img_arr[:, :, 1].astype(np.float32)
    b = img_arr[:, :, 2].astype(np.float32)
    gray = (r + g + b) / 3.0
    redness = r - (g + b) / 2.0

    # Мультимасштабный DoG: ловим прыщи РАЗНЫХ размеров.
    # На крупном плане (3000px) прыщи 8-20px, на мелком (600px) — 3-6px.
    # Берём максимум откликов на двух масштабах.
    small_s = max(2, int(min(h, w) * 0.003))   # мелкие прыщи
    small_l = small_s * 5
    mid_s = max(4, int(min(h, w) * 0.010))     # крупные прыщи (crop-фото)
    mid_l = mid_s * 5

    red_dog = np.maximum(
        _dog_response(redness, small_s, small_l),
        _dog_response(redness, mid_s, mid_l),
    )
    dark_dog = np.maximum(
        _dog_response(-gray, small_s, small_l),
        _dog_response(-gray, mid_s, mid_l),
    )
    bright_dog = np.maximum(
        _dog_response(gray, small_s, small_l),
        _dog_response(gray, mid_s, mid_l),
    )
    sigma_small = small_s
    sigma_large = mid_l

    # Адаптивные пороги: берём перцентили только по коже.
    rd_skin = red_dog[skin_bin]
    dd_skin = dark_dog[skin_bin]
    bd_skin = bright_dog[skin_bin]

    # 99-й перцентиль ловит реальные пики, но не широкополосные изменения.
    red_thr = max(3.0, float(np.percentile(rd_skin, 98))) if rd_skin.size > 100 else 5.0
    dark_thr = max(3.0, float(np.percentile(dd_skin, 98))) if dd_skin.size > 100 else 5.0
    bright_thr = max(4.0, float(np.percentile(bd_skin, 99))) if bd_skin.size > 100 else 8.0

    red_peaks = (red_dog > red_thr) & skin_bin
    dark_peaks = (dark_dog > dark_thr) & skin_bin
    bright_peaks = (bright_dog > bright_thr) & skin_bin

    # === ДЕТЕКЦИЯ ЩЕТИНЫ ===
    # Щетина = ОЧЕНЬ много мелких тёмных точек на единицу площади.
    # Считаем плотность dark_peaks через размытие. Где плотность высокая —
    # это борода / щетина, прыщи туда не попадают.
    dark_density_pil = Image.fromarray(
        (dark_peaks.astype(np.uint8) * 255), mode='L'
    ).filter(ImageFilter.GaussianBlur(radius=max(8, int(min(h, w) * 0.020))))
    dark_density = np.array(dark_density_pil)
    # Порог 22 = локально >~9% пикселей являются тёмными точками.
    stubble_zone = dark_density > 22

    # Расширяем зону щетины с запасом, чтобы прыщи между волосками тоже
    # не попадали в маску (LaMa там сгладит щетину).
    stubble_pil = Image.fromarray(
        (stubble_zone.astype(np.uint8) * 255), mode='L'
    ).filter(ImageFilter.MaxFilter(7))
    stubble_zone = np.array(stubble_pil) > 0

    # Дефекты = пики, но НЕ в зоне щетины (там оставляем кожу как есть).
    # Красные пики оставляем даже в щетине — это явные воспаления.
    peaks = ((red_peaks) |
             (dark_peaks & ~stubble_zone) |
             (bright_peaks & ~stubble_zone)).astype(np.uint8) * 255

    # Расширяем каждый пик в круг радиуса ~ mid_s (покрываем крупные прыщи).
    grow_r = max(3, mid_s)
    max_k = grow_r * 2 + 1
    if max_k % 2 == 0:
        max_k += 1
    max_k = min(max_k, 21)  # лимит 21px чтобы не раздувать тени
    peaks_pil = Image.fromarray(peaks, mode='L').filter(
        ImageFilter.MaxFilter(max_k)
    )
    defects = np.array(peaks_pil)
    defects = np.minimum(defects, skin_mask)
    stubble_cnt = int(np.count_nonzero(stubble_zone))

    # Удаляем крупные заливки (на случай, если несколько пиков слились в зону >
    # ~30px — это уже не прыщ, а тень/брови/складка).
    before_blob = int(np.count_nonzero(defects))
    blob_r = max(8, int(min(h, w) * 0.018))
    erode_pil = Image.fromarray(defects, mode='L')
    for _ in range(blob_r):
        erode_pil = erode_pil.filter(ImageFilter.MinFilter(3))
    for _ in range(blob_r + 2):
        erode_pil = erode_pil.filter(ImageFilter.MaxFilter(3))
    big_blobs = np.array(erode_pil)
    defects = np.where(big_blobs > 0, 0, defects).astype(np.uint8)
    after_blob = int(np.count_nonzero(defects))

    cnt = after_blob
    rc = int(np.count_nonzero(red_peaks))
    dc = int(np.count_nonzero(dark_peaks))
    bc = int(np.count_nonzero(bright_peaks))
    print(f"[SKIN MASK] Defects(DoG): {cnt}px "
          f"red={rc} dark={dc} bright={bc} stubble={stubble_cnt} "
          f"thr=r{red_thr:.1f}/d{dark_thr:.1f}/b{bright_thr:.1f} "
          f"sigma={sigma_small}/{sigma_large} blob_removed={before_blob - after_blob}")
    return defects


def _dilate_mask(mask, px):
    if px <= 0:
        return mask
    m = Image.fromarray(mask, mode='L')
    # Два прохода: crude dilate + closing для склейки соседних пятен.
    for _ in range(max(1, px // 2)):
        m = m.filter(ImageFilter.MaxFilter(min(px * 2 + 1, 13)))
    # Closing: dilate затем erode — заполняет мелкие промежутки
    m = m.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(3))
    return np.array(m)


def build_face_skin_mask(image_bytes):
    """Возвращает маску ВСЕЙ кожи лица и шеи (без дефектов — всю зону целиком).
    Используется для композиции результата внешней ретуши с оригиналом:
    внутри маски применяем ретушь, снаружи (волосы, брови, одежда) — оригинал.

    Сначала пробует ИИ (SegFormer face-parsing на сервере), при недоступности —
    откат на YCrCb-эвристику.
    """
    # ИИ-маска: точная, разделяет кожу/волосы/одежду/глаза.
    ai_mask = _call_ai_face_parse(image_bytes, mode="skin")
    if ai_mask is not None:
        # Лёгкое сглаживание краёв, чтобы не было ступенек.
        m = Image.fromarray(ai_mask, mode='L').filter(ImageFilter.GaussianBlur(radius=1.5))
        ai_mask = np.where(np.array(m) > 128, 255, 0).astype(np.uint8)
        return _mask_to_b64(ai_mask)

    # Fallback: эвристика.
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')
    img_arr = np.array(img)
    h, w = img_arr.shape[:2]

    skin_color = _detect_skin_color(img_arr)
    pct = np.count_nonzero(skin_color) * 100 / (h * w)
    if pct < 1:
        return _mask_to_b64(np.zeros((h, w), dtype=np.uint8))

    face_skin = _find_face_regions(skin_color)
    face_skin = _exclude_non_skin(img_arr, face_skin)

    # Closing: заполняем мелкие дыры (глаза, рот, тени под бровями),
    # но с радиусом, который НЕ надувает маску в чёлку и нос.
    close_r = max(4, int(min(h, w) * 0.007))
    m = Image.fromarray(face_skin, mode='L')
    m = m.filter(ImageFilter.MaxFilter(min(close_r * 2 + 1, 13)))
    m = m.filter(ImageFilter.MinFilter(min(close_r * 2 + 1, 13)))
    # Финальная лёгкая эрозия по периметру — убираем «заход» в чёлку/волосы.
    erode_r = max(2, int(min(h, w) * 0.004))
    m = m.filter(ImageFilter.MinFilter(min(erode_r * 2 + 1, 7)))
    # Мягкое сглаживание границ.
    m = m.filter(ImageFilter.GaussianBlur(radius=2))
    face_skin = np.array(m)
    face_skin = np.where(face_skin > 96, 255, 0).astype(np.uint8)

    print(f"[SKIN MASK] Face skin: {np.count_nonzero(face_skin) * 100 / (h * w):.1f}%")
    return _mask_to_b64(face_skin)


def build_auto_mask(image_bytes):
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != 'RGB':
        img = img.convert('RGB')

    img_arr = np.array(img)
    h, w = img_arr.shape[:2]
    print(f"[SKIN MASK] Image: {w}x{h}")

    # ИИ-маска кожи: точная, минует одежду/волосы/глаза/губы.
    ai_face_skin = _call_ai_face_parse(image_bytes, mode="skin")
    if ai_face_skin is not None:
        face_skin = ai_face_skin
        pct_ai = np.count_nonzero(face_skin) * 100 / (h * w)
        print(f"[SKIN MASK] AI face skin: {pct_ai:.1f}%")
        if pct_ai < 1:
            print("[SKIN MASK] AI: no skin on image — empty mask")
            return _mask_to_b64(np.zeros((h, w), dtype=np.uint8))
    else:
        # Fallback: старая эвристика.
        skin_color = _detect_skin_color(img_arr)
        pct = np.count_nonzero(skin_color) * 100 / (h * w)
        print(f"[SKIN MASK] Skin color (heuristic): {pct:.1f}%")
        if pct < 1:
            print("[SKIN MASK] No skin — empty mask")
            return _mask_to_b64(np.zeros((h, w), dtype=np.uint8))
        face_skin = _find_face_regions(skin_color)
        face_skin = _exclude_non_skin(img_arr, face_skin)

    defects = _detect_defects(img_arr, face_skin)

    dilate_px = max(6, int(min(h, w) * 0.012))
    expanded = _dilate_mask(defects, dilate_px)
    expanded = np.minimum(expanded, face_skin)

    # Смягчаем края маски — иначе прямоугольные ядра MaxFilter оставляют
    # угловатые следы на коже после инпейнта.
    soft_r = max(2, dilate_px // 3)
    soft = np.array(
        Image.fromarray(expanded, mode='L').filter(ImageFilter.GaussianBlur(radius=soft_r))
    )
    # Порог 40 — круглые края без "ступенек", не теряя центр пятен
    expanded = np.where(soft > 40, 255, 0).astype(np.uint8)
    expanded = np.minimum(expanded, face_skin)

    total = np.count_nonzero(expanded)
    pct = total * 100 / (h * w)
    print(f"[SKIN MASK] Final: {total}px ({pct:.2f}%), dilate={dilate_px}")

    # Защита от «маска залила всё лицо» — только при действительно огромных значениях.
    # Лицо с сильным акне реально требует 15–25% кадра, поэтому порог подняли до 30%.
    if pct > 30:
        print("[SKIN MASK] Too large, reducing")
        gray = np.mean(img_arr.astype(np.float32), axis=2)
        sp = gray[face_skin > 0]
        sm, ss = np.mean(sp), max(8, np.std(sp))
        # Мягче порог: 1.8·std вместо 2.3·std, чтобы fallback не обнулял маску.
        strict = ((gray < sm - 1.8 * ss) & (face_skin > 0)).astype(np.uint8) * 255
        strict_pil = Image.fromarray(strict, mode='L')
        strict = np.array(strict_pil.filter(ImageFilter.MinFilter(3)))
        strict_pil2 = Image.fromarray(strict, mode='L')
        strict = np.array(strict_pil2.filter(ImageFilter.MaxFilter(3)))
        strict_expanded = _dilate_mask(strict, dilate_px)
        strict_expanded = np.minimum(strict_expanded, face_skin)
        strict_pct = np.count_nonzero(strict_expanded) * 100 / (h * w)
        print(f"[SKIN MASK] Reduced candidate: {strict_pct:.2f}%")
        # Применяем fallback ТОЛЬКО если он не обнулил маску.
        if strict_pct >= 1.0:
            expanded = strict_expanded
            pct = strict_pct
        else:
            print("[SKIN MASK] Fallback produced empty mask — keep original")

    return _mask_to_b64(expanded)


def _mask_to_b64(mask_array):
    # Отдаём RGBA: R=G=B=255 (белый), A=сама маска. Так:
    # 1) Бэкенд-инпейнт по-прежнему читает яркость (всё белое там где A>0).
    # 2) Фронт-CSS mask-image через альфу корректно показывает прозрачные зоны,
    #    вместо того чтобы заливать весь кадр.
    h, w = mask_array.shape[:2]
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = 255
    rgba[..., 1] = 255
    rgba[..., 2] = 255
    rgba[..., 3] = mask_array
    m = Image.fromarray(rgba, mode='RGBA')
    buf = io.BytesIO()
    m.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('utf-8')