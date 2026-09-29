/**
 * Совместимость canvas с мобильными браузерами.
 *
 * iOS Safari: один canvas не больше ~16,7 Мп (4096×4096), а общий объём
 * всех canvas на странице ограничен — при превышении canvas молча становится
 * пустым и toBlob отдаёт null. Фото с зеркалки (5760×3840 = 22 Мп) туда не влезает.
 * Кроме того, Safari до 18-й версии игнорирует ctx.filter (blur).
 */

export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ представляется как Mac, но с сенсорным экраном
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

export const isAndroid = (): boolean =>
  typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');

/** Максимум пикселей на один canvas, который гарантированно отрисуется. */
export const maxCanvasPixels = (): number => {
  if (isIOS()) return 16_000_000;
  if (isAndroid()) return 50_000_000;
  return 120_000_000;
};

/** Размер, ужатый до лимита устройства с сохранением пропорций. */
export const fitToCanvasLimit = (w: number, h: number) => {
  const max = maxCanvasPixels();
  if (w * h <= max) return { w, h, scaled: false };
  const k = Math.sqrt(max / (w * h));
  return { w: Math.floor(w * k), h: Math.floor(h * k), scaled: true };
};

let filterSupport: boolean | null = null;

export const supportsCanvasFilter = (): boolean => {
  if (filterSupport !== null) return filterSupport;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 3;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(1, 1, 1, 1);
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = 3;
    const tctx = tmp.getContext('2d')!;
    tctx.filter = 'blur(1px)';
    tctx.drawImage(c, 0, 0);
    // Если blur сработал, соседний пиксель стал ненулевым
    filterSupport = tctx.getImageData(0, 1, 1, 1).data[3] > 0 || tctx.getImageData(0, 1, 1, 1).data[0] > 0;
  } catch {
    filterSupport = false;
  }
  return filterSupport;
};

/**
 * Рисует src в ctx с размытием radius (px в координатах ctx).
 * Без поддержки ctx.filter — размытие через уменьшение и сглаженное увеличение.
 */
export const drawBlurred = (
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  w: number,
  h: number,
  radius: number,
) => {
  if (radius <= 0) {
    ctx.drawImage(src, 0, 0, w, h);
    return;
  }
  if (supportsCanvasFilter()) {
    ctx.filter = `blur(${radius}px)`;
    ctx.drawImage(src, 0, 0, w, h);
    ctx.filter = 'none';
    return;
  }
  const k = Math.max(2, Math.round(radius));
  const sw = Math.max(1, Math.round(w / k));
  const sh = Math.max(1, Math.round(h / k));
  const small = document.createElement('canvas');
  small.width = sw;
  small.height = sh;
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(src, 0, 0, sw, sh);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, w, h);
  releaseCanvas(small);
};

/** Освобождает память canvas сразу (важно для iOS: лимит общего объёма). */
export const releaseCanvas = (c: HTMLCanvasElement | null | undefined) => {
  if (!c) return;
  c.width = 0;
  c.height = 0;
};
