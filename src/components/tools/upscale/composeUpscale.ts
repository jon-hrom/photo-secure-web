/**
 * Сборка увеличенного фото без изменения содержимого.
 *
 * Итог = оригинал, точно растянутый до нужного размера
 *      + только мелкие детали из ответа AI (то, чего нет в оригинале).
 * Цвет, свет, формы и композиция остаются от оригинала. Там, где AI
 * что-то перерисовал заметно (крупное расхождение), его детали не берутся.
 * Считаем полосами, чтобы не держать в памяти несколько огромных холстов.
 */
export interface UpscalePlace {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TARGET_SIDE: Record<'2k' | '4k' | '8k', number> = { '2k': 2048, '4k': 4096, '8k': 8192 };

export const targetSize = (w: number, h: number, size: keyof typeof TARGET_SIDE) => {
  const k = TARGET_SIDE[size] / Math.max(w, h);
  return { width: Math.round(w * k), height: Math.round(h * k), factor: k };
};

const STRIP = 256;
const PAD = 8;
const DIFF_FROM = 10;
const DIFF_RANGE = 20;
const DETAIL_CLAMP = 28;

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

export const composeUpscale = async (
  original: HTMLImageElement,
  result: HTMLImageElement,
  place: UpscalePlace,
  width: number,
  height: number,
  onProgress?: (p: number) => void,
): Promise<HTMLCanvasElement> => {
  const ow = original.naturalWidth;
  const oh = original.naturalHeight;

  // «Размытая» версия ответа AI в размере оригинала — по ней видно, что AI изменил крупно
  const low = makeCanvas(ow, oh);
  low.ctx.drawImage(result, place.x, place.y, place.w, place.h, 0, 0, ow, oh);

  const out = makeCanvas(width, height);
  const sy = oh / height;
  const ry = place.h / height;

  for (let y0 = 0; y0 < height; y0 += STRIP) {
    const y1 = Math.min(height, y0 + STRIP);
    const a = Math.max(0, y0 - PAD);
    const b = Math.min(height, y1 + PAD);
    const sh = b - a;

    const base = makeCanvas(width, sh);
    base.ctx.drawImage(original, 0, a * sy, ow, sh * sy, 0, 0, width, sh);
    const lowUp = makeCanvas(width, sh);
    lowUp.ctx.drawImage(low.c, 0, a * sy, ow, sh * sy, 0, 0, width, sh);
    const model = makeCanvas(width, sh);
    model.ctx.drawImage(result, place.x, place.y + a * ry, place.w, sh * ry, 0, 0, width, sh);

    const top = y0 - a;
    const rows = y1 - y0;
    const B = base.ctx.getImageData(0, top, width, rows);
    const L = lowUp.ctx.getImageData(0, top, width, rows).data;
    const M = model.ctx.getImageData(0, top, width, rows).data;
    const d = B.data;

    for (let i = 0; i < d.length; i += 4) {
      const diff = (Math.abs(L[i] - d[i]) + Math.abs(L[i + 1] - d[i + 1]) + Math.abs(L[i + 2] - d[i + 2])) / 3;
      const w = diff <= DIFF_FROM ? 1 : diff >= DIFF_FROM + DIFF_RANGE ? 0 : 1 - (diff - DIFF_FROM) / DIFF_RANGE;
      if (w === 0) continue;
      for (let ch = 0; ch < 3; ch++) {
        let det = M[i + ch] - L[i + ch];
        if (det > DETAIL_CLAMP) det = DETAIL_CLAMP;
        else if (det < -DETAIL_CLAMP) det = -DETAIL_CLAMP;
        d[i + ch] = d[i + ch] + det * w;
      }
    }
    out.ctx.putImageData(B, 0, y0);
    [base, lowUp, model].forEach((x) => { x.c.width = 0; x.c.height = 0; });
    onProgress?.(y1 / height);
    await nextFrame();
  }
  low.c.width = 0;
  low.c.height = 0;
  return out.c;
};
