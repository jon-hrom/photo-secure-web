export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
  return iOSDevice || iPadOS;
};

const canShareFiles = (files: File[]): boolean => {
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files });
};

export const canShareBlob = (blob: Blob, fileName: string): boolean => {
  try {
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
    return canShareFiles([file]);
  } catch {
    return false;
  }
};

/**
 * Отдаёт файл в системное меню iPhone.
 * ВАЖНО: вызывать строго из обработчика нажатия — iOS запрещает
 * открывать это меню, если между касанием и вызовом была загрузка.
 */
export const shareBlobNow = async (blob: Blob, fileName: string): Promise<boolean> => {
  try {
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
    if (!canShareFiles([file])) return false;
    await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ files: [file] });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return true;
    return false;
  }
};

const fallbackDownload = (url: string, fileName: string) => {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

/**
 * Сохраняет уже загруженный файл на устройство.
 * На iPhone/iPad предлагает системное «Сохранить в Фото»,
 * на остальных устройствах — обычная загрузка в папку загрузок.
 */
export const saveBlobToDevice = async (
  blob: Blob,
  fileName: string
): Promise<'shared' | 'downloaded'> => {
  const isImage = (blob.type || '').startsWith('image/') || /\.(jpe?g|png|heic|webp|gif)$/i.test(fileName);

  if (isIOS() && isImage) {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      if (canShareFiles([file])) {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          files: [file],
        });
        return 'shared';
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }

  const objectUrl = window.URL.createObjectURL(blob);
  fallbackDownload(objectUrl, fileName);
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 10000);
  return 'downloaded';
};

/**
 * Пытается сохранить сразу несколько фото в галерею iPhone
 * одним системным окном «Поделиться» → «Сохранить N изображений».
 * Возвращает false, если устройство или браузер так не умеют —
 * тогда вызывающий код должен собрать привычный ZIP-архив.
 */
export const savePhotosToGallery = async (
  items: { blob: Blob; fileName: string }[]
): Promise<boolean> => {
  if (!isIOS() || items.length === 0) return false;

  try {
    const files = items.map(
      ({ blob, fileName }) => new File([blob], fileName, { type: blob.type || 'image/jpeg' })
    );
    if (!canShareFiles(files)) return false;

    await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ files });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return true;
    return false;
  }
};

/**
 * Сохраняет фото на устройство.
 * На iPhone/iPad открывает системное окно «Поделиться» с пунктом
 * «Сохранить в Фото» — снимок попадает прямо в галерею,
 * минуя папку «Загрузки». На остальных устройствах — обычная загрузка.
 */
export const savePhotoToDevice = async (
  url: string,
  fileName: string
): Promise<'shared' | 'downloaded'> => {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return await saveBlobToDevice(blob, fileName);
  } catch {
    fallbackDownload(url, fileName);
    return 'downloaded';
  }
};