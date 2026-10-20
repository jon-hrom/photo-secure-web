/**
 * Точный перенос головы: вместо головы, НАРИСОВАННОЙ AI, вклеиваем НАСТОЯЩИЕ пиксели
 * с фото-донора. Голова только равномерно масштабируется, поворачивается и сдвигается
 * (без растяжений и перерисовки) по точкам лица — глаза, нос, рот совпадают с позой,
 * которую AI подобрал под тело. От AI остаются шея, стык с телом и свет вокруг.
 */
import * as faceapi from '@vladmandic/face-api';
import { loadFaceDetectionModels } from '@/utils/faceDetection';

export interface P {
  x: number;
  y: number;
}

/** Опорные точки: уголки глаз, переносица/кончик носа, уголки и центр рта — по ним размер и наклон. */
const KEY_IDX = [36, 39, 42, 45, 27, 30, 33, 48, 54, 51, 57];
/** Если после совмещения точки расходятся больше этой доли ширины лица — поза другая, не вклеиваем. */
const MAX_RESIDUAL = 0.2;
const MEAN_SHIFT_CLAMP = 22;
/** Лёгкое сужение лица по горизонтали (вдоль линии глаз): 1 = без изменений, 0.95 = на 5% уже. */
const FACE_WIDTH = 0.95;

export const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('не удалось загрузить изображение'));
    i.src = src;
  });

export const toCanvas = (img: CanvasImageSource, w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d', { willReadFrequently: true })!.drawImage(img, 0, 0, w, h);
  return c;
};

/** Маска кисти может быть полупрозрачной — делаем её сплошной (как на сервере: alpha > 10). */
export const binarize = (c: HTMLCanvasElement) => {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const on = d[i + 3] > 10;
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = on ? 255 : 0;
  }
  ctx.putImageData(im, 0, 0);
  return c;
};

export const maskBox = (mask: HTMLCanvasElement) => {
  const { width: w, height: h } = mask;
  const d = mask.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
};

/** Точки лица, ближайшего к центру отмеченной области. */
const pickNearest = (
  res: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>[],
  box: { x0: number; y0: number; x1: number; y1: number },
  map: (p: P) => P,
) => {
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  let best: P[] | null = null;
  let bd = Infinity;
  for (const r of res) {
    const pts = r.landmarks.positions.map((p) => map({ x: p.x, y: p.y }));
    const c = pts.reduce((a, p) => ({ x: a.x + p.x / pts.length, y: a.y + p.y / pts.length }), { x: 0, y: 0 });
    if (c.x < box.x0 || c.x > box.x1 || c.y < box.y0 || c.y > box.y1) continue;
    const dd = Math.hypot(c.x - cx, c.y - cy);
    if (dd < bd) {
      bd = dd;
      best = pts;
    }
  }
  return best;
};

/**
 * Ищет лицо рядом с отмеченной областью. Сначала — в увеличенном фрагменте вокруг отметки
 * (на больших групповых снимках лицо в целом кадре слишком мелкое), затем — во всём фото.
 */
export const landmarksNear = async (src: HTMLCanvasElement, box: { x0: number; y0: number; x1: number; y1: number }) => {
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
  const side = Math.max(bw, bh);
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const x0 = Math.max(0, Math.round(cx - side / 2)), y0 = Math.max(0, Math.round(cy - side / 2));
  const x1 = Math.min(src.width, Math.round(cx + side / 2)), y1 = Math.min(src.height, Math.round(cy + side / 2));
  const cw = x1 - x0, ch = y1 - y0;
  if (cw > 8 && ch > 8) {
    for (const target of [512, 768, 384]) {
      const k = target / Math.max(cw, ch);
      const crop = document.createElement('canvas');
      crop.width = Math.max(1, Math.round(cw * k));
      crop.height = Math.max(1, Math.round(ch * k));
      const cc = crop.getContext('2d')!;
      cc.imageSmoothingQuality = 'high';
      cc.drawImage(src, x0, y0, cw, ch, 0, 0, crop.width, crop.height);
      for (const scoreThreshold of [0.3, 0.12]) {
        const res = await faceapi
          .detectAllFaces(crop, new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold }))
          .withFaceLandmarks();
        const best = pickNearest(res, box, (p) => ({ x: x0 + p.x / k, y: y0 + p.y / k }));
        if (best) {
          crop.width = 0;
          console.log('[FACE_FIND] found in crop', target, 'thr', scoreThreshold);
          return best;
        }
      }
      crop.width = 0;
    }
  }
  const res = await faceapi
    .detectAllFaces(src, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.2 }))
    .withFaceLandmarks();
  const best = pickNearest(res, box, (p) => p);
  console.log('[FACE_FIND] full image', best ? 'found' : 'not found', 'faces', res.length);
  return best;
};

/** Подобие (масштаб + поворот + сдвиг) по методу наименьших квадратов: dst ≈ s·R·src + t. */
const similarity = (src: P[], dst: P[]) => {
  const n = src.length;
  let sx = 0, sy = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { sx += src[i].x; sy += src[i].y; dx += dst[i].x; dy += dst[i].y; }
  sx /= n; sy /= n; dx /= n; dy /= n;
  let a = 0, b = 0, ss = 0;
  for (let i = 0; i < n; i++) {
    const px = src[i].x - sx, py = src[i].y - sy;
    const qx = dst[i].x - dx, qy = dst[i].y - dy;
    a += px * qx + py * qy;
    b += px * qy - py * qx;
    ss += px * px + py * py;
  }
  const c = a / ss;
  const s = b / ss;
  const tx = dx - (c * sx - s * sy);
  const ty = dy - (s * sx + c * sy);
  const apply = (p: P) => ({ x: c * p.x - s * p.y + tx, y: s * p.x + c * p.y + ty });
  return { c, s, tx, ty, apply };
};

export interface ExactHeadInput {
  donorUrl: string;
  donorMask: HTMLCanvasElement;
  /** Целевое фото ДО переноса — по лицу на нём задаём размер, положение и наклон головы. */
  targetUrl: string;
  resultUrl: string;
  targetMask: HTMLCanvasElement;
  withHair: boolean;
}

/** Возвращает dataURL с вклеенной настоящей головой донора или null, если безопасно вклеить нельзя. */
export const exactHeadPaste = async ({ donorUrl, donorMask, targetUrl, resultUrl, targetMask, withHair }: ExactHeadInput) => {
  if (!(await loadFaceDetectionModels())) return null;
  const [dImg, rImg, tImg] = await Promise.all([loadImg(donorUrl), loadImg(resultUrl), loadImg(targetUrl)]);
  const DW = dImg.naturalWidth, DH = dImg.naturalHeight;
  const RW = rImg.naturalWidth, RH = rImg.naturalHeight;
  const donor = toCanvas(dImg, DW, DH);
  const result = toCanvas(rImg, RW, RH);
  const dMask = binarize(toCanvas(donorMask, DW, DH));
  const tMask = binarize(toCanvas(targetMask, RW, RH));

  const dBox = maskBox(dMask);
  const tBox = maskBox(tMask);
  if (!dBox || !tBox) return null;
  const grow = (b: typeof dBox, W: number, H: number) => {
    const m = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.5;
    return { x0: Math.max(0, b.x0 - m), y0: Math.max(0, b.y0 - m), x1: Math.min(W, b.x1 + m), y1: Math.min(H, b.y1 + m) };
  };
  // Размер и положение берём с ЛИЦА НА ИСХОДНОМ целевом фото (AI мог нарисовать голову
  // меньше/круглее). Если там лицо не нашлось — по лицу, которое нарисовал AI.
  const targetOrig = toCanvas(tImg, RW, RH);
  const [dl, tl] = await Promise.all([
    landmarksNear(donor, grow(dBox, DW, DH)),
    landmarksNear(targetOrig, grow(tBox, RW, RH)),
  ]);
  targetOrig.width = 0;
  const rl = tl || (await landmarksNear(result, grow(tBox, RW, RH)));
  console.log('[FACE_SWAP] align to', tl ? 'original target face' : 'AI face');
  if (!dl || !rl) return null;

  const srcPts = KEY_IDX.map((i) => dl[i]);
  const dstPts = KEY_IDX.map((i) => rl[i]);
  const T = similarity(srcPts, dstPts);
  const faceW = Math.hypot(rl[16].x - rl[0].x, rl[16].y - rl[0].y) || 1;
  let res = 0;
  for (let i = 0; i < srcPts.length; i++) {
    const p = T.apply(srcPts[i]);
    res += Math.hypot(p.x - dstPts[i].x, p.y - dstPts[i].y);
  }
  res /= srcPts.length * faceW;
  console.log('[FACE_SWAP] exact head residual', res.toFixed(3));
  if (res > MAX_RESIDUAL) return null;

  // Маска головы донора: отмеченная область, а для «только лицо» — ещё и сжатая внутрь лица
  const scale = Math.hypot(T.c, T.s);
  // Итоговая матрица: подобие T + сужение вдоль оси глаз вокруг центра лица (вертикаль не трогаем)
  const th = Math.atan2(T.s, T.c);
  const ux = Math.cos(th), uy = Math.sin(th);
  const k1 = FACE_WIDTH - 1;
  const A11 = 1 + k1 * ux * ux, A12 = k1 * ux * uy, A22 = 1 + k1 * uy * uy;
  const cx = dstPts.reduce((a, p) => a + p.x, 0) / dstPts.length;
  const cy = dstPts.reduce((a, p) => a + p.y, 0) / dstPts.length;
  const m11 = A11 * T.c + A12 * T.s, m12 = -A11 * T.s + A12 * T.c;
  const m21 = A12 * T.c + A22 * T.s, m22 = -A12 * T.s + A22 * T.c;
  const e = A11 * (T.tx - cx) + A12 * (T.ty - cy) + cx;
  const f = A12 * (T.tx - cx) + A22 * (T.ty - cy) + cy;
  const M: [number, number, number, number, number, number] = [m11, m21, m12, m22, e, f];
  const featherPx = Math.max(3, faceW * (withHair ? 0.035 : 0.06));
  const warpMask = document.createElement('canvas');
  warpMask.width = RW;
  warpMask.height = RH;
  const wm = warpMask.getContext('2d', { willReadFrequently: true })!;
  wm.setTransform(...M);
  wm.drawImage(dMask, 0, 0);
  wm.setTransform(1, 0, 0, 1, 0, 0);
  const soft = document.createElement('canvas');
  soft.width = RW;
  soft.height = RH;
  const sc = soft.getContext('2d', { willReadFrequently: true })!;
  sc.filter = `blur(${Math.round(featherPx)}px)`;
  sc.drawImage(warpMask, 0, 0);

  // Голова донора на месте (только масштаб/поворот/сдвиг)
  const warped = document.createElement('canvas');
  warped.width = RW;
  warped.height = RH;
  const wc = warped.getContext('2d', { willReadFrequently: true })!;
  wc.imageSmoothingEnabled = true;
  wc.imageSmoothingQuality = 'high';
  wc.setTransform(...M);
  wc.drawImage(donor, 0, 0);

  const R = result.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, RW, RH);
  const Wd = wc.getImageData(0, 0, RW, RH).data;
  const Md = sc.getImageData(0, 0, RW, RH).data;
  const rd = R.data;

  // Свет: сдвигаем только средний цвет кожи донора к свету кадра (черты не трогаем)
  const fx0 = Math.max(0, Math.floor(Math.min(...dstPts.map((p) => p.x))));
  const fx1 = Math.min(RW, Math.ceil(Math.max(...dstPts.map((p) => p.x))));
  const fy0 = Math.max(0, Math.floor(Math.min(...dstPts.map((p) => p.y))));
  const fy1 = Math.min(RH, Math.ceil(Math.max(...dstPts.map((p) => p.y))));
  const mr = [0, 0, 0];
  const md = [0, 0, 0];
  let cnt = 0;
  for (let y = fy0; y < fy1; y += 2) {
    for (let x = fx0; x < fx1; x += 2) {
      const i = (y * RW + x) * 4;
      for (let c = 0; c < 3; c++) { mr[c] += rd[i + c]; md[c] += Wd[i + c]; }
      cnt++;
    }
  }
  const shift = [0, 0, 0].map((_, c) => {
    if (!cnt) return 0;
    const v = (mr[c] - md[c]) / cnt;
    return Math.max(-MEAN_SHIFT_CLAMP, Math.min(MEAN_SHIFT_CLAMP, v));
  });

  for (let i = 0; i < rd.length; i += 4) {
    const a = Md[i + 3] / 255;
    if (a <= 0.003) continue;
    for (let c = 0; c < 3; c++) {
      const v = Wd[i + c] + shift[c];
      rd[i + c] = rd[i + c] * (1 - a) + (v < 0 ? 0 : v > 255 ? 255 : v) * a;
    }
  }
  result.getContext('2d')!.putImageData(R, 0, 0);
  console.log('[FACE_SWAP] exact head pasted, scale', scale.toFixed(3));
  const out = result.toDataURL('image/jpeg', 0.95);
  [donor, result, dMask, tMask, warpMask, soft, warped].forEach((c) => { c.width = 0; c.height = 0; });
  return out;
};
