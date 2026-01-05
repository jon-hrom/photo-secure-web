import { useEffect, useCallback } from 'react';

interface PhotoBankEffectsProps {
  userId: string | null;
  authChecking: boolean;
  selectedFolder: any;
  photos: any[];
  folders: any[];
  selectionMode: boolean;
  fetchFolders: () => void;
  fetchPhotos: (folderId: number) => void;
  fetchStorageUsage: () => void;
  setSelectedFolder: (folder: any) => void;
  setSelectionMode: (mode: boolean) => void;
  navigation: any;
}

export const usePhotoBankEffects = ({
  userId,
  authChecking,
  selectedFolder,
  photos,
  folders,
  selectionMode,
  fetchFolders,
  fetchPhotos,
  fetchStorageUsage,
  setSelectedFolder,
  setSelectionMode,
  navigation,
}: PhotoBankEffectsProps) => {
  
  // Загрузка данных при монтировании
  useEffect(() => {
    if (!userId || authChecking) return;
    
    fetchFolders();
    fetchStorageUsage();
  }, [userId, authChecking]);

  // Загрузка фотографий при выборе папки
  useEffect(() => {
    if (selectedFolder) {
      fetchPhotos(selectedFolder.id);
    }
  }, [selectedFolder?.id]);

  // Автозакрытие пустых tech_rejects папок
  useEffect(() => {
    if (selectedFolder?.folder_type === 'tech_rejects' && photos.length === 0) {
      console.log('[PHOTO_BANK] Tech rejects folder is empty, closing it');
      setSelectedFolder(null);
      fetchFolders();
    }
  }, [selectedFolder?.folder_type, photos.length]);

  // Автообновление для RAW файлов (проверка превью каждые 10 сек)
  useEffect(() => {
    if (!selectedFolder || !photos.length) return;
    
    const hasRawWithoutThumbnail = photos.some(p => p.is_raw && !p.thumbnail_s3_url);
    if (!hasRawWithoutThumbnail) return;
    
    console.log('[PHOTO_BANK] RAW files without thumbnail detected, scheduling refresh');
    const intervalId = setInterval(() => {
      console.log('[PHOTO_BANK] Auto-refreshing photos for thumbnail updates');
      fetchPhotos(selectedFolder.id);
    }, 10000);
    
    return () => clearInterval(intervalId);
  }, [selectedFolder?.id, photos.length, photos.some(p => p.is_raw && !p.thumbnail_s3_url)]);

  // Сохранение состояния навигации
  useEffect(() => {
    if (folders.length > 0) {
      navigation.pushState({
        selectedFolderId: selectedFolder?.id || null,
        selectionMode,
      });
    }
  }, [selectedFolder?.id, selectionMode, folders.length, navigation]);

  // Обработчики навигации
  const handleGoBack = useCallback(() => {
    const prevState = navigation.goBack();
    if (prevState) {
      const folder = folders.find(f => f.id === prevState.selectedFolderId);
      setSelectedFolder(folder || null);
      setSelectionMode(prevState.selectionMode);
    }
  }, [navigation, folders, setSelectedFolder, setSelectionMode]);

  const handleGoForward = useCallback(() => {
    const nextState = navigation.goForward();
    if (nextState) {
      const folder = folders.find(f => f.id === nextState.selectedFolderId);
      setSelectedFolder(folder || null);
      setSelectionMode(nextState.selectionMode);
    }
  }, [navigation, folders, setSelectedFolder, setSelectionMode]);

  return {
    handleGoBack,
    handleGoForward,
  };
};