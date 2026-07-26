// Уменьшает картинку из файла до maxSize по большей стороне и возвращает
// data URL (JPEG). Нужно, чтобы обложка не улетала в облачную функцию
// многомегабайтным base64 и не упиралась в лимит тела запроса (~3.5 МБ).
export async function downscaleImageToDataUrl(
  file: File,
  maxSize = 1280,
  quality = 0.85
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        // Фолбэк: если canvas недоступен — отдаём исходник как есть
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Не удалось обработать картинку'));
    img.src = dataUrl;
  });
}

export default downscaleImageToDataUrl;
