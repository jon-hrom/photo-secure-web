import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankHeader from '@/components/photobank/PhotoBankHeader';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogsContainer from '@/components/photobank/PhotoBankDialogsContainer';
import MobileNavigation from '@/components/layout/MobileNavigation';
import PhotoBankAdminBanner from '@/pages/photobank/PhotoBankAdminBanner';
import ShareFolderModal from '@/components/photobank/ShareFolderModal';
import { usePhotoBankState } from '@/hooks/usePhotoBankState';
import { usePhotoBankApi } from '@/hooks/usePhotoBankApi';
import { usePhotoBankHandlers } from '@/hooks/usePhotoBankHandlers';
import { usePhotoBankHandlersExtended } from '@/hooks/usePhotoBankHandlersExtended';
import { usePhotoBankNavigationHistory } from '@/hooks/usePhotoBankNavigationHistory';
import { getAuthUserId, usePhotoBankAuth, useEmailVerification, getIsAdminViewing } from '@/pages/photobank/PhotoBankAuth';
import { usePhotoBankEffects } from '@/pages/photobank/PhotoBankEffects';
import { useSessionWatcher } from '@/hooks/useSessionWatcher';

const PhotoBank = () => {
  const navigate = useNavigate();
  
  useSessionWatcher();
  
  const userId = getAuthUserId();
  const { authChecking } = usePhotoBankAuth();
  const { emailVerified } = useEmailVerification(userId, authChecking);
  const [showCameraUpload, setShowCameraUpload] = useState(false);
  const [showUrlUpload, setShowUrlUpload] = useState(false);
  const [shareModalFolder, setShareModalFolder] = useState<{ id: number; name: string } | null>(null);

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

  const {
    techSortProgress,
    downloadProgress,
    handleStartTechSort,
    handleRestorePhoto,
    handleDownloadFolder
  } = usePhotoBankHandlersExtended(
    userId,
    folders,
    selectedFolder,
    setLoading,
    startTechSort,
    restorePhoto,
    fetchFolders,
    fetchPhotos
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

  const handleDeleteSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) return;

    const confirmed = window.confirm(
      `Удалить выбранные фото (${selectedPhotos.size}) в корзину?`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      for (const photoId of selectedPhotos) {
        const photo = photos.find(p => p.id === photoId);
        if (photo) {
          await handleDeletePhoto(photoId, photo.file_name);
        }
      }
      setSelectedPhotos(new Set());
      setSelectionMode(false);
      if (selectedFolder) {
        await fetchPhotos(selectedFolder.id);
      }
      await fetchFolders();
    } catch (error) {
      console.error('Failed to delete photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleShareFolder = async (folderId: number, folderName: string) => {
    setShareModalFolder({ id: folderId, name: folderName });
  };

  const handleRenameFolder = () => {
    if (!selectedFolder) return;
    const newName = window.prompt('Введите новое название папки:', selectedFolder.folder_name);
    if (!newName || newName.trim() === '' || newName === selectedFolder.folder_name) return;

    fetch(`${PHOTOBANK_FOLDERS_API}/${selectedFolder.id}?userId=${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder_name: newName.trim() })
    })
      .then(res => res.json())
      .then(() => {
        fetchFolders();
        setSelectedFolder({ ...selectedFolder, folder_name: newName.trim() });
      })
      .catch(err => {
        console.error('Failed to rename folder:', err);
        alert('Ошибка переименования папки');
      });
  };

  const handleRestoreSelectedPhotos = async () => {
    if (selectedPhotos.size === 0) return;

    const confirmed = window.confirm(
      `Вернуть выбранные фото (${selectedPhotos.size}) обратно в оригиналы?`
    );

    if (!confirmed) return;

    setLoading(true);
    let restoredCount = 0;
    let cleanedCount = 0;

    try {
      for (const photoId of selectedPhotos) {
        try {
          const result = await handleRestorePhoto(photoId);
          if (result?.cleaned) {
            cleanedCount++;
          } else {
            restoredCount++;
          }
        } catch (error) {
          console.error(`Failed to restore photo ${photoId}:`, error);
        }
      }

      setSelectedPhotos(new Set());
      setSelectionMode(false);
      
      if (selectedFolder) {
        await fetchPhotos(selectedFolder.id);
      }
      await fetchFolders();

      const message = cleanedCount > 0 
        ? `Восстановлено: ${restoredCount}, удалено из базы (файл отсутствует): ${cleanedCount}`
        : `Успешно восстановлено ${restoredCount} фото`;
      
      alert(message);
    } catch (error) {
      console.error('Failed to restore photos:', error);
      alert('Произошла ошибка при восстановлении фото');
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
      
      <PhotoBankDialogsContainer
        userId={userId}
        folders={folders}
        selectedFolder={selectedFolder}
        showCreateFolder={showCreateFolder}
        showClearConfirm={showClearConfirm}
        showCameraUpload={showCameraUpload}
        showUrlUpload={showUrlUpload}
        folderName={folderName}
        techSortProgress={techSortProgress}
        downloadProgress={downloadProgress}
        setShowCreateFolder={setShowCreateFolder}
        setShowClearConfirm={setShowClearConfirm}
        setShowCameraUpload={setShowCameraUpload}
        setShowUrlUpload={setShowUrlUpload}
        setFolderName={setFolderName}
        setSelectedFolder={setSelectedFolder}
        handleCreateFolder={handleCreateFolder}
        handleClearAll={handleClearAll}
        fetchFolders={fetchFolders}
        fetchPhotos={fetchPhotos}
        fetchStorageUsage={fetchStorageUsage}
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
          onDeleteSelectedPhotos={handleDeleteSelectedPhotos}
          onRestoreSelectedPhotos={handleRestoreSelectedPhotos}
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
            onDownloadFolder={handleDownloadFolder}
            onShareFolder={handleShareFolder}
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
            onUploadPhoto={handleUploadPhoto}
            onDeletePhoto={handleDeletePhoto}
            onTogglePhotoSelection={togglePhotoSelection}
            onCancelUpload={handleCancelUpload}
            onRestorePhoto={handleRestorePhoto}
            isAdminViewing={isAdminViewing}
            onRenameFolder={handleRenameFolder}
          />
        )}
      </div>

      <MobileNavigation />

      {shareModalFolder && (
        <ShareFolderModal
          folderId={shareModalFolder.id}
          folderName={shareModalFolder.name}
          userId={userId}
          onClose={() => setShareModalFolder(null)}
        />
      )}
    </div>
  );
};

export default PhotoBank;