import type { RetouchTask } from '@/components/photobank/RetouchTaskList';

export const RETOUCH_API = 'https://functions.poehali.dev/c95989eb-d7f0-4fac-b9c9-f8ab0fb61aff';
export const RETOUCH_WAKER_API = 'https://functions.poehali.dev/d668813e-6fa2-4d11-b5bf-4bb013473dbc';
export const CONCURRENT_LIMIT = 1;
export const CLIENT_TASK_TIMEOUT_MS = 10 * 60 * 1000;

export interface RetouchSession {
  folderId: number;
  folderName: string;
  userId: string;
  onRetouchComplete?: () => void;
}

export interface Photo {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  data_url?: string;
}

export interface RetouchContextValue {
  tasks: RetouchTask[];
  photos: Photo[];
  isProcessing: boolean;
  waking: boolean;
  wakeStatus: string | null;
  submitting: boolean;
  minimized: boolean;
  session: RetouchSession | null;
  totalProgress: number;
  totalBatchSize: number;
  setMinimized: (v: boolean) => void;
  startSession: (session: RetouchSession) => void;
  fullClose: () => void;
  handleRetouchSingle: (photoId: number, photos: Photo[]) => Promise<void>;
  handleRetouchAll: (photos: Photo[]) => Promise<void>;
  retryTask: (task: RetouchTask) => Promise<void>;
  retryAllFailed: () => Promise<void>;
  lightboxData: { tasks: RetouchTask[]; startIndex: number } | null;
  lightboxDataRef: React.RefObject<{ tasks: RetouchTask[]; startIndex: number } | null>;
  openRetouchLightbox: (tasks: RetouchTask[], startIndex: number) => void;
  closeRetouchLightbox: () => void;
}
