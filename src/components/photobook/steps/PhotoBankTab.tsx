import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
  const [viewPhoto, setViewPhoto] = useState<PhotoBankPhoto | null>(null);
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number; touches: number } | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  
  const handlePhotoClick = (photo: PhotoBankPhoto, e: React.MouseEvent) => {
    e.stopPropagation();
    setViewPhoto(photo);
  };
  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!viewPhoto) return;
    const currentIndex = photoBankPhotos.findIndex(p => p.id === viewPhoto.id);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < photoBankPhotos.length) {
      setViewPhoto(photoBankPhotos[newIndex]);
    }
  };

  const currentPhotoIndex = viewPhoto ? photoBankPhotos.findIndex(p => p.id === viewPhoto.id) : -1;
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photoBankPhotos.length - 1;

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
      setZoom(prev => Math.max(1, Math.min(2, prev + delta)));
    };

    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [viewPhoto, hasPrev, hasNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    if (touchCount === 1) {
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
        touches: touchCount
      });
    } else if (touchCount > 1) {
      setTouchStart({
        x: 0,
        y: 0,
        time: Date.now(),
        touches: touchCount
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart || !viewPhoto) return;

    if (touchStart.touches > 1) {
      setTouchStart(null);
      return;
    }

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
      time: Date.now()
    };

    const deltaX = touchEnd.x - touchStart.x;
    const deltaY = touchEnd.y - touchStart.y;
    const deltaTime = touchEnd.time - touchStart.time;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    if (deltaTime < 300 && absDeltaX < 10 && absDeltaY < 10) {
      setTouchStart(null);
      return;
    }

    if (absDeltaX > absDeltaY && absDeltaX > 50) {
      if (deltaX > 0 && hasPrev) {
        handleNavigate('prev');
        setZoom(1);
      } else if (deltaX < 0 && hasNext) {
        handleNavigate('next');
        setZoom(1);
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > 50) {
      const zoomSteps = Math.floor(absDeltaY / 50);
      if (deltaY < 0) {
        setZoom(prev => Math.min(2, prev + (zoomSteps * 0.15)));
      } else {
        setZoom(prev => Math.max(1, prev - (zoomSteps * 0.15)));
      }
    }

    setTouchStart(null);
  };

  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setZoom(1);
  };

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
                      <button
                        onClick={(e) => handlePhotoClick(photo, e)}
                        className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center transition-all z-10"
                      >
                        <Icon name="Eye" size={16} className="text-white" />
                      </button>
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

      <Dialog open={!!viewPhoto} onOpenChange={() => { setViewPhoto(null); setZoom(1); }}>
        <DialogContent hideCloseButton aria-describedby="photobank-photo-viewer" className="max-w-full max-h-full w-full h-full p-0 bg-black/95 border-0 rounded-none">
          {viewPhoto && (
            <div id="photobank-photo-viewer" className="relative w-full h-full flex items-center justify-center">
              {!isLandscape && (
                <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-50">
                  <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    {currentPhotoIndex + 1} / {photoBankPhotos.length}
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
              )}

              {isLandscape && (
                <button
                  onClick={() => setViewPhoto(null)}
                  className="absolute top-2 right-2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                >
                  <Icon name="X" size={20} className="text-white" />
                </button>
              )}

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
              
              <div 
                className="relative w-full h-full flex items-center justify-center overflow-auto"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                <img
                  src={viewPhoto.s3_url || viewPhoto.data_url || ''}
                  alt={viewPhoto.file_name}
                  className="object-contain cursor-move transition-transform duration-200 select-none"
                  style={{
                    transform: `scale(${zoom})`,
                    maxWidth: '100%',
                    maxHeight: isLandscape ? '100vh' : 'calc(100vh - 200px)'
                  }}
                  onDoubleClick={handleDoubleTap}
                  onTouchEnd={(e) => {
                    if (e.timeStamp - (touchStart?.time || 0) < 300) {
                      handleDoubleTap(e);
                    }
                  }}
                  draggable={false}
                />
              </div>

              {!isLandscape && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 md:p-6">
                <p className="text-white font-medium text-lg mb-2">{viewPhoto.file_name}</p>
                <div className="flex items-center gap-4 text-white/70 text-sm mb-4">
                  <span>{formatBytes(viewPhoto.file_size)}</span>
                  {viewPhoto.width && viewPhoto.height && (
                    <span>{viewPhoto.width} × {viewPhoto.height}</span>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!photoBankSelectedPhotos.has(viewPhoto.id)) {
                      onTogglePhotoSelection(viewPhoto.id);
                    }
                    setViewPhoto(null);
                  }}
                  disabled={photoBankSelectedPhotos.has(viewPhoto.id)}
                  className="bg-purple-600/80 hover:bg-purple-600 text-white border-0"
                >
                  {photoBankSelectedPhotos.has(viewPhoto.id) ? (
                    <>
                      <Icon name="Check" size={16} className="mr-2" />
                      Уже выбрано
                    </>
                  ) : (
                    <>
                      <Icon name="Plus" size={16} className="mr-2" />
                      Добавить в фотобук
                    </>
                  )}
                </Button>
              </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PhotoBankTab;