/**
 * Сборка со стабилизацией: резкость и контуры — из ответа AI (выровненного по участкам,
 * чтобы ничего не двоилось), а цвет и общий тон — из оригинала. Там, где AI заметно
 * перерисовал (крупное расхождение), остаётся оригинал. В конце — лёгкая резкость контуров.
 */
import type { UpscalePlace } from '@/components/tools/upscale/composeUpscale';
import { computeShiftField, drawAligned, confRows } from '@/components/tools/upscale/stabilize';

const STRIP = 256;
const PAD = 12;
const COARSE = 8;
const DIFF_FROM = 12;
const DIFF_RANGE = 18;
const SHARP_AMOUNT = 0.6;
const SHARP_THRESHOLD = 2;

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('не хватает памяти устройства для такого размера');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  return { c, ctx };
};

const nextFrame = () => new Promise((r) => setTimeout(r, 0));

/** Размытие биномиальным фильтром 5×5 (≈ гаусс r=2) — для маски резкости. */
const blur5 = (src: Float32Array, w: number, h: number) => {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const x0 = x > 1 ? x - 2 : 0;
      const x1 = x > 0 ? x - 1 : 0;
      const x3 = x < w - 1 ? x + 1 : w - 1;
      const x4 = x < w - 2 ? x + 2 : w - 1;
      tmp[o + x] = (src[o + x0] + 4 * src[o + x1] + 6 * src[o + x] + 4 * src[o + x3] + src[o + x4]) / 16;
    }
  }
  for (let y = 0; y < h; y++) {
    const y0 = (y > 1 ? y - 2 : 0) * w;
    const y1 = (y > 0 ? y - 1 : 0) * w;
    const y3 = (y < h - 1 ? y + 1 : h - 1) * w;
    const y4 = (y < h - 2 ? y + 2 : h - 1) * w;
    const o = y * w;
    for (let x = 0; x < w; x++) {
      out[o + x] = (tmp[y0 + x] + 4 * tmp[y1 + x] + 6 * tmp[o + x] + 4 * tmp[y3 + x] + tmp[y4 + x]) / 16;
    }
  }
  return out;
};

export const composeStable = async (
  original: HTMLImageElement,
  result: HTMLImageElement,
  place: UpscalePlace,
  width: number,
  height: number,
  onProgress?: (p: number) => void,
): Promise<HTMLCanvasElement> => {
  const ow = original.naturalWidth;
  const oh = original.naturalHeight;

  const field = computeShiftField(original, result, place);
  await nextFrame();

  // Грубые копии (1/8 итога): по ним сравниваем крупные формы и берём из оригинала цвет/тон
  const lw = Math.max(8, Math.round(width / COARSE));
  const lh = Math.max(8, Math.round(height / COARSE));
  const aiLow = makeCanvas(lw, lh);
  drawAligned(aiLow.ctx, result, place, field, lw, lh, 0, lh);
  const orLow = makeCanvas(lw, lh);
  orLow.ctx.drawImage(original, 0, 0, ow, oh, 0, 0, lw, lh);

  const out = makeCanvas(width, height);
  const sy = oh / height;
  const ly = lh / height;

  for (let y0 = 0; y0 < height; y0 += STRIP) {
    const y1 = Math.min(height, y0 + STRIP);
    const a = Math.max(0, y0 - PAD);
    const b = Math.min(height, y1 + PAD);
    const sh = b - a;

    const base = makeCanvas(width, sh);
    base.ctx.drawImage(original, 0, a * sy, ow, sh * sy, 0, 0, width, sh);
    const model = makeCanvas(width, sh);
    drawAligned(model.ctx, result, place, field, width, height, a, b);
    const mLow = makeCanvas(width, sh);
    mLow.ctx.drawImage(aiLow.c, 0, a * ly, lw, sh * ly, 0, 0, width, sh);
    const oLow = makeCanvas(width, sh);
    oLow.ctx.drawImage(orLow.c, 0, a * ly, lw, sh * ly, 0, 0, width, sh);

    const B = base.ctx.getImageData(0, 0, width, sh);
    const Md = model.ctx.getImageData(0, 0, width, sh).data;
    const Ml = mLow.ctx.getImageData(0, 0, width, sh).data;
    const Ol = oLow.ctx.getImageData(0, 0, width, sh).data;
    const conf = confRows(field, width, height, a, b);
    const d = B.data;
    const n = width * sh;
    const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];

    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const diff = (Math.abs(Ml[i] - Ol[i]) + Math.abs(Ml[i + 1] - Ol[i + 1]) + Math.abs(Ml[i + 2] - Ol[i + 2])) / 3;
      let w = diff <= DIFF_FROM ? 1 : diff >= DIFF_FROM + DIFF_RANGE ? 0 : 1 - (diff - DIFF_FROM) / DIFF_RANGE;
      w *= conf[p];
      for (let c = 0; c < 3; c++) {
        const v = Ol[i + c] + (Md[i + c] - Ml[i + c]);
        ch[c][p] = d[i + c] * (1 - w) + v * w;
      }
    }

    // Резкость контуров (unsharp mask)
    for (let c = 0; c < 3; c++) {
      const src = ch[c];
      const bl = blur5(src, width, sh);
      for (let p = 0, i = c; p < n; p++, i += 4) {
        const det = src[p] - bl[p];
        const v = Math.abs(det) > SHARP_THRESHOLD ? src[p] + det * SHARP_AMOUNT : src[p];
        d[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }

    out.ctx.putImageData(B, 0, a, 0, y0 - a, width, y1 - y0);
    [base, model, mLow, oLow].forEach((x) => { x.c.width = 0; x.c.height = 0; });
    onProgress?.(y1 / height);
    await nextFrame();
  }
  [aiLow, orLow].forEach((x) => { x.c.width = 0; x.c.height = 0; });
  return out.c;
};
