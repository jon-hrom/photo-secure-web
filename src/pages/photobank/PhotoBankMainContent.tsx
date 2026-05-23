import { ReactNode } from 'react';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankHeader from '@/components/photobank/PhotoBankHeader';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import FavoriteListsViewer from '@/components/photobank/FavoriteListsViewer';
import ClientUploadViewer from '@/components/photobank/ClientUploadViewer';

interface PhotoFolder {
  id: number;
  folder_name: string;
  parent_folder_id?: number | null;
  unread_messages_count?: number;
  [key: string]: unknown;
}

interface PhotoBankMainContentProps {
  storageUsage: unknown;
  folders: PhotoFolder[];
  selectedFolder: PhotoFolder | null;
  photos: unknown[];
  selectionMode: boolean;
  selectedPhotos: Set<number>;
  isAdminViewing: boolean;
  isAdmin: boolean;
  loading: boolean;
  uploading: boolean;
  uploadProgress: unknown;
  emailVerified: boolean;
  userId: string;
  photobankFoldersApi: string;
  navigation: { canGoBack: boolean; canGoForward: boolean };
  handleGoBack: () => void;
  handleGoForward: () => void;
  handleExitAdminView: () => void;
  setSelectedFolder: (f: PhotoFolder | null) => void;
  setPhotos: (p: unknown[]) => void;
  setSelectionMode: (v: boolean) => void;
  setSelectedPhotos: (s: Set<number>) => void;
  setShowCreateFolder: (v: boolean) => void;
  setShowClearConfirm: (v: boolean) => void;
  setShowCameraUpload: (v: boolean) => void;
  setShowUrlUpload: (v: boolean) => void;
  setShowVideoUrlUpload: (v: boolean) => void;
  setShowFavorites: (v: boolean) => void;
  setShowStats: (v: boolean) => void;
  setFolderChatsId: (v: number | null) => void;
  setChatClient: (c: { id: number; name: string } | null) => void;
  setRetouchFolder: (f: { id: number; name: string } | null) => void;
  setViewsStatsFolder: (f: { id: number; name: string } | null) => void;
  setCreateSubfolderParentId: (id: number | null) => void;
  setSubfolderSettings: (s: { id: number; folder_name: string; has_password?: boolean; is_hidden?: boolean } | null) => void;
  handleAddToPhotobook: () => void;
  handleDeleteSelectedPhotos: () => void;
  handleRestoreSelectedPhotos: () => void;
  handleStartTechSort: (folderId: number, folderName: string) => void;
  handleDownloadFolder: (folderId: number, folderName: string) => void;
  handleShareFolder: (folderId: number, folderName: string) => void;
  handleOpenFolderChats: (folderId: number) => void;
  handleDeleteFolder: (folderId: number, folderName: string) => void;
  handleUploadPhoto: (...args: unknown[]) => void;
  handleDeletePhoto: (...args: unknown[]) => void;
  handleCancelUpload: () => void;
  handleRestorePhoto: (...args: unknown[]) => void;
  handleRenameFolder: (...args: unknown[]) => void;
  togglePhotoSelection: (...args: unknown[]) => void;
  fetchPhotos: (folderId: number) => void;
  fetchFolders: () => void;
  fetchStorageUsage: () => void;
  onNavigateRoot: () => void;
}

