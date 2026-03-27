import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import VideoPlayer from '@/components/photobank/VideoPlayer';
import { useGalleryGestures } from '@/hooks/useGalleryGestures';
import GalleryViewerTopBar from './GalleryViewerTopBar';
import GalleryViewerImage from './GalleryViewerImage';
import GalleryViewerHelpModal from './GalleryViewerHelpModal';
import GalleryViewerDownloadModal from './GalleryViewerDownloadModal';

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
    const isMob = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMob) return false;
    const key = 'gallery_help_shown';
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
    return true;
  });
  const [fullImageLoaded, setFullImageLoaded] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);

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

  // Устанавливаем --dvh CSS-переменную для корректного vh на мобиле (адресбар iOS/Android)
  useEffect(() => {
    const setDvh = () => {
      document.documentElement.style.setProperty('--dvh', `${window.innerHeight * 0.01}px`);
    };
    setDvh();
    window.addEventListener('resize', setDvh);
    window.addEventListener('orientationchange', setDvh);
    return () => {
      window.removeEventListener('resize', setDvh);
      window.removeEventListener('orientationchange', setDvh);
    };
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

  useEffect(() => {
    const isTouch = 'ontouchstart' in window;
    if (!isTouch) return;
    const mq = window.matchMedia('(orientation: landscape)');
    const apply = (landscape: boolean) => {
      setIsLandscapeMobile(landscape);
      if (landscape) {
        setShowUI(false);
      } else {
        setShowUI(true);
      }
    };
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Exit fullscreen on unmount
  useEffect(() => {
    return () => { exitFullscreen(); };
  }, [exitFullscreen]);

  const handleSingleTap = useCallback(() => {
    setShowUI(prev => !prev);
  }, []);

  const handleDoubleTap = useCallback(() => {
    // Double tap only resets zoom, never exits fullscreen
  }, []);

  const {
    zoom,
    panOffset,
    isDragging,
    isZooming,
    imageRef: transformRef,
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

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // На мобильных показываем thumbnail (2000px), оригинал грузим только при зуме
  // На десктопе сразу показываем оригинал
  useEffect(() => {
    if (zoom > 0 && currentPhoto?.thumbnail_url && !fullImageLoaded && isMobile) {
      setShowFullImage(true);
      const img = new Image();
      img.onload = () => setFullImageLoaded(true);
      img.src = currentPhoto.photo_url;
    }
  }, [zoom, currentPhoto, fullImageLoaded, isMobile]);

  // Preload adjacent thumbnails
  useEffect(() => {
    const preloadIndexes = [currentIndex - 1, currentIndex + 1].filter(
      i => i >= 0 && i < photos.length
    );
    preloadIndexes.forEach(i => {
      const src = isMobile
        ? (photos[i].thumbnail_url || photos[i].photo_url)
        : photos[i].photo_url;
      const img = new Image();
      img.src = src;
    });
  }, [currentIndex, photos, isMobile]);

  if (!currentPhoto) return null;

  // Мобильные: thumbnail_url (2000px) → при зуме оригинал
  // Десктоп: сразу оригинал
  const displaySrc = isMobile
    ? ((!currentPhoto.thumbnail_url || showFullImage) ? currentPhoto.photo_url : currentPhoto.thumbnail_url)
    : currentPhoto.photo_url;

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

          <GalleryViewerTopBar
            currentIndex={currentIndex}
            totalCount={photos.length}
            fileName={currentPhoto.file_name}
            isFullscreen={isFullscreen}
            zoom={zoom}
            downloadDisabled={downloadDisabled}
            onDownload={onDownload ? () => setShowDownloadModal(true) : undefined}
            onExitFullscreen={exitFullscreen}
            onResetZoom={resetZoom}
            onShowHelp={() => setShowHelp(true)}
            onClose={onClose}
            showUI={showUI}
          />

          <GalleryViewerImage
            src={displaySrc}
            fileName={currentPhoto.file_name}
            fileSize={currentPhoto.file_size}
            width={currentPhoto.width}
            height={currentPhoto.height}
            zoom={zoom}
            panOffset={panOffset}
            isDragging={isDragging}
            isZooming={isZooming}
            isFullscreen={isFullscreen}
            isLandscapeMobile={isLandscapeMobile}
            screenshotProtection={screenshotProtection}
            showFullImage={showFullImage}
            fullImageLoaded={fullImageLoaded}
            currentIndex={currentIndex}
            totalCount={photos.length}
            showUI={showUI}
            watermark={watermark}
            transformRef={transformRef}
            onNavigatePrev={() => handleNavigate('prev')}
            onNavigateNext={() => handleNavigate('next')}
            onToggleFullscreen={() => isFullscreen ? exitFullscreen() : enterFullscreen()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
          />

          {showHelp && (
            <GalleryViewerHelpModal
              onClose={() => setShowHelp(false)}
              downloadDisabled={downloadDisabled}
              hasDownload={!!onDownload}
            />
          )}

          {showDownloadModal && (
            <GalleryViewerDownloadModal
              photo={currentPhoto}
              onClose={() => setShowDownloadModal(false)}
              onDownload={onDownload}
            />
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}