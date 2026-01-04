import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankHeader from '@/components/photobank/PhotoBankHeader';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogs from '@/components/photobank/PhotoBankDialogs';
import CameraUploadDialog from '@/components/photobank/CameraUploadDialog';
import UrlUploadDialog from '@/components/photobank/UrlUploadDialog';
import TechSortProgressDialog from '@/components/photobank/TechSortProgressDialog';
import MobileNavigation from '@/components/layout/MobileNavigation';
import PhotoBankAdminBanner from '@/pages/photobank/PhotoBankAdminBanner';
import { usePhotoBankState } from '@/hooks/usePhotoBankState';
import { usePhotoBankApi } from '@/hooks/usePhotoBankApi';
import { usePhotoBankHandlers } from '@/hooks/usePhotoBankHandlers';
import { usePhotoBankNavigationHistory } from '@/hooks/usePhotoBankNavigationHistory';
import { getAuthUserId, usePhotoBankAuth, useEmailVerification, getIsAdminViewing } from '@/pages/photobank/PhotoBankAuth';
import { usePhotoBankEffects } from '@/pages/photobank/PhotoBankEffects';
import { useSessionWatcher } from '@/hooks/useSessionWatcher';

const PhotoBank = () => {
  const navigate = useNavigate();
  
  // Отслеживаем изменения сессии для автоматической очистки admin viewing
  useSessionWatcher();
  
  const userId = getAuthUserId();
  const { authChecking } = usePhotoBankAuth();
  const { emailVerified } = useEmailVerification(userId, authChecking);
  const [showCameraUpload, setShowCameraUpload] = useState(false);
  const [showUrlUpload, setShowUrlUpload] = useState(false);
  const [techSortProgress, setTechSortProgress] = useState({
    open: false,
    progress: 0,
    currentFile: '',
    processedCount: 0,
    totalCount: 0,
    status: 'analyzing' as 'analyzing' | 'completed' | 'error',
    errorMessage: ''
  });

  const navigation = usePhotoBankNavigationHistory();

  const {
    folders,
    setFolders,
    selectedFolder,
    setSelectedFolder,
    photos,
    setPhotos,
    loading,
    setLoading,
    uploading,
    setUploading,
    uploadProgress,
    setUploadProgress,
    uploadCancelled,
    setUploadCancelled,
    showCreateFolder,
    setShowCreateFolder,
    showClearConfirm,
    setShowClearConfirm,
    folderName,
    setFolderName,
    selectedPhotos,
    setSelectedPhotos,
    selectionMode,
    setSelectionMode,
    storageUsage,
    setStorageUsage
  } = usePhotoBankState();

  const {
    fetchFolders,
    fetchPhotos,
    fetchStorageUsage,
    startTechSort,
    restorePhoto,
    PHOTOBANK_FOLDERS_API,
    PHOTOBANK_TRASH_API
  } = usePhotoBankApi(userId, setFolders, setPhotos, setLoading, setStorageUsage);

  const {
    handleCreateFolder,
    handleUploadPhoto,
    handleCancelUpload,
    handleDeletePhoto,
    handleDeleteFolder,
    handleClearAll,
    togglePhotoSelection,
    handleAddToPhotobook
  } = usePhotoBankHandlers(
    userId,
    PHOTOBANK_FOLDERS_API,
    PHOTOBANK_TRASH_API,
    selectedFolder,
    photos,
    selectedPhotos,
    folderName,
    setFolderName,
    setShowCreateFolder,
    setShowClearConfirm,
    setUploading,
    setUploadProgress,
    uploadCancelled,
    setUploadCancelled,
    setSelectedFolder,
    setPhotos,
    setSelectedPhotos,
    setSelectionMode,
    fetchFolders,
    fetchPhotos,
    fetchStorageUsage
  );

  const { handleGoBack, handleGoForward } = usePhotoBankEffects({
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
  });

  const isAdminViewing = getIsAdminViewing();

  const handleExitAdminView = () => {
    localStorage.removeItem('admin_viewing_user_id');
    const adminViewingUser = localStorage.getItem('admin_viewing_user');
    if (adminViewingUser) {
      navigate('/');
    } else {
      navigate('/');
    }
  };

  const handleStartTechSort = async (folderId: number, folderName: string) => {
    // Используем нативный confirm для всех платформ (работает на web, iOS, Android)
    const confirmed = window.confirm(
      `Запустить автоматическую сортировку фото в папке "${folderName}"?\n\n` +
      `Фото с техническим браком будут перемещены в отдельную подпапку.\n\n` +
      `Это может занять несколько минут в зависимости от количества фото.`
    );
    
    if (!confirmed) {
      return;
    }

    // Получаем количество фото в папке
    const folder = folders.find(f => f.id === folderId);
    const totalPhotos = folder?.photo_count || 0;

    if (totalPhotos === 0) {
      return;
    }

    // Показываем диалог прогресса
    setTechSortProgress({
      open: true,
      progress: 0,
      currentFile: 'Подготовка...',
      processedCount: 0,
      totalCount: totalPhotos,
      status: 'analyzing',
      errorMessage: ''
    });

    // Симулируем прогресс (примерно 2 секунды на фото)
    const estimatedTimeMs = totalPhotos * 2000;
    const updateInterval = 100; // обновление каждые 100ms
    const incrementPerUpdate = (100 / (estimatedTimeMs / updateInterval));
    
    let currentProgress = 0;
    let processedFiles = 0;

    const progressInterval = setInterval(() => {
      currentProgress += incrementPerUpdate;
      processedFiles = Math.floor((currentProgress / 100) * totalPhotos);
      
      if (currentProgress >= 95) {
        clearInterval(progressInterval);
        currentProgress = 95;
      }

      setTechSortProgress(prev => ({
        ...prev,
        progress: currentProgress,
        processedCount: processedFiles,
        currentFile: `Анализ фото ${processedFiles + 1} из ${totalPhotos}...`
      }));
    }, updateInterval);

    try {
      const result = await startTechSort(folderId);
      
      clearInterval(progressInterval);
      
      // Показываем завершение
      setTechSortProgress({
        open: true,
        progress: 100,
        currentFile: '',
        processedCount: result.processed || totalPhotos,
        totalCount: totalPhotos,
        status: 'completed',
        errorMessage: ''
      });

      // Обновляем список папок
      await fetchFolders();

      // Закрываем диалог через 2 секунды
      setTimeout(() => {
        setTechSortProgress(prev => ({ ...prev, open: false }));
      }, 2000);

    } catch (error: any) {
      clearInterval(progressInterval);
      
      setTechSortProgress({
        open: true,
        progress: 0,
        currentFile: '',
        processedCount: 0,
        totalCount: totalPhotos,
        status: 'error',
        errorMessage: error.message || 'Произошла ошибка при анализе'
      });

      // Закрываем диалог через 3 секунды
      setTimeout(() => {
        setTechSortProgress(prev => ({ ...prev, open: false }));
      }, 3000);
    }
  };

  const handleRestorePhoto = async (photoId: number) => {
    setLoading(true);
    try {
      await restorePhoto(photoId);
      if (selectedFolder) {
        await fetchPhotos(selectedFolder.id);
      }
      await fetchFolders();
    } catch (error) {
      console.error('Failed to restore photo:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authChecking || !userId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Проверка авторизации...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <PhotoBankAdminBanner 
        isAdminViewing={isAdminViewing}
        userId={userId}
        onExitAdminView={handleExitAdminView}
      />
      
      <PhotoBankDialogs
        showCreateFolder={showCreateFolder}
        showClearConfirm={showClearConfirm}
        folderName={folderName}
        foldersCount={folders.length}
        onSetShowCreateFolder={setShowCreateFolder}
        onSetShowClearConfirm={setShowClearConfirm}
        onSetFolderName={setFolderName}
        onCreateFolder={handleCreateFolder}
        onClearAll={handleClearAll}
      />

      <CameraUploadDialog
        open={showCameraUpload}
        onOpenChange={setShowCameraUpload}
        userId={userId || ''}
        folders={folders}
        onUploadComplete={() => {
          fetchFolders();
          fetchStorageUsage();
        }}
      />

      <UrlUploadDialog
        open={showUrlUpload}
        onClose={() => setShowUrlUpload(false)}
        onUpload={async (url: string) => {
          // TODO: Реализовать загрузку по URL
          console.log('Upload from URL:', url);
        }}
      />

      <div className="max-w-7xl mx-auto space-y-6">
        <PhotoBankStorageIndicator storageUsage={storageUsage} />

        <PhotoBankHeader
          folders={folders}
          selectedFolder={selectedFolder}
          photos={photos}
          selectionMode={selectionMode}
          selectedPhotos={selectedPhotos}
          isAdminViewing={isAdminViewing}
          onNavigateBack={() => {
            if (isAdminViewing) {
              handleExitAdminView();
            } else if (selectedFolder) {
              setSelectedFolder(null);
              setPhotos([]);
            } else {
              navigate('/');
            }
          }}
          onAddToPhotobook={handleAddToPhotobook}
          onCancelSelection={() => {
            setSelectionMode(false);
            setSelectedPhotos(new Set());
          }}
          onStartSelection={() => setSelectionMode(true)}
          onShowCreateFolder={() => setShowCreateFolder(true)}
          onShowClearConfirm={() => setShowClearConfirm(true)}
          onShowCameraUpload={() => setShowCameraUpload(true)}
          onShowUrlUpload={() => setShowUrlUpload(true)}
          canGoBack={navigation.canGoBack}
          canGoForward={navigation.canGoForward}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
        />

        {!selectedFolder ? (
          <PhotoBankFoldersList
            folders={folders}
            selectedFolder={selectedFolder}
            loading={loading}
            isAdminViewing={isAdminViewing}
            onSelectFolder={setSelectedFolder}
            onDeleteFolder={handleDeleteFolder}
            onCreateFolder={() => setShowCreateFolder(true)}
            onStartTechSort={handleStartTechSort}
          />
        ) : (
          <PhotoBankPhotoGrid
            selectedFolder={selectedFolder}
            photos={photos}
            loading={loading}
            uploading={uploading}
            uploadProgress={uploadProgress}
            selectionMode={selectionMode}
            selectedPhotos={selectedPhotos}
            emailVerified={emailVerified}
            isAdminViewing={isAdminViewing}
            onUploadPhoto={handleUploadPhoto}
            onDeletePhoto={handleDeletePhoto}
            onTogglePhotoSelection={togglePhotoSelection}
            onCancelUpload={handleCancelUpload}
            onRestorePhoto={handleRestorePhoto}
          />
        )}
      </div>

      <TechSortProgressDialog
        open={techSortProgress.open}
        progress={techSortProgress.progress}
        currentFile={techSortProgress.currentFile}
        processedCount={techSortProgress.processedCount}
        totalCount={techSortProgress.totalCount}
        status={techSortProgress.status}
        errorMessage={techSortProgress.errorMessage}
      />
      
      <MobileNavigation />
    </div>
  );
};

export default PhotoBank;