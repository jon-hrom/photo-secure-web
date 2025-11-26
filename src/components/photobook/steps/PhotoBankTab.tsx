import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface PhotoBankPhoto {
  id: number;
  file_name: string;
  s3_url?: string;
  data_url?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface PhotoBankTabProps {
  photoBankFolders: PhotoFolder[];
  photoBankPhotos: PhotoBankPhoto[];
  selectedPhotoBankFolder: PhotoFolder | null;
  loadingPhotoBank: boolean;
  photoBankSelectedPhotos: Set<number>;
  onSelectFolder: (folder: PhotoFolder) => void;
  onFetchPhotos: (folderId: number) => void;
  onTogglePhotoSelection: (photoId: number) => void;
  onSelectAllPhotos: () => void;
  onClearSelection: () => void;
  onAddPhotosToSelection: () => void;
}

const PhotoBankTab = ({
  photoBankFolders,
  photoBankPhotos,
  selectedPhotoBankFolder,
  loadingPhotoBank,
  photoBankSelectedPhotos,
  onSelectFolder,
  onFetchPhotos,
  onTogglePhotoSelection,
  onSelectAllPhotos,
  onClearSelection,
  onAddPhotosToSelection
}: PhotoBankTabProps) => {
  return (
    <div className="grid grid-cols-[250px_1fr] flex-1 overflow-hidden">
      <div className="border-r p-4 overflow-y-auto">
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground mb-2">Папки</h3>
          {loadingPhotoBank ? (
            <div className="text-center py-4">
              <Icon name="Loader2" size={24} className="animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : photoBankFolders.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет папок в фотобанке</p>
          ) : (
            photoBankFolders.map(folder => (
              <div
                key={folder.id}
                className={`flex items-center justify-between p-2 rounded cursor-pointer ${
                  selectedPhotoBankFolder?.id === folder.id
                    ? 'bg-purple-100 text-purple-900'
                    : 'hover:bg-gray-100'
                }`}
                onClick={() => {
                  onSelectFolder(folder);
                  onFetchPhotos(folder.id);
                }}
              >
                <span className="text-sm">{folder.folder_name}</span>
                <span className="text-xs text-muted-foreground">{folder.photo_count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex flex-col overflow-hidden">
        {!selectedPhotoBankFolder ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Icon name="FolderOpen" size={64} className="mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">Выберите папку слева</p>
            </div>
          </div>
        ) : loadingPhotoBank ? (
          <div className="flex-1 flex items-center justify-center">
            <Icon name="Loader2" size={48} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h3 className="font-semibold">{selectedPhotoBankFolder.folder_name}</h3>
                {photoBankSelectedPhotos.size > 0 && (
                  <Button
                    onClick={onAddPhotosToSelection}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Icon name="Plus" size={16} className="mr-2" />
                    Добавить выбранные ({photoBankSelectedPhotos.size})
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                {photoBankSelectedPhotos.size > 0 && (
                  <Button
                    variant="outline"
                    onClick={onClearSelection}
                  >
                    <Icon name="X" size={18} className="mr-2" />
                    Снять выделение
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={onSelectAllPhotos}
                  disabled={photoBankPhotos.length === 0}
                >
                  <Icon name="CheckSquare" size={18} className="mr-2" />
                  Выделить все
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {photoBankPhotos.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Icon name="ImageOff" size={64} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">В этой папке нет фотографий</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {photoBankPhotos.map(photo => {
                    const isVertical = (photo.height || 0) > (photo.width || 0);
                    return (
                    <div
                      key={photo.id}
                      className={`relative rounded-lg overflow-hidden cursor-pointer border-2 transition-all bg-muted/30 ${
                        photoBankSelectedPhotos.has(photo.id)
                          ? 'border-purple-600 ring-4 ring-purple-200'
                          : 'border-transparent hover:border-purple-300'
                      } ${isVertical ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}
                      onClick={() => onTogglePhotoSelection(photo.id)}
                    >
                      <img
                        src={photo.s3_url || photo.data_url || ''}
                        alt={photo.file_name}
                        className="w-full h-full object-contain"
                      />
                      {photoBankSelectedPhotos.has(photo.id) && (
                        <div className="absolute top-2 right-2 bg-purple-600 rounded-full p-1">
                          <Icon name="Check" size={16} className="text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <p className="text-white text-xs truncate">{photo.file_name}</p>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PhotoBankTab;