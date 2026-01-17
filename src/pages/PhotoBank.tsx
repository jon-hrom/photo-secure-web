import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankHeader from '@/components/photobank/PhotoBankHeader';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogsContainer from '@/components/photobank/PhotoBankDialogsContainer';
import MobileNavigation from '@/components/layout/MobileNavigation';
import PhotoBankAdminBanner from '@/pages/photobank/PhotoBankAdminBanner';
import { PhotoBankModals } from '@/pages/photobank/PhotoBankModals';
import { usePhotoBankState } from '@/hooks/usePhotoBankState';
import { usePhotoBankApi } from '@/hooks/usePhotoBankApi';
import { usePhotoBankHandlers } from '@/hooks/usePhotoBankHandlers';
import { usePhotoBankHandlersExtended } from '@/hooks/usePhotoBankHandlersExtended';
import { usePhotoBankNavigationHistory } from '@/hooks/usePhotoBankNavigationHistory';
import { usePhotoBankHandlersLocal } from '@/pages/photobank/usePhotoBankHandlersLocal';
import { usePhotoBankUnreadMessages } from '@/pages/photobank/usePhotoBankUnreadMessages';
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
  const [folderChatsId, setFolderChatsId] = useState<number | null>(null);

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

  const {
    handleExitAdminView,
    handleDeleteSelectedPhotos,
    handleShareFolder,
    handleOpenFolderChats,
    handleRenameFolder,
    handleRestoreSelectedPhotos,
  } = usePhotoBankHandlersLocal({
    userId,
    selectedFolder,
    selectedPhotos,
    photos,
    setShareModalFolder,
    setFolderChatsId,
    setSelectedFolder,
    setLoading,
    setSelectedPhotos,
    setSelectionMode,
    handleDeletePhoto,
    handleRestorePhoto,
    fetchFolders,
    fetchPhotos,
  });

  usePhotoBankUnreadMessages({
    userId,
    foldersLength: folders.length,
    setFolders,
  });

  const isAdminViewing = getIsAdminViewing();

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
          onShowAllChats={() => setFolderChatsId(-1)}
          totalUnreadMessages={folders.reduce((sum, f) => sum + (f.unread_messages_count || 0), 0)}
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
            onOpenFolderChats={handleOpenFolderChats}
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

      <PhotoBankModals
        shareModalFolder={shareModalFolder}
        showFavorites={showFavorites}
        selectedFolder={selectedFolder}
        showStats={showStats}
        chatClient={chatClient}
        folderChatsId={folderChatsId}
        userId={userId}
        onCloseShareModal={() => setShareModalFolder(null)}
        onCloseFavorites={() => setShowFavorites(false)}
        onCloseStats={() => setShowStats(false)}
        onCloseChat={() => setChatClient(null)}
        onCloseFolderChats={() => {
          setFolderChatsId(null);
          fetchFolders();
        }}
      />
    </div>
  );
};

export default PhotoBank;