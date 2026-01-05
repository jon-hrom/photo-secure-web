import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FileUploadStatus,
  MOBILE_UPLOAD_API,
  PHOTOBANK_FOLDERS_API,
  MAX_CONCURRENT_UPLOADS,
  MAX_RETRIES,
  RETRY_DELAY,
  BATCH_SIZE
} from './CameraUploadTypes';

const DIRECT_UPLOAD_API = 'https://functions.poehali.dev/145813d2-d8f3-4a2b-b38e-08583a3153da';
const URL_BATCH_SIZE = 50; // Получаем URLs пачками по 50 файлов

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
  const statsUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStatsRef = useRef({ completedFiles: 0, totalFiles: 0, startTime: 0 });
  const cancelledRef = useRef(false);

  // Получаем presigned URLs пачкой для ускорения
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
    
    data.uploads.forEach((upload: any) => {
      urlMap.set(upload.filename, {
        url: upload.url,
        key: upload.key
      });
    });

    return urlMap;
  };

  const uploadFile = async (fileStatus: FileUploadStatus, uploadUrl?: string, s3Key?: string, retryAttempt: number = 0, onPhotoAdded?: () => void): Promise<void> => {
    const { file } = fileStatus;
    const abortController = new AbortController();
    abortControllersRef.current.set(file.name, abortController);

    let lastProgressUpdate = 0;
    const PROGRESS_THROTTLE = 200; // обновляем прогресс раз в 200мс

    try {
      setFiles(prev => {
        const updated = prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: retryAttempt > 0 ? 'retrying' : 'uploading', progress: 0, retryCount: retryAttempt } 
            : f
        );
        filesRef.current = updated;
        return updated;
      });

      if (!navigator.onLine) {
        throw new Error('Нет подключения к интернету');
      }

      // Если URL не передан, получаем его (fallback на старую систему)
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
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const now = Date.now();
          // Throttling: обновляем не чаще раза в 200мс
          if (now - lastProgressUpdate < PROGRESS_THROTTLE && e.loaded < e.total) {
            return;
          }
          lastProgressUpdate = now;
          
          const progress = Math.min(99, (e.loaded / e.total) * 100); // макс 99% до завершения
          
          setFiles(prev => {
            const updated = prev.map(f => 
              f.file.name === file.name ? { ...f, progress } : f
            );
            filesRef.current = updated;
            return updated;
          });
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

      // Confirm запрос НЕ нужен при использовании новой системы - файлы добавляются в БД пачкой после всех загрузок

      setFiles(prev => {
        const updated = prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: 'success', progress: 100, s3_key: key } 
            : f
        );
        filesRef.current = updated;

        // Сразу добавляем файл в БД после успешной загрузки
        const folderId = (window as any).__photobankTargetFolderId;
        if (folderId && key) {
          const s3Url = `https://storage.yandexcloud.net/foto-mix/${key}`;
          fetch(PHOTOBANK_FOLDERS_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId,
            },
            body: JSON.stringify({
              action: 'upload_photo',
              folder_id: folderId,
              file_name: file.name,
              s3_url: s3Url,
              file_size: file.size,
              content_type: file.type
            }),
          })
            .then(async res => {
              if (res.ok) {
                const data = await res.json();
                if (!data.skipped) {
                  console.log(`[CAMERA_UPLOAD] Photo ${file.name} added to folder ${folderId}`);
                  // Обновляем галерею после добавления каждого фото
                  if (onPhotoAdded) {
                    onPhotoAdded();
                  }
                } else {
                  console.log(`[CAMERA_UPLOAD] Photo ${file.name} skipped - already exists`);
                }
              } else {
                console.error(`[CAMERA_UPLOAD] Failed to add photo ${file.name} to DB`);
              }
            })
            .catch(err => console.error('[CAMERA_UPLOAD] DB add error:', err));
        }
        
        // Обновляем статистику с debounce (500ms) чтобы избежать дергания
        const actualCompleted = updated.filter(f => f.status === 'success').length;
        pendingStatsRef.current.completedFiles = actualCompleted;
        
        if (statsUpdateTimerRef.current) {
          clearTimeout(statsUpdateTimerRef.current);
        }
        
        statsUpdateTimerRef.current = setTimeout(() => {
          setUploadStats(stats => {
            const elapsed = Date.now() - stats.startTime;
            const avgTimePerFile = pendingStatsRef.current.completedFiles > 0 
              ? elapsed / pendingStatsRef.current.completedFiles 
              : 0;
            const remaining = stats.totalFiles - pendingStatsRef.current.completedFiles;
            const estimatedTimeRemaining = remaining > 0 && avgTimePerFile > 0 
              ? Math.round(avgTimePerFile * remaining / 1000) 
              : 0;
            
            return {
              ...stats,
              completedFiles: pendingStatsRef.current.completedFiles,
              estimatedTimeRemaining
            };
          });
        }, 500); // Увеличено с 300 до 500мс для плавности
        
        return updated;
      });

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setFiles(prev => {
          const updated = prev.map(f => 
            f.file.name === file.name 
              ? { ...f, status: 'error', error: 'Отменено' } 
              : f
          );
          filesRef.current = updated;
          return updated;
        });
      } else {
        const isNetworkError = error.message.includes('Network') || 
                               error.message.includes('интернет') || 
                               !navigator.onLine;
        
        if (isNetworkError && retryAttempt < MAX_RETRIES) {
          console.log(`[CAMERA_UPLOAD] Retry ${retryAttempt + 1}/${MAX_RETRIES} for ${file.name}`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          await uploadFile(fileStatus, uploadUrl, s3Key, retryAttempt + 1, onPhotoAdded);
        } else {
          setFiles(prev => {
            const updated = prev.map(f => 
              f.file.name === file.name 
                ? { ...f, status: 'error', error: isNetworkError ? 'Ошибка сети' : error.message } 
                : f
            );
            filesRef.current = updated;
            return updated;
          });
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
    
    for (let i = 0; i < failedFiles.length; i += MAX_CONCURRENT_UPLOADS) {
      const batch = failedFiles.slice(i, i + MAX_CONCURRENT_UPLOADS);
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
      const pendingFiles = filesRef.current.filter(f => (f.status === 'pending' || f.status === 'error') && f.status !== 'skipped');
      console.log('[CAMERA_UPLOAD] Pending files to upload:', pendingFiles.length);

      // Создаем папку ДО начала загрузки, чтобы сразу добавлять файлы
      let targetFolderId: number;

      if (folderMode === 'new') {
        console.log('[CAMERA_UPLOAD] Creating folder:', folderName.trim());
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
          const errorText = await createFolderResponse.text();
          console.error('[CAMERA_UPLOAD] Create folder error:', errorText);
          throw new Error('Не удалось создать папку');
        }

        const folderData = await createFolderResponse.json();
        console.log('[CAMERA_UPLOAD] Folder created:', folderData);
        targetFolderId = folderData.folder.id;
      } else {
        targetFolderId = selectedFolderId!;
      }
      
      // Сохраняем ID папки для использования в uploadFile
      (window as any).__photobankTargetFolderId = targetFolderId;

      // Инициализируем статистику
      setUploadStats({
        startTime: Date.now(),
        completedFiles: 0,
        totalFiles: pendingFiles.length,
        estimatedTimeRemaining: 0
      });
      pendingStatsRef.current = {
        completedFiles: 0,
        totalFiles: pendingFiles.length,
        startTime: Date.now()
      };
      
      // ПОСЛЕДОВАТЕЛЬНАЯ ЗАГРУЗКА: по одному файлу за раз для стабильной скорости
      console.log('[CAMERA_UPLOAD] 🚀 НОВАЯ ВЕРСИЯ - ПОСЛЕДОВАТЕЛЬНАЯ ЗАГРУЗКА (1 файл за раз)');
      console.log('[CAMERA_UPLOAD] Version: 2025-01-04-SEQUENTIAL');
      
      for (let urlBatchStart = 0; urlBatchStart < pendingFiles.length; urlBatchStart += URL_BATCH_SIZE) {
        if (cancelledRef.current) break;
        
        const urlBatch = pendingFiles.slice(urlBatchStart, urlBatchStart + URL_BATCH_SIZE);
        console.log(`[CAMERA_UPLOAD] Fetching URLs for ${urlBatch.length} files...`);
        
        let urlMap: Map<string, {url: string, key: string}>;
        try {
          urlMap = await getBatchUrls(urlBatch);
          console.log(`[CAMERA_UPLOAD] Got ${urlMap.size} URLs`);
        } catch (error) {
          console.error('[CAMERA_UPLOAD] Batch URL fetch failed, falling back to individual requests:', error);
          // Fallback: загружаем последовательно без batch URLs
          for (const fileStatus of urlBatch) {
            if (cancelledRef.current) break;
            await uploadFile(fileStatus, undefined, undefined, 0, onUploadComplete);
          }
          continue;
        }
        
        // Загружаем файлы ПОСЛЕДОВАТЕЛЬНО - по одному
        for (const fileStatus of urlBatch) {
          if (cancelledRef.current) break;
          
          const urlInfo = urlMap.get(fileStatus.file.name);
          if (!urlInfo) {
            console.error(`[CAMERA_UPLOAD] No URL for ${fileStatus.file.name}, skipping`);
            continue;
          }
          await uploadFile(fileStatus, urlInfo.url, urlInfo.key, 0, onUploadComplete);
        }
      }
      
      if (cancelledRef.current) {
        console.log('[CAMERA_UPLOAD] Upload process stopped due to cancellation');
        return;
      }

      // Очищаем временный ID папки
      delete (window as any).__photobankTargetFolderId;

      const successfulUploads = filesRef.current.filter(f => f.status === 'success');
      console.log('[CAMERA_UPLOAD] Upload process finished. Successful uploads:', successfulUploads.length);

      if (successfulUploads.length > 0) {
        console.log('[CAMERA_UPLOAD] Upload complete!');
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
        console.log('[CAMERA_UPLOAD] No successful uploads');
        toast.error('Файлы не удалось загрузить');
      }

    } catch (error: any) {
      console.error('[CAMERA_UPLOAD] Upload error:', error);
      toast.error(`Ошибка: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      console.log('[CAMERA_UPLOAD] Network online');
      setIsOnline(true);
      if (uploading && filesRef.current.some(f => f.status === 'error')) {
        toast.info('Интернет восстановлен, продолжаем загрузку...');
        retryFailedUploads();
      }
    };
    
    const handleOffline = () => {
      console.log('[CAMERA_UPLOAD] Network offline');
      setIsOnline(false);
      toast.error('Нет интернета. Загрузка возобновится автоматически.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [uploading]);

  const cancelUpload = () => {
    cancelledRef.current = true;
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
    
    if (statsUpdateTimerRef.current) {
      clearTimeout(statsUpdateTimerRef.current);
      statsUpdateTimerRef.current = null;
    }
  };
  
  return {
    isOnline,
    uploadFile,
    retryFailedUploads,
    handleUploadProcess,
    abortControllersRef,
    uploadStats,
    cancelUpload
  };
};