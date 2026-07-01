const IMAGE_THUMB_URL = 'https://functions.poehali.dev/4af7dbda-63cb-4107-add3-fb5cb1b87da1';

/**
 * Возвращает URL лёгкого превью для фото через функцию ресайза.
 * Нужно, чтобы в галереях выбора не грузить полноразмерные фото (15+ МБ).
 * Работает только для storage.yandexcloud.net / cdn.poehali.dev.
 *
 * @param src  исходный URL фото (presigned S3 или CDN)
 * @param width желаемая ширина превью в px (по умолчанию 400)
 */
export const getThumbUrl = (src: string | undefined | null, width = 400): string => {
  if (!src) return '';
  if (!/storage\.yandexcloud\.net|cdn\.poehali\.dev/.test(src)) return src;
  return `${IMAGE_THUMB_URL}?w=${width}&url=${encodeURIComponent(src)}`;
};

export default getThumbUrl;
