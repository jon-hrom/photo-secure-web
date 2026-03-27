import { useState, useCallback } from 'react';

const colorCache = new Map<string, string>();

const getDominantColor = (img: HTMLImageElement): string => {
  const canvas = document.createElement('canvas');
  const size = 16;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#f3f4f6';

  try {
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const edgePixels: number[][] = [];
    for (let x = 0; x < size; x++) {
      for (const y of [0, 1, size - 2, size - 1]) {
        const i = (y * size + x) * 4;
        edgePixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }
    for (let y = 2; y < size - 2; y++) {
      for (const x of [0, 1, size - 2, size - 1]) {
        const i = (y * size + x) * 4;
        edgePixels.push([data[i], data[i + 1], data[i + 2]]);
      }
    }

    let r = 0, g = 0, b = 0;
    for (const [pr, pg, pb] of edgePixels) {
      r += pr;
      g += pg;
      b += pb;
    }
    const count = edgePixels.length;
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return '#f3f4f6';
  }
};

export const useDominantColor = (src: string | undefined) => {
  const [bgColor, setBgColor] = useState<string | null>(() => {
    if (src && colorCache.has(src)) return colorCache.get(src)!;
    return null;
  });

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!src) return;
    if (colorCache.has(src)) {
      setBgColor(colorCache.get(src)!);
      return;
    }
    try {
      const color = getDominantColor(e.currentTarget);
      colorCache.set(src, color);
      setBgColor(color);
    } catch {
      setBgColor('#f3f4f6');
    }
  }, [src]);

  return { bgColor, onImageLoad };
};

export default useDominantColor;
