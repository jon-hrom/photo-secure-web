/**
 * Детализация поверх собранного фото.
 * 1) Строим карту «мыльности» по всему кадру: где мало мелких деталей — сильнее резкость,
 *    где уже резко — почти не трогаем (без пересвета контуров).
 * 2) Лица и фигуры людей находим отдельно и усиливаем там прорисовку.
 * 3) Сильное размытие фона (боке) — не трогаем, кроме зон людей.
 * Контраст — мягкий, с плавным сжатием светов и теней, без переконтраста.
 */
import * as faceapi from '@vladmandic/face-api';
import { loadFaceDetectionModels } from '@/utils/faceDetection';

const STRIP = 256;
const PAD = 8;
const CELL = 16;
/** Уровень «нормальной» резкости (средний модуль лапласиана на 1/4 масштаба). */
const SHARP_OK = 9;
/** Ниже этого — уже не «мыло», а намеренное размытие фона. */
const BOKEH = 1.6;

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

const ctx2d = (c: HTMLCanvasElement) => {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('не хватает памяти устройства для такого размера');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return ctx;
};

const blur3 = (src: Float32Array, w: number, h: number) => {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      tmp[o + x] = (src[o + (x > 0 ? x - 1 : 0)] + 2 * src[o + x] + src[o + (x < w - 1 ? x + 1 : w - 1)]) / 4;
    }
  }
  for (let y = 0; y < h; y++) {
    const a = (y > 0 ? y - 1 : 0) * w;
    const b = (y < h - 1 ? y + 1 : h - 1) * w;
    const o = y * w;
    for (let x = 0; x < w; x++) out[o + x] = (tmp[a + x] + 2 * tmp[o + x] + tmp[b + x]) / 4;
  }
  return out;
};

type Box = { x: number; y: number; w: number; h: number };
/** Прямоугольник глаза в долях кадра; pair — индекс лица. */
type Eye = { x0: number; y0: number; x1: number; y1: number; pair: number };

const detectFaces = async (canvas: HTMLCanvasElement): Promise<{ faces: Box[]; eyes: Eye[] }> => {
  const empty = { faces: [], eyes: [] };
  try {
    if (!(await loadFaceDetectionModels())) return empty;
    const k = Math.min(1, 1600 / Math.max(canvas.width, canvas.height));
    const c = document.createElement('canvas');
    c.width = Math.round(canvas.width * k);
    c.height = Math.round(canvas.height * k);
    ctx2d(c).drawImage(canvas, 0, 0, c.width, c.height);
    const res = await faceapi
      .detectAllFaces(c, new faceapi.TinyFaceDetectorOptions({ inputSize: 608, scoreThreshold: 0.3 }))
      .withFaceLandmarks();
    const W = c.width;
    const H = c.height;
    c.width = 0;
    const faces: Box[] = [];
    const eyes: Eye[] = [];
    res.forEach((r, fi) => {
      const bx = r.detection.box;
      faces.push({ x: bx.x / W, y: bx.y / H, w: bx.width / W, h: bx.height / H });
      const p = r.landmarks.positions;
      for (const [a, b] of [[36, 41], [42, 47]]) {
        const pts = p.slice(a, b + 1);
        const xs = pts.map((q) => q.x);
        const ys = pts.map((q) => q.y);
        const ex0 = Math.min(...xs);
        const ex1 = Math.max(...xs);
        const ew = ex1 - ex0;
        const ecy = (Math.min(...ys) + Math.max(...ys)) / 2;
        // с запасом: веки, ресницы, уголки
        eyes.push({
          x0: (ex0 - ew * 0.45) / W,
          x1: (ex1 + ew * 0.45) / W,
          y0: (ecy - ew * 0.6) / H,
          y1: (ecy + ew * 0.6) / H,
          pair: fi,
        });
      }
    });
    return { faces, eyes };
  } catch (e) {
    console.warn('[DETAIL] face detection failed', e);
    return empty;
  }
};

/**
 * Карта силы резкости (сетка W/CELL × H/CELL), 0..~1.6.
 * Мыло → больше, резко → меньше, боке вне людей → почти 0, лица → максимум.
 */
