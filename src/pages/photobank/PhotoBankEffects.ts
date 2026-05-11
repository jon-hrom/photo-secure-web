import { useEffect, useCallback } from 'react';

interface PhotoBankEffectsProps {
  userId: string | null;
  authChecking: boolean;
  selectedFolder: any;
  photos: any[];
  folders: any[];
  selectionMode: boolean;
  fetchFolders: () => void;
  fetchPhotos: (folderId: number, options?: { silent?: boolean }) => void;
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

  // НЕ автозакрываем пустые tech_rejects папки - они служат маркером завершённого анализа
  // useEffect(() => {
  //   if (selectedFolder?.folder_type === 'tech_rejects' && photos.length === 0) {
  //     console.log('[PHOTO_BANK] Tech rejects folder is empty, closing it');
  //     setSelectedFolder(null);
  //     fetchFolders();
  //   }
  // }, [selectedFolder?.folder_type, photos.length]);

  // Автообновление для RAW файлов (проверка превью каждые 10 сек, максимум 2 минуты)
  useEffect(() => {
    if (!selectedFolder || !photos.length) return;
    
    const hasRawWithoutThumbnail = photos.some(p => p.is_raw && !p.thumbnail_s3_url);
    if (!hasRawWithoutThumbnail) return;
    
    console.log('[PHOTO_BANK] RAW files without thumbnail detected, scheduling refresh (max 2 min)');
    let attempts = 0;
    const MAX_ATTEMPTS = 12;
    
    const intervalId = setInterval(() => {
      // Пропускаем тик, если у пользователя открыт просмотр фото
      if (document.body.getAttribute('data-photo-viewer-open') === 'true') {
        console.log('[PHOTO_BANK] Viewer is open, skipping auto-refresh tick');
        return;
      }
      
      attempts += 1;
      console.log(`[PHOTO_BANK] Auto-refreshing photos for thumbnail updates (attempt ${attempts}/${MAX_ATTEMPTS})`);
      fetchPhotos(selectedFolder.id, { silent: true });
      
      if (attempts >= MAX_ATTEMPTS) {
        console.log('[PHOTO_BANK] Auto-refresh limit reached, stopping');
        clearInterval(intervalId);
      }
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