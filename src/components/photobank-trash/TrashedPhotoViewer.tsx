import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { TrashedPhoto } from './types';
import { useTrashedPhotoGestures } from './TrashedPhotoGestureHandlers';
import TrashedPhotoControls from './TrashedPhotoControls';
import TrashedPhotoContextMenu from './TrashedPhotoContextMenu';
import TrashedPhotoInfo from './TrashedPhotoInfo';

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
  const [isLandscape, setIsLandscape] = useState(false);

  // Используем кастомный хук для всей логики жестов
  const {
    zoom,
    panOffset,
    isDragging,
    isZooming,
    showContextMenu,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleCloseDialog,
    setShowContextMenu,
    resetZoom
  } = useTrashedPhotoGestures({
    viewPhoto,
    photos,
    onClose,
    onNavigate
  });

  // Отслеживание ориентации экрана
  useEffect(() => {
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  if (!viewPhoto) return null;

  return (
    <Dialog open={!!viewPhoto} onOpenChange={handleCloseDialog}>
      <DialogContent hideCloseButton aria-describedby="trash-photo-viewer" className="max-w-full max-h-full w-full h-full p-0 bg-black/95 border-0 rounded-none" style={{ touchAction: 'none' }}>
        <div id="trash-photo-viewer" className="relative w-full h-full flex items-center justify-center" style={{ touchAction: 'none' }}>
          
          {/* Элементы управления (верхняя панель, навигация) */}
          <TrashedPhotoControls
            viewPhoto={viewPhoto}
            photos={photos}
            zoom={zoom}
            isLandscape={isLandscape}
            onClose={handleCloseDialog}
            onNavigate={onNavigate}
            onResetZoom={resetZoom}
          />
          
          {/* Область с изображением */}
          <div 
            className="relative w-full h-full flex items-center justify-center overflow-auto"
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
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
              className="object-contain select-none touch-manipulation"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                maxWidth: '100%',
                maxHeight: isLandscape ? '100vh' : 'calc(100vh - 200px)',
                touchAction: 'none',
                transition: isDragging ? 'none' : (isZooming ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'transform 0.2s ease-out'),
                imageRendering: zoom >= 3.0 ? 'high-quality' : 'auto',
                pointerEvents: 'none'
              }}
              draggable={false}
            />
          </div>

          {/* Нижняя панель с информацией и кнопками */}
          <TrashedPhotoInfo
            viewPhoto={viewPhoto}
            restoring={restoring}
            deleting={deleting}
            isLandscape={isLandscape}
            onRestorePhoto={onRestorePhoto}
            onDeletePhotoForever={onDeletePhotoForever}
            onCloseDialog={handleCloseDialog}
            getDaysLeftBadge={getDaysLeftBadge}
            formatDate={formatDate}
            formatBytes={formatBytes}
          />

          {/* Контекстное меню */}
          <TrashedPhotoContextMenu
            viewPhoto={viewPhoto}
            showContextMenu={showContextMenu}
            onClose={() => setShowContextMenu(false)}
            onRestorePhoto={onRestorePhoto}
            onDeletePhotoForever={onDeletePhotoForever}
            getDaysLeftBadge={getDaysLeftBadge}
            formatDate={formatDate}
            formatBytes={formatBytes}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrashedPhotoViewer;