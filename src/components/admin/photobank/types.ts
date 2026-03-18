import funcUrls from '../../../../backend/func2url.json';

export interface PhotoFolder {
  id: number;
  folder_name: string;
  s3_prefix: string;
  folder_type: string;
  parent_folder_id: number | null;
  created_at: string;
  updated_at: string;
  photo_count: number;
  archive_download_count: number;
  is_hidden: boolean;
  has_password: boolean;
  sort_order: number;
}

export interface Photo {
  id: number;
  file_name: string;
  s3_key: string;
  s3_url: string;
  thumbnail_s3_key: string;
  thumbnail_s3_url: string;
  is_raw: boolean;
  is_video: boolean;
  content_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  tech_reject_reason: string | null;
  tech_analyzed: boolean;
  created_at: string;
  photo_download_count: number;
}

export interface S3Folder {
  name: string;
  prefix: string;
}

export interface S3File {
  name: string;
  key: string;
  size: number;
  last_modified: string;
  storage_class: string;
}

export const API_URL = (funcUrls as Record<string, string>)['admin-user-photobank'];

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const isPreviewable = (name: string) => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(name);
export const isRawFile = (name: string) => /\.(raw|cr2|cr3|nef|arw|dng|orf|rw2|pef|raf|srw|heic|heif)$/i.test(name);
export const isVideoFile = (name: string) => /\.(mp4|mov|avi|webm|mkv)$/i.test(name);
