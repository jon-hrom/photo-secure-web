export const SKIN_RETOUCH_URL = 'https://functions.poehali.dev/a7cdfbe7-4eb5-4dbb-bde4-27b0692e7183';
export const PHOTOBANK_URL = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';

/** Больше не нужно: модель всё равно работает с ~2K, а трафик экономим. */
export const MAX_SIDE = 1600;

export type RetouchStage = 'upload' | 'setup' | 'result';
export type PresetKey = 'light' | 'medium' | 'strong';

export interface RetouchPreset {
  key: PresetKey;
  label: string;
  hint: string;
}

export const PRESETS: RetouchPreset[] = [
  { key: 'light', label: 'Лёгкая', hint: 'Минимум вмешательства, максимум деталей кожи' },
  { key: 'medium', label: 'Стандарт', hint: 'Баланс: чистая кожа и естественная текстура' },
  { key: 'strong', label: 'Сильная', hint: 'Для проблемной кожи — максимально ровный тон' },
];

export type EyeSharpenKey = 'off' | 'normal' | 'strong';

export const EYE_SHARPEN_OPTIONS: { key: EyeSharpenKey; label: string }[] = [
  { key: 'off', label: 'Выкл' },
  { key: 'normal', label: 'Обычная' },
  { key: 'strong', label: 'Сильная' },
];

export const urlToImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });

export const fileToImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

export const dataUrlToBase64 = (dataUrl: string) => dataUrl.split(',')[1] || '';

export const imageToDataUrl = (img: HTMLImageElement, mime = 'image/jpeg'): string => {
  let w = img.naturalWidth;
  let h = img.naturalHeight;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL(mime, 0.94);
};

/**
 * Зона подбородка для режима «убрать второй подбородок».
 * Поиск идёт параллельно с ожиданием модели, поэтому можно позволить
 * себе несколько попыток: сервис распознавания иногда не укладывается
 * в лимит времени функции и отвечает пустым списком.
 */
export const fetchChinBoxes = async (
  imageB64: string,
  headers: Record<string, string>,
  attempts = 4,
): Promise<number[][]> => {
  // Сначала точки лица в браузере — быстро и надёжно даже на общем плане.
  try {
    const { localChinBoxes } = await import('@/components/tools/skinRetouch/plastic');
    const local = await localChinBoxes(`data:image/jpeg;base64,${imageB64}`);
    if (local.length) return local;
  } catch (e) {
    console.warn('local chin boxes failed', e);
  }
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await fetch(`${SKIN_RETOUCH_URL}?action=chin_regions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ image: imageB64 }),
      });
      const d = await r.json();
      if (Array.isArray(d?.boxes) && d.boxes.length) return d.boxes;
    } catch (e) {
      console.warn('chin regions failed', e);
    }
  }
  return [];
};