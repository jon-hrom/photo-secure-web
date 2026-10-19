/**
 * Стабилизация: AI иногда рисует ответ со сдвигом на 1–3 пикселя, причём в разных
 * частях кадра по-разному. Если брать детали из такого ответа, контуры «двоятся».
 * Здесь для каждого участка кадра находим точный сдвиг ответа относительно оригинала
 * и насколько уверенно он совпадает. Несовпавшие участки потом берутся из оригинала.
 */
import type { UpscalePlace } from '@/components/tools/upscale/composeUpscale';

export interface ShiftField {
  aw: number;
  ah: number;
  T: number;
  cols: number;
  rows: number;
  dx: Float32Array;
  dy: Float32Array;
  conf: Float32Array;
}

const ANALYSIS_SIDE = 2048;
const TILE = 48;
const SEARCH = 4;
const STEP = 2;
const SAD_GOOD = 7;
const SAD_BAD = 16;
const FLAT_STD = 3;

const toGray = (img: CanvasImageSource, w: number, h: number, sx: number, sy: number, sw: number, sh: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  c.width = 0;
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  return g;
};

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1];
};

export const computeShiftField = (
  original: HTMLImageElement,
  result: HTMLImageElement,
  place: UpscalePlace,
): ShiftField => {
  const ow = original.naturalWidth;
  const oh = original.naturalHeight;
  const k = Math.min(1, ANALYSIS_SIDE / Math.max(ow, oh));
  const aw = Math.max(8, Math.round(ow * k));
  const ah = Math.max(8, Math.round(oh * k));
  const kx = place.w / aw;
  const ky = place.h / ah;
  const M = SEARCH;
  const rw = aw + 2 * M;
  const rh = ah + 2 * M;

  const G = toGray(original, aw, ah, 0, 0, ow, oh);
  const R = toGray(result, rw, rh, place.x - M * kx, place.y - M * ky, place.w + 2 * M * kx, place.h + 2 * M * ky);

  const cols = Math.ceil(aw / TILE);
  const rows = Math.ceil(ah / TILE);
  const n = cols * rows;
  const dx = new Float32Array(n);
  const dy = new Float32Array(n);
  const conf = new Float32Array(n);
  const flat = new Uint8Array(n);
  const S = 2 * M + 1;
  const sad = new Float32Array(S * S);

  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const x0 = tx * TILE;
      const y0 = ty * TILE;
      const x1 = Math.min(aw, x0 + TILE);
      const y1 = Math.min(ah, y0 + TILE);
      const idx = ty * cols + tx;

      let mean = 0;
      let cnt = 0;
      for (let y = y0; y < y1; y += STEP) for (let x = x0; x < x1; x += STEP) { mean += G[y * aw + x]; cnt++; }
      mean /= cnt;
      let v = 0;
      for (let y = y0; y < y1; y += STEP) for (let x = x0; x < x1; x += STEP) { const t = G[y * aw + x] - mean; v += t * t; }
      const std = Math.sqrt(v / cnt);

      let best = Infinity;
      let bi = M;
      let bj = M;
      for (let j = 0; j < S; j++) {
        for (let i = 0; i < S; i++) {
          let s = 0;
          for (let y = y0; y < y1; y += STEP) {
            const go = y * aw;
            const ro = (y + j) * rw + i;
            for (let x = x0; x < x1; x += STEP) s += Math.abs(G[go + x] - R[ro + x]);
          }
          s /= cnt;
          sad[j * S + i] = s;
          if (s < best) { best = s; bi = i; bj = j; }
        }
      }
      const sub = (a: number, b: number, c: number) => {
        const den = a - 2 * b + c;
        return den > 1e-6 ? Math.max(-0.5, Math.min(0.5, (a - c) / (2 * den))) : 0;
      };
      const fx = bi > 0 && bi < S - 1 ? sub(sad[bj * S + bi - 1], best, sad[bj * S + bi + 1]) : 0;
      const fy = bj > 0 && bj < S - 1 ? sub(sad[(bj - 1) * S + bi], best, sad[(bj + 1) * S + bi]) : 0;
      dx[idx] = bi - M + fx;
      dy[idx] = bj - M + fy;
      conf[idx] = best <= SAD_GOOD ? 1 : best >= SAD_BAD ? 0 : 1 - (best - SAD_GOOD) / (SAD_BAD - SAD_GOOD);
      if (std < FLAT_STD) flat[idx] = 1;
    }
  }

  // Однотонные участки (небо, стена) не дают надёжного сдвига — берём медиану соседей,
  // затем сглаживаем поле, чтобы соседние участки не «рвались»
  const sx = new Float32Array(n);
  const sy = new Float32Array(n);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const ax: number[] = [];
      const ay: number[] = [];
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const x = tx + i;
          const y = ty + j;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const q = y * cols + x;
          if (flat[q] && !(i === 0 && j === 0)) continue;
          ax.push(dx[q]);
          ay.push(dy[q]);
        }
      }
      const idx = ty * cols + tx;
      sx[idx] = ax.length ? median(ax) : 0;
      sy[idx] = ay.length ? median(ay) : 0;
    }
  }

  return { aw, ah, T: TILE, cols, rows, dx: sx, dy: sy, conf };
};

