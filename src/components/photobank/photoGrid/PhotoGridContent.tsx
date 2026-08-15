import { CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import type { CSSProperties } from 'react';
import PhotoGridCard from '../PhotoGridCard';
import PhotoGridToolbar from './PhotoGridToolbar';
import { Photo, PhotoFolder, SortField, SortDirection, FrameMode, handleDownload, getRejectionReasonLabel } from './photoGridTypes';

interface PhotoGridContentProps {
  loading: boolean;
  uploading: boolean;
  photos: Photo[];
  sortedPhotos: Photo[];
  selectedFolder: PhotoFolder | null;
  isTechRejectsFolder: boolean;
  clientUploadSlot?: React.ReactNode;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  frameMode: FrameMode;
  setFrameMode: (mode: FrameMode) => void;
  selectionMode: boolean;
  selectedPhotos: Set<number>;
  emailVerified: boolean;
  isAdminViewing: boolean;
  onPhotoClick: (photo: Photo) => void;
  onDeletePhoto: (photoId: number, fileName: string) => void;
  onShowExif: (photo: Photo) => void;
  onRetouchFolder?: (folderId: number, folderName: string, photoId?: number) => void;
  onSetVideoPoster?: (photo: Photo) => void;
  getFrameStyle: (dominantColor?: string) => CSSProperties;
  onRestorePhoto?: (photoId: number) => void;
}

const PhotoGridContent = ({
  loading,
  uploading,
  photos,
  sortedPhotos,
  selectedFolder,
  isTechRejectsFolder,
  clientUploadSlot,
  sortField,
  sortDirection,
  onSortChange,
  frameMode,
  setFrameMode,
  selectionMode,
  selectedPhotos,
  emailVerified,
  isAdminViewing,
  onPhotoClick,
  onDeletePhoto,
  onShowExif,
  onRetouchFolder,
  onSetVideoPoster,
  getFrameStyle,
  onRestorePhoto,
}: PhotoGridContentProps) => {
  return (
    <CardContent>
      {isTechRejectsFolder && photos.length > 0 && (
        <div className="mb-4 p-2 sm:p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <Icon name="AlertTriangle" size={16} className="sm:w-[18px] sm:h-[18px] flex-shrink-0" />
            <p className="text-xs sm:text-sm font-medium">
              Папка с техническим браком ({photos.length} фото)
            </p>
          </div>
          <p className="text-[10px] sm:text-xs text-red-600 mt-1">
            Эти фото автоматически определены как технический брак. Вы можете восстановить их в оригиналы.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && !selectedFolder && (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="FolderOpen" size={48} className="mx-auto mb-4 opacity-50" />
          <p>Выберите папку для просмотра фотографий</p>
        </div>
      )}

      {!loading && selectedFolder && photos.length === 0 && !uploading && (
        <>
          {clientUploadSlot}
          <div className="text-center py-12 text-muted-foreground">
            <Icon name="ImageOff" size={48} className="mx-auto mb-4 opacity-50" />
            <p>В этой папке пока нет фотографий</p>
            {!isTechRejectsFolder && <p className="text-sm mt-2">Загрузите фото, чтобы начать работу</p>}
          </div>
        </>
      )}

      {!loading && photos.length > 0 && (
        <>
          <PhotoGridToolbar
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
            frameMode={frameMode}
            setFrameMode={setFrameMode}
          />
          {clientUploadSlot}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {sortedPhotos.map((photo) => (
              <div key={photo.id} className="relative">
                <PhotoGridCard
                  photo={photo}
                  selectionMode={selectionMode}
                  isSelected={selectedPhotos.has(photo.id)}
                  emailVerified={emailVerified}
                  isAdminViewing={isAdminViewing}
                  onPhotoClick={onPhotoClick}
                  onDownload={handleDownload}
                  onDeletePhoto={onDeletePhoto}
                  onShowExif={(photo) => onShowExif(photo)}
                  onRetouch={
                    onRetouchFolder && selectedFolder
                      ? () => onRetouchFolder(selectedFolder.id, selectedFolder.folder_name, photo.id)
                      : undefined
                  }
                  onSetVideoPoster={onSetVideoPoster}
                  frameMode={frameMode}
                  getFrameStyle={getFrameStyle}
                />
              {isTechRejectsFolder && photo.tech_reject_reason && (
                <div className="mt-1 space-y-1">
                  <div className="text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 bg-red-100 text-red-700 rounded text-center truncate" title={getRejectionReasonLabel(photo.tech_reject_reason)}>
                    {getRejectionReasonLabel(photo.tech_reject_reason)}
                  </div>
                  {onRestorePhoto && (
                    <button
                      onClick={() => onRestorePhoto(photo.id)}
                      className="w-full text-[10px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 bg-green-100 hover:bg-green-200 active:bg-green-300 text-green-700 rounded transition-colors flex items-center justify-center gap-1 touch-manipulation"
                    >
                      <Icon name="RotateCcw" size={12} />
                      <span className="hidden xs:inline">Восстановить</span>
                      <span className="xs:hidden">↻</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        </>
      )}
    </CardContent>
  );
};

export default PhotoGridContent;
