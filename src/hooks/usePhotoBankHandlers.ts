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
  s3_url: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

export const usePhotoBankHandlers = (
  userId: string,
  PHOTO_BANK_API: string,
  selectedFolder: PhotoFolder | null,
  photos: Photo[],
  selectedPhotos: Set<number>,
  folderName: string,
  setFolderName: (name: string) => void,
  setShowCreateFolder: (show: boolean) => void,
  setShowClearConfirm: (show: boolean) => void,
  setUploading: (uploading: boolean) => void,
  setUploadProgress: (progress: { current: number; total: number }) => void,
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
      const res = await fetch(PHOTO_BANK_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'create_folder',
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
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать папку',
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

    setUploading(true);
    setUploadProgress({ current: 0, total: imageFiles.length });
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        console.log(`[UPLOAD] Processing file ${i + 1}/${imageFiles.length}:`, file.name);
        try {
          const base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
          });
          console.log(`[UPLOAD] File ${file.name} encoded, size: ${base64Data.length} chars`);

          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = `data:${file.type};base64,${base64Data}`;
          });
          console.log(`[UPLOAD] Image dimensions: ${img.width}x${img.height}`);

          const res = await fetch(PHOTO_BANK_API, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': userId
            },
            body: JSON.stringify({
              action: 'upload_photo',
              folder_id: selectedFolder.id,
              file_name: file.name,
              file_data: base64Data,
              width: img.width,
              height: img.height
            })
          });

          console.log(`[UPLOAD] Response status: ${res.status}`);
          if (res.ok) {
            const data = await res.json();
            console.log(`[UPLOAD] Success:`, data);
            successCount++;
          } else {
            const errorData = await res.json();
            console.error(`[UPLOAD] Failed:`, errorData);
            errorCount++;
          }
        } catch (err) {
          console.error(`[UPLOAD] Error uploading ${file.name}:`, err);
          errorCount++;
        }
        setUploadProgress({ current: i + 1, total: imageFiles.length });
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
      setUploadProgress({ current: 0, total: 0 });
      e.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: number, fileName: string) => {
    if (!confirm(`Удалить фото ${fileName}?`)) return;

    try {
      await fetch(PHOTO_BANK_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'delete_photo',
          photo_id: photoId
        })
      });

      toast({
        title: 'Успешно',
        description: `Фото ${fileName} удалено`
      });

      if (selectedFolder) {
        fetchPhotos(selectedFolder.id);
        fetchFolders();
        fetchStorageUsage();
      }
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить фото',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteFolder = async (folderId: number, folderName: string) => {
    if (!confirm(`Удалить папку "${folderName}" со всеми фотографиями?`)) return;

    try {
      await fetch(PHOTO_BANK_API, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          action: 'delete_folder',
          folder_id: folderId
        })
      });

      toast({
        title: 'Успешно',
        description: `Папка "${folderName}" удалена`
      });

      if (selectedFolder?.id === folderId) {
        setSelectedFolder(null);
        setPhotos([]);
      }
      fetchFolders();
      fetchStorageUsage();
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить папку',
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
      url: p.s3_url,
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
    handleDeletePhoto,
    handleDeleteFolder,
    handleClearAll,
    togglePhotoSelection,
    handleAddToPhotobook
  };
};
