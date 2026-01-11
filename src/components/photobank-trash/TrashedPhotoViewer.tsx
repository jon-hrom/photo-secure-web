import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { TrashedPhoto } from './types';

interface TrashedPhotoViewerProps {
  viewPhoto: TrashedPhoto | null;
  photos: TrashedPhoto[];
  restoring: number | null;
  deleting: number | null;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onRestorePhoto: (photoId: number, fileName: string) => void;
  onDeletePhotoForever: (photoId: number, fileName: string) => void;
  getDaysLeftBadge: (dateStr: string) => { days: number; variant: string; text: string };
  formatDate: (dateStr: string) => string;
  formatBytes: (bytes: number) => string;
}

const TrashedPhotoViewer = ({
  viewPhoto,
  photos,
  restoring,
  deleting,
  onClose,
  onNavigate,
  onRestorePhoto,
  onDeletePhotoForever,
  getDaysLeftBadge,
  formatDate,
  formatBytes
}: TrashedPhotoViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number; touches: number } | null>(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const [isLandscape, setIsLandscape] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const currentPhotoIndex = viewPhoto ? photos.findIndex(p => p.id === viewPhoto.id) : -1;
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photos.length - 1;

  useEffect(() => {
    if (viewPhoto) {
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    }
  }, [viewPhoto?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!viewPhoto) return;
      
      if (e.key === 'Escape') {
        onClose();
        setZoom(1);
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onNavigate('prev');
        setZoom(1);
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNavigate('next');
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
      if (zoom > 1) {
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

    console.log('[TRASH_TOUCH] TouchEnd:', {
      deltaX,
      deltaY,
      absDeltaX,
      absDeltaY,
      deltaTime,
      zoom,
      isUpperHalf,
      isDrag: deltaTime > 150,
      touchStartY: touchStart.y,
      screenHeight: window.innerHeight
    });

    // Если это был drag (долгое удержание) - просто завершаем, не меняем zoom
    if (deltaTime > 150 && zoom > 1) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    // Обработка двойного тапа
    const now = Date.now();
    if (deltaTime < 300 && absDeltaX < 10 && absDeltaY < 10) {
      if (now - lastTapTime < 300) {
        // Двойной тап - сброс zoom
        setZoom(1);
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
    if (zoom > 1 && absDeltaY > 50 && absDeltaY > absDeltaX) {
      const zoomSteps = Math.floor(absDeltaY / 100);
      
      // Свайп вниз с верхней половины экрана - уменьшение
      if (deltaY > 0 && isUpperHalf) {
        setZoom(prev => {
          const newZoom = Math.max(1, prev - (zoomSteps * 0.3));
          if (newZoom <= 1.3) {
            setPanOffset({ x: 0, y: 0 });
            return 1;
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
    if (zoom > 1) {
      setTouchStart(null);
      setDragStart(null);
      return;
    }

    // Фото не увеличено (zoom === 1)
    if (absDeltaX > absDeltaY && absDeltaX > 50) {
      // Горизонтальный свайп - переключение фото
      if (deltaX > 0 && hasPrev) {
        onNavigate('prev');
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      } else if (deltaX < 0 && hasNext) {
        onNavigate('next');
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
      }
    } else if (absDeltaY > absDeltaX && absDeltaY > 50) {
      // Вертикальный свайп вверх - приближение
      if (deltaY < 0) {
        const zoomSteps = Math.floor(absDeltaY / 100);
        setZoom(prev => {
          const newZoom = prev === 1 ? 1.3 : Math.min(2.5, prev + (zoomSteps * 0.3));
          return newZoom;
        });
      }
    }

    setTouchStart(null);
    setDragStart(null);
  };

  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleCloseDialog = () => {
    onClose();
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setDragStart(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      offsetX: panOffset.x,
      offsetY: panOffset.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || zoom <= 1) return;
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
    
    const now = Date.now();
    const holdTime = now - touchStart.time;
    
    // Если увеличено и держим больше 150ms - это drag для перемещения
    if (zoom > 1 && holdTime > 150) {
      e.preventDefault();
      
      // Инициализируем dragStart если его нет
      if (!dragStart) {
        setDragStart({
          x: touchStart.x,
          y: touchStart.y,
          offsetX: panOffset.x,
          offsetY: panOffset.y
        });
        return;
      }
      
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
      <DialogContent hideCloseButton aria-describedby="trash-photo-viewer" className="max-w-full max-h-full w-full h-full p-0 bg-black/95 border-0 rounded-none" style={{ touchAction: 'none' }}>
        <div id="trash-photo-viewer" className="relative w-full h-full flex items-center justify-center" style={{ touchAction: 'none' }}>
          {!isLandscape && (
            <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-50">
              <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                {currentPhotoIndex + 1} / {photos.length}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  {Math.round(zoom * 100)}%
                </div>
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
              onClick={() => { onNavigate('prev'); setZoom(1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
            >
              <Icon name="ChevronLeft" size={28} className="text-white" />
            </button>
          )}

          {hasNext && (
            <button
              onClick={() => { onNavigate('next'); setZoom(1); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
            >
              <Icon name="ChevronRight" size={28} className="text-white" />
            </button>
          )}
          
          <div 
            className="relative w-full h-full flex items-center justify-center overflow-auto"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={viewPhoto.s3_url || ''}
              alt={viewPhoto.file_name}
              className="object-contain transition-transform duration-200 select-none touch-manipulation"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                maxWidth: '100%',
                maxHeight: isLandscape ? '100vh' : 'calc(100vh - 200px)',
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                touchAction: 'none'
              }}
              draggable={false}
            />
          </div>

          {!isLandscape && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 md:p-6">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-white font-medium text-lg">{viewPhoto.file_name}</p>
                <Badge 
                  variant={getDaysLeftBadge(viewPhoto.trashed_at).variant as any}
                  className="text-xs"
                >
                  <Icon name="Clock" size={12} className="mr-1" />
                  {getDaysLeftBadge(viewPhoto.trashed_at).text}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-white/70 text-sm mb-4">
                <span>{formatBytes(viewPhoto.file_size || 0)}</span>
                {viewPhoto.width && viewPhoto.height && (
                  <span>{viewPhoto.width} × {viewPhoto.height}</span>
                )}
                <span>Удалено: {formatDate(viewPhoto.trashed_at)}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRestorePhoto(viewPhoto.id, viewPhoto.file_name);
                    handleCloseDialog();
                  }}
                  disabled={restoring === viewPhoto.id}
                  className="bg-green-600/80 hover:bg-green-600 text-white border-0"
                >
                  {restoring === viewPhoto.id ? (
                    <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Icon name="Undo2" size={16} className="mr-2" />
                  )}
                  Восстановить
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePhotoForever(viewPhoto.id, viewPhoto.file_name);
                    handleCloseDialog();
                  }}
                  disabled={deleting === viewPhoto.id}
                  className="bg-red-600/80 hover:bg-red-600 border-0"
                >
                  {deleting === viewPhoto.id ? (
                    <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Icon name="Trash2" size={16} className="mr-2" />
                  )}
                  Удалить навсегда
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrashedPhotoViewer;