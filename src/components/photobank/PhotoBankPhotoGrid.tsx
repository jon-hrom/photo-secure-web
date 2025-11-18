import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface PhotoFolder {
  id: number;
  folder_name: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
}

interface PhotoBankPhotoGridProps {
  selectedFolder: PhotoFolder | null;
  photos: Photo[];
  loading: boolean;
  uploading: boolean;
  uploadProgress: { current: number; total: number };
  selectionMode: boolean;
  selectedPhotos: Set<number>;
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (photoId: number, fileName: string) => void;
  onTogglePhotoSelection: (photoId: number) => void;
}

const PhotoBankPhotoGrid = ({
  selectedFolder,
  photos,
  loading,
  uploading,
  uploadProgress,
  selectionMode,
  selectedPhotos,
  onUploadPhoto,
  onDeletePhoto,
  onTogglePhotoSelection
}: PhotoBankPhotoGridProps) => {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Icon name="Image" size={20} />
            {selectedFolder ? selectedFolder.folder_name : 'Фотографии'}
          </CardTitle>
          {selectedFolder && (
            <div className="relative">
              <input
                type="file"
                id="photo-upload"
                className="hidden"
                accept="image/*"
                multiple
                onChange={onUploadPhoto}
                disabled={uploading}
              />
              <Button asChild disabled={uploading} size="sm">
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <Icon name="Upload" className="mr-2" size={16} />
                  {uploading ? 'Загрузка...' : 'Загрузить фото'}
                </label>
              </Button>
            </div>
          )}
        </div>
        {uploading && uploadProgress.total > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Загружено {uploadProgress.current} из {uploadProgress.total}
              </span>
              <span className="font-medium">
                {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!selectedFolder ? (
          <div className="text-center py-16 text-muted-foreground">
            <Icon name="FolderOpen" size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">Выберите папку</p>
            <p className="text-sm">Выберите папку слева, чтобы просмотреть фотографии</p>
          </div>
        ) : loading ? (
          <div className="text-center py-16">
            <Icon name="Loader2" size={48} className="animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Загрузка фотографий...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Icon name="ImageOff" size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg mb-2">Нет фотографий</p>
            <p className="text-sm mb-4">Загрузите первое фото в эту папку</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className={`group relative aspect-square rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                  selectionMode && selectedPhotos.has(photo.id)
                    ? 'border-primary ring-4 ring-primary/20'
                    : 'border-muted hover:border-primary'
                }`}
                onClick={() => selectionMode && onTogglePhotoSelection(photo.id)}
              >
                {selectionMode && (
                  <div className="absolute top-2 right-2 z-10">
                    <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                      selectedPhotos.has(photo.id)
                        ? 'bg-primary border-primary'
                        : 'bg-white border-white/80 group-hover:border-primary'
                    }`}>
                      {selectedPhotos.has(photo.id) && (
                        <Icon name="Check" size={16} className="text-white" />
                      )}
                    </div>
                  </div>
                )}
                <img
                  src={photo.data_url || ''}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                />
                {!selectionMode && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                    <Button
                      variant="destructive"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onDeletePhoto(photo.id, photo.file_name)}
                    >
                      <Icon name="Trash2" size={18} />
                    </Button>
                  </div>
                )}
                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 transition-opacity ${
                  selectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}>
                  <p className="text-white text-xs truncate">{photo.file_name}</p>
                  <p className="text-white/70 text-xs">
                    {formatBytes(photo.file_size)}
                    {photo.width && photo.height && ` • ${photo.width}×${photo.height}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PhotoBankPhotoGrid;