export const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';
/** Конвертер RAW → JPEG (превью 2400px, для ретуши его более чем достаточно — модель работает с 1600px). */
export const RAW_CONVERT_URL = 'https://functions.poehali.dev/40c5290a-b9a7-48e8-a0a6-68468d29a62c';
export const RAW_CONVERT_CONCURRENCY = 4;
export const RETOUCH_FOLDER_NAME = 'Ретуширование фото';
export const BATCH_CONCURRENCY = 2;
export const RAW_RE = /\.(cr2|cr3|nef|nrw|arw|srf|sr2|dng|orf|rw2|raf|pef|raw|rwl|iiq|3fr)$/i;

export interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  is_video?: boolean;
  is_raw?: boolean;
  content_type?: string;
}

export type ItemStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface BatchItem {
  id: number;
  file_name: string;
  thumb: string;
  status: ItemStatus;
  text?: string;
}

export interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: number;
  folderName: string;
  userId: string;
  preselectedPhotoId?: number;
  onRetouchComplete?: () => void;
}

export const isRaw = (p: Photo) => !!p.is_raw || RAW_RE.test(p.file_name || '');

export const isRetouchable = (p: Photo) =>
  !p.is_video && !(p.content_type || '').startsWith('video/') && (isRaw(p) || !!p.s3_url);

/** Для RAW показываем только JPEG-превью (сам RAW браузер не отрисует). */
export const thumbOf = (p: Photo) => (isRaw(p) ? p.thumbnail_s3_url || '' : p.thumbnail_s3_url || p.s3_url || '');
