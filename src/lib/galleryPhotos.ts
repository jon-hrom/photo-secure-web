const GALLERY_URL = 'https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab';

export interface GalleryPhotoLite {
  id: number;
  photo_url: string;
  thumbnail_url?: string;
  file_name?: string;
  is_video?: boolean;
}

// Достаёт короткий код галереи из ссылки вида https://.../g/CODE или из чистого кода
export const extractGalleryCode = (input: string): string => {
  const v = (input || '').trim();
  if (!v) return '';
  const m = v.match(/\/g\/([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  // возможно вставили просто код
  if (/^[A-Za-z0-9_-]{3,20}$/.test(v)) return v;
  return '';
};

export const fetchGalleryPhotos = async (
  linkOrCode: string,
  password?: string,
): Promise<{ ok: boolean; photos: GalleryPhotoLite[]; requiresPassword?: boolean; error?: string }> => {
  const code = extractGalleryCode(linkOrCode);
  if (!code) return { ok: false, photos: [], error: 'bad_code' };
  const params = new URLSearchParams({ code });
  if (password) params.set('password', password);
  try {
    const r = await fetch(`${GALLERY_URL}?${params.toString()}`);
    if (r.status === 401) return { ok: false, photos: [], requiresPassword: true };
    if (!r.ok) return { ok: false, photos: [], error: 'not_found' };
    const d = await r.json();
    const photos: GalleryPhotoLite[] = (d.photos || [])
      .filter((p: GalleryPhotoLite) => !p.is_video)
      .map((p: GalleryPhotoLite) => ({
        id: p.id,
        photo_url: p.photo_url,
        thumbnail_url: p.thumbnail_url || p.photo_url,
        file_name: p.file_name,
      }));
    return { ok: true, photos };
  } catch {
    return { ok: false, photos: [], error: 'network' };
  }
};
