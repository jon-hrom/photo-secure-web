import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotoExifDialog from './PhotoExifDialog';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface PhotoGridViewerProps {
  viewPhoto: Photo | null;
  photos: Photo[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onDownload: (s3Key: string, fileName: string, userId: number) => Promise<void>;
  formatBytes: (bytes: number) => string;
}

const PhotoGridViewer = ({
  viewPhoto,
  photos,
  onClose,
  onNavigate,
  onDownload,
  formatBytes
}: PhotoGridViewerProps) => {
  const [zoom, setZoom] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number; touches: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showExif, setShowExif] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoadingFullRes, setIsLoadingFullRes] = useState(false);

  const currentPhotoIndex = viewPhoto ? photos.findIndex(p => p.id === viewPhoto.id) : -1;
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photos.length - 1;

  useEffect(() => {
    if (viewPhoto) {
      setZoom(0);
      setPanOffset({ x: 0, y: 0 });
      setImageError(false);
      setIsLoadingFullRes(false);
    }
  }, [viewPhoto?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewPhoto) return;
      
      if (e.key === 'Escape') {
        onClose();
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onNavigate('prev');
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNavigate('next');
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (!viewPhoto) return;
      e.preventDefault();
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom(prev => {
        if (prev === 0) {
          setPanOffset({ x: 0, y: 0 });
          setImageError(false);
          return delta > 0 ? 1.1 : 0;
        }
        const newZoom = prev + delta;
        if (newZoom < 0.5) {
          setPanOffset({ x: 0, y: 0 });
          setImageError(false);
          return 0;
        }
        return Math.max(0, Math.min(2, newZoom));
      });
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
  }, [viewPhoto, hasPrev, hasNext, onClose, onNavigate]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touchCount = e.touches.length;
    if (touchCount === 1) {
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
        touches: touchCount
      });
      if (zoom > 0) {
        setDragStart({
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          offsetX: panOffset.x,
          offsetY: panOffset.y
        });
      }
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
      setDragStart(null);
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
    const isUpperHalf = touchStart.y < window.innerHeight / 2;

    console.log('[TOUCH] TouchEnd:', {
      deltaX,
      deltaY,
      absDeltaX,
      absDeltaY,
      deltaTime,
      zoom,
      isUpperHalf,
      touchStartY: touchStart.y,
      screenHeight: window.innerHeight
    });

    // Обработка двойного тапа
    const now = Date.now();
    if (deltaTime < 300 && absDeltaX < 10 && absDeltaY < 10) {
      if (now - lastTapTime < 300) {
        // Двойной тап - сброс zoom
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
        setLastTapTime(0);
        setTouchStart(null);
        setDragStart(null);
        return;
      }
      setLastTapTime(now);
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    // Если фото увеличено - обработка вертикальных свайпов
    if (zoom > 0 && absDeltaY > 50 && absDeltaY > absDeltaX) {
      const zoomSteps = Math.floor(absDeltaY / 100);
      
      // Свайп вниз с верхней половины экрана - уменьшение
      if (deltaY > 0 && isUpperHalf) {
        setZoom(prev => {
          const newZoom = Math.max(0, prev - (zoomSteps * 0.3));
          if (newZoom < 0.3) {
            setPanOffset({ x: 0, y: 0 });
            return 0;
          }
          return newZoom;
        });
        setTouchStart(null);
        setDragStart(null);
        return;
      }
      
      // Свайп вверх - увеличение
      if (deltaY < 0) {
        setZoom(prev => {
          const newZoom = Math.min(2.5, prev + (zoomSteps * 0.3));
          return newZoom;
        });
        setTouchStart(null);
        setDragStart(null);
        return;
      }
    }

    // Если фото увеличено и это не вертикальный свайп - это drag для перемещения
    if (zoom > 0) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    // Фото не увеличено (zoom === 0)
    if (absDeltaX > absDeltaY && absDeltaX > 50) {
      // Горизонтальный свайп - переключение фото
      if (deltaX > 0 && hasPrev) {
        onNavigate('prev');
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      } else if (deltaX < 0 && hasNext) {
        onNavigate('next');
        setZoom(0);
        setPanOffset({ x: 0, y: 0 });
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > 50) {
      // Вертикальный свайп вверх - приближение
      if (deltaY < 0) {
        const zoomSteps = Math.floor(absDeltaY / 100);
        setZoom(prev => {
          const newZoom = prev === 0 ? 0.3 : Math.min(2.5, prev + (zoomSteps * 0.3));
          return newZoom;
        });
      }
    }

    setTouchStart(null);
    setDragStart(null);
  };

  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setZoom(0);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleCloseDialog = () => {
    onClose();
    setZoom(0);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDragStart(null);
    setImageError(false);
    setIsLoadingFullRes(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || zoom <= 0) return;
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    setPanOffset({
      x: dragStart.offsetX + deltaX,
      y: dragStart.offsetY + deltaY
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart || touchStart.touches > 1) return;
    
    // Если увеличено - двигаем фото
    if (zoom > 0 && dragStart) {
      e.preventDefault();
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;
      setPanOffset({
        x: dragStart.offsetX + deltaX,
        y: dragStart.offsetY + deltaY
      });
    }
  };

  if (!viewPhoto) return null;

  return (
    <Dialog open={!!viewPhoto} onOpenChange={handleCloseDialog}>
      <DialogContent hideCloseButton className="max-w-full max-h-full w-full h-full p-0 bg-black/95 border-0 rounded-none" style={{ touchAction: 'none' }}>
        <VisuallyHidden>
          <DialogTitle>Просмотр фото {viewPhoto.file_name}</DialogTitle>
        </VisuallyHidden>
        <VisuallyHidden>
          <p id="photo-viewer-description">Галерея для просмотра изображений с возможностью масштабирования и навигации</p>
        </VisuallyHidden>
        <div className="relative w-full h-full flex items-center justify-center" style={{ touchAction: 'none' }}>
          {!isLandscape && (
            <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-50">
              <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                {currentPhotoIndex + 1} / {photos.length}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {zoom === 0 ? '100%' : `${Math.round((1 + zoom) * 100)}%`}
                </div>
                <button
                  onClick={async () => {
                    if (viewPhoto.s3_key) {
                      const userIdStr = getAuthUserId();
                      const userId = userIdStr ? parseInt(userIdStr, 10) : 0;
                      if (userId) {
                        await onDownload(viewPhoto.s3_key, viewPhoto.file_name, userId);
                      }
                    }
                  }}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                  title="Скачать фото"
                >
                  <Icon name="Download" size={20} className="text-white" />
                </button>
                <button
                  onClick={() => setShowExif(true)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                  title="Информация о фото"
                >
                  <Icon name="Info" size={20} className="text-white" />
                </button>
                <button
                  onClick={handleCloseDialog}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                >
                  <Icon name="X" size={24} className="text-white" />
                </button>
              </div>
            </div>
          )}

          {isLandscape && (
            <button
              onClick={handleCloseDialog}
              className="absolute top-2 right-2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
            >
              <Icon name="X" size={20} className="text-white" />
            </button>
          )}

          {hasPrev && (
            <button
              onClick={() => { onNavigate('prev'); setZoom(0); setPanOffset({ x: 0, y: 0 }); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
            >
              <Icon name="ChevronLeft" size={28} className="text-white" />
            </button>
          )}

          {hasNext && (
            <button
              onClick={() => { onNavigate('next'); setZoom(0); setPanOffset({ x: 0, y: 0 }); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
            >
              <Icon name="ChevronRight" size={28} className="text-white" />
            </button>
          )}
          
          <div 
            className="relative w-full h-full flex items-center justify-center overflow-auto"
          >
            {viewPhoto.is_raw && !viewPhoto.thumbnail_s3_url ? (
              <div className="flex flex-col items-center justify-center text-white/60 p-8">
                <Icon name="Loader2" size={48} className="animate-spin mb-4" />
                <p className="text-lg mb-2">Конвертация RAW файла...</p>
                <p className="text-sm text-white/40">Это может занять до минуты</p>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Превью изображение - показывается только при zoom === 0 или как fallback при загрузке full-res */}
                {(zoom === 0 || isLoadingFullRes || imageError || !viewPhoto.s3_url) && (
                  <img
                    src={viewPhoto.thumbnail_s3_url || viewPhoto.s3_url || viewPhoto.data_url || ''}
                    alt={viewPhoto.file_name}
                    className="object-contain cursor-move select-none touch-manipulation"
                    style={{
                      transform: zoom > 0 
                        ? `scale(${1 + zoom}) translate(${panOffset.x / (1 + zoom)}px, ${panOffset.y / (1 + zoom)}px)` 
                        : 'none',
                      maxWidth: zoom === 0 ? '90vw' : '100%',
                      maxHeight: zoom === 0 ? (isLandscape ? '85vh' : '70vh') : (isLandscape ? '100vh' : 'calc(100vh - 200px)'),
                      cursor: zoom === 0 ? 'zoom-in' : (isDragging ? 'grabbing' : 'grab'),
                      transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                      imageRendering: zoom > 0.5 ? 'high-quality' : 'auto',
                      touchAction: 'none'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    draggable={false}
                  />
                )}
                {/* Full-res изображение - показывается ВМЕСТО превью при zoom > 0 
                    Для RAW используем thumbnail, для обычных - s3_url */}
                {zoom > 0 && !imageError && (viewPhoto.is_raw ? viewPhoto.thumbnail_s3_url : viewPhoto.s3_url) && (
                  <img
                    src={viewPhoto.is_raw ? viewPhoto.thumbnail_s3_url : viewPhoto.s3_url}
                    alt={viewPhoto.file_name}
                    className="object-contain cursor-move select-none touch-manipulation"
                    style={{
                      transform: `scale(${1 + zoom}) translate(${panOffset.x / (1 + zoom)}px, ${panOffset.y / (1 + zoom)}px)`,
                      maxWidth: '100%',
                      maxHeight: isLandscape ? '100vh' : 'calc(100vh - 200px)',
                      cursor: isDragging ? 'grabbing' : 'grab',
                      transition: isDragging ? 'none' : 'transform 0.2s ease-out',
                      imageRendering: zoom > 0.5 ? 'high-quality' : 'auto',
                      opacity: isLoadingFullRes ? 0 : 1,
                      touchAction: 'none'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onLoad={() => {
                      console.log('[PHOTO_VIEWER] Full-res loaded:', viewPhoto.file_name, 'isRAW:', viewPhoto.is_raw);
                      setIsLoadingFullRes(false);
                    }}
                    onError={(e) => {
                      console.error('[PHOTO_VIEWER] Full-res image load error:', {
                        fileName: viewPhoto.file_name,
                        isRAW: viewPhoto.is_raw,
                        s3Url: viewPhoto.s3_url,
                        thumbnailUrl: viewPhoto.thumbnail_s3_url,
                        s3Key: viewPhoto.s3_key,
                        error: e
                      });
                      setImageError(true);
                      setIsLoadingFullRes(false);
                    }}
                    onLoadStart={() => {
                      console.log('[PHOTO_VIEWER] Full-res loading started:', viewPhoto.is_raw ? viewPhoto.thumbnail_s3_url : viewPhoto.s3_url);
                      setIsLoadingFullRes(true);
                    }}
                    draggable={false}
                  />
                )}
                {isLoadingFullRes && zoom > 0 && (
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full flex items-center gap-2">
                    <Icon name="Loader2" size={16} className="animate-spin text-white/80" />
                    <span className="text-xs text-white/80">Загрузка...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {!isLandscape && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 md:p-6">
              <p className="text-white font-medium text-lg mb-2">{viewPhoto.file_name}</p>
              <div className="flex items-center gap-4 text-white/70 text-sm">
                <span>{formatBytes(viewPhoto.file_size)}</span>
                {viewPhoto.width && viewPhoto.height && (
                  <span>{viewPhoto.width} × {viewPhoto.height}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {viewPhoto && (
        <PhotoExifDialog
          open={showExif}
          onOpenChange={setShowExif}
          s3Key={viewPhoto.s3_key || ''}
          fileName={viewPhoto.file_name}
          photoUrl={viewPhoto.s3_url || viewPhoto.data_url}
        />
      )}
    </Dialog>
  );
};

export default PhotoGridViewer;