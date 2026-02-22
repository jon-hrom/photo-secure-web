import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showUI, setShowUI] = useState(true);

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

  // Helpers: enter / exit real fullscreen
  type ExtendedElement = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> };
  type ExtendedDocument = Document & {
    webkitExitFullscreen?: () => Promise<void>;
    webkitFullscreenElement?: Element | null;
  };

  const enterFullscreen = useCallback(async () => {
    const el = containerRef.current as ExtendedElement | null;
    if (!el) return;
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      }
    } catch (_) { /* browser denied */ }
  }, []);

  const exitFullscreen = useCallback(async () => {
    const doc = document as ExtendedDocument;
    try {
      if (document.exitFullscreen && document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (doc.webkitExitFullscreen && doc.webkitFullscreenElement) {
        await doc.webkitExitFullscreen();
      }
    } catch (_) { /* ignore */ }
  }, []);

  // Sync isFullscreen state with native fullscreen events
  useEffect(() => {
    const onFsChange = () => {
      const doc = document as ExtendedDocument;
      const isFull = !!(document.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull) setShowUI(true);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  // Auto fullscreen on landscape orientation
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        enterFullscreen();
        setShowUI(false);
      } else {
        exitFullscreen();
      }
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [enterFullscreen, exitFullscreen]);

  // Exit fullscreen on unmount
  useEffect(() => {
    return () => { exitFullscreen(); };
  }, [exitFullscreen]);

  const handleSingleTap = useCallback(() => {
    setShowUI(prev => !prev);
  }, []);

  const handleDoubleTap = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
      setShowUI(false);
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

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
    onNavigate: handleNavigate,
    onSingleTap: handleSingleTap,
    onDoubleTap: handleDoubleTap,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          exitFullscreen();
        } else {
          onClose();
        }
      }
      if (e.key === 'ArrowLeft') handleNavigate('prev');
      if (e.key === 'ArrowRight') handleNavigate('next');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFullscreen]);

  // Reset image quality state when photo changes
  useEffect(() => {
    setFullImageLoaded(false);
    setShowFullImage(false);
  }, [currentPhoto?.id]);

  // Reset download modal when photo changes
  useEffect(() => {
    setShowDownloadModal(false);
  }, [currentIndex]);

  // When zoom > 0, start loading full quality image
  useEffect(() => {
    if (zoom > 0 && currentPhoto?.thumbnail_url && !fullImageLoaded) {
      setShowFullImage(true);
      const img = new Image();
      img.onload = () => setFullImageLoaded(true);
      img.src = currentPhoto.photo_url;
    }
  }, [zoom, currentPhoto, fullImageLoaded]);

  // Preload adjacent thumbnails
  useEffect(() => {
    const preloadIndexes = [currentIndex - 1, currentIndex + 1].filter(
      i => i >= 0 && i < photos.length
    );
    preloadIndexes.forEach(i => {
      const src = photos[i].thumbnail_url || photos[i].photo_url;
      const img = new Image();
      img.src = src;
    });
  }, [currentIndex, photos]);

  if (!currentPhoto) return null;

  const displaySrc = (!currentPhoto.thumbnail_url || showFullImage) 
    ? currentPhoto.photo_url 
    : currentPhoto.thumbnail_url;

  if (currentPhoto.is_video) {
    console.log('[GALLERY_PHOTO_VIEWER] Opening video:', currentPhoto);
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

  // In fullscreen: photo fills entire screen, object-fit: contain, no padding
  const imgMaxWidth = isFullscreen ? '100vw' : (zoom === 0 ? '96vw' : '100%');
  const imgMaxHeight = isFullscreen ? '100vh' : (zoom === 0 ? 'calc(100vh - 100px)' : '100vh');

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent 
        hideCloseButton 
        className="max-w-full max-h-full w-full h-full p-0 bg-black border-0 rounded-none" 
        style={{ touchAction: 'none' }}
      >
        <VisuallyHidden>
          <DialogTitle>Просмотр фото {currentPhoto.file_name}</DialogTitle>
        </VisuallyHidden>
        <div ref={containerRef} className="absolute inset-0 bg-black" style={{ touchAction: 'none' }}>

        {/* Верхняя панель */}
        <div 
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 z-50 transition-opacity duration-300"
          style={{ 
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            opacity: showUI ? 1 : 0,
            pointerEvents: showUI ? 'auto' : 'none'
          }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-2">
            <div className="text-white/80 text-xs bg-black/40 backdrop-blur-sm px-2.5 py-1.5 rounded-full flex-shrink-0">
              {currentIndex + 1} / {photos.length}
            </div>
            <div className="text-white/70 text-xs bg-black/30 backdrop-blur-sm px-2.5 py-1.5 rounded-full truncate hidden sm:block">
              {currentPhoto.file_name}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isFullscreen && (
              <button
                onClick={() => exitFullscreen()}
                className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
                style={{ width: 44, height: 44 }}
                title="Выйти из полного экрана"
              >
                <Icon name="Minimize2" size={20} className="text-white" />
              </button>
            )}
            {zoom > 0 && (
              <button
                onClick={resetZoom}
                className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
                style={{ width: 44, height: 44 }}
                title="Сбросить увеличение"
              >
                <Icon name="ZoomOut" size={20} className="text-white" />
              </button>
            )}
            {!downloadDisabled && onDownload && (
              <button
                onClick={() => setShowDownloadModal(true)}
                className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
                style={{ width: 44, height: 44 }}
                title="Скачать фото"
              >
                <Icon name="Download" size={20} className="text-white" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-full bg-white/10 active:bg-white/30 backdrop-blur-sm transition-all"
              style={{ width: 44, height: 44 }}
            >
              <Icon name="X" size={22} className="text-white" />
            </button>
          </div>
        </div>

        {/* Область изображения */}
        <div 
          className="relative w-full h-full flex items-center justify-center overflow-hidden"
          style={{ cursor: zoom === 0 ? 'default' : (isDragging ? 'grabbing' : 'grab'), touchAction: 'none' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={displaySrc}
            alt={currentPhoto.file_name}
            className="object-contain select-none touch-manipulation"
            style={{
              transform: zoom > 0 
                ? `scale(${1 + zoom}) translate(${panOffset.x / (1 + zoom)}px, ${panOffset.y / (1 + zoom)}px)` 
                : 'none',
              maxWidth: imgMaxWidth,
              maxHeight: imgMaxHeight,
              width: isFullscreen ? '100vw' : undefined,
              height: isFullscreen ? '100vh' : undefined,
              transition: isDragging ? 'none' : (isZooming ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'transform 0.2s ease-out, max-width 0.3s ease, max-height 0.3s ease'),
              touchAction: 'none',
              pointerEvents: 'none'
            }}
            onContextMenu={(e) => screenshotProtection && e.preventDefault()}
            draggable={false}
          />
          {zoom > 0 && showFullImage && !fullImageLoaded && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full">
              Загрузка полного качества...
            </div>
          )}
        </div>

        {/* Кнопки навигации */}
        <div
          className="transition-opacity duration-300"
          style={{ opacity: showUI ? 1 : 0, pointerEvents: showUI ? 'auto' : 'none' }}
        >
          {currentIndex > 0 && (
            <button
              onClick={() => handleNavigate('prev')}
              className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/30 active:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all"
              style={{ width: 44, height: 44 }}
            >
              <Icon name="ChevronLeft" size={26} className="text-white" />
            </button>
          )}
          {currentIndex < photos.length - 1 && (
            <button
              onClick={() => handleNavigate('next')}
              className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/30 active:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all"
              style={{ width: 44, height: 44 }}
            >
              <Icon name="ChevronRight" size={28} className="text-white" />
            </button>
          )}
        </div>

        {/* Нижняя панель с информацией */}
        <div 
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-8 transition-opacity duration-300"
          style={{ 
            paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
            opacity: showUI ? 1 : 0,
            pointerEvents: showUI ? 'auto' : 'none'
          }}
        >
          <p className="text-white font-medium text-base mb-1 truncate">{currentPhoto.file_name}</p>
          <div className="flex items-center gap-4 text-white/60 text-xs">
            {currentPhoto.file_size && <span>{(currentPhoto.file_size / 1024 / 1024).toFixed(2)} МБ</span>}
            {currentPhoto.width && currentPhoto.height && (
              <span>{currentPhoto.width} × {currentPhoto.height}</span>
            )}
          </div>
        </div>

        {/* Подсказка по жестам */}
        {showHelp && (
          <div className="absolute inset-0 bg-black/95 z-[100] flex items-end sm:items-center justify-center"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="bg-white rounded-t-2xl sm:rounded-2xl p-5 max-w-md w-full space-y-4 sm:space-y-6 sm:mx-4">
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
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="Hand" size={20} className="text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Один тап</p>
                    <p className="text-sm text-gray-600">Скрыть / показать кнопки управления</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="Maximize2" size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Два тапа</p>
                    <p className="text-sm text-gray-600">Полный экран / выйти из полного экрана</p>
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
                    <Icon name="Smartphone" size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Поворот телефона</p>
                    <p className="text-sm text-gray-600">Горизонтально — автоматически полный экран</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <Icon name="X" size={20} className="text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Крестик (правый верхний угол)</p>
                    <p className="text-sm text-gray-600">Выйти из полного экрана или закрыть просмотр</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseHelp}
                className="w-full bg-blue-600 active:bg-blue-700 text-white font-medium rounded-xl transition-colors touch-manipulation"
                style={{ minHeight: 48 }}
              >
                ОК, понятно
              </button>
            </div>
          </div>
        )}

        {/* Модалка выбора качества скачивания */}
        {showDownloadModal && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowDownloadModal(false)}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 mx-4 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Скачать фото</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{currentPhoto.file_name}</p>
              
              <div className="space-y-3">
                {currentPhoto.thumbnail_url && (
                  <button
                    onClick={async () => {
                      setShowDownloadModal(false);
                      try {
                        const response = await fetch(currentPhoto.thumbnail_url!);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `web_${currentPhoto.file_name.replace(/\.[^.]+$/, '.jpg')}`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      } catch {
                        const a = document.createElement('a');
                        a.href = currentPhoto.thumbnail_url!;
                        a.download = `web_${currentPhoto.file_name.replace(/\.[^.]+$/, '.jpg')}`;
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                      <Icon name="Image" size={20} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white text-sm">Веб-версия</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Оптимизированное для интернета</p>
                    </div>
                  </button>
                )}
                <button
                  onClick={async () => {
                    setShowDownloadModal(false);
                    if (onDownload) {
                      onDownload(currentPhoto);
                    } else {
                      try {
                        const response = await fetch(currentPhoto.photo_url);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = currentPhoto.file_name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      } catch {
                        const a = document.createElement('a');
                        a.href = currentPhoto.photo_url;
                        a.download = currentPhoto.file_name;
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                    <Icon name="Download" size={20} className="text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">Оригинал</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Полное качество, оригинальный файл</p>
                  </div>
                </button>
              </div>

              <button
                onClick={() => setShowDownloadModal(false)}
                className="mt-4 w-full text-center text-sm text-gray-500 dark:text-gray-400 py-2"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}