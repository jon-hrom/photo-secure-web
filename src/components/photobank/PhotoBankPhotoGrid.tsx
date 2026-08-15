import { Card } from '@/components/ui/card';
import PhotoGridHeader from './PhotoGridHeader';
import PhotoGridContent from './photoGrid/PhotoGridContent';
import PhotoGridDialogs from './photoGrid/PhotoGridDialogs';
import usePhotoGridState from './photoGrid/usePhotoGridState';
import type { PhotoBankPhotoGridProps } from './photoGrid/photoGridTypes';

const PhotoBankPhotoGrid = ({
  selectedFolder,
  photos,
  loading,
  uploading,
  uploadProgress,
  selectionMode,
  selectedPhotos,
  emailVerified,
  onUploadPhoto,
  onDeletePhoto,
  onTogglePhotoSelection,
  onCancelUpload,
  onRestorePhoto,
  isAdminViewing = false,
  onRenameFolder,
  storageUsage,
  subfolders,
  onSelectSubfolder,
  onCreateSubfolder,
  onOpenSubfolderSettings,
  onDeleteSubfolder,
  onNavigateToParent,
  clientUploadSlot,
  onRetouchFolder,
  userId,
  onRefreshPhotos
}: PhotoBankPhotoGridProps) => {
  const grid = usePhotoGridState({
    photos,
    selectedFolder,
    selectionMode,
    onTogglePhotoSelection,
    userId,
    onRefreshPhotos,
  });

  const isTechRejectsFolder = selectedFolder?.folder_type === 'tech_rejects';

  return (
    <Card>
      <PhotoGridHeader
        selectedFolder={selectedFolder}
        uploading={uploading}
        uploadProgress={uploadProgress}
        isAdminViewing={isAdminViewing}
        onUploadPhoto={onUploadPhoto}
        onCancelUpload={onCancelUpload}
        onRenameFolder={onRenameFolder}
        storageUsage={storageUsage}
        subfolders={subfolders}
        onSelectSubfolder={onSelectSubfolder}
        onCreateSubfolder={onCreateSubfolder}
        onOpenSubfolderSettings={onOpenSubfolderSettings}
        onDeleteSubfolder={onDeleteSubfolder}
        onNavigateToParent={onNavigateToParent}
        missingFrames={grid.missingFrames}
        rawCount={grid.rawPhotoIds.length}
        regenerating={grid.regenerating}
        regenProgress={grid.regenProgress}
        onRegenerateThumbnails={grid.handleRegenerateThumbnails}
      />

      <PhotoGridContent
        loading={loading}
        uploading={uploading}
        photos={photos}
        sortedPhotos={grid.sortedPhotos}
        selectedFolder={selectedFolder}
        isTechRejectsFolder={isTechRejectsFolder}
        clientUploadSlot={clientUploadSlot}
        sortField={grid.sortField}
        sortDirection={grid.sortDirection}
        onSortChange={grid.handleSortChange}
        frameMode={grid.frameMode}
        setFrameMode={grid.setFrameMode}
        selectionMode={selectionMode}
        selectedPhotos={selectedPhotos}
        emailVerified={emailVerified}
        isAdminViewing={isAdminViewing}
        onPhotoClick={grid.handlePhotoClick}
        onDeletePhoto={onDeletePhoto}
        onShowExif={(photo) => grid.setExifPhoto(photo)}
        onRetouchFolder={onRetouchFolder}
        onSetVideoPoster={userId ? (p) => grid.setPosterPhoto(p) : undefined}
        getFrameStyle={grid.getFrameStyle}
        onRestorePhoto={onRestorePhoto}
      />

      <PhotoGridDialogs
        viewPhoto={grid.viewPhoto}
        sortedPhotos={grid.sortedPhotos}
        onCloseViewer={() => grid.setViewPhoto(null)}
        onNavigate={grid.handleNavigate}
        exifPhoto={grid.exifPhoto}
        setExifPhoto={grid.setExifPhoto}
        viewVideo={grid.viewVideo}
        setViewVideo={grid.setViewVideo}
        posterPhoto={grid.posterPhoto}
        setPosterPhoto={grid.setPosterPhoto}
        posterBusy={grid.posterBusy}
        posterFileInputRef={grid.posterFileInputRef}
        onPosterFileSelected={grid.handlePosterFileSelected}
        onResetPoster={grid.handleResetPoster}
      />
    </Card>
  );
};

export default PhotoBankPhotoGrid;
