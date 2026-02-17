import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import Icon from '@/components/ui/icon';
import VideoPlayer from '@/components/photobank/VideoPlayer';
import { useGalleryGestures } from '@/hooks/useGalleryGestures';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
  is_video?: boolean;
  content_type?: string;
}

interface WatermarkSettings {
  enabled: boolean;
  type: string;
  text?: string;
  image_url?: string;
  frequency: number;
  size: number;
  opacity: number;
  rotation?: number;
}

interface GalleryPhotoViewerProps {
  photos: Photo[];
  initialPhotoId: number;
  onClose: () => void;
  downloadDisabled?: boolean;
  screenshotProtection?: boolean;
  watermark?: WatermarkSettings;
  onDownload?: (photo: Photo) => void;
}

export default function GalleryPhotoViewer({
  photos,
  initialPhotoId,
  onClose,
  downloadDisabled = false,
  screenshotProtection = false,
  watermark,
  onDownload
}: GalleryPhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(() => 
    photos.findIndex(p => p.id === initialPhotoId) || 0
  );
  const [showHelp, setShowHelp] = useState(() => {
    const hasSeenHelp = localStorage.getItem('gallery-help-seen');
    return !hasSeenHelp;
  });

  const handleCloseHelp = () => {
    localStorage.setItem('gallery-help-seen', 'true');
    setShowHelp(false);
  };

  const currentPhoto = photos[currentIndex];

  const handleNavigate = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < photos.length) {
      setCurrentIndex(newIndex);
    }
  };

  const {
    zoom,
    panOffset,
    isDragging,
    isZooming,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    resetZoom
  } = useGalleryGestures({
    currentPhoto,
    photos,
    currentIndex,
    onNavigate: handleNavigate
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handleNavigate('prev');
      if (e.key === 'ArrowRight') handleNavigate('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  if (!currentPhoto) return null;

  if (currentPhoto.is_video) {
    console.log('[GALLERY_PHOTO_VIEWER] Opening video:', currentPhoto);
    
    // Для видео используем photo_url (это оригинальный файл с CDN)
    const videoSrc = currentPhoto.photo_url;
    
    return (
      <VideoPlayer
        src={videoSrc}
        poster={currentPhoto.thumbnail_url}
        onClose={onClose}
        fileName={currentPhoto.file_name}
        downloadDisabled={downloadDisabled}
      />
    );
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent 
        hideCloseButton 
        className="max-w-full max-h-full w-full h-full p-0 bg-black/95 border-0 rounded-none" 
        style={{ touchAction: 'none' }}
      >
        <VisuallyHidden>
          <DialogTitle>Просмотр фото {currentPhoto.file_name}</DialogTitle>
        </VisuallyHidden>

        {/* Верхняя панель */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-50 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
              {currentIndex + 1} / {photos.length}
            </div>
            <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full max-w-xs truncate">
              {currentPhoto.file_name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {zoom > 0 && (
              <button
                onClick={resetZoom}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                title="Сбросить увеличение"
              >
                <Icon name="ZoomOut" size={20} className="text-white" />
              </button>
            )}
            {!downloadDisabled && onDownload && (
              <button
                onClick={() => onDownload(currentPhoto)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
                title="Скачать фото"
              >
                <Icon name="Download" size={20} className="text-white" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 sm:w-8 sm:h-8 min-w-[44px] min-h-[44px] rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 animate-pulse-once"
            >
              <Icon name="X" size={20} className="text-white" />
            </button>
          </div>
        </div>

        {/* Область изображения */}
        <div 
          className="relative w-full h-full flex items-center justify-center overflow-hidden"
          style={{ cursor: zoom === 0 ? 'zoom-in' : (isDragging ? 'grabbing' : 'grab'), touchAction: 'none' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={currentPhoto.photo_url}
            alt={currentPhoto.file_name}
            className="object-contain select-none touch-manipulation"
            style={{
              transform: zoom > 0 
                ? `scale(${1 + zoom}) translate(${panOffset.x / (1 + zoom)}px, ${panOffset.y / (1 + zoom)}px)` 
                : 'none',
              maxWidth: zoom === 0 ? '90vw' : '100%',
              maxHeight: zoom === 0 ? '85vh' : '100vh',
              transition: isDragging ? 'none' : (isZooming ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'transform 0.2s ease-out'),
              touchAction: 'none',
              pointerEvents: 'none'
            }}
            onContextMenu={(e) => screenshotProtection && e.preventDefault()}
            draggable={false}
          />
        </div>

        {/* Кнопки навигации */}
        {currentIndex > 0 && (
          <button
            onClick={() => handleNavigate('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
          >
            <Icon name="ChevronLeft" size={28} className="text-white" />
          </button>
        )}

        {currentIndex < photos.length - 1 && (
          <button
            onClick={() => handleNavigate('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
          >
            <Icon name="ChevronRight" size={28} className="text-white" />
          </button>
        )}

        {/* Нижняя панель с информацией */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 md:p-6">
          <p className="text-white font-medium text-lg mb-2">{currentPhoto.file_name}</p>
          <div className="flex items-center gap-4 text-white/70 text-sm">
            {currentPhoto.file_size && <span>{(currentPhoto.file_size / 1024 / 1024).toFixed(2)} МБ</span>}
            {currentPhoto.width && currentPhoto.height && (
              <span>{currentPhoto.width} × {currentPhoto.height}</span>
            )}
          </div>
        </div>

        {/* Подсказка по жестам */}
        {showHelp && (
          <div className="absolute inset-0 bg-black/95 z-[100] flex items-center justify-center p-6">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Как пользоваться просмотром
                </h3>
                <p className="text-gray-600 text-sm">
                  Используйте жесты для удобного просмотра фотографий
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="ArrowLeftRight" size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Свайп влево/вправо</p>
                    <p className="text-sm text-gray-600">Переключение между фото</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="ArrowUp" size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Свайп вверх</p>
                    <p className="text-sm text-gray-600">Увеличить фото (300%)</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="ZoomIn" size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Два пальца</p>
                    <p className="text-sm text-gray-600">Pinch-zoom для точного масштабирования</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="Move" size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Перетаскивание</p>
                    <p className="text-sm text-gray-600">Перемещайте увеличенное фото пальцем</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="ArrowDown" size={20} className="text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Уменьшить</p>
                    <p className="text-sm text-gray-600">Свайп вниз с верхней части экрана или двойной тап</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseHelp}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
              >
                ОК, понятно
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}