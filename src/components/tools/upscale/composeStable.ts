/**
 * Сборка со стабилизацией — ОДИН слой: фото целиком перерисовано AI, никаких наложений
 * копий друг на друга (поэтому контурам нечему «не сходиться»). От оригинала берётся
 * только общий цвет/тон на очень грубом масштабе. Если AI где-то сильно перерисовал
 * форму — на этом месте остаётся оригинал. В конце — усиленная резкость контуров.
 */
import type { UpscalePlace } from '@/components/tools/upscale/composeUpscale';
import { detectEyeZones, eyeWeights } from '@/components/tools/upscale/eyeGuard';

const STRIP = 256;
const PAD = 12;
const COARSE = 32;
const TONE_CLAMP = 25;
const FALLBACK_FROM = 30;
const FALLBACK_RANGE = 25;
/** Двухступенчатая резкость: мелкие контуры (r≈1) + средние (r≈3). */
const SHARP_FINE = 2.0;
const SHARP_MID = 0.9;
const SHARP_THRESHOLD = 2;
/**
 * Глаза: форма и положение — из оригинала (без искажений), а мелкая прорисовка
 * (ресницы, радужка, блик) — из AI, но только там, где AI совпал с оригиналом.
 * Плюс отдельная резкость, чтобы глаз не «мылил».
 */
const EYE_DETAIL_CLAMP = 40;
const EYE_AGREE_FROM = 10;
const EYE_AGREE_RANGE = 22;
const EYE_SHARP_BOOST = 1.7;

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

/** Размытие 3×3 (1-2-1) — для мелкой резкости. */
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

export const composeStable = async (
  original: HTMLImageElement,
  result: HTMLImageElement,
  place: UpscalePlace,
  width: number,
  height: number,
  onProgress?: (p: number) => void,
  detail = 0,
): Promise<HTMLCanvasElement> => {
  const ow = original.naturalWidth;
  const oh = original.naturalHeight;
  // Детализация: AI убрал дымку — не возвращаем её подгонкой тона под оригинал
  // и реже откатываемся к мыльному оригиналу.
  const dk = Math.max(0, Math.min(100, detail)) / 100;
  const toneClamp = TONE_CLAMP * (1 - dk * 0.75);
  const fbFrom = FALLBACK_FROM + dk * 20;
  const eyes = await detectEyeZones(original);

  // Грубые копии (1/32 итога): только для подгонки цвета/тона под оригинал
  const lw = Math.max(8, Math.round(width / COARSE));
  const lh = Math.max(8, Math.round(height / COARSE));
  const aiLow = makeCanvas(lw, lh);
  aiLow.ctx.drawImage(result, place.x, place.y, place.w, place.h, 0, 0, lw, lh);
  const orLow = makeCanvas(lw, lh);
  orLow.ctx.drawImage(original, 0, 0, ow, oh, 0, 0, lw, lh);

  const out = makeCanvas(width, height);
  const sy = oh / height;
  const ry = place.h / height;
  const ly = lh / height;

  for (let y0 = 0; y0 < height; y0 += STRIP) {
    const y1 = Math.min(height, y0 + STRIP);
    const a = Math.max(0, y0 - PAD);
    const b = Math.min(height, y1 + PAD);
    const sh = b - a;

    const base = makeCanvas(width, sh);
    base.ctx.drawImage(original, 0, a * sy, ow, sh * sy, 0, 0, width, sh);
    const model = makeCanvas(width, sh);
    model.ctx.drawImage(result, place.x, place.y + a * ry, place.w, sh * ry, 0, 0, width, sh);
    const mLow = makeCanvas(width, sh);
    mLow.ctx.drawImage(aiLow.c, 0, a * ly, lw, sh * ly, 0, 0, width, sh);
    const oLow = makeCanvas(width, sh);
    oLow.ctx.drawImage(orLow.c, 0, a * ly, lw, sh * ly, 0, 0, width, sh);

    const B = base.ctx.getImageData(0, 0, width, sh);
    const Md = model.ctx.getImageData(0, 0, width, sh).data;
    const Ml = mLow.ctx.getImageData(0, 0, width, sh).data;
    const Ol = oLow.ctx.getImageData(0, 0, width, sh).data;
    const d = B.data;
    const n = width * sh;
    const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    const eyeW = eyeWeights(eyes, width, height, a, b);

    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const diff = (Math.abs(Ml[i] - Ol[i]) + Math.abs(Ml[i + 1] - Ol[i + 1]) + Math.abs(Ml[i + 2] - Ol[i + 2])) / 3;
      const keep = diff <= fbFrom ? 0 : diff >= fbFrom + FALLBACK_RANGE ? 1 : (diff - fbFrom) / FALLBACK_RANGE;
      for (let c = 0; c < 3; c++) {
        let t = Ol[i + c] - Ml[i + c];
        if (t > toneClamp) t = toneClamp;
        else if (t < -toneClamp) t = -toneClamp;
        const v = Md[i + c] + t;
        ch[c][p] = keep ? v * (1 - keep) + d[i + c] * keep : v;
      }
    }

    if (eyeW) {
      // Глаза: оригинал + мелкие детали AI там, где AI совпал с оригиналом по форме
      const mc = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
      const oc = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
      for (let p = 0, i = 0; p < n; p++, i += 4) {
        for (let c = 0; c < 3; c++) { mc[c][p] = Md[i + c]; oc[c][p] = d[i + c]; }
      }
      const mB = mc.map((x) => blur5(blur3(x, width, sh), width, sh));
      const oB = oc.map((x) => blur5(blur3(x, width, sh), width, sh));
      for (let p = 0; p < n; p++) {
        const e = eyeW[p];
        if (!e) continue;
        const mis = (Math.abs(mB[0][p] - oB[0][p]) + Math.abs(mB[1][p] - oB[1][p]) + Math.abs(mB[2][p] - oB[2][p])) / 3;
        const agree = mis <= EYE_AGREE_FROM ? 1 : mis >= EYE_AGREE_FROM + EYE_AGREE_RANGE ? 0 : 1 - (mis - EYE_AGREE_FROM) / EYE_AGREE_RANGE;
        for (let c = 0; c < 3; c++) {
          let det = mc[c][p] - mB[c][p];
          if (det > EYE_DETAIL_CLAMP) det = EYE_DETAIL_CLAMP;
          else if (det < -EYE_DETAIL_CLAMP) det = -EYE_DETAIL_CLAMP;
          // база — оригинал (форма), сверху — прорисовка AI
          const eyeV = oB[c][p] + (oc[c][p] - oB[c][p]) * (1 - agree) + det * agree;
          ch[c][p] = ch[c][p] * (1 - e) + eyeV * e;
        }
      }
    }

    // Резкость контуров: мелкие + средние (два unsharp mask)
    for (let c = 0; c < 3; c++) {
      const src = ch[c];
      const b3 = blur3(src, width, sh);
      const b5 = blur5(b3, width, sh);
      for (let p = 0, i = c; p < n; p++, i += 4) {
        const fine = src[p] - b3[p];
        const midD = b3[p] - b5[p];
        let v = src[p];
        const boost = eyeW && eyeW[p] ? 1 + (EYE_SHARP_BOOST - 1) * eyeW[p] : 1;
        if (Math.abs(fine) > SHARP_THRESHOLD) v += fine * SHARP_FINE * boost;
        if (Math.abs(midD) > SHARP_THRESHOLD) v += midD * SHARP_MID * boost;
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
