import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotoBankStorageIndicator from '@/components/photobank/PhotoBankStorageIndicator';
import PhotoBankFoldersList from '@/components/photobank/PhotoBankFoldersList';
import PhotoBankPhotoGrid from '@/components/photobank/PhotoBankPhotoGrid';
import PhotoBankDialogs from '@/components/photobank/PhotoBankDialogs';
import { usePhotoBankState } from '@/hooks/usePhotoBankState';
import { usePhotoBankApi } from '@/hooks/usePhotoBankApi';
import { usePhotoBankHandlers } from '@/hooks/usePhotoBankHandlers';

const PhotoBank = () => {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId') || '1';

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
    PHOTO_BANK_API
  } = usePhotoBankApi(userId, setFolders, setPhotos, setLoading, setStorageUsage);

  const {
    handleCreateFolder,
    handleUploadPhoto,
    handleDeletePhoto,
    handleDeleteFolder,
    handleClearAll,
    togglePhotoSelection,
    handleAddToPhotobook
  } = usePhotoBankHandlers(
    userId,
    PHOTO_BANK_API,
    selectedFolder,
    photos,
    selectedPhotos,
    folderName,
    setFolderName,
    setShowCreateFolder,
    setShowClearConfirm,
    setUploading,
    setUploadProgress,
    setSelectedFolder,
    setPhotos,
    setSelectedPhotos,
    setSelectionMode,
    fetchFolders,
    fetchPhotos,
    fetchStorageUsage
  );

  useEffect(() => {
    fetchFolders();
    fetchStorageUsage();
  }, []);

  useEffect(() => {
    if (selectedFolder) {
      fetchPhotos(selectedFolder.id);
    }
  }, [selectedFolder]);

  return (
    <div className="min-h-screen bg-background p-6">
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

      <div className="max-w-7xl mx-auto space-y-6">
        <PhotoBankStorageIndicator storageUsage={storageUsage} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/')}
            >
              <Icon name="ArrowLeft" size={24} />
            </Button>
            <h1 className="text-3xl font-bold">Мой фото банк</h1>
          </div>
          <div className="flex gap-2">
            {selectionMode && (
              <>
                <Button 
                  variant="default"
                  onClick={handleAddToPhotobook}
                  disabled={selectedPhotos.size === 0}
                >
                  <Icon name="Plus" className="mr-2" size={18} />
                  Добавить в макет ({selectedPhotos.size})
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelectedPhotos(new Set());
                  }}
                >
                  Отмена
                </Button>
              </>
            )}
            {!selectionMode && selectedFolder && photos.length > 0 && (
              <Button 
                variant="outline"
                onClick={() => setSelectionMode(true)}
              >
                <Icon name="CheckSquare" className="mr-2" size={18} />
                Выбрать фото
              </Button>
            )}
            <Button 
              variant="outline"
              onClick={() => setShowCreateFolder(true)}
            >
              <Icon name="FolderPlus" className="mr-2" size={18} />
              Новая папка
            </Button>
            {folders.length > 0 && (
              <Button 
                variant="destructive"
                onClick={() => setShowClearConfirm(true)}
              >
                <Icon name="Trash2" className="mr-2" size={18} />
                Очистить весь банк
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[300px_1fr] gap-6">
          <PhotoBankFoldersList
            folders={folders}
            selectedFolder={selectedFolder}
            loading={loading}
            onSelectFolder={setSelectedFolder}
            onDeleteFolder={handleDeleteFolder}
            onCreateFolder={() => setShowCreateFolder(true)}
          />

          <PhotoBankPhotoGrid
            selectedFolder={selectedFolder}
            photos={photos}
            loading={loading}
            uploading={uploading}
            uploadProgress={uploadProgress}
            selectionMode={selectionMode}
            selectedPhotos={selectedPhotos}
            onUploadPhoto={handleUploadPhoto}
            onDeletePhoto={handleDeletePhoto}
            onTogglePhotoSelection={togglePhotoSelection}
          />
        </div>
      </div>
    </div>
  );
};

export default PhotoBank;