const PhotoBankMainContent = (props: PhotoBankMainContentProps) => {
  const {
    storageUsage,
    folders,
    selectedFolder,
    photos,
    selectionMode,
    selectedPhotos,
    isAdminViewing,
    isAdmin,
    loading,
    uploading,
    uploadProgress,
    emailVerified,
    userId,
    photobankFoldersApi,
    navigation,
    handleGoBack,
    handleGoForward,
    handleExitAdminView,
    setSelectedFolder,
    setPhotos,
    setSelectionMode,
    setSelectedPhotos,
    setShowCreateFolder,
    setShowClearConfirm,
    setShowCameraUpload,
    setShowUrlUpload,
    setShowVideoUrlUpload,
    setShowFavorites,
    setShowStats,
    setFolderChatsId,
    setChatClient,
    setRetouchFolder,
    setViewsStatsFolder,
    setCreateSubfolderParentId,
    setSubfolderSettings,
    handleAddToPhotobook,
    handleDeleteSelectedPhotos,
    handleRestoreSelectedPhotos,
    handleStartTechSort,
    handleDownloadFolder,
    handleShareFolder,
    handleOpenFolderChats,
    handleDeleteFolder,
    handleUploadPhoto,
    handleDeletePhoto,
    handleCancelUpload,
    handleRestorePhoto,
    handleRenameFolder,
    togglePhotoSelection,
    fetchPhotos,
    fetchFolders,
    fetchStorageUsage,
    onNavigateRoot,
  } = props;

  const clientUploadSlot: ReactNode = userId && selectedFolder ? (
    <>
      <FavoriteListsViewer
        parentFolderId={selectedFolder.id}
        userId={parseInt(userId, 10)}
      />
      <ClientUploadViewer
        parentFolderId={selectedFolder.id}
        userId={parseInt(userId, 10)}
      />
    </>
  ) : undefined;

  return (
    <div className="w-full mx-auto space-y-6 px-2 sm:px-4 lg:px-6 xl:px-8 2xl:px-12">
      <PhotoBankStorageIndicator storageUsage={storageUsage} />

      <PhotoBankHeader
        folders={folders}
        selectedFolder={selectedFolder}
        photos={photos}
        selectionMode={selectionMode}
        selectedPhotos={selectedPhotos}
        isAdminViewing={isAdminViewing}
        isAdmin={isAdmin}
        onNavigateBack={() => {
          if (isAdminViewing) {
            handleExitAdminView();
          } else if (selectedFolder?.parent_folder_id) {
            const parentFolder = folders.find(f => f.id === selectedFolder.parent_folder_id);
            if (parentFolder) {
              setSelectedFolder(parentFolder);
              fetchPhotos(parentFolder.id);
            } else {
              setSelectedFolder(null);
              setPhotos([]);
            }
          } else if (selectedFolder) {
            setSelectedFolder(null);
            setPhotos([]);
          } else {
            onNavigateRoot();
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
        onShowVideoUrlUpload={() => setShowVideoUrlUpload(true)}
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
          onRetouchFolder={(id, name) => setRetouchFolder({ id, name })}
          onShareFolder={handleShareFolder}
          onOpenChat={(clientId, clientName) => setChatClient({ id: clientId, name: clientName })}
          onOpenFolderChats={handleOpenFolderChats}
          onShowViewsStats={(id, name) => setViewsStatsFolder({ id, name })}
          onCreateSubfolder={(parentId) => setCreateSubfolderParentId(parentId)}
          onOpenSubfolderSettings={(subfolder) => setSubfolderSettings(subfolder)}
        />
      ) : (
        <>
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
            storageUsage={storageUsage}
            subfolders={selectedFolder ? folders.filter(f => f.parent_folder_id === selectedFolder.id || (selectedFolder.parent_folder_id && f.parent_folder_id === selectedFolder.parent_folder_id)) : []}
            onSelectSubfolder={(subfolder) => setSelectedFolder(subfolder)}
            onCreateSubfolder={() => {
              const parentId = selectedFolder?.parent_folder_id || selectedFolder?.id;
              if (parentId) setCreateSubfolderParentId(parentId);
            }}
            onOpenSubfolderSettings={(subfolder) => setSubfolderSettings(subfolder)}
            onRetouchFolder={(id, name) => setRetouchFolder({ id, name })}
            onNavigateToParent={() => {
              if (selectedFolder?.parent_folder_id) {
                const parentFolder = folders.find(f => f.id === selectedFolder.parent_folder_id);
                if (parentFolder) {
                  setSelectedFolder(parentFolder);
                  fetchPhotos(parentFolder.id);
                }
              }
            }}
            onDeleteSubfolder={(subfolder) => {
              if (!confirm(`Удалить подпапку "${subfolder.folder_name}" со всеми фото? Файлы будут перемещены в корзину.`)) return;
              fetch(`${photobankFoldersApi}?folder_id=${subfolder.id}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': userId }
              }).then(res => {
                if (res.ok) {
                  if (selectedFolder?.id === subfolder.id) {
                    const parentId = subfolder.parent_folder_id;
                    const parentFolder = parentId ? folders.find(f => f.id === parentId) : null;
                    if (parentFolder) {
                      setSelectedFolder(parentFolder);
                      fetchPhotos(parentFolder.id);
                    } else {
                      setSelectedFolder(null);
                      setPhotos([]);
                    }
                  }
                  fetchFolders();
                  fetchStorageUsage();
                }
              });
            }}
            clientUploadSlot={clientUploadSlot}
          />
        </>
      )}
    </div>
  );
};

export default PhotoBankMainContent;