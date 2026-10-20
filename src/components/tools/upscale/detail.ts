/**
 * Детализация поверх собранного фото: снимает «дымку» (локальный контраст
 * на крупном масштабе) и «мыло» (резкость мелких и средних деталей).
 * Сила 0–100. Обрабатывает холст полосами, чтобы не съесть память.
 */
const STRIP = 256;
const PAD = 8;

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

  // Крупное размытие через уменьшенную копию: по нему видно «вуаль» дымки
  const lw = Math.max(8, Math.round(W / 40));
  const lh = Math.max(8, Math.round(H / 40));
  const low = document.createElement('canvas');
  low.width = lw;
  low.height = lh;
  ctx2d(low).drawImage(canvas, 0, 0, lw, lh);
  // Мягкий уровень чёрного: самые тёмные места кадра на крупном масштабе
  const ld = ctx2d(low).getImageData(0, 0, lw, lh).data;
  const mins: number[] = [];
  for (let i = 0; i < ld.length; i += 4) mins.push(Math.min(ld[i], ld[i + 1], ld[i + 2]));
  mins.sort((a, b) => a - b);
  const veil = Math.min(40, mins[Math.floor(mins.length * 0.02)] || 0) * k * 0.8;
  const gain = 255 / (255 - veil);

  const clarity = 0.45 * k;
  const fineAmt = 1.6 * k;
  const midAmt = 0.8 * k;

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
    const d = img.data;
    const n = W * sh;
    for (let c = 0; c < 3; c++) {
      const src = new Float32Array(n);
      for (let p = 0, i = c; p < n; p++, i += 4) src[p] = d[i];
      const b1 = blur3(src, W, sh);
      const b2 = blur3(blur3(b1, W, sh), W, sh);
      for (let p = 0, i = c; p < n; p++, i += 4) {
        let v = src[p];
        const fine = v - b1[p];
        const mid = b1[p] - b2[p];
        if (Math.abs(fine) > 1.5) v += fine * fineAmt;
        if (Math.abs(mid) > 1.5) v += mid * midAmt;
        // Локальный контраст: слабее у краёв диапазона, чтобы не выбить света и тени
        const lum = L[i];
        const room = 1 - Math.abs(lum - 128) / 160;
        v += (v - lum) * clarity * (room > 0 ? room : 0);
        v = (v - veil) * gain;
        d[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    ctx.putImageData(img, 0, a, 0, y0 - a, W, y1 - y0);
    onProgress?.(y1 / H);
    await nextFrame();
  }
  low.width = 0;
  return canvas;
};
