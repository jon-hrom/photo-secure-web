export const MOBILE_UPLOAD_API = 'https://functions.poehali.dev/3372b3ed-5509-41e0-a542-b3774be6b702';
export const PHOTOBANK_FOLDERS_API = 'https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc';
export const MAX_CONCURRENT_UPLOADS = 3;
export const MAX_RETRIES = 3;
export const RETRY_DELAY = 2000;

export interface FileUploadStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'retrying';
  progress: number;
  error?: string;
  s3_key?: string;
  retryCount?: number;
}

export interface PhotoFolder {
  id: number;
  folder_name: string;
}

export interface CameraUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  folders: PhotoFolder[];
  onUploadComplete?: () => void;
}
