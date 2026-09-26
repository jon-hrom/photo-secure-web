import type { BodyGeo, FaceGeo, Pt, VisPt } from './detect';

/**
 * «Пластика» как в Photoshop Liquify, но по точкам лица и позы.
 * Все значения 0..100. 0 — выключено.
 */
export interface PlasticParams {
  chin: number;
  shoulders: number;
  arms: number;
  waist: number;
}

export const PLASTIC_ZERO: PlasticParams = { chin: 0, shoulders: 0, arms: 0, waist: 0 };

export const isPlasticZero = (p: PlasticParams) =>
  !p.chin && !p.shoulders && !p.arms && !p.waist;

/** Поле смещений на грубой сетке: для пикселя выхода — откуда брать цвет. */
class Field {
  readonly gw: number;
  readonly gh: number;
  readonly dx: Float32Array;
  readonly dy: Float32Array;
  constructor(readonly w: number, readonly h: number, readonly step: number) {
    this.gw = Math.ceil(w / step) + 1;
    this.gh = Math.ceil(h / step) + 1;
    this.dx = new Float32Array(this.gw * this.gh);
    this.dy = new Float32Array(this.gw * this.gh);
  }

  /** Обходит узлы сетки внутри рамки и добавляет смещение fn(x, y). */
  apply(x0: number, y0: number, x1: number, y1: number, fn: (x: number, y: number) => Pt | null) {
    const s = this.step;
    const gx0 = Math.max(0, Math.floor(x0 / s));
    const gy0 = Math.max(0, Math.floor(y0 / s));
    const gx1 = Math.min(this.gw - 1, Math.ceil(x1 / s));
    const gy1 = Math.min(this.gh - 1, Math.ceil(y1 / s));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const d = fn(gx * s, gy * s);
        if (!d) continue;
        const i = gy * this.gw + gx;
        this.dx[i] += d.x;
        this.dy[i] += d.y;
      }
    }
  }
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const len = (a: Pt) => Math.hypot(a.x, a.y);
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// ---------------------------------------------------------------------------
// Второй подбородок: ткань под линией челюсти подтягивается к челюсти,
// складка и её тень «съедаются», шея ниже слегка растягивается.
// Сама челюсть и всё, что выше, не двигаются.
// ---------------------------------------------------------------------------
const chinWarp = (f: Field, face: FaceGeo, amount: number) => {
  const down = face.down;
  const side = { x: -down.y, y: down.x };
  const c = face.jaw[8];
  const W = face.width;
  // Контур челюсти в координатах лица (u — поперёк, v — вниз).
  const jaw = face.jaw.map((p) => ({ u: dot(sub(p, c), side), v: dot(sub(p, c), down) })).sort((a, b) => a.u - b.u);
  const jawV = (u: number) => {
    if (u <= jaw[0].u) return jaw[0].v;
    for (let i = 1; i < jaw.length; i++) {
      if (u <= jaw[i].u) {
        const t = (u - jaw[i - 1].u) / (jaw[i].u - jaw[i - 1].u || 1);
        return jaw[i - 1].v + (jaw[i].v - jaw[i - 1].v) * t;
      }
    }
    return jaw[jaw.length - 1].v;
  };
  const shift = W * 0.16 * amount;
  const reach = W * 0.62;
  const R = W * 1.1;
  f.apply(c.x - R, c.y - R, c.x + R, c.y + R, (x, y) => {
    const p = { x: x - c.x, y: y - c.y };
    const u = dot(p, side);
    const v = dot(p, down);
    const lat = 1 - smooth(W * 0.26, W * 0.46, Math.abs(u));
    if (lat <= 0) return null;
    const s = v - jawV(u);
    if (s <= 0 || s >= reach) return null;
    // Быстрый подъём сразу под челюстью, плавный спад к середине шеи.
    const w = smooth(0, W * 0.07, s) * (1 - smooth(W * 0.12, reach, s));
    const k = shift * w * lat;
    // Берём цвет ниже по шее — складка подтягивается вверх.
    // Плюс лёгкое сужение по бокам — подбородок становится чётче.
    const pinch = 0.035 * amount * w * lat;
    return { x: down.x * k + side.x * u * pinch, y: down.y * k + side.y * u * pinch };
  });
};

