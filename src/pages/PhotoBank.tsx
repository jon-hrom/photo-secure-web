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
import SubfolderSettingsModal from '@/components/photobank/SubfolderSettingsModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
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
import ClientUploadViewer from '@/components/photobank/ClientUploadViewer';
import RetouchDialog from '@/components/photobank/RetouchDialog';

function CreateSubfolderDialog({ open, onOpenChange, subfolderName, onSetSubfolderName, onCreateSubfolder }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subfolderName: string;
  onSetSubfolderName: (name: string) => void;
  onCreateSubfolder: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 dark:from-purple-950/80 dark:via-pink-950/60 dark:to-rose-950/80 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Добавить папку</DialogTitle>
          <DialogDescription>Введите название для новой подпапки</DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Например: Подготовка"
          value={subfolderName}
          onChange={(e) => onSetSubfolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreateSubfolder()}
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={onCreateSubfolder}>
            <Icon name="FolderPlus" size={16} className="mr-2" />
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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

      <CreateSubfolderDialog
        open={createSubfolderParentId !== null}
        onOpenChange={(open) => { if (!open) { setCreateSubfolderParentId(null); setSubfolderName(''); } }}
        subfolderName={subfolderName}
        onSetSubfolderName={setSubfolderName}
        onCreateSubfolder={async () => {
          if (!subfolderName.trim() || !createSubfolderParentId) return;
          try {
            const res = await fetch(PHOTOBANK_FOLDERS_API, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
              body: JSON.stringify({ action: 'create', folder_name: subfolderName, parent_folder_id: createSubfolderParentId })
            });
            if (res.ok) {
              setCreateSubfolderParentId(null);
              setSubfolderName('');
              fetchFolders();
            }
          } catch { /* ignore */ }
        }}
      />

      <SubfolderSettingsModal
        open={subfolderSettings !== null}
        onOpenChange={(open) => { if (!open) setSubfolderSettings(null); }}
        subfolder={subfolderSettings}
        apiUrl={PHOTOBANK_FOLDERS_API}
        userId={userId}
        onSaved={fetchFolders}
      />

      {retouchFolder && (
        <RetouchDialog
          open={retouchFolder !== null}
          onOpenChange={(open) => { if (!open) setRetouchFolder(null); }}
          folderId={retouchFolder.id}
          folderName={retouchFolder.name}
          userId={userId}
          onRetouchComplete={fetchFolders}
        />
      )}

      <div className="max-w-7xl mx-auto space-y-6 px-2 sm:px-4 lg:px-6">
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
                fetch(`${PHOTOBANK_FOLDERS_API}?folder_id=${subfolder.id}`, {
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
              clientUploadSlot={userId && selectedFolder ? (
                <ClientUploadViewer
                  parentFolderId={selectedFolder.id}
                  userId={parseInt(userId, 10)}
                />
              ) : undefined}
            />
          </>
        )}
      </div>

      <MobileNavigation />

      <PhotoBankModals
        shareModalFolder={shareModalFolder}
        showFavorites={showFavorites}
        selectedFolder={selectedFolder}
        showStats={showStats}
        showVideoUrlUpload={showVideoUrlUpload}
        chatClient={chatClient}
        folderChatsId={folderChatsId}
        userId={userId}
        onCloseShareModal={() => setShareModalFolder(null)}
        onCloseFavorites={() => setShowFavorites(false)}
        onCloseStats={() => setShowStats(false)}
        onCloseVideoUrlUpload={() => setShowVideoUrlUpload(false)}
        onCloseChat={() => setChatClient(null)}
        onCloseFolderChats={() => {
          setFolderChatsId(null);
          fetchFolders();
        }}
        onVideoUploadSuccess={() => {
          if (selectedFolder) {
            fetchPhotos(selectedFolder.id);
          }
          fetchFolders();
          fetchStorageUsage();
        }}
      />
    </div>
  );
};

export default PhotoBank;