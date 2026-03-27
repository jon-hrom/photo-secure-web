const FALLBACK_COLOR = "#9ca3af";
const CANVAS_SIZE = 50;
const COLOR_BUCKET_SHIFT = 4;

const colorCache = new Map<string, string>();

const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    "#" +
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  );
};

const quantizeChannel = (value: number): number => {
  return (value >> COLOR_BUCKET_SHIFT) << COLOR_BUCKET_SHIFT;
};

const findDominantFromPixels = (data: Uint8ClampedArray): string => {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) continue;

    const qr = quantizeChannel(r);
    const qg = quantizeChannel(g);
    const qb = quantizeChannel(b);
    const key = `${qr},${qg},${qb}`;

    const existing = buckets.get(key);
    if (existing) {
      existing.count++;
      existing.r += r;
      existing.g += g;
      existing.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  if (buckets.size === 0) return FALLBACK_COLOR;

  let maxCount = 0;
  let dominant = { r: 156, g: 163, b: 175 };

  for (const bucket of buckets.values()) {
    if (bucket.count > maxCount) {
      maxCount = bucket.count;
      dominant = {
        r: Math.round(bucket.r / bucket.count),
        g: Math.round(bucket.g / bucket.count),
        b: Math.round(bucket.b / bucket.count),
      };
    }
  }

  return rgbToHex(dominant.r, dominant.g, dominant.b);
};

export const extractDominantColor = (imageUrl: string): Promise<string> => {
  const cached = colorCache.get(imageUrl);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      if (!ctx) {
        resolve(FALLBACK_COLOR);
        return;
      }

      try {
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const imageData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        const color = findDominantFromPixels(imageData.data);
        colorCache.set(imageUrl, color);
        resolve(color);
      } catch {
        colorCache.set(imageUrl, FALLBACK_COLOR);
        resolve(FALLBACK_COLOR);
      }
    };

    img.onerror = () => {
      resolve(FALLBACK_COLOR);
    };

    img.src = imageUrl;
  });
};

export const clearColorCache = (): void => {
  colorCache.clear();
};

export default extractDominantColor;
