import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankHeader from '@/components/photobank/PhotoBankHeader';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogsContainer from '@/components/photobank/PhotoBankDialogsContainer';
import MobileNavigation from '@/components/layout/MobileNavigation';
import PhotoBankAdminBanner from '@/pages/photobank/PhotoBankAdminBanner';
import ShareFolderModal from '@/components/photobank/ShareFolderModal';
import FavoritesViewModal from '@/components/photobank/FavoritesViewModal';
import DownloadStats from '@/components/photobank/DownloadStats';
import ChatModal from '@/components/gallery/ChatModal';
import Icon from '@/components/ui/icon';
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
  const [showFavorites, setShowFavorites] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [chatClient, setChatClient] = useState<{ id: number; name: string } | null>(null);

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

  useEffect(() => {
    const loadUnreadCounts = async () => {
      if (!userId || folders.length === 0) return;

      try {
        const response = await fetch(
          `https://functions.poehali.dev/ac9cc03a-3a9c-4359-acca-5cf58252f6d1?photographer_id=${userId}`
        );
        
        if (!response.ok) return;
        
        const data = await response.json();
        const unreadMap = new Map(
          data.folders.map((f: { folder_id: number; unread_count: number }) => [f.folder_id, f.unread_count])
        );

        setFolders(prev => prev.map(folder => ({
          ...folder,
          unread_messages_count: unreadMap.get(folder.id) || 0
        })));
      } catch (error) {
        console.error('Failed to load unread counts:', error);
      }
    };

    loadUnreadCounts();
    const interval = setInterval(loadUnreadCounts, 10000);
    return () => clearInterval(interval);
  }, [userId, folders.length]);

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

    const PHOTO_BANK_API = 'https://functions.poehali.dev/8aa39ae1-26f5-40c1-ad06-fe0d657f1310';
    
    fetch(PHOTO_BANK_API, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'X-User-Id': userId
      },
      body: JSON.stringify({ 
        action: 'rename_folder',
        folder_id: selectedFolder.id,
        folder_name: newName.trim() 
      })
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
          onShowFavorites={() => setShowFavorites(true)}
          canGoBack={navigation.canGoBack}
          canGoForward={navigation.canGoForward}
          onGoBack={handleGoBack}
          onGoForward={handleGoForward}
          onDeleteSelectedPhotos={handleDeleteSelectedPhotos}
          onRestoreSelectedPhotos={handleRestoreSelectedPhotos}
          onShowStats={() => setShowStats(true)}
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
            onOpenChat={(clientId, clientName) => setChatClient({ id: clientId, name: clientName })}
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

      {showFavorites && selectedFolder && (
        <FavoritesViewModal
          folderId={selectedFolder.id}
          folderName={selectedFolder.folder_name}
          userId={userId}
          onClose={() => setShowFavorites(false)}
        />
      )}

      {showStats && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-2xl font-bold">Статистика скачиваний</h2>
              <button
                onClick={() => setShowStats(false)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <Icon name="X" size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <DownloadStats userId={parseInt(userId)} />
            </div>
          </div>
        </div>
      )}

      {chatClient && (
        <ChatModal
          isOpen={true}
          onClose={() => setChatClient(null)}
          clientId={chatClient.id}
          photographerId={parseInt(userId)}
          senderType="photographer"
          clientName={chatClient.name}
        />
      )}
    </div>
  );
};

export default PhotoBank;