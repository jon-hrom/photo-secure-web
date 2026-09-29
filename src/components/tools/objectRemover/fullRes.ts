/**
 * Сборка результата в исходном разрешении.
 * Редактирование идёт на уменьшенной копии (≤1600px), а при экспорте
 * дорисованные участки масштабируются и вклеиваются в оригинал по маске —
 * остальная часть фото остаётся пиксель в пиксель как у оригинала.
 */

export const mimeFromName = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
};

export const ensureName = (name: string | null | undefined): string => {
  const n = (name || '').split(/[\\/]/).pop()?.trim() || '';
  if (!n) return `photo-${Date.now()}.jpg`;
  if (!/\.[a-z0-9]{2,5}$/i.test(n)) return `${n}.jpg`;
  return n;
};

/** Добавляет новую маску (base64 PNG, белое = изменено) к накопленной. */
export const mergeMask = async (prev: HTMLCanvasElement | null, maskB64: string, w: number, h: number) => {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = (e) => rej(e);
    img.src = `data:image/png;base64,${maskB64}`;
  });
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  if (prev) ctx.drawImage(prev, 0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return out;
};

/** Маска (белое на чёрном) → альфа-маска с расширением и мягким краем. */
const toAlphaMask = (mask: HTMLCanvasElement, w: number, h: number, scale: number) => {
  const mw = mask.width;
  const mh = mask.height;
  const src = mask.getContext('2d')!.getImageData(0, 0, mw, mh);
  const a = document.createElement('canvas');
  a.width = mw;
  a.height = mh;
  const actx = a.getContext('2d')!;
  const dst = actx.createImageData(mw, mh);
  for (let i = 0; i < src.data.length; i += 4) {
    dst.data[i] = 255;
    dst.data[i + 1] = 255;
    dst.data[i + 2] = 255;
    dst.data[i + 3] = src.data[i] > 20 ? 255 : 0;
  }
  actx.putImageData(dst, 0, 0);

  // Бэкенд расширяет маску и размывает край (~20px), берём с запасом
  const grown = document.createElement('canvas');
  grown.width = mw;
  grown.height = mh;
  const gctx = grown.getContext('2d')!;
  for (const r of [8, 16, 24]) {
    for (let k = 0; k < 24; k++) {
      const ang = (k / 24) * Math.PI * 2;
      gctx.drawImage(a, Math.round(Math.cos(ang) * r), Math.round(Math.sin(ang) * r));
    }
  }
  gctx.drawImage(a, 0, 0);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  octx.filter = `blur(${Math.max(2, Math.round(6 * scale))}px)`;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(grown, 0, 0, w, h);
  octx.filter = 'none';
  return out;
};

export const buildFullResCanvas = (
  original: HTMLImageElement,
  edited: HTMLCanvasElement,
  mask: HTMLCanvasElement | null,
): HTMLCanvasElement => {
  const w = original.naturalWidth;
  const h = original.naturalHeight;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(original, 0, 0, w, h);
  if (!mask) return out;

  const scale = w / edited.width;
  const layer = document.createElement('canvas');
  layer.width = w;
  layer.height = h;
  const lctx = layer.getContext('2d')!;
  lctx.imageSmoothingEnabled = true;
  lctx.imageSmoothingQuality = 'high';
  lctx.drawImage(edited, 0, 0, w, h);
  lctx.globalCompositeOperation = 'destination-in';
  lctx.drawImage(toAlphaMask(mask, w, h, scale), 0, 0);

  ctx.drawImage(layer, 0, 0);
  return out;
};

// ---------- перенос EXIF / ICC из оригинального JPEG ----------

const isJpeg = (b: Uint8Array) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8;

/** Ставит Orientation=1: пиксели уже развёрнуты браузером. */
const resetOrientation = (seg: Uint8Array) => {
  // seg: FF E1 len(2) "Exif\0\0" TIFF...
  const t = 10;
  if (seg.length < t + 8) return;
  const le = seg[t] === 0x49;
  const u16 = (o: number) => (le ? seg[o] | (seg[o + 1] << 8) : (seg[o] << 8) | seg[o + 1]);
  const u32 = (o: number) =>
    le
      ? (seg[o] | (seg[o + 1] << 8) | (seg[o + 2] << 16) | (seg[o + 3] << 24)) >>> 0
      : ((seg[o] << 24) | (seg[o + 1] << 16) | (seg[o + 2] << 8) | seg[o + 3]) >>> 0;
  const ifd = t + u32(t + 4);
  if (ifd + 2 > seg.length) return;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > seg.length) return;
    if (u16(e) === 0x0112) {
      const v = e + 8;
      if (le) { seg[v] = 1; seg[v + 1] = 0; } else { seg[v] = 0; seg[v + 1] = 1; }
      return;
    }
  }
};

const extractMeta = (src: Uint8Array): Uint8Array[] => {
  const segs: Uint8Array[] = [];
  let p = 2;
  while (p + 4 <= src.length && src[p] === 0xff) {
    const marker = src[p + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = (src[p + 2] << 8) | src[p + 3];
    const seg = src.slice(p, p + 2 + len);
    const isExif = marker === 0xe1 && seg[4] === 0x45 && seg[5] === 0x78; // "Ex"
    if (marker === 0xe0 || marker === 0xe2 || isExif) {
      if (isExif) resetOrientation(seg);
      segs.push(seg);
    }
    p += 2 + len;
  }
  return segs;
};

/** Вставляет JFIF (DPI), EXIF и ICC оригинала в новый JPEG. */
export const copyJpegMeta = (originalBytes: ArrayBuffer | null, output: Blob): Promise<Blob> =>
  (async () => {
    if (!originalBytes) return output;
    const src = new Uint8Array(originalBytes);
    const dst = new Uint8Array(await output.arrayBuffer());
    if (!isJpeg(src) || !isJpeg(dst)) return output;
    const meta = extractMeta(src);
    if (!meta.length) return output;
    // Пропускаем собственный APP0 у результата
    let p = 2;
    while (p + 4 <= dst.length && dst[p] === 0xff && dst[p + 1] === 0xe0) {
      p += 2 + ((dst[p + 2] << 8) | dst[p + 3]);
    }
    const parts = [dst.slice(0, 2), ...meta, dst.slice(p)] as unknown as BlobPart[];
    return new Blob(parts, { type: 'image/jpeg' });
  })().catch(() => output);

export const canvasToBlob = (canvas: HTMLCanvasElement, mime: string, quality = 0.95) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('не удалось собрать файл'))), mime, quality);
  });

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });