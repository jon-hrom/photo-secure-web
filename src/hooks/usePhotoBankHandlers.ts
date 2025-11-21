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
  fetchStorageUsage: () => Promise<void>
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

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast({
        title: 'Ошибка',
        description: 'Можно загружать только изображения',
        variant: 'destructive'
      });
      return;
    }

    // Check file size limit (50 MB)
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    const tooLargeFiles = imageFiles.filter(file => file.size > MAX_FILE_SIZE);
    if (tooLargeFiles.length > 0) {
      toast({
        title: 'Файлы слишком большие',
        description: `Максимальный размер файла: 50 МБ. Слишком большие файлы: ${tooLargeFiles.map(f => f.name).join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setUploading(true);
    setUploadCancelled(false);
    setUploadProgress({ current: 0, total: imageFiles.length, percent: 0, currentFileName: '' });
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        if (uploadCancelled) {
          console.log('[UPLOAD] Cancelled by user');
          break;
        }

        const file = imageFiles[i];
        const percent = Math.round(((i) / imageFiles.length) * 100);
        setUploadProgress({ 
          current: i, 
          total: imageFiles.length, 
          percent,
          currentFileName: file.name 
        });
        console.log(`[UPLOAD] Processing file ${i + 1}/${imageFiles.length}:`, file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        try {
          // Load image to get dimensions
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            const reader = new FileReader();
            reader.onload = (e) => {
              image.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
          });
          console.log(`[UPLOAD] Original dimensions: ${img.width}x${img.height}`);

          const width = img.width;
          const height = img.height;

          console.log(`[UPLOAD] Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
          
          // Cloud Functions limit is ~3.5 MB after base64 encoding (~2.6 MB original)
          const MAX_SIZE_FOR_DIRECT = 2.5 * 1024 * 1024;
          let base64Data: string;
          const finalWidth = width;
          const finalHeight = height;
          
          if (file.size > MAX_SIZE_FOR_DIRECT) {
            console.log(`[UPLOAD] File too large for direct upload, compressing smartly...`);
            const canvas = document.createElement('canvas');
            
            // Сохраняем высокое разрешение, но сжимаем качество
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            // Пробуем разные уровни качества, пока не получим приемлемый размер
            let quality = 0.85;
            let blob: Blob;
            
            do {
              blob = await new Promise<Blob>((resolve) => {
                canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality);
              });
              console.log(`[UPLOAD] Quality ${quality}: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
              
              if (blob.size <= MAX_SIZE_FOR_DIRECT) break;
              quality -= 0.05;
            } while (quality > 0.5);
            
            console.log(`[UPLOAD] Compressed: ${(file.size / 1024 / 1024).toFixed(2)} MB -> ${(blob.size / 1024 / 1024).toFixed(2)} MB at quality ${quality}`);
            
            const reader = new FileReader();
            base64Data = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } else {
            console.log(`[UPLOAD] File size OK, uploading original`);
            const reader = new FileReader();
            base64Data = await new Promise<string>((resolve) => {
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
          }

          console.log(`[UPLOAD] Uploading to backend...`);
          const res = await fetch(PHOTOBANK_FOLDERS_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId
            },
            body: JSON.stringify({
              action: 'upload_direct',
              folder_id: selectedFolder.id,
              file_name: file.name,
              file_data: base64Data,
              width: Math.round(finalWidth),
              height: Math.round(finalHeight)
            })
          });

          console.log(`[UPLOAD] Response status: ${res.status}`);
          if (res.ok) {
            const data = await res.json();
            console.log(`[UPLOAD] Success:`, data);
            successCount++;
          } else if (res.status === 403) {
            const errorData = await res.json();
            if (errorData.requireEmailVerification) {
              toast({
                title: 'Подтвердите email',
                description: 'Для загрузки фото необходимо подтвердить адрес электронной почты',
                variant: 'destructive'
              });
              setUploading(false);
              return;
            }
            errorCount++;
          } else {
            const errorText = await res.text();
            console.error(`[UPLOAD] Failed with status ${res.status}:`, errorText);
            try {
              const errorData = JSON.parse(errorText);
              console.error(`[UPLOAD] Error details:`, errorData);
            } catch (e) {
              console.error(`[UPLOAD] Raw error response:`, errorText);
            }
            errorCount++;
          }
        } catch (err) {
          console.error(`[UPLOAD] Error uploading ${file.name}:`, err);
          errorCount++;
        }
        const newPercent = Math.round(((i + 1) / imageFiles.length) * 100);
        setUploadProgress({ 
          current: i + 1, 
          total: imageFiles.length, 
          percent: newPercent,
          currentFileName: i + 1 < imageFiles.length ? imageFiles[i + 1].name : '' 
        });
      }

      if (successCount > 0) {
        toast({
          title: 'Успешно',
          description: `Загружено ${successCount} фото${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`
        });
        fetchPhotos(selectedFolder.id);
        fetchFolders();
        fetchStorageUsage();
      } else {
        toast({
          title: 'Ошибка',
          description: 'Не удалось загрузить фото',
          variant: 'destructive'
        });
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