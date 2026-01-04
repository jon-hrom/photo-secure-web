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
    let uploadedBytes = 0;

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
            const progress = (e.loaded / e.total) * 100;
            uploadedBytes = e.loaded;
            
            // Вычисляем скорость загрузки
            const elapsed = (Date.now() - startTime) / 1000; // секунды
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
              
              // Обновляем статистику
              setUploadStats(prev => {
                const newCompleted = prev.completedFiles + 1;
                const elapsed = (Date.now() - startTime) / 1000;
                const avgTimePerFile = elapsed / newCompleted;
                const remaining = prev.totalFiles - newCompleted;
                const estimatedTimeRemaining = Math.round(avgTimePerFile * remaining);
                
                // Средняя скорость всех файлов
                const avgSpeed = filesRef.current
                  .filter(f => f.uploadSpeed && f.uploadSpeed > 0)
                  .reduce((sum, f) => sum + (f.uploadSpeed || 0), 0) / newCompleted;

                return {
                  ...prev,
                  completedFiles: newCompleted,
                  estimatedTimeRemaining,
                  uploadSpeed: avgSpeed
                };
              });
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