/**
 * Рисует ответ AI с поправкой сдвигов по участкам: в ctx попадают строки [oy0, oy1)
 * виртуального изображения outW×outH (строка oy0 — в y=0 холста).
 */
export const drawAligned = (
  ctx: CanvasRenderingContext2D,
  result: HTMLImageElement,
  place: UpscalePlace,
  f: ShiftField,
  outW: number,
  outH: number,
  oy0: number,
  oy1: number,
) => {
  const kx = place.w / f.aw;
  const ky = place.h / f.ah;
  const qx = outW / f.aw;
  const qy = outH / f.ah;
  for (let ty = 0; ty < f.rows; ty++) {
    const y0 = ty * f.T;
    const y1 = Math.min(f.ah, y0 + f.T);
    const Y0 = Math.floor(y0 * qy);
    const Y1 = Math.ceil(y1 * qy);
    if (Y1 <= oy0 || Y0 >= oy1) continue;
    for (let tx = 0; tx < f.cols; tx++) {
      const x0 = tx * f.T;
      const x1 = Math.min(f.aw, x0 + f.T);
      const X0 = Math.floor(x0 * qx);
      const X1 = Math.ceil(x1 * qx);
      const idx = ty * f.cols + tx;
      const sx0 = X0 / qx;
      const sy0 = Y0 / qy;
      ctx.drawImage(
        result,
        place.x + (sx0 + f.dx[idx]) * kx,
        place.y + (sy0 + f.dy[idx]) * ky,
        ((X1 - X0) / qx) * kx,
        ((Y1 - Y0) / qy) * ky,
        X0,
        Y0 - oy0,
        X1 - X0,
        Y1 - Y0,
      );
    }
  }
};

/** Плавная (без ступенек на границах участков) карта уверенности для строк [oy0, oy1) итога. */
export const confRows = (f: ShiftField, outW: number, outH: number, oy0: number, oy1: number) => {
  const out = new Float32Array(outW * (oy1 - oy0));
  const at = (c: number, r: number) =>
    f.conf[Math.max(0, Math.min(f.rows - 1, r)) * f.cols + Math.max(0, Math.min(f.cols - 1, c))];
  const cx = new Float32Array(outW);
  const c0 = new Int32Array(outW);
  for (let x = 0; x < outW; x++) {
    const u = ((x + 0.5) * f.aw) / outW / f.T - 0.5;
    c0[x] = Math.floor(u);
    cx[x] = u - c0[x];
  }
  for (let y = oy0; y < oy1; y++) {
    const v = ((y + 0.5) * f.ah) / outH / f.T - 0.5;
    const r0 = Math.floor(v);
    const fy = v - r0;
    const o = (y - oy0) * outW;
    for (let x = 0; x < outW; x++) {
      const a = at(c0[x], r0) * (1 - cx[x]) + at(c0[x] + 1, r0) * cx[x];
      const b = at(c0[x], r0 + 1) * (1 - cx[x]) + at(c0[x] + 1, r0 + 1) * cx[x];
      out[o + x] = a * (1 - fy) + b * fy;
    }
  }
  return out;
};