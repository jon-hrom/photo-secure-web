import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  FileUploadStatus,
  MOBILE_UPLOAD_API,
  PHOTOBANK_FOLDERS_API,
  MAX_RETRIES,
  RETRY_DELAY,
} from './CameraUploadTypes';

const DIRECT_UPLOAD_API = 'https://functions.poehali.dev/145813d2-d8f3-4a2b-b38e-08583a3153da';
const URL_BATCH_SIZE = 100;
const PARALLEL_LIMIT = 6;
const UI_UPDATE_INTERVAL = 800;

export const useCameraUploadLogic = (
  userId: string,
  uploading: boolean,
  setFiles: React.Dispatch<React.SetStateAction<FileUploadStatus[]>>,
  filesRef: React.MutableRefObject<FileUploadStatus[]>,
  setUploading: React.Dispatch<React.SetStateAction<boolean>>
) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [uploadStats, setUploadStats] = useState({
    startTime: 0,
    completedFiles: 0,
    totalFiles: 0,
    estimatedTimeRemaining: 0
  });
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const cancelledRef = useRef(false);
  const progressMapRef = useRef<Map<string, number>>(new Map());
  const uiTimerRef = useRef<NodeJS.Timeout | null>(null);
  const completedCountRef = useRef(0);
  const uploadStartTimeRef = useRef(0);
  const totalFilesRef = useRef(0);
  const pendingDbWrites = useRef<Array<{file_name: string, s3_url: string, file_size: number, content_type: string}>>([]);
  const dbWriteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const getBatchUrls = async (files: FileUploadStatus[]): Promise<Map<string, {url: string, key: string}>> => {
    const filesData = files.map(f => ({
      name: f.file.name,
      type: f.file.type,
      size: f.file.size
    }));

    const response = await fetch(DIRECT_UPLOAD_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: JSON.stringify({
        action: 'batch-urls',
        files: filesData
      })
    });

    if (!response.ok) throw new Error('Failed to get upload URLs');

    const data = await response.json();
    const urlMap = new Map<string, {url: string, key: string}>();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.uploads.forEach((upload: any) => {
      urlMap.set(upload.filename, {
        url: upload.url,
        key: upload.key
      });
    });

    return urlMap;
  };

  const startUiUpdater = () => {
    if (uiTimerRef.current) return;
    uiTimerRef.current = setInterval(() => {
      setFiles(() => {
        return [...filesRef.current];
      });
      
      const elapsed = Date.now() - uploadStartTimeRef.current;
      const completed = completedCountRef.current;
      const total = totalFilesRef.current;
      const avgTimePerFile = completed > 0 ? elapsed / completed : 0;
      const remaining = total - completed;
      const estimatedTimeRemaining = remaining > 0 && avgTimePerFile > 0 
        ? Math.round(avgTimePerFile * remaining / 1000) 
        : 0;
      
      setUploadStats({
        startTime: uploadStartTimeRef.current,
        completedFiles: completed,
        totalFiles: total,
        estimatedTimeRemaining
      });
    }, UI_UPDATE_INTERVAL);
  };

  const stopUiUpdater = () => {
    if (uiTimerRef.current) {
      clearInterval(uiTimerRef.current);
      uiTimerRef.current = null;
    }
  };

  const flushDbWrites = useCallback(async (folderId: number, onPhotoAdded?: () => void) => {
    const writes = pendingDbWrites.current.splice(0);
    if (writes.length === 0) return;

    try {
      const response = await fetch(PHOTOBANK_FOLDERS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          action: 'upload_photos_batch',
          folder_id: folderId,
          photos: writes
        }),
      });

      if (response.ok) {
        console.log(`[CAMERA_UPLOAD] Batch DB write: ${writes.length} photos`);
        if (onPhotoAdded) onPhotoAdded();
      } else {
        for (const photo of writes) {
          fetch(PHOTOBANK_FOLDERS_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId,
            },
            body: JSON.stringify({
              action: 'upload_photo',
              folder_id: folderId,
              ...photo
            }),
          }).catch(() => {});
        }
        if (onPhotoAdded) onPhotoAdded();
      }
    } catch {
      console.error('[CAMERA_UPLOAD] Batch DB write failed');
    }
  }, [userId]);

  const scheduleDbWrite = (folderId: number, photo: {file_name: string, s3_url: string, file_size: number, content_type: string}, onPhotoAdded?: () => void) => {
    pendingDbWrites.current.push(photo);
    
    if (dbWriteTimerRef.current) {
      clearTimeout(dbWriteTimerRef.current);
    }
    
    if (pendingDbWrites.current.length >= 10) {
      flushDbWrites(folderId, onPhotoAdded);
    } else {
      dbWriteTimerRef.current = setTimeout(() => {
        flushDbWrites(folderId, onPhotoAdded);
      }, 2000);
    }
  };

  const uploadFile = async (fileStatus: FileUploadStatus, uploadUrl?: string, s3Key?: string, retryAttempt: number = 0, onPhotoAdded?: () => void): Promise<void> => {
    const { file } = fileStatus;
    const abortController = new AbortController();
    abortControllersRef.current.set(file.name, abortController);

    try {
      const idx = filesRef.current.findIndex(f => f.file.name === file.name);
      if (idx >= 0) {
        filesRef.current[idx] = { 
          ...filesRef.current[idx], 
          status: retryAttempt > 0 ? 'retrying' : 'uploading', 
          progress: 0, 
          retryCount: retryAttempt 
        };
      }

      if (!navigator.onLine) {
        throw new Error('Нет подключения к интернету');
      }

      let url = uploadUrl;
      let key = s3Key;
      
      if (!url || !key) {
        const urlResponse = await fetch(
          `${MOBILE_UPLOAD_API}?action=get-url&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
          {
            headers: { 'X-User-Id': userId },
            signal: abortController.signal,
          }
        );

        if (!urlResponse.ok) throw new Error('Failed to get upload URL');
        
        const urlData = await urlResponse.json();
        url = urlData.url;
        key = urlData.key;
      }

      const xhr = new XMLHttpRequest();
      let lastProgressUpdate = 0;
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const now = Date.now();
          if (now - lastProgressUpdate < 500 && e.loaded < e.total) return;
          lastProgressUpdate = now;
          
          const progress = Math.min(99, (e.loaded / e.total) * 100);
          progressMapRef.current.set(file.name, progress);
          
          const idx2 = filesRef.current.findIndex(f => f.file.name === file.name);
          if (idx2 >= 0) {
            filesRef.current[idx2] = { ...filesRef.current[idx2], progress };
          }
        }
      });

      await new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.open('PUT', url!);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const folderId = (window as any).__photobankTargetFolderId;
      if (folderId && key) {
        const s3Url = `https://storage.yandexcloud.net/foto-mix/${key}`;
        scheduleDbWrite(folderId, {
          file_name: file.name,
          s3_url: s3Url,
          file_size: file.size,
          content_type: file.type
        }, onPhotoAdded);
      }

      const idx2 = filesRef.current.findIndex(f => f.file.name === file.name);
      if (idx2 >= 0) {
        filesRef.current[idx2] = { ...filesRef.current[idx2], status: 'success', progress: 100, s3_key: key };
      }
      completedCountRef.current++;
      progressMapRef.current.delete(file.name);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.name === 'AbortError') {
        const idx2 = filesRef.current.findIndex(f => f.file.name === file.name);
        if (idx2 >= 0) {
          filesRef.current[idx2] = { ...filesRef.current[idx2], status: 'error', error: 'Отменено' };
        }
      } else {
        const isNetworkError = error.message.includes('Network') || 
                               error.message.includes('интернет') || 
                               !navigator.onLine;
        
        if (isNetworkError && retryAttempt < MAX_RETRIES) {
          console.log(`[CAMERA_UPLOAD] Retry ${retryAttempt + 1}/${MAX_RETRIES} for ${file.name}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          await uploadFile(fileStatus, uploadUrl, s3Key, retryAttempt + 1, onPhotoAdded);
        } else {
          const idx2 = filesRef.current.findIndex(f => f.file.name === file.name);
          if (idx2 >= 0) {
            filesRef.current[idx2] = { ...filesRef.current[idx2], status: 'error', error: isNetworkError ? 'Ошибка сети' : error.message };
          }
        }
      }
    } finally {
      abortControllersRef.current.delete(file.name);
    }
  };

  const retryFailedUploads = async () => {
    const failedFiles = filesRef.current.filter(f => f.status === 'error');
    if (failedFiles.length === 0) return;

    console.log('[CAMERA_UPLOAD] Retrying failed uploads:', failedFiles.length);
    
    for (let i = 0; i < failedFiles.length; i += PARALLEL_LIMIT) {
      const batch = failedFiles.slice(i, i + PARALLEL_LIMIT);
      await Promise.all(batch.map(f => uploadFile(f)));
    }
  };

  const handleUploadProcess = async (
    folderMode: 'new' | 'existing',
    folderName: string,
    selectedFolderId: number | null,
    onUploadComplete?: () => void,
    onOpenChange?: (open: boolean) => void
  ) => {
    try {
      cancelledRef.current = false;
      completedCountRef.current = 0;
      pendingDbWrites.current = [];
      const pendingFiles = filesRef.current.filter(f => (f.status === 'pending' || f.status === 'error') && f.status !== 'skipped');
      console.log('[CAMERA_UPLOAD] Pending files to upload:', pendingFiles.length);

      let targetFolderId: number;

      if (folderMode === 'new') {
        const createFolderResponse = await fetch(PHOTOBANK_FOLDERS_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId,
          },
          body: JSON.stringify({
            action: 'create_folder',
            folder_name: folderName.trim(),
          }),
        });

        if (!createFolderResponse.ok) {
          throw new Error('Не удалось создать папку');
        }

        const folderData = await createFolderResponse.json();
        targetFolderId = folderData.folder.id;
      } else {
        targetFolderId = selectedFolderId!;
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__photobankTargetFolderId = targetFolderId;

      // Проверяем дубликаты параллельно с получением URL
      const duplicateCheckPromise = fetch(
        `${PHOTOBANK_FOLDERS_API}?action=check_duplicates&folder_id=${targetFolderId}`,
        { headers: { 'X-User-Id': userId } }
      ).then(async res => {
        if (res.ok) {
          const { existing_files } = await res.json();
          return new Set<string>(existing_files);
        }
        return new Set<string>();
      }).catch(() => new Set<string>());

      // Получаем ВСЕ URL параллельно одним запросом (до 100 файлов)
      const urlBatches: Promise<Map<string, {url: string, key: string}>>[] = [];
      for (let i = 0; i < pendingFiles.length; i += URL_BATCH_SIZE) {
        const batch = pendingFiles.slice(i, i + URL_BATCH_SIZE);
        urlBatches.push(getBatchUrls(batch));
      }

      const [existingSet, ...urlMaps] = await Promise.all([duplicateCheckPromise, ...urlBatches]);

      // Применяем дубликаты
      let filesToUpload = pendingFiles;
      if (existingSet.size > 0) {
        filesToUpload = pendingFiles.filter(f => !existingSet.has(f.file.name));
        const skippedCount = pendingFiles.length - filesToUpload.length;
        
        if (skippedCount > 0) {
          toast.info(`Пропущено ${skippedCount} дубликатов`);
          for (const f of filesRef.current) {
            if (existingSet.has(f.file.name)) {
              const idx = filesRef.current.indexOf(f);
              if (idx >= 0) filesRef.current[idx] = { ...f, status: 'skipped' as const };
            }
          }
          setFiles([...filesRef.current]);
        }
        
        if (filesToUpload.length === 0) {
          toast.success('Все файлы уже загружены');
          if (onUploadComplete) onUploadComplete();
          if (onOpenChange) onOpenChange(false);
          return;
        }
      }

      // Объединяем все URL в одну карту
      const allUrls = new Map<string, {url: string, key: string}>();
      for (const urlMap of urlMaps) {
        for (const [k, v] of urlMap) {
          allUrls.set(k, v);
        }
      }

      totalFilesRef.current = filesToUpload.length;
      uploadStartTimeRef.current = Date.now();
      
      setUploadStats({
        startTime: Date.now(),
        completedFiles: 0,
        totalFiles: filesToUpload.length,
        estimatedTimeRemaining: 0
      });

      startUiUpdater();
      
      console.log(`[CAMERA_UPLOAD] TURBO: ${PARALLEL_LIMIT} параллельных потоков, ${filesToUpload.length} файлов`);
      
      const refreshGallery = onUploadComplete ? () => {
        onUploadComplete();
      } : undefined;

      // Загружаем параллельно по PARALLEL_LIMIT
      for (let i = 0; i < filesToUpload.length; i += PARALLEL_LIMIT) {
        if (cancelledRef.current) break;
        
        const chunk = filesToUpload.slice(i, i + PARALLEL_LIMIT);
        const promises = chunk.map(fileStatus => {
          const urlInfo = allUrls.get(fileStatus.file.name);
          if (!urlInfo) {
            return uploadFile(fileStatus, undefined, undefined, 0, refreshGallery);
          }
          return uploadFile(fileStatus, urlInfo.url, urlInfo.key, 0, refreshGallery);
        });
        await Promise.all(promises);
      }
      
      stopUiUpdater();
      
      if (cancelledRef.current) {
        console.log('[CAMERA_UPLOAD] Upload cancelled');
        return;
      }

      // Финальный flush записей в БД
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const folderId = (window as any).__photobankTargetFolderId;
      if (folderId) {
        await flushDbWrites(folderId, refreshGallery);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__photobankTargetFolderId;

      // Финальное обновление UI
      setFiles([...filesRef.current]);

      const successfulUploads = filesRef.current.filter(f => f.status === 'success');

      if (successfulUploads.length > 0) {
        toast.success(`Загружено ${successfulUploads.length} файлов`);
        
        if (onUploadComplete) {
          onUploadComplete();
        }

        setFiles([]);
        filesRef.current = [];
        if (onOpenChange) {
          onOpenChange(false);
        }
      } else {
        toast.error('Файлы не удалось загрузить');
      }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      stopUiUpdater();
      console.error('[CAMERA_UPLOAD] Upload error:', error);
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      stopUiUpdater();
      setUploading(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (uploading && filesRef.current.some(f => f.status === 'error')) {
        toast.info('Интернет восстановлен, продолжаем загрузку...');
        retryFailedUploads();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Нет интернета. Загрузка возобновится автоматически.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploading]);

  const cancelUpload = () => {
    cancelledRef.current = true;
    stopUiUpdater();
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
    
    for (let i = 0; i < filesRef.current.length; i++) {
      if (filesRef.current[i].status === 'uploading' || filesRef.current[i].status === 'retrying') {
        filesRef.current[i] = { ...filesRef.current[i], status: 'error', error: 'Отменено' };
      }
    }
    setFiles([...filesRef.current]);
    setUploading(false);
  };

  return {
    isOnline,
    uploadStats,
    handleUploadProcess,
    cancelUpload,
  };
};