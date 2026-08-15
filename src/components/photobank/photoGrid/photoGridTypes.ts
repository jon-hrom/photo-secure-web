export type SortField = 'name' | 'shot_date' | 'created_at' | 'shot_time';
export type SortDirection = 'asc' | 'desc';
export type FrameMode = 'none' | 'theme' | 'adaptive';

export interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  is_video?: boolean;
  content_type?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
  shot_date?: string | null;
  tech_reject_reason?: string | null;
  tech_analyzed?: boolean;
  photo_download_count?: number;
}

export interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
  folder_type?: 'originals' | 'tech_rejects' | 'retouch' | 'review';
  parent_folder_id?: number | null;
}

export interface MissingFrames {
  count: number;
  expected: number;
  actual: number;
  sample: number[];
}

export interface PhotoBankPhotoGridProps {
  selectedFolder: PhotoFolder | null;
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: { current: number; total: number; percent: number; currentFileName: string };
  selectionMode: boolean;
  selectedPhotos: Set<number>;
  emailVerified: boolean;
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (photoId: number, fileName: string) => void;
  onTogglePhotoSelection: (photoId: number) => void;
  onCancelUpload: () => void;
  onRestorePhoto?: (photoId: number) => void;
  isAdminViewing?: boolean;
  onRenameFolder?: () => void;
  storageUsage?: { usedGb: number; limitGb: number; percent: number };
  subfolders?: PhotoFolder[];
  onSelectSubfolder?: (subfolder: PhotoFolder) => void;
  onCreateSubfolder?: () => void;
  onOpenSubfolderSettings?: (subfolder: PhotoFolder) => void;
  onDeleteSubfolder?: (subfolder: PhotoFolder) => void;
  onNavigateToParent?: () => void;
  clientUploadSlot?: React.ReactNode;
  onRetouchFolder?: (folderId: number, folderName: string, photoId?: number) => void;
  userId?: string;
  onRefreshPhotos?: () => void;
}

export const handleDownload = async (s3Key: string, fileName: string, userId: number) => {
  try {
    console.log('[DOWNLOAD] Starting download:', { s3Key, fileName, userId });
    const response = await fetch(
      `https://functions.poehali.dev/8a60ca41-e494-417e-b881-2ce4f1f4247e?key=${encodeURIComponent(s3Key)}&userId=${userId}`
    );
    console.log('[DOWNLOAD] Download URL response:', response.status);
    
    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }
    
    const data = await response.json();
    console.log('[DOWNLOAD] Pre-signed URL received:', data.url ? 'yes' : 'no');
    
    const fileResponse = await fetch(data.url);
    if (!fileResponse.ok) throw new Error('Failed to fetch file');
    const blob = await fileResponse.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('[DOWNLOAD] Download failed:', error);
    alert('Ошибка при скачивании файла. Попробуйте позже.');
  }
};

export const naturalCompare = (a: string, b: string): number => {
  const re = /(\d+)|(\D+)/g;
  const aParts = a.match(re) || [];
  const bParts = b.match(re) || [];
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    if (i >= aParts.length) return -1;
    if (i >= bParts.length) return 1;
    const aNum = parseInt(aParts[i]);
    const bNum = parseInt(bParts[i]);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const cmp = aParts[i].localeCompare(bParts[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
};

export const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export const getRejectionReasonLabel = (reason?: string | null) => {
  const labels: Record<string, string> = {
    blur: 'Размытие',
    overexposed: 'Пересвет',
    underexposed: 'Недосвет',
    noise: 'Шум',
    low_contrast: 'Низкий контраст',
    corrupt_file: 'Поврежденный файл',
    analysis_error: 'Ошибка анализа',
    closed_eyes: 'Закрытые глаза',
    review_blur: 'Резкость под вопросом',
    review_eyes: 'Глаза под вопросом',
    ok: 'OK'
  };
  return reason ? labels[reason] || reason : 'Неизвестно';
};