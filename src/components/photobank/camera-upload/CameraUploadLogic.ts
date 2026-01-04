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

  const uploadFile = async (fileStatus: FileUploadStatus, retryAttempt: number = 0): Promise<void> => {
    const { file } = fileStatus;
    const abortController = new AbortController();
    abortControllersRef.current.set(file.name, abortController);

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

      const urlResponse = await fetch(
        `${MOBILE_UPLOAD_API}?action=get-url&filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`,
        {
          headers: { 'X-User-Id': userId },
          signal: abortController.signal,
        }
      );

      if (!urlResponse.ok) throw new Error('Failed to get upload URL');
      
      const { url, key } = await urlResponse.json();

      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
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

        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      await fetch(MOBILE_UPLOAD_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: JSON.stringify({
          action: 'confirm',
          s3_key: key,
          orig_filename: file.name,
          size_bytes: file.size,
          content_type: file.type,
        }),
      });

      setFiles(prev => {
        const updated = prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: 'success', progress: 100, s3_key: key } 
            : f
        );
        filesRef.current = updated;
        
        // Обновляем статистику с debounce (300ms) чтобы избежать дергания
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
        }, 300);
        
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
          await uploadFile(fileStatus, retryAttempt + 1);
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
      
      for (let i = 0; i < pendingFiles.length; i += MAX_CONCURRENT_UPLOADS) {
        if (cancelledRef.current) {
          console.log('[CAMERA_UPLOAD] Upload cancelled by user');
          break;
        }
        const batch = pendingFiles.slice(i, i + MAX_CONCURRENT_UPLOADS);
        await Promise.all(batch.map(uploadFile));
      }
      
      if (cancelledRef.current) {
        console.log('[CAMERA_UPLOAD] Upload process stopped due to cancellation');
        return;
      }

      const successfulUploads = filesRef.current.filter(f => f.status === 'success');
      console.log('[CAMERA_UPLOAD] Successful uploads:', successfulUploads.length, successfulUploads);

      if (successfulUploads.length > 0) {
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

        console.log('[CAMERA_UPLOAD] Adding photos to folder:', targetFolderId, 'count:', successfulUploads.length);
        
        // Используем batch API для ускорения добавления фото в БД
        for (let i = 0; i < successfulUploads.length; i += BATCH_SIZE) {
          const batch = successfulUploads.slice(i, i + BATCH_SIZE);
          const photos = batch
            .filter(f => f.s3_key)
            .map(f => ({
              file_name: f.file.name,
              s3_url: `https://storage.yandexcloud.net/foto-mix/${f.s3_key}`,
              file_size: f.file.size,
              content_type: f.file.type
            }));
          
          if (photos.length === 0) continue;
          
          console.log(`[CAMERA_UPLOAD] Sending batch ${i / BATCH_SIZE + 1}: ${photos.length} photos`);
          
          const batchResponse = await fetch(PHOTOBANK_FOLDERS_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId,
            },
            body: JSON.stringify({
              action: 'upload_photos_batch',
              folder_id: targetFolderId,
              photos: photos,
            }),
          });

          if (!batchResponse.ok) {
            const errorText = await batchResponse.text();
            console.error('[CAMERA_UPLOAD] Batch add error:', errorText);
            
            // Fallback на поштучное добавление при ошибке batch
            console.log('[CAMERA_UPLOAD] Falling back to individual uploads');
            for (const fileStatus of batch) {
              if (!fileStatus.s3_key) continue;
              
              const s3Url = `https://storage.yandexcloud.net/foto-mix/${fileStatus.s3_key}`;
              await fetch(PHOTOBANK_FOLDERS_API, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Id': userId,
                },
                body: JSON.stringify({
                  action: 'upload_photo',
                  folder_id: targetFolderId,
                  file_name: fileStatus.file.name,
                  s3_url: s3Url,
                  file_size: fileStatus.file.size,
                }),
              }).catch(err => console.error('[CAMERA_UPLOAD] Fallback error:', err));
            }
          } else {
            const result = await batchResponse.json();
            console.log(`[CAMERA_UPLOAD] Batch ${i / BATCH_SIZE + 1} added: ${result.inserted} photos`);
          }
        }

        console.log('[CAMERA_UPLOAD] Upload complete!');
        toast.success(`Загружено ${successfulUploads.length} файлов в папку "${folderName}"`);
        
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