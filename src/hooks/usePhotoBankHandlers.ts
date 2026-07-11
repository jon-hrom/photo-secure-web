import { useToast } from '@/hooks/use-toast';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
  is_video?: boolean;
  content_type?: string;
  thumbnail_s3_url?: string;
}

export const usePhotoBankHandlers = (
  userId: string,
  PHOTOBANK_FOLDERS_API: string,
  PHOTOBANK_TRASH_API: string,
  selectedFolder: PhotoFolder | null,
  photos: Photo[],
  selectedPhotos: Set<number>,
  folderName: string,
  setFolderName: (name: string) => void,
  setShowCreateFolder: (show: boolean) => void,
  setShowClearConfirm: (show: boolean) => void,
  setUploading: (uploading: boolean) => void,
  setUploadProgress: (progress: { current: number; total: number; percent: number; currentFileName: string }) => void,
  uploadCancelled: boolean,
  setUploadCancelled: (cancelled: boolean) => void,
  setSelectedFolder: (folder: PhotoFolder | null) => void,
  setPhotos: (photos: Photo[]) => void,
  setSelectedPhotos: (photos: Set<number>) => void,
  setSelectionMode: (mode: boolean) => void,
  fetchFolders: () => Promise<void>,
  fetchPhotos: (folderId: number) => Promise<void>,
  fetchStorageUsage: () => Promise<void>,
  storageUsage: { usedGb: number; limitGb: number; percent: number }
) => {
  const { toast } = useToast();

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название папки',
        variant: 'destructive'
      });
      return;
    }

    try {
      const res = await fetch(PHOTOBANK_FOLDERS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'create',
          folder_name: folderName
        })
      });

      if (res.ok) {
        toast({
          title: 'Успешно',
          description: `Папка "${folderName}" создана`
        });
        setFolderName('');
        setShowCreateFolder(false);
        fetchFolders();
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create folder');
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать папку',
        variant: 'destructive'
      });
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (storageUsage.percent >= 100) {
      toast({
        title: 'Хранилище заполнено',
        description: 'Объём хранилища заполнен на 100%. Перейдите в Главная → Тарифы для смены тарифного плана.',
        variant: 'destructive',
        duration: 8000
      });
      e.target.value = '';
      return;
    }

    if (!selectedFolder) {
      toast({
        title: 'Ошибка',
        description: 'Выберите папку для загрузки',
        variant: 'destructive'
      });
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;

    const RAW_EXTENSIONS = ['.cr2', '.nef', '.arw', '.dng', '.raw'];
    const isRawFile = (filename: string) => {
      const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
      return RAW_EXTENSIONS.includes(ext);
    };

    const mediaFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/') || file.type.startsWith('video/') || isRawFile(file.name)
    );
    
    if (mediaFiles.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Можно загружать только изображения и видео',
        variant: 'destructive'
      });
      return;
    }

    // Проверяем дубликаты
    try {
      const checkResponse = await fetch(
        `${PHOTOBANK_FOLDERS_API}?action=check_duplicates&folder_id=${selectedFolder.id}`,
        { headers: { 'X-User-Id': userId } }
      );
      
      if (checkResponse.ok) {
        const { existing_files } = await checkResponse.json();
        const existingSet = new Set(existing_files);
        
        const filesToUpload = mediaFiles.filter(file => !existingSet.has(file.name));
        const skippedCount = mediaFiles.length - filesToUpload.length;
        
        if (filesToUpload.length === 0) {
          toast({
            title: 'Все файлы уже загружены',
            description: `Пропущено ${skippedCount} дубликатов`,
            variant: 'default'
          });
          return;
        }
        
        if (skippedCount > 0) {
          toast({
            title: `Загрузка ${filesToUpload.length} новых файлов`,
            description: `Пропущено ${skippedCount} дубликатов`
          });
        }
        
        // Продолжаем загрузку только уникальных файлов
        mediaFiles.splice(0, mediaFiles.length, ...filesToUpload);
      }
    } catch (error) {
      console.error('Failed to check duplicates:', error);
      // Продолжаем без проверки дубликатов
    }

    // Лимит размера фото поднят до 500 МБ (загрузка идёт напрямую в S3,
    // ограничения base64 больше нет). Видео — без лимита.
    const MAX_FILE_SIZE = 500 * 1024 * 1024;
    const tooLargeFiles = mediaFiles.filter(file => {
      const isVideo = file.type.startsWith('video/');
      return !isVideo && file.size > MAX_FILE_SIZE;
    });
    if (tooLargeFiles.length > 0) {
      toast({
        title: 'Файлы слишком большие',
        description: `Макс. размер для фото: 500 МБ. Файлы: ${tooLargeFiles.map(f => f.name).join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    setUploadCancelled(false);
    setUploadProgress({ current: 0, total: mediaFiles.length, percent: 0, currentFileName: '' });
    let successCount = 0;
    let errorCount = 0;

    const PARALLEL_LIMIT = 10;
    const URL_BATCH_SIZE = 50;
    const DIRECT_UPLOAD_API = 'https://functions.poehali.dev/145813d2-d8f3-4a2b-b38e-08583a3153da';
    const cancelledRef = uploadCancelled;

    // ВСЕ файлы (фото, RAW, видео) грузим напрямую в S3 через presigned URL.
    // Это убирает проблему с большими фото (9-30+ МБ): раньше обычные изображения
    // отправлялись как base64 через JSON и упирались в лимит тела запроса.
    const rawVideoIndexes: number[] = mediaFiles.map((_, idx) => idx);

    // Presigned URL кэш + ленивое (just-in-time) получение пачками.
    // КРИТИЧНО: URL живут 30 минут, поэтому НЕ получаем все сразу для 1000 файлов —
    // иначе поздние URL истекут до загрузки. Берём пачку прямо перед загрузкой.
    const presignedByIndex = new Map<number, { url: string; key: string }>();
    let urlFetchCursor = 0;
    let urlFetchPromise: Promise<void> | null = null;

    const fetchNextUrlBatch = async () => {
      const start = urlFetchCursor;
      const chunkIdx = rawVideoIndexes.slice(start, start + URL_BATCH_SIZE);
      if (chunkIdx.length === 0) return;
      urlFetchCursor = start + chunkIdx.length;
      const filesPayload = chunkIdx.map(idx => ({
        name: mediaFiles[idx].name,
        type: mediaFiles[idx].type || 'application/octet-stream',
        size: mediaFiles[idx].size,
      }));
      const urlRes = await fetch(DIRECT_UPLOAD_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ action: 'batch-urls', files: filesPayload, folder_id: selectedFolder?.id }),
      });
      if (!urlRes.ok) throw new Error('Failed to get upload URLs');
      const urlData = await urlRes.json();
      const uploads = urlData.uploads || [];
      chunkIdx.forEach((idx, j) => {
        const u = uploads[j];
        if (u) presignedByIndex.set(idx, { url: u.url, key: u.key });
      });
    };

    // Возвращает свежий presigned URL для индекса, подгружая пачку при необходимости.
    const getPresignedForIndex = async (index: number, forceRefresh = false) => {
      if (forceRefresh) presignedByIndex.delete(index);
      while (!presignedByIndex.has(index)) {
        // Защита от параллельных дублей запросов
        if (urlFetchPromise) {
          await urlFetchPromise;
          if (presignedByIndex.has(index)) break;
        }
        urlFetchPromise = (forceRefresh
          ? (async () => {
              // Точечный запрос только для этого файла (URL истёк)
              const f = mediaFiles[index];
              const res = await fetch(DIRECT_UPLOAD_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
                body: JSON.stringify({
                  action: 'batch-urls',
                  files: [{ name: f.name, type: f.type || 'application/octet-stream', size: f.size }],
                  folder_id: selectedFolder?.id,
                }),
              });
              if (!res.ok) throw new Error('Failed to refresh upload URL');
              const d = await res.json();
              const u = (d.uploads || [])[0];
              if (u) presignedByIndex.set(index, { url: u.url, key: u.key });
            })()
          : fetchNextUrlBatch());
        try {
          await urlFetchPromise;
        } finally {
          urlFetchPromise = null;
        }
        forceRefresh = false;
      }
      return presignedByIndex.get(index)!;
    };
    // Накопитель записей в БД для батч-вставки
    const pendingDbWrites: Array<{ file_name: string; s3_url: string; file_size: number; content_type: string }> = [];
    const flushDbWrites = async () => {
      if (pendingDbWrites.length === 0 || !selectedFolder) return;
      const writes = pendingDbWrites.splice(0, pendingDbWrites.length);
      // Запись метаданных в БД с повторами: файл уже в S3, потеря записи = «пропуск» в папке.
      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const res = await fetch(PHOTOBANK_FOLDERS_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
            body: JSON.stringify({
              action: 'upload_photos_batch',
              folder_id: selectedFolder.id,
              photos: writes,
            }),
          });
          if (res.ok) return;
          lastErr = new Error(`DB batch write responded ${res.status}`);
        } catch (err) {
          lastErr = err;
        }
        if (attempt < 4) await new Promise((r) => setTimeout(r, attempt * 800));
      }
      // Вернём записи в очередь, чтобы финальный flush мог попробовать ещё раз
      pendingDbWrites.unshift(...writes);
      console.error('[UPLOAD] Failed to write photo batch to DB after retries', lastErr);
      throw new Error('Failed to save photos to database');
    };

    const totalBytes = mediaFiles.reduce((sum, f) => sum + (f.size || 1), 0);
    const fileLoaded = new Map<number, number>();
    let completedCount = 0;
    let lastActiveName = '';
    let rafScheduled = false;

    const flushProgress = () => {
      rafScheduled = false;
      let loadedSum = 0;
      fileLoaded.forEach((v) => { loadedSum += v; });
      const percent = totalBytes > 0
        ? Math.min(100, Math.round((loadedSum / totalBytes) * 100))
        : 0;
      setUploadProgress({
        current: Math.min(mediaFiles.length, completedCount + 1),
        total: mediaFiles.length,
        percent,
        currentFileName: lastActiveName,
      });
    };

    const scheduleProgressUpdate = () => {
      if (rafScheduled) return;
      rafScheduled = true;
      requestAnimationFrame(flushProgress);
    };
    
    const uploadSingleFile = async (file: File, index: number) => {
      if (cancelledRef) {
        throw new Error('Upload cancelled');
      }
      
      console.log(`[UPLOAD] Processing file ${index + 1}/${mediaFiles.length}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      
      // Прямая загрузка в S3 по presigned URL — для ВСЕХ типов файлов.
      // Без base64 и без сжатия: оригинал любого размера уходит напрямую.
      const putToS3 = (uploadUrl: string) => new Promise<number>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Таймаут под размер файла: 5 мин + 2 мин на каждый ГБ.
        const sizeGb = file.size / (1024 * 1024 * 1024);
        xhr.timeout = Math.round((5 * 60 + sizeGb * 120) * 1000);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const prev = fileLoaded.get(index) || 0;
            if (e.loaded > prev) fileLoaded.set(index, e.loaded);
            lastActiveName = file.name;
            scheduleProgressUpdate();
          }
        });

        xhr.addEventListener('load', () => resolve(xhr.status));
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('timeout', () => reject(new Error('Upload timeout')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.send(file);
      });

      // Берём свежий URL (just-in-time) и грузим с повторами.
      // До 4 попыток: обрыв сети, таймаут, истёкший URL (403/400) и серверные ошибки (5xx)
      // не должны терять файл целиком — повторяем со свежим presigned URL.
      const MAX_ATTEMPTS = 4;
      let key = '';
      let lastError: unknown = null;
      let uploaded = false;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        if (cancelledRef || uploadCancelled) {
          throw new Error('Upload cancelled');
        }
        // На повторах всегда берём свежий URL (мог истечь или быть частично использован)
        const forceFresh = attempt > 1;
        try {
          const presigned = await getPresignedForIndex(index, forceFresh);
          key = presigned.key;
          fileLoaded.set(index, 0);
          const status = await putToS3(presigned.url);
          if (status >= 200 && status < 300) {
            uploaded = true;
            break;
          }
          // 403/400 — истёкший URL; 5xx — временная ошибка сервера S3: повторяем
          lastError = new Error(`S3 responded ${status}`);
        } catch (err) {
          const msg = (err as Error)?.message;
          if (msg === 'Upload cancelled' || msg === 'EMAIL_VERIFICATION_REQUIRED') {
            throw err;
          }
          lastError = err;
        }
        if (attempt < MAX_ATTEMPTS) {
          // Небольшая нарастающая пауза перед повтором (0.8с, 1.6с, 2.4с)
          await new Promise((r) => setTimeout(r, attempt * 800));
        }
      }

      if (!uploaded) {
        console.error(`[UPLOAD] File ${index + 1} (${file.name}) failed after ${MAX_ATTEMPTS} attempts`, lastError);
        throw new Error('Failed to upload file to S3');
      }

      const s3Url = `https://storage.yandexcloud.net/foto-mix/${key}`;
      pendingDbWrites.push({
        file_name: file.name,
        s3_url: s3Url,
        file_size: file.size,
        content_type: file.type || 'application/octet-stream',
      });
      if (pendingDbWrites.length >= 20) {
        // Промежуточная запись не должна ронять уже загруженный в S3 файл:
        // при неудаче записи вернутся в очередь и допишутся финальным flush.
        try {
          await flushDbWrites();
        } catch (dbErr) {
          console.warn('[UPLOAD] Промежуточная запись в БД не удалась, отложено до финала', dbErr);
        }
      }

      fileLoaded.set(index, file.size);
      completedCount++;
      scheduleProgressUpdate();
    };

    try {
      // Пул параллельных загрузок (скользящее окно) — новый файл стартует сразу, как освободился слот.
      // presigned URL берутся лениво внутри uploadSingleFile (just-in-time), чтобы они не истекали.
      let shouldStop = false;
      let nextIndex = 0;

      const worker = async () => {
        while (true) {
          if (shouldStop || uploadCancelled) return;
          const index = nextIndex++;
          if (index >= mediaFiles.length) return;
          try {
            await uploadSingleFile(mediaFiles[index], index);
            successCount++;
          } catch (err: unknown) {
            const msg = (err as Error)?.message;
            console.error(`[UPLOAD] File ${index + 1} failed:`, err);
            if (msg === 'EMAIL_VERIFICATION_REQUIRED') {
              toast({
                title: 'Подтвердите email',
                description: 'Для загрузки фото необходимо подтвердить адрес электронной почты',
                variant: 'destructive'
              });
              shouldStop = true;
              return;
            }
            if (msg === 'Upload cancelled') {
              shouldStop = true;
              return;
            }
            errorCount++;
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(PARALLEL_LIMIT, mediaFiles.length) }, () => worker())
      );

      // 3. Дописываем оставшиеся записи в БД одним батчем
      await flushDbWrites();
      flushProgress();

      if (uploadCancelled) {
        toast({
          title: 'Загрузка остановлена',
          description: `Загружено ${successCount} из ${mediaFiles.length} фото`
        });
      } else if (successCount > 0) {
        toast({
          title: 'Успешно',
          description: `Загружено ${successCount} фото${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`
        });
      } else if (errorCount > 0) {
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить фото',
          variant: 'destructive'
        });
      }
      
      if (successCount > 0) {
        fetchPhotos(selectedFolder.id);
        fetchFolders();
        fetchStorageUsage();
        // После догрузки перезагружаем страницу, чтобы гарантированно убрать
        // предупреждение о недостающих кадрах и показать актуальный список.
        if (!uploadCancelled) {
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message || 'Не удалось загрузить фото',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0, percent: 0, currentFileName: '' });
      setUploadCancelled(false);
      e.target.value = '';
    }
  };

  const handleCancelUpload = () => {
    setUploadCancelled(true);
    toast({
      title: 'Загрузка отменена',
      description: 'Загрузка файлов прервана'
    });
  };

  const handleDeletePhoto = async (photoId: number, fileName: string) => {
    if (!confirm(`Переместить фото ${fileName} в корзину?`)) return;

    try {
      const res = await fetch(`${PHOTOBANK_TRASH_API}?photo_id=${photoId}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': userId
        }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete photo');
      }

      toast({
        title: 'Успешно',
        description: `Фото ${fileName} перемещено в корзину`
      });

      if (selectedFolder) {
        fetchPhotos(selectedFolder.id);
        fetchFolders();
        fetchStorageUsage();
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить фото',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteFolder = async (folderId: number, folderName: string) => {
    if (!confirm(`Переместить папку "${folderName}" в корзину?`)) return;

    try {
      const res = await fetch(`${PHOTOBANK_FOLDERS_API}?folder_id=${folderId}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': userId
        }
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete folder');
      }

      toast({
        title: 'Успешно',
        description: `Папка "${folderName}" перемещена в корзину`
      });

      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
        setPhotos([]);
      }
      fetchFolders();
      fetchStorageUsage();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить папку',
        variant: 'destructive'
      });
    }
  };

  const handleClearAll = async () => {
    try {
      await fetch(PHOTO_BANK_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'clear_all'
        })
      });

      toast({
        title: 'Успешно',
        description: 'Весь фото банк очищен'
      });

      setSelectedFolder(null);
      setPhotos([]);
      setShowClearConfirm(false);
      fetchFolders();
      fetchStorageUsage();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось очистить банк',
        variant: 'destructive'
      });
    }
  };

  const togglePhotoSelection = (photoId: number) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleAddToPhotobook = () => {
    if (selectedPhotos.size === 0) {
      toast({
        title: 'Выберите фото',
        description: 'Отметьте фотографии для добавления в макет',
        variant: 'destructive'
      });
      return;
    }

    const selected = photos.filter(p => selectedPhotos.has(p.id));
    localStorage.setItem('photobank_selected_photos', JSON.stringify(selected.map(p => ({
      id: p.id,
      url: p.data_url,
      width: p.width,
      height: p.height,
      file_name: p.file_name
    }))));

    toast({
      title: 'Успешно',
      description: `${selectedPhotos.size} фото добавлены в макет`
    });

    setSelectedPhotos(new Set());
    setSelectionMode(false);
  };

  return {
    handleCreateFolder,
    handleUploadPhoto,
    handleCancelUpload,
    handleDeletePhoto,
    handleDeleteFolder,
    handleClearAll,
    togglePhotoSelection,
    handleAddToPhotobook
  };
};