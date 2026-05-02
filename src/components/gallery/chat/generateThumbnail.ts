// Утилита генерации миниатюры на canvas и параллельной заливки в S3.
// Используется в чате, чтобы в ленте сообщений рендерить лёгкое превью
// (≈100-200 КБ) вместо оригинала (8-50 МБ).

const MAX_DIMENSION = 800; // максимальная сторона миниатюры
const JPEG_QUALITY = 0.8;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось декодировать изображение'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob вернул null'));
      },
      type,
      quality,
    );
  });
}

/**
 * Генерирует JPEG-миниатюру максимум MAX_DIMENSION×MAX_DIMENSION
 * и грузит её в S3 по уже подписанному presigned URL.
 * Возвращает CDN-URL миниатюры или null если что-то пошло не так.
 */
export async function generateAndUploadThumbnail(
  file: File,
  uploadUrl: string,
  cdnUrl: string,
): Promise<string | null> {
  try {
    const img = await loadImage(file);
    const { width: w, height: h } = img;
    const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, tw, th);

    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', 'image/jpeg');
      xhr.setRequestHeader('x-amz-acl', 'public-read');
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Thumb PUT HTTP ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error('Network error during thumb upload'));
      xhr.send(blob);
    });

    return cdnUrl;
  } catch (err) {
    console.warn('[CHAT] generateAndUploadThumbnail failed:', err);
    return null;
  }
}