// ---------------------------------------------------------------------------
// Сжатие конечности к её оси (рука: плечо→локоть, локоть→запястье).
// ---------------------------------------------------------------------------
const limbWarp = (f: Field, a: Pt, b: Pt, halfW: number, k: number) => {
  const axis = sub(b, a);
  const L = len(axis);
  if (L < 4 || halfW < 2) return;
  const t = { x: axis.x / L, y: axis.y / L };
  const n = { x: -t.y, y: t.x };
  const R = halfW * 2.2;
  f.apply(Math.min(a.x, b.x) - R, Math.min(a.y, b.y) - R, Math.max(a.x, b.x) + R, Math.max(a.y, b.y) + R, (x, y) => {
    const p = { x: x - a.x, y: y - a.y };
    const along = dot(p, t) / L;
    const d = dot(p, n);
    const ad = Math.abs(d);
    if (ad >= R || along < -0.25 || along > 1.25) return null;
    const wa = smooth(-0.25, 0.1, along) * (1 - smooth(0.9, 1.25, along));
    const wd = 1 - smooth(halfW * 1.1, R, ad);
    const s = d * k * wa * wd; // берём цвет дальше от оси → рука тоньше
    return { x: n.x * s, y: n.y * s };
  });
};

const ok = (...pts: VisPt[]) => pts.every((p) => p && p.v > 0.5);

// ---------------------------------------------------------------------------
// Плечи: линия плеча чуть опускается и слегка сужается наружу —
// шея визуально длиннее, силуэт легче.
// ---------------------------------------------------------------------------
const shoulderWarp = (f: Field, pose: VisPt[], amount: number) => {
  const L = pose[11];
  const Rr = pose[12];
  if (!ok(L, Rr)) return;
  const sw = len(sub(L, Rr));
  if (sw < 10) return;
  const hipsOk = ok(pose[23], pose[24]);
  const midS = lerp(L, Rr, 0.5);
  const down = hipsOk
    ? (() => {
        const v = sub(lerp(pose[23], pose[24], 0.5), midS);
        const l = len(v) || 1;
        return { x: v.x / l, y: v.y / l };
      })()
    : { x: 0, y: 1 };
  for (const sh of [L, Rr]) {
    const outward = sub(sh, midS);
    const ol = len(outward) || 1;
    const out = { x: outward.x / ol, y: outward.y / ol };
    // Верхний контур плеча лежит выше сустава.
    const top = { x: sh.x - down.x * sw * 0.12 - out.x * sw * 0.05, y: sh.y - down.y * sw * 0.12 - out.y * sw * 0.05 };
    const rad = sw * 0.34;
    const drop = sw * 0.05 * amount;
    const inward = sw * 0.035 * amount;
    f.apply(top.x - rad * 2, top.y - rad * 2, top.x + rad * 2, top.y + rad * 2, (x, y) => {
      const r = Math.hypot(x - top.x, y - top.y) / rad;
      if (r >= 2) return null;
      const w = Math.exp(-r * r * 1.4);
      // Цвет берём выше и снаружи → контур плеча смещается вниз и внутрь.
      return { x: (-down.x * drop + out.x * inward) * w, y: (-down.y * drop + out.y * inward) * w };
    });
  }
};

const armsWarp = (f: Field, pose: VisPt[], amount: number) => {
  const sw = ok(pose[11], pose[12]) ? len(sub(pose[11], pose[12])) : 0;
  if (sw < 10) return;
  const k = 0.13 * amount;
  for (const [s, e, w] of [[11, 13, 15], [12, 14, 16]]) {
    if (ok(pose[s], pose[e])) limbWarp(f, pose[s], pose[e], sw * 0.17, k);
    if (ok(pose[e], pose[w])) limbWarp(f, pose[e], pose[w], sw * 0.12, k * 0.8);
  }
};

