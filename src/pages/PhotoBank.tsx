import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoBankDialogsContainer from '@/components/photobank/PhotoBankDialogsContainer';
import MobileNavigation from '@/components/layout/MobileNavigation';
import PhotoBankAdminBanner from '@/pages/photobank/PhotoBankAdminBanner';
import PhotoBankAuxDialogs from '@/pages/photobank/PhotoBankAuxDialogs';
import PhotoBankMainContent from '@/pages/photobank/PhotoBankMainContent';
import PhotoBankOverlayModals from '@/pages/photobank/PhotoBankOverlayModals';
import { usePhotoBankState } from '@/hooks/usePhotoBankState';
import { usePhotoBankApi } from '@/hooks/usePhotoBankApi';
import { usePhotoBankHandlers } from '@/hooks/usePhotoBankHandlers';
import { usePhotoBankHandlersExtended } from '@/hooks/usePhotoBankHandlersExtended';
import { usePhotoBankNavigationHistory } from '@/hooks/usePhotoBankNavigationHistory';
import { usePhotoBankHandlersLocal } from '@/pages/photobank/usePhotoBankHandlersLocal';
import { usePhotoBankUnreadMessages } from '@/pages/photobank/usePhotoBankUnreadMessages';
import { getAuthUserId, usePhotoBankAuth, useEmailVerification, getIsAdminViewing, getIsAdmin } from '@/pages/photobank/PhotoBankAuth';
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
  const [showVideoUrlUpload, setShowVideoUrlUpload] = useState(false);
  const [shareModalFolder, setShareModalFolder] = useState<{ id: number; name: string } | null>(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [chatClient, setChatClient] = useState<{ id: number; name: string } | null>(null);
  const [folderChatsId, setFolderChatsId] = useState<number | null>(null);
  const [createSubfolderParentId, setCreateSubfolderParentId] = useState<number | null>(null);
  const [subfolderName, setSubfolderName] = useState('');
  const [subfolderSettings, setSubfolderSettings] = useState<{ id: number; folder_name: string; has_password?: boolean; is_hidden?: boolean } | null>(null);
  const [retouchFolder, setRetouchFolder] = useState<{ id: number; name: string } | null>(null);
  const [viewsStatsFolder, setViewsStatsFolder] = useState<{ id: number; name: string } | null>(null);

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
    fetchStorageUsage,
    storageUsage
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
  const isAdmin = getIsAdmin();

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
    <div className="min-h-screen bg-background py-4 sm:py-6">
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

      <PhotoBankAuxDialogs
        createSubfolderParentId={createSubfolderParentId}
        setCreateSubfolderParentId={setCreateSubfolderParentId}
        subfolderName={subfolderName}
        setSubfolderName={setSubfolderName}
        userId={userId}
        photobankFoldersApi={PHOTOBANK_FOLDERS_API}
        fetchFolders={fetchFolders}
        subfolderSettings={subfolderSettings}
        setSubfolderSettings={setSubfolderSettings}
        retouchFolder={retouchFolder}
        setRetouchFolder={setRetouchFolder}
      />

      <PhotoBankMainContent
        storageUsage={storageUsage}
        folders={folders}
        selectedFolder={selectedFolder}
        photos={photos}
        selectionMode={selectionMode}
        selectedPhotos={selectedPhotos}
        isAdminViewing={isAdminViewing}
        isAdmin={isAdmin}
        loading={loading}
        uploading={uploading}
        uploadProgress={uploadProgress}
        emailVerified={emailVerified}
        userId={userId}
        photobankFoldersApi={PHOTOBANK_FOLDERS_API}
        navigation={navigation}
        handleGoBack={handleGoBack}
        handleGoForward={handleGoForward}
        handleExitAdminView={handleExitAdminView}
        setSelectedFolder={setSelectedFolder}
        setPhotos={setPhotos}
        setSelectionMode={setSelectionMode}
        setSelectedPhotos={setSelectedPhotos}
        setShowCreateFolder={setShowCreateFolder}
        setShowClearConfirm={setShowClearConfirm}
        setShowCameraUpload={setShowCameraUpload}
        setShowUrlUpload={setShowUrlUpload}
        setShowVideoUrlUpload={setShowVideoUrlUpload}
        setShowFavorites={setShowFavorites}
        setShowStats={setShowStats}
        setFolderChatsId={setFolderChatsId}
        setChatClient={setChatClient}
        setRetouchFolder={setRetouchFolder}
        setViewsStatsFolder={setViewsStatsFolder}
        setCreateSubfolderParentId={setCreateSubfolderParentId}
        setSubfolderSettings={setSubfolderSettings}
        handleAddToPhotobook={handleAddToPhotobook}
        handleDeleteSelectedPhotos={handleDeleteSelectedPhotos}
        handleRestoreSelectedPhotos={handleRestoreSelectedPhotos}
        handleStartTechSort={handleStartTechSort}
        handleDownloadFolder={handleDownloadFolder}
        handleShareFolder={handleShareFolder}
        handleOpenFolderChats={handleOpenFolderChats}
        handleDeleteFolder={handleDeleteFolder}
        handleUploadPhoto={handleUploadPhoto}
        handleDeletePhoto={handleDeletePhoto}
        handleCancelUpload={handleCancelUpload}
        handleRestorePhoto={handleRestorePhoto}
        handleRenameFolder={handleRenameFolder}
        togglePhotoSelection={togglePhotoSelection}
        fetchPhotos={fetchPhotos}
        fetchFolders={fetchFolders}
        fetchStorageUsage={fetchStorageUsage}
        onNavigateRoot={() => navigate('/')}
      />

      <MobileNavigation />

      <PhotoBankOverlayModals
        shareModalFolder={shareModalFolder}
        showFavorites={showFavorites}
        selectedFolder={selectedFolder}
        showStats={showStats}
        showVideoUrlUpload={showVideoUrlUpload}
        chatClient={chatClient}
        folderChatsId={folderChatsId}
        userId={userId}
        setShareModalFolder={setShareModalFolder}
        setShowFavorites={setShowFavorites}
        setShowStats={setShowStats}
        setShowVideoUrlUpload={setShowVideoUrlUpload}
        setChatClient={setChatClient}
        setFolderChatsId={setFolderChatsId}
        fetchPhotos={fetchPhotos}
        fetchFolders={fetchFolders}
        fetchStorageUsage={fetchStorageUsage}
        viewsStatsFolder={viewsStatsFolder}
        setViewsStatsFolder={setViewsStatsFolder}
      />
    </div>
  );
};

export default PhotoBank;