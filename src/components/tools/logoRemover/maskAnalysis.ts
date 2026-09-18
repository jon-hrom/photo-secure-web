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
