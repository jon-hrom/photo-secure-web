import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [zoom, setZoom] = useState(1);
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handlePhotoClick = (photo: Photo) => {
    if (!selectionMode) {
      setViewPhoto(photo);
    } else {
      onTogglePhotoSelection(photo.id);
    }
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!viewPhoto) return;
    const currentIndex = photos.findIndex(p => p.id === viewPhoto.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < photos.length) {
      setViewPhoto(photos[newIndex]);
    }
  };

  const currentPhotoIndex = viewPhoto ? photos.findIndex(p => p.id === viewPhoto.id) : -1;
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photos.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewPhoto) return;
      
      if (e.key === 'Escape') {
        setViewPhoto(null);
        setZoom(1);
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        handleNavigate('prev');
        setZoom(1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        handleNavigate('next');
        setZoom(1);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!viewPhoto) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => Math.max(0.5, Math.min(5, prev + delta)));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [viewPhoto, hasPrev, hasNext]);

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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {photos.map((photo) => {
              const isVertical = (photo.height || 0) > (photo.width || 0);
              return (
              <div
                key={photo.id}
                className={`group relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer bg-muted/30 ${
                  selectionMode && selectedPhotos.has(photo.id)
                    ? 'border-primary ring-4 ring-primary/20'
                    : 'border-muted hover:border-primary'
                } ${isVertical ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}
                onClick={() => handlePhotoClick(photo)}
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
                  className="w-full h-full object-contain"
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
            );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={!!viewPhoto} onOpenChange={() => { setViewPhoto(null); setZoom(1); }}>
        <DialogContent hideCloseButton className="max-w-[98vw] max-h-[98vh] w-auto h-auto p-0 bg-black/95 border-0">
          {viewPhoto && (
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-50">
                <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {currentPhotoIndex + 1} / {photos.length}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    {Math.round(zoom * 100)}%
                  </div>
                  <button
                    onClick={() => setViewPhoto(null)}
                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                  >
                    <Icon name="X" size={24} className="text-white" />
                  </button>
                </div>
              </div>

              {hasPrev && (
                <button
                  onClick={() => { handleNavigate('prev'); setZoom(1); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                >
                  <Icon name="ChevronLeft" size={28} className="text-white" />
                </button>
              )}

              {hasNext && (
                <button
                  onClick={() => { handleNavigate('next'); setZoom(1); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                >
                  <Icon name="ChevronRight" size={28} className="text-white" />
                </button>
              )}
              
              <div className="relative w-full h-[calc(100vh-120px)] flex items-center justify-center overflow-auto p-4">
                <img
                  src={viewPhoto.s3_url || viewPhoto.data_url || ''}
                  alt={viewPhoto.file_name}
                  className="object-contain rounded-lg cursor-move transition-transform duration-200"
                  style={{
                    transform: `scale(${zoom})`,
                    maxWidth: zoom > 1 ? 'none' : '100%',
                    maxHeight: zoom > 1 ? 'none' : '90vh'
                  }}
                />
              </div>

              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6">
                <p className="text-white font-medium text-lg mb-2">{viewPhoto.file_name}</p>
                <div className="flex items-center gap-4 text-white/70 text-sm">
                  <span>{formatBytes(viewPhoto.file_size)}</span>
                  {viewPhoto.width && viewPhoto.height && (
                    <span>{viewPhoto.width} × {viewPhoto.height}</span>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(viewPhoto.s3_url || viewPhoto.data_url || '', viewPhoto.file_name);
                    }}
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                  >
                    <Icon name="Download" size={16} className="mr-2" />
                    Скачать
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePhoto(viewPhoto.id, viewPhoto.file_name);
                      setViewPhoto(null);
                    }}
                    className="bg-red-600/80 hover:bg-red-600 border-0"
                  >
                    <Icon name="Trash2" size={16} className="mr-2" />
                    Удалить
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PhotoBankPhotoGrid;