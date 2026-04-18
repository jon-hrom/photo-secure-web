export const LOGO_REMOVE_URL = 'https://functions.poehali.dev/3795ef81-5e3e-451a-b638-0d994d8ee56c';
export const PHOTOBANK_URL = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';
export const MAX_SIDE = 1600;

export type Stage = 'upload' | 'edit';

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
  return canvas.toDataURL(mime, 0.92);
};
