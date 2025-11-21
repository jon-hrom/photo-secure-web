import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
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
  uploadProgress: { current: number; total: number; percent: number; currentFileName: string };
  selectionMode: boolean;
  selectedPhotos: Set<number>;
  emailVerified: boolean;
  onUploadPhoto: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeletePhoto: (photoId: number, fileName: string) => void;
  onTogglePhotoSelection: (photoId: number) => void;
  onCancelUpload: () => void;
}

const handleDownload = async (url: string, fileName: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Download failed:', error);
  }
};

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
  onCancelUpload
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
                disabled={uploading || !emailVerified}
              />
              <Button asChild disabled={uploading || !emailVerified} size="sm">
                <label htmlFor="photo-upload" className={emailVerified ? "cursor-pointer" : "cursor-not-allowed"}>
                  <Icon name="Upload" className="mr-2" size={16} />
                  {uploading ? 'Загрузка...' : 'Загрузить фото'}
                </label>
              </Button>
            </div>
          )}
        </div>
        {selectedFolder && !emailVerified && (
          <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <Icon name="AlertCircle" className="text-amber-600 mt-0.5" size={20} />
            <div className="flex-1 text-sm">
              <p className="font-medium text-amber-900">Подтвердите email для загрузки фото</p>
              <p className="text-amber-700 mt-1">
                Перейдите в Настройки, чтобы подтвердить свой email-адрес
              </p>
            </div>
          </div>
        )}
        {uploading && uploadProgress.total > 0 && (
          <div className="mt-4 space-y-3 p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Icon name="Loader2" size={20} className="animate-spin text-primary" />
                  <div className="absolute inset-0 animate-ping opacity-25">
                    <Icon name="Loader2" size={20} className="text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Загружается {uploadProgress.current} из {uploadProgress.total}
                  </p>
                  {uploadProgress.currentFileName && (
                    <p className="text-xs text-muted-foreground truncate max-w-xs">
                      {uploadProgress.currentFileName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-primary">
                  {uploadProgress.percent}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={onCancelUpload}
                >
                  <Icon name="X" size={16} />
                </Button>
              </div>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent animate-pulse"
              />
              <div
                className="relative h-full bg-gradient-to-r from-primary via-primary to-primary/80 transition-all duration-500 ease-out rounded-full shadow-lg shadow-primary/50"
                style={{ width: `${uploadProgress.percent}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Осталось: {uploadProgress.total - uploadProgress.current}</span>
              <span>Успешно: {uploadProgress.current}</span>
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
                  src={photo.s3_url || photo.data_url || ''}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                />
                {!selectionMode && (
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <Button
                      variant="default"
                      size="icon"
                      className="h-7 w-7 bg-blue-600 hover:bg-blue-700 shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(photo.s3_url || photo.data_url || '', photo.file_name);
                      }}
                    >
                      <Icon name="Download" size={14} />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-7 w-7 shadow-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePhoto(photo.id, photo.file_name);
                      }}
                    >
                      <Icon name="Trash2" size={14} />
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