const buildAmountMap = (canvas: HTMLCanvasElement, faces: Box[]) => {
  const W = canvas.width;
  const H = canvas.height;
  const sw = Math.max(32, Math.round(W / 4));
  const sh = Math.max(32, Math.round(H / 4));
  const s = document.createElement('canvas');
  s.width = sw;
  s.height = sh;
  const sctx = ctx2d(s);
  sctx.drawImage(canvas, 0, 0, sw, sh);
  const px = sctx.getImageData(0, 0, sw, sh).data;
  s.width = 0;
  const lum = new Float32Array(sw * sh);
  for (let p = 0, i = 0; p < lum.length; p++, i += 4) lum[p] = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];

  const gw = Math.max(4, Math.ceil(W / CELL));
  const gh = Math.max(4, Math.ceil(H / CELL));
  const sum = new Float32Array(gw * gh);
  const cnt = new Float32Array(gw * gh);
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const p = y * sw + x;
      const lap = Math.abs(4 * lum[p] - lum[p - 1] - lum[p + 1] - lum[p - sw] - lum[p + sw]);
      const g = Math.min(gh - 1, Math.floor((y / sh) * gh)) * gw + Math.min(gw - 1, Math.floor((x / sw) * gw));
      sum[g] += lap;
      cnt[g] += 1;
    }
  }
  let sharp = new Float32Array(gw * gh);
  for (let g = 0; g < sharp.length; g++) sharp[g] = cnt[g] ? sum[g] / cnt[g] : SHARP_OK;
  sharp = blur3(blur3(sharp, gw, gh), gw, gh);

  // Зоны людей: лицо (сильно) и фигура под ним (умеренно)
  const people = new Float32Array(gw * gh);
  const face = new Float32Array(gw * gh);
  for (const f of faces) {
    const fcx = (f.x + f.w / 2) * gw;
    const fcy = (f.y + f.h / 2) * gh;
    const frx = f.w * gw * 0.9;
    const fry = f.h * gh * 1.0;
    const bx0 = Math.floor((f.x - f.w * 1.6) * gw);
    const bx1 = Math.ceil((f.x + f.w * 2.6) * gw);
    const by0 = Math.floor((f.y - f.h * 0.6) * gh);
    const by1 = Math.ceil((f.y + f.h * 8) * gh);
    for (let y = Math.max(0, by0); y < Math.min(gh, by1); y++) {
      for (let x = Math.max(0, bx0); x < Math.min(gw, bx1); x++) {
        const g = y * gw + x;
        people[g] = 1;
        const dx = (x + 0.5 - fcx) / frx;
        const dy = (y + 0.5 - fcy) / fry;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 1) face[g] = Math.max(face[g], d < 0.6 ? 1 : 1 - (d - 0.6) / 0.4);
      }
    }
  }
  const peopleS = blur3(blur3(people, gw, gh), gw, gh);
  const faceS = blur3(face, gw, gh);

  const amt = new Float32Array(gw * gh);
  for (let g = 0; g < amt.length; g++) {
    const v = sharp[g];
    // насколько кадр здесь «мылит»: 0 — уже резко, 1 — сильно мыльно
    const soft = Math.max(0, Math.min(1, (SHARP_OK - v) / (SHARP_OK - BOKEH)));
    // боке вне людей не трогаем
    const bokeh = v < BOKEH ? 1 : v < BOKEH * 2 ? 1 - (v - BOKEH) / BOKEH : 0;
    const keepBg = 1 - bokeh * (1 - peopleS[g]);
    let a = (0.35 + 0.65 * soft) * keepBg;
    a *= 1 + 0.25 * peopleS[g] + 0.4 * faceS[g];
    amt[g] = a;
  }
  return { amt, gw, gh };
};