// ---------------------------------------------------------------------------
// Талия: бока корпуса на уровне талии подтягиваются к оси с двух сторон.
// ---------------------------------------------------------------------------
const waistWarp = (f: Field, pose: VisPt[], amount: number) => {
  if (!ok(pose[11], pose[12], pose[23], pose[24])) return;
  const midS = lerp(pose[11], pose[12], 0.5);
  const midH = lerp(pose[23], pose[24], 0.5);
  const axis = sub(midH, midS);
  const T = len(axis);
  if (T < 20) return;
  const t = { x: axis.x / T, y: axis.y / T };
  const n = { x: -t.y, y: t.x };
  const hipW = len(sub(pose[23], pose[24]));
  const sw = len(sub(pose[11], pose[12]));
  const waistC = lerp(midS, midH, 0.68);
  const half = Math.max(hipW * 0.75, sw * 0.42);
  const k = 0.1 * amount;
  const sig = T * 0.3;
  const R = half * 1.9;
  f.apply(waistC.x - R, waistC.y - T, waistC.x + R, waistC.y + T, (x, y) => {
    const p = { x: x - waistC.x, y: y - waistC.y };
    const a = dot(p, t);
    const d = dot(p, n);
    const ad = Math.abs(d);
    if (ad >= R || Math.abs(a) > sig * 2.6) return null;
    const wa = Math.exp(-(a * a) / (2 * sig * sig));
    // Центр живота почти не трогаем — работают бока.
    const wd = smooth(half * 0.2, half * 0.75, ad) * (1 - smooth(half * 1.15, R, ad));
    const s = (d / (ad || 1)) * half * k * wa * wd;
    return { x: n.x * s, y: n.y * s };
  });
};

/** Применяет пластику к картинке. Возвращает новый canvas. */
export const applyPlastic = (
  src: HTMLImageElement | HTMLCanvasElement,
  geo: BodyGeo,
  params: PlasticParams,
): HTMLCanvasElement => {
  const W = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const H = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, W, H);
  if (isPlasticZero(params)) return canvas;

  // Точки найдены на исходнике — масштабируем, если размеры отличаются.
  const sx = W / geo.width;
  const sy = H / geo.height;
  const sc = (p: VisPt): VisPt => ({ x: p.x * sx, y: p.y * sy, v: p.v });
  const faces = geo.faces.map((fc) => ({ ...fc, jaw: fc.jaw.map((p) => ({ x: p.x * sx, y: p.y * sy })), width: fc.width * sx }));
  const poses = geo.poses.map((p) => p.map(sc));

  const field = new Field(W, H, 3);
  if (params.chin) faces.forEach((fc) => chinWarp(field, fc, params.chin / 100));
  poses.forEach((p) => {
    if (params.shoulders) shoulderWarp(field, p, params.shoulders / 100);
    if (params.arms) armsWarp(field, p, params.arms / 100);
    if (params.waist) waistWarp(field, p, params.waist / 100);
  });

  const srcData = ctx.getImageData(0, 0, W, H);
  const out = ctx.createImageData(W, H);
  const s = srcData.data;
  const o = out.data;
  const { gw, step, dx, dy } = field;
  const inv = 1 / step;

  for (let y = 0; y < H; y++) {
    const gyf = y * inv;
    const gy = gyf | 0;
    const fy = gyf - gy;
    for (let x = 0; x < W; x++) {
      const gxf = x * inv;
      const gx = gxf | 0;
      const fx = gxf - gx;
      const i00 = gy * gw + gx;
      const i10 = i00 + 1;
      const i01 = i00 + gw;
      const i11 = i01 + 1;
      const ddx = (dx[i00] * (1 - fx) + dx[i10] * fx) * (1 - fy) + (dx[i01] * (1 - fx) + dx[i11] * fx) * fy;
      const ddy = (dy[i00] * (1 - fx) + dy[i10] * fx) * (1 - fy) + (dy[i01] * (1 - fx) + dy[i11] * fx) * fy;
      const oi = (y * W + x) * 4;
      if (ddx === 0 && ddy === 0) {
        o[oi] = s[oi];
        o[oi + 1] = s[oi + 1];
        o[oi + 2] = s[oi + 2];
        o[oi + 3] = s[oi + 3];
        continue;
      }
      let px = x + ddx;
      let py = y + ddy;
      if (px < 0) px = 0;
      else if (px > W - 1.001) px = W - 1.001;
      if (py < 0) py = 0;
      else if (py > H - 1.001) py = H - 1.001;
      const x0 = px | 0;
      const y0 = py | 0;
      const ax = px - x0;
      const ay = py - y0;
      const a = (y0 * W + x0) * 4;
      const b = a + 4;
      const c = a + W * 4;
      const d = c + 4;
      for (let ch = 0; ch < 4; ch++) {
        o[oi + ch] = (s[a + ch] * (1 - ax) + s[b + ch] * ax) * (1 - ay) + (s[c + ch] * (1 - ax) + s[d + ch] * ax) * ay;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
};
