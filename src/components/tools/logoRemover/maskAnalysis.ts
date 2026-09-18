export interface MaskStats {
  mask_ratio: number;
  ring_std: number;
  skin_ratio: number;
  face_hint: boolean;
}

const isSkin = (r: number, g: number, b: number) => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 95 && g > 40 && b > 20 &&
    max - min > 15 &&
    Math.abs(r - g) > 15 &&
    r > g && r > b
  );
};

/**
 * Считает статистику по маске и кольцу вокруг неё: насколько большая область,
 * насколько пёстрый фон рядом и много ли там кожи. По этим числам бэкенд
 * выбирает движок: простой фон — быстрая LAMA, кожа/лицо — дорисовка AI.
 */
export const analyzeMask = (
  image: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  faceHint = false,
): MaskStats => {
  const w = mask.width;
  const h = mask.height;
  const empty: MaskStats = { mask_ratio: 0, ring_std: 0, skin_ratio: 0, face_hint: faceHint };
  if (!w || !h) return empty;

  const mCtx = mask.getContext('2d');
  const iCtx = image.getContext('2d');
  if (!mCtx || !iCtx) return empty;

  const maskData = mCtx.getImageData(0, 0, w, h).data;
  const imgData = iCtx.getImageData(0, 0, w, h).data;

  // Шаг сэмплирования — чтобы на 1600px не жевать по 2.5 млн пикселей
  const step = Math.max(1, Math.round(Math.max(w, h) / 400));

  let maskCount = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  let total = 0;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      total++;
      if (maskData[(y * w + x) * 4 + 3] > 10) {
        maskCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!maskCount || maxX < 0) return empty;

  const maskRatio = maskCount / total;

  // Кольцо вокруг bbox маски: там оценим контраст фона и наличие кожи
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.5) + 12;
  const rx0 = Math.max(0, minX - pad);
  const ry0 = Math.max(0, minY - pad);
  const rx1 = Math.min(w - 1, maxX + pad);
  const ry1 = Math.min(h - 1, maxY + pad);

  let sum = 0;
  let sumSq = 0;
  let ringCount = 0;
  let skinCount = 0;

  for (let y = ry0; y <= ry1; y += step) {
    for (let x = rx0; x <= rx1; x += step) {
      const idx = (y * w + x) * 4;
      if (maskData[idx + 3] > 10) continue;
      const r = imgData[idx];
      const g = imgData[idx + 1];
      const b = imgData[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      sum += lum;
      sumSq += lum * lum;
      ringCount++;
      if (isSkin(r, g, b)) skinCount++;
    }
  }

  if (!ringCount) return { mask_ratio: maskRatio, ring_std: 0, skin_ratio: 0, face_hint: faceHint };

  const mean = sum / ringCount;
  const variance = Math.max(0, sumSq / ringCount - mean * mean);

  return {
    mask_ratio: Number(maskRatio.toFixed(5)),
    ring_std: Number(Math.sqrt(variance).toFixed(2)),
    skin_ratio: Number((skinCount / ringCount).toFixed(4)),
    face_hint: faceHint,
  };
};

/**
 * Готовит маску для inpaint: лёгкое расширение (dilate) и мягкие края (feather).
 * Жёсткая бинарная маска оставляет видимый шов по контуру — расширение
 * захватывает ореол вокруг лого, размытие делает переход незаметным.
 */
export const buildInpaintMask = (mask: HTMLCanvasElement, dilatePx = 3, featherPx = 2): string => {
  const w = mask.width;
  const h = mask.height;

  const solid = document.createElement('canvas');
  solid.width = w;
  solid.height = h;
  const sCtx = solid.getContext('2d')!;

  const src = mask.getContext('2d')!.getImageData(0, 0, w, h);
  const dst = sCtx.createImageData(w, h);
  for (let i = 0; i < src.data.length; i += 4) {
    const v = src.data[i + 3] > 10 ? 255 : 0;
    dst.data[i] = v;
    dst.data[i + 1] = v;
    dst.data[i + 2] = v;
    dst.data[i + 3] = 255;
  }
  sCtx.putImageData(dst, 0, 0);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const oCtx = out.getContext('2d')!;
  oCtx.fillStyle = '#000';
  oCtx.fillRect(0, 0, w, h);

  // Dilate: рисуем маску со сдвигами по кругу, режим lighter накапливает белое
  oCtx.globalCompositeOperation = 'lighter';
  const d = Math.max(0, Math.round(dilatePx));
  if (d > 0) {
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      oCtx.drawImage(solid, Math.round(Math.cos(ang) * d), Math.round(Math.sin(ang) * d));
    }
  }
  oCtx.drawImage(solid, 0, 0);
  oCtx.globalCompositeOperation = 'source-over';

  if (featherPx > 0) {
    const blurred = document.createElement('canvas');
    blurred.width = w;
    blurred.height = h;
    const bCtx = blurred.getContext('2d')!;
    bCtx.filter = `blur(${featherPx}px)`;
    bCtx.drawImage(out, 0, 0);
    bCtx.filter = 'none';
    return blurred.toDataURL('image/png').split(',')[1] || '';
  }

  return out.toDataURL('image/png').split(',')[1] || '';
};