export const applyDetail = async (
  canvas: HTMLCanvasElement,
  detail: number,
  onProgress?: (p: number) => void,
) => {
  const k = Math.max(0, Math.min(100, detail)) / 100;
  if (k <= 0) return canvas;
  const W = canvas.width;
  const H = canvas.height;
  const ctx = ctx2d(canvas);

  const { faces, eyes } = await detectFaces(canvas);
  const { amt, gw, gh } = buildAmountMap(canvas, faces);

  // Крупное размытие через уменьшенную копию: по нему видно «вуаль» дымки
  const lw = Math.max(8, Math.round(W / 40));
  const lh = Math.max(8, Math.round(H / 40));
  const low = document.createElement('canvas');
  low.width = lw;
  low.height = lh;
  ctx2d(low).drawImage(canvas, 0, 0, lw, lh);
  const ld = ctx2d(low).getImageData(0, 0, lw, lh).data;
  const mins: number[] = [];
  for (let i = 0; i < ld.length; i += 4) mins.push(Math.min(ld[i], ld[i + 1], ld[i + 2]));
  mins.sort((a, b) => a - b);
  // Мягкое снятие вуали: не больше 20 уровней, чтобы тени не проваливались
  const veil = Math.min(20, mins[Math.floor(mins.length * 0.02)] || 0) * k * 0.5;
  const gain = 255 / (255 - veil);

  const clarity = 0.22 * k;
  const fineAmt = 1.5 * k;
  const midAmt = 0.7 * k;
  /** Ограничение прироста резкости — без ореолов и пересвеченных контуров. */
  const halo = 26;
  const gx = gw / W;
  const gy = gh / H;

  for (let y0 = 0; y0 < H; y0 += STRIP) {
    const y1 = Math.min(H, y0 + STRIP);
    const a = Math.max(0, y0 - PAD);
    const b = Math.min(H, y1 + PAD);
    const sh = b - a;
    const img = ctx.getImageData(0, a, W, sh);
    const lc = document.createElement('canvas');
    lc.width = W;
    lc.height = sh;
    ctx2d(lc).drawImage(low, 0, (a * lh) / H, lw, (sh * lh) / H, 0, 0, W, sh);
    const L = ctx2d(lc).getImageData(0, 0, W, sh).data;
    lc.width = 0;

    // Сила по пикселям — билинейно из сетки
    const n = W * sh;
    const A = new Float32Array(n);
    for (let y = 0; y < sh; y++) {
      const fy = Math.max(0, Math.min(gh - 1.001, (a + y) * gy - 0.5));
      const yi = Math.floor(fy);
      const ty = fy - yi;
      const r0 = yi * gw;
      const r1 = Math.min(gh - 1, yi + 1) * gw;
      for (let x = 0; x < W; x++) {
        const fx = Math.max(0, Math.min(gw - 1.001, x * gx - 0.5));
        const xi = Math.floor(fx);
        const tx = fx - xi;
        const x1 = Math.min(gw - 1, xi + 1);
        A[y * W + x] = (amt[r0 + xi] * (1 - tx) + amt[r0 + x1] * tx) * (1 - ty) + (amt[r1 + xi] * (1 - tx) + amt[r1 + x1] * tx) * ty;
      }
    }

    const d = img.data;
    for (let c = 0; c < 3; c++) {
      const src = new Float32Array(n);
      for (let p = 0, i = c; p < n; p++, i += 4) src[p] = d[i];
      const b1 = blur3(src, W, sh);
      const b2 = blur3(blur3(b1, W, sh), W, sh);
      for (let p = 0, i = c; p < n; p++, i += 4) {
        const s = A[p];
        let v = src[p];
        const fine = v - b1[p];
        const mid = b1[p] - b2[p];
        let add = 0;
        if (Math.abs(fine) > 1.5) add += fine * fineAmt * s;
        if (Math.abs(mid) > 1.5) add += mid * midAmt * s;
        // плавное ограничение: мелкое усиливается полностью, крупные перепады — нет
        add = (halo * add) / (halo + Math.abs(add));
        v += add;
        const lum = L[i];
        const room = 1 - Math.abs(lum - 128) / 150;
        v += (v - lum) * clarity * Math.min(1, s) * (room > 0 ? room : 0);
        v = (v - veil) * gain;
        // мягкое колено: прирост в светах/тенях плавно гасится у края диапазона —
        // исходные белые и чёрные не меняются, но и не выбиваются
        const o = src[p];
        const dv = v - o;
        if (dv > 0 && v > 225) {
          const room = Math.max(1, 255 - o);
          v = o + (room * dv) / (room + dv);
        } else if (dv < 0 && v < 30) {
          const room = Math.max(1, o);
          v = o - (room * -dv) / (room - dv);
        }
        d[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    ctx.putImageData(img, 0, a, 0, y0 - a, W, y1 - y0);
    onProgress?.(y1 / H);
    await nextFrame();
  }
  low.width = 0;
  equalizeEyes(canvas, eyes, k);
  return canvas;
};

/** Резкость участка: средний модуль лапласиана по яркости. */
const lapEnergy = (lum: Float32Array, w: number, h: number) => {
  let s = 0;
  let c = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      s += Math.abs(4 * lum[p] - lum[p - 1] - lum[p + 1] - lum[p - w] - lum[p + w]);
      c++;
    }
  }
  return c ? s / c : 0;
};

/**
 * Выравнивание глаз: мыльный глаз дотягиваем по резкости до второго глаза того же лица
 * (и до уровня «живого» глаза, если мылят оба). Форма не меняется — только прорисовка.
 */
const equalizeEyes = (canvas: HTMLCanvasElement, eyes: Eye[], k: number) => {
  if (!eyes.length) return;
  const W = canvas.width;
  const H = canvas.height;
  const ctx = ctx2d(canvas);
  const boxes = eyes.map((e) => {
    const x0 = Math.max(0, Math.floor(e.x0 * W));
    const y0 = Math.max(0, Math.floor(e.y0 * H));
    const x1 = Math.min(W, Math.ceil(e.x1 * W));
    const y1 = Math.min(H, Math.ceil(e.y1 * H));
    return { x0, y0, w: x1 - x0, h: y1 - y0, pair: e.pair, energy: 0 };
  }).filter((b) => b.w > 8 && b.h > 8);

  for (const b of boxes) {
    const d = ctx.getImageData(b.x0, b.y0, b.w, b.h).data;
    const lum = new Float32Array(b.w * b.h);
    for (let p = 0, i = 0; p < lum.length; p++, i += 4) lum[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // считаем по центральной части — сам глаз, без бровей и кожи по краям
    b.energy = lapEnergy(lum, b.w, b.h);
  }

  for (const b of boxes) {
    const mate = boxes.find((o) => o !== b && o.pair === b.pair);
    const target = Math.max(mate ? mate.energy : 0, b.energy * 1.25);
    if (target <= b.energy * 1.05) continue;
    // во сколько раз этот глаз мягче нужного уровня → сила дорисовки
    const ratio = Math.min(3, target / Math.max(0.5, b.energy));
    const amount = (ratio - 1) * 1.6 * (0.5 + 0.5 * k);
    const img = ctx.getImageData(b.x0, b.y0, b.w, b.h);
    const d = img.data;
    const n = b.w * b.h;
    // мягкая эллиптическая маска — без видимых границ
    const mask = new Float32Array(n);
    for (let y = 0; y < b.h; y++) {
      const dy = (y + 0.5 - b.h / 2) / (b.h / 2);
      for (let x = 0; x < b.w; x++) {
        const dx = (x + 0.5 - b.w / 2) / (b.w / 2);
        const r = Math.sqrt(dx * dx + dy * dy);
        const v = r <= 0.55 ? 1 : r >= 1 ? 0 : 1 - (r - 0.55) / 0.45;
        mask[y * b.w + x] = v * v * (3 - 2 * v);
      }
    }
    for (let c = 0; c < 3; c++) {
      const src = new Float32Array(n);
      for (let p = 0, i = c; p < n; p++, i += 4) src[p] = d[i];
      const b1 = blur3(src, b.w, b.h);
      const b2 = blur3(blur3(b1, b.w, b.h), b.w, b.h);
      for (let p = 0, i = c; p < n; p++, i += 4) {
        const m = mask[p];
        if (!m) continue;
        let add = ((src[p] - b1[p]) * 1.0 + (b1[p] - b2[p]) * 0.8) * amount * m;
        add = (30 * add) / (30 + Math.abs(add));
        const v = src[p] + add;
        d[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    ctx.putImageData(img, b.x0, b.y0);
  }
};
