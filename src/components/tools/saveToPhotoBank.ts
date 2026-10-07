const DIRECT_UPLOAD_API = 'https://functions.poehali.dev/145813d2-d8f3-4a2b-b38e-08583a3153da';
const PHOTOBANK_URL = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';

/**
 * Сохраняет готовое изображение в папку фотобанка без лимита размера:
 * presigned URL → прямой PUT в S3 → confirm_upload (запись в БД + превью).
 * Раньше файл уходил base64 в JSON и большие фото падали с HTTP 413.
 */
export const saveBlobToPhotoBank = async (params: {
  userId: string | number;
  folderId: number;
  blob: Blob;
  fileName: string;
  width?: number;
  height?: number;
}) => {
  const { userId, folderId, blob, fileName, width, height } = params;
  const uid = String(userId);
  const type = blob.type || 'image/jpeg';

  const urlRes = await fetch(DIRECT_UPLOAD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': uid },
    body: JSON.stringify({
      action: 'batch-urls',
      files: [{ name: fileName, type, size: blob.size }],
      folder_id: folderId,
    }),
  });
  const urlData = await urlRes.json().catch(() => ({}));
  const upload = (urlData?.uploads || [])[0];
  if (!urlRes.ok || !upload?.url || !upload?.key) {
    throw new Error(urlData?.error || `Не удалось получить ссылку загрузки (HTTP ${urlRes.status})`);
  }

  let putOk = false;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3 && !putOk; attempt++) {
    try {
      const put = await fetch(upload.url, { method: 'PUT', headers: { 'Content-Type': type }, body: blob });
      lastStatus = put.status;
      putOk = put.ok;
    } catch {
      lastStatus = 0;
    }
    if (!putOk && attempt < 3) await new Promise((r) => setTimeout(r, attempt * 800));
  }
  if (!putOk) throw new Error(`Не удалось загрузить файл в хранилище (${lastStatus || 'сеть'})`);

  const confirmRes = await fetch(PHOTOBANK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': uid },
    body: JSON.stringify({
      action: 'confirm_upload',
      folder_id: folderId,
      s3_key: upload.key,
      file_name: fileName,
      width,
      height,
    }),
  });
  const data = await confirmRes.json().catch(() => ({}));
  if (!confirmRes.ok) throw new Error(data?.error || `HTTP ${confirmRes.status}`);
  return data;
};

export const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => (await fetch(dataUrl)).blob();
