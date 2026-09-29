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

// ---------- общие помощники для всех инструментов ----------

export interface SourceImage {
  img: HTMLImageElement;
  bytes: ArrayBuffer | null;
  name: string;
}

const bytesToImage = (bytes: ArrayBuffer, type = ''): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([bytes], type ? { type } : undefined));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });

/** Оригинал из файла: картинка в полном разрешении + байты (для EXIF) + имя. */
export const loadSourceFromFile = async (file: File): Promise<SourceImage> => {
  const bytes = await file.arrayBuffer();
  return { img: await bytesToImage(bytes, file.type), bytes, name: ensureName(file.name) };
};

/** Оригинал по ссылке (фотобанк). Если байты не скачались — хотя бы картинка. */
export const loadSourceFromUrl = async (url: string, name: string): Promise<SourceImage> => {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const bytes = await r.arrayBuffer();
    return { img: await bytesToImage(bytes), bytes, name: ensureName(name) };
  } catch {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(e);
      i.src = url;
    });
    return { img, bytes: null, name: ensureName(name) };
  }
};

export const dataUrlToCanvas = async (dataUrl: string): Promise<HTMLCanvasElement> => {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = (e) => rej(e);
    img.src = dataUrl;
  });
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return c;
};

/**
 * Маска изменений для инструментов без явной маски (ретушь, замена лица, пластика):
 * сравниваем результат AI с уменьшенным оригиналом блоками 4×4.
 * Где разницы нет — в итог пойдёт оригинал в полном разрешении.
 */
export const diffMask = (original: HTMLImageElement, edited: HTMLCanvasElement, threshold = 5): HTMLCanvasElement => {
  const w = edited.width;
  const h = edited.height;
  const a = document.createElement('canvas');
  a.width = w;
  a.height = h;
  const actx = a.getContext('2d', { willReadFrequently: true })!;
  actx.imageSmoothingQuality = 'high';
  actx.drawImage(original, 0, 0, w, h);
  const od = actx.getImageData(0, 0, w, h).data;
  const ed = edited.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data;

  const B = 4;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d')!;
  octx.fillStyle = '#000';
  octx.fillRect(0, 0, w, h);
  octx.fillStyle = '#fff';
  for (let by = 0; by < h; by += B) {
    for (let bx = 0; bx < w; bx += B) {
      let sum = 0;
      let n = 0;
      const ye = Math.min(h, by + B);
      const xe = Math.min(w, bx + B);
      for (let y = by; y < ye; y++) {
        for (let x = bx; x < xe; x++) {
          const i = (y * w + x) * 4;
          sum += Math.max(Math.abs(od[i] - ed[i]), Math.abs(od[i + 1] - ed[i + 1]), Math.abs(od[i + 2] - ed[i + 2]));
          n++;
        }
      }
      if (sum / n > threshold) octx.fillRect(bx, by, xe - bx, ye - by);
    }
  }
  return out;
};

/** Итоговый файл: исходное разрешение, исходное имя, формат и EXIF оригинала. */
export const exportFullRes = async (
  src: SourceImage,
  edited: HTMLCanvasElement,
  mask: HTMLCanvasElement | null | 'auto',
) => {
  const m = mask === 'auto' ? diffMask(src.img, edited) : mask;
  const full = buildFullResCanvas(src.img, edited, m);
  const mime = mimeFromName(src.name);
  let blob = await canvasToBlob(full, mime, 0.95);
  if (mime === 'image/jpeg') blob = await copyJpegMeta(src.bytes, blob);
  return { blob, name: src.name, width: full.width, height: full.height };
};

export const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
