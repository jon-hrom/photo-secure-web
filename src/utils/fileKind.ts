const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tif', 'tiff', 'avif', 'svg'];
const RAW_EXTS = ['raw', 'cr2', 'cr3', 'nef', 'arw', 'dng', 'orf', 'rw2', 'raf', 'pef'];

export const fileExt = (name?: string) => {
  const n = (name || '').toLowerCase();
  const i = n.lastIndexOf('.');
  return i >= 0 ? n.slice(i + 1) : '';
};

/** Файл не фото и не видео (документ, архив и т.п.) — без превью и просмотрщика. */
export const isDocumentFile = (p: { file_name?: string; content_type?: string; is_video?: boolean; is_raw?: boolean; thumbnail_s3_url?: string }) => {
  if (p.is_video || p.is_raw || p.thumbnail_s3_url) return false;
  const ct = (p.content_type || '').toLowerCase();
  if (ct.startsWith('image/') || ct.startsWith('video/')) return false;
  const ext = fileExt(p.file_name);
  if (!ext) return ct !== '' && ct !== 'application/octet-stream';
  return !IMAGE_EXTS.includes(ext) && !RAW_EXTS.includes(ext);
};

export const fileIconName = (name?: string) => {
  const ext = fileExt(name);
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'FileArchive';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'FileText';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'FileSpreadsheet';
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return 'FileAudio';
  if (['psd', 'ai', 'eps', 'indd', 'xmp', 'lrcat'].includes(ext)) return 'FileImage';
  return 'File';
};
