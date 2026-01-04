import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileUploadStatus } from './CameraUploadTypes';

const DIRECT_UPLOAD_API = 'https://functions.poehali.dev/145813d2-d8f3-4a2b-b38e-08583a3153da';
const MAX_CONCURRENT_UPLOADS = 6; // Браузер обычно поддерживает 6 параллельных HTTP/2 соединений
const BATCH_SIZE = 20; // Получаем URLs пачками по 20

export const useFastUploadLogic = (
  userId: string,
  setFiles: React.Dispatch<React.SetStateAction<FileUploadStatus[]>>,
  filesRef: React.MutableRefObject<FileUploadStatus[]>
) => {
  const [uploadStats, setUploadStats] = useState({
    startTime: 0,
    completedFiles: 0,
    totalFiles: 0,
    estimatedTimeRemaining: 0,
    uploadSpeed: 0 // байт/сек
  });
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const statsUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastStatsUpdateRef = useRef(0);

  // Получаем presigned URLs пачкой
  const getBatchPresignedUrls = async (files: FileUploadStatus[]): Promise<Map<string, {url: string, key: string}>> => {
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

    if (!response.ok) {
      throw new Error('Failed to get upload URLs');
    }

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

  // Загружаем файл напрямую в S3
  const uploadFileToS3 = async (fileStatus: FileUploadStatus, uploadInfo: {url: string, key: string}): Promise<void> => {
    const { file } = fileStatus;
    const abortController = new AbortController();
    abortControllersRef.current.set(file.name, abortController);

    const startTime = Date.now();
    let lastProgressUpdate = 0;
    const PROGRESS_THROTTLE = 200; // обновляем прогресс раз в 200мс

    try {
      setFiles(prev => {
        const updated = prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: 'uploading', progress: 0 } 
            : f
        );
        filesRef.current = updated;
        return updated;
      });

      // Используем XMLHttpRequest для отслеживания прогресса
      await new Promise<void>((resolve, reject) => {
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
            const elapsed = Math.max(0.1, (now - startTime) / 1000); // минимум 0.1с
            const speed = e.loaded / elapsed; // байт/сек
            
            setFiles(prev => {
              const updated = prev.map(f => 
                f.file.name === file.name 
                  ? { ...f, progress, uploadSpeed: speed } 
                  : f
              );
              filesRef.current = updated;
              return updated;
            });
          }
        });

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.open('PUT', uploadInfo.url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Помечаем как успешно загруженный
      setFiles(prev => {
        const updated = prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: 'success', progress: 100, s3_key: uploadInfo.key } 
            : f
        );
        filesRef.current = updated;
        return updated;
      });

    } catch (error: any) {
      setFiles(prev => {
        const updated = prev.map(f => 
          f.file.name === file.name 
            ? { ...f, status: 'error', error: error.message } 
            : f
        );
        filesRef.current = updated;
        return updated;
      });
      throw error;
    } finally {
      abortControllersRef.current.delete(file.name);
    }
  };

  // Основная функция загрузки с пакетной обработкой
  const uploadFilesOptimized = async (files: FileUploadStatus[]): Promise<void> => {
    if (files.length === 0) return;

    console.log(`[FAST_UPLOAD] Starting optimized upload for ${files.length} files`);
    const startTime = Date.now();
    
    setUploadStats({
      startTime,
      completedFiles: 0,
      totalFiles: files.length,
      estimatedTimeRemaining: 0,
      uploadSpeed: 0
    });

    // Загружаем пачками
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      console.log(`[FAST_UPLOAD] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, files: ${batch.length}`);

      try {
        // Получаем URLs для всей пачки за один запрос
        const urlMap = await getBatchPresignedUrls(batch);

        // Загружаем файлы параллельно (но не больше MAX_CONCURRENT_UPLOADS одновременно)
        for (let j = 0; j < batch.length; j += MAX_CONCURRENT_UPLOADS) {
          const concurrentBatch = batch.slice(j, j + MAX_CONCURRENT_UPLOADS);
          
          const uploadPromises = concurrentBatch.map(async (fileStatus) => {
            const uploadInfo = urlMap.get(fileStatus.file.name);
            if (!uploadInfo) {
              console.error(`[FAST_UPLOAD] No URL for file: ${fileStatus.file.name}`);
              return;
            }
            
            try {
              await uploadFileToS3(fileStatus, uploadInfo);
              
              // Обновляем статистику с throttling (раз в 500мс)
              const now = Date.now();
              if (now - lastStatsUpdateRef.current >= 500) {
                lastStatsUpdateRef.current = now;
                
                setUploadStats(prev => {
                  const newCompleted = filesRef.current.filter(f => f.status === 'success').length;
                  const elapsed = (now - startTime) / 1000;
                  const avgTimePerFile = newCompleted > 0 ? elapsed / newCompleted : 0;
                  const remaining = prev.totalFiles - newCompleted;
                  const estimatedTimeRemaining = avgTimePerFile > 0 ? Math.round(avgTimePerFile * remaining) : 0;
                  
                  // Средняя скорость активных загрузок
                  const activeSpeeds = filesRef.current
                    .filter(f => f.uploadSpeed && f.uploadSpeed > 0);
                  const avgSpeed = activeSpeeds.length > 0
                    ? activeSpeeds.reduce((sum, f) => sum + (f.uploadSpeed || 0), 0) / activeSpeeds.length
                    : 0;

                  return {
                    ...prev,
                    completedFiles: newCompleted,
                    estimatedTimeRemaining,
                    uploadSpeed: avgSpeed
                  };
                });
              }
            } catch (error) {
              console.error(`[FAST_UPLOAD] Failed to upload ${fileStatus.file.name}:`, error);
            }
          });

          await Promise.all(uploadPromises);
        }
      } catch (error) {
        console.error('[FAST_UPLOAD] Batch failed:', error);
        toast.error('Ошибка получения URLs для загрузки');
      }
    }

    const elapsed = (Date.now() - startTime) / 1000;
    console.log(`[FAST_UPLOAD] Completed in ${elapsed.toFixed(2)}s`);
  };

  const cancelUpload = () => {
    abortControllersRef.current.forEach(controller => controller.abort());
    abortControllersRef.current.clear();
  };

  return {
    uploadFilesOptimized,
    uploadStats,
    cancelUpload
  };
};