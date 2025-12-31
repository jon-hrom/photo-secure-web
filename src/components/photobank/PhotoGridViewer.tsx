import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import PhotoExifDialog from './PhotoExifDialog';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
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
  formatBytes: (bytes: number) => string;
}

const PhotoGridViewer = ({
  viewPhoto,
  photos,
  onClose,
  onNavigate,
  formatBytes
}: PhotoGridViewerProps) => {
  const [zoom, setZoom] = useState(1);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; time: number; touches: number } | null>(null);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showExif, setShowExif] = useState(false);

  const currentPhotoIndex = viewPhoto ? photos.findIndex(p => p.id === viewPhoto.id) : -1;
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photos.length - 1;

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
        onNavigate('prev');
        setZoom(1);
      } else if (deltaX < 0 && hasNext) {
        onNavigate('next');
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

  const handleCloseDialog = () => {
    onClose();
    setZoom(1);
  };

  if (!viewPhoto) return null;

  return (
    <Dialog open={!!viewPhoto} onOpenChange={handleCloseDialog}>
      <DialogContent hideCloseButton className="max-w-full max-h-full w-full h-full p-0 bg-black/95 border-0 rounded-none">
        <div className="relative w-full h-full flex items-center justify-center">
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
          >
            {viewPhoto.is_raw && !viewPhoto.thumbnail_s3_url ? (
              <div className="flex flex-col items-center justify-center text-white/60 p-8">
                <Icon name="Loader2" size={48} className="animate-spin mb-4" />
                <p className="text-lg mb-2">Конвертация RAW файла...</p>
                <p className="text-sm text-white/40">Это может занять до минуты</p>
              </div>
            ) : (
              <img
                src={viewPhoto.thumbnail_s3_url || viewPhoto.s3_url || viewPhoto.data_url || ''}
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
          s3Key={
            viewPhoto.s3_url
              ? viewPhoto.s3_url.replace('https://storage.yandexcloud.net/foto-mix/', '')
              : ''
          }
          fileName={viewPhoto.file_name}
          photoUrl={viewPhoto.s3_url || viewPhoto.data_url}
        />
      )}
    </Dialog>
  );
};

export default PhotoGridViewer;