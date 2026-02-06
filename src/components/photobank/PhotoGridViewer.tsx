import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import Icon from '@/components/ui/icon';
import PhotoExifDialog from './PhotoExifDialog';
import { usePhotoGridGestures } from './PhotoGridGestureHandlers';
import PhotoGridControls from './PhotoGridControls';
import PhotoGridContextMenu from './PhotoGridContextMenu';
import PhotoGridInfo from './PhotoGridInfo';
import VideoPlayer from './VideoPlayer';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  is_video?: boolean;
  content_type?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
  photo_download_count?: number;
}

interface PhotoGridViewerProps {
  viewPhoto: Photo | null;
  photos: Photo[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onDownload: (s3Key: string, fileName: string, userId: number) => Promise<void>;
  formatBytes: (bytes: number) => string;
  downloadDisabled?: boolean;
}

const PhotoGridViewer = ({
  viewPhoto,
  photos,
  onClose,
  onNavigate,
  onDownload,
  formatBytes,
  downloadDisabled = false
}: PhotoGridViewerProps) => {
  const [showExif, setShowExif] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  // Блокируем скролл body когда диалог открыт
  useEffect(() => {
    if (viewPhoto) {
      // Сохраняем оригинальные значения ДО изменения
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalWidth = document.body.style.width;
      const originalHeight = document.body.style.height;
      const scrollY = window.scrollY;
      
      // Блокируем скролл
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Восстанавливаем оригинальные значения
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = originalWidth;
        document.body.style.height = originalHeight;
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [viewPhoto]);

  // Используем кастомный хук для всей логики жестов
  const {
    zoom,
    panOffset,
    isDragging,
    isZooming,
    isLandscape,
    showContextMenu,
    imageError,
    isLoadingFullRes,
    handleTouchStart,
    handleTouchEnd,
    handleTouchMove,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleCloseDialog,
    setShowContextMenu,
    resetZoom
  } = usePhotoGridGestures({
    viewPhoto,
    photos,
    onClose,
    onNavigate
  });

  if (!viewPhoto) return null;

  if (viewPhoto.is_video) {
    return (
      <VideoPlayer
        src={viewPhoto.s3_url || viewPhoto.data_url || ''}
        poster={viewPhoto.thumbnail_s3_url}
        onClose={onClose}
        fileName={viewPhoto.file_name}
        downloadDisabled={downloadDisabled}
      />
    );
  }

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
          
          {/* Элементы управления (верхняя панель, навигация) */}
          <PhotoGridControls
            viewPhoto={viewPhoto}
            photos={photos}
            zoom={zoom}
            isLandscape={isLandscape}
            onClose={handleCloseDialog}
            onNavigate={onNavigate}
            onResetZoom={resetZoom}
            onDownload={onDownload}
            onShowExif={() => setShowExif(true)}
            onCopyFileName={() => {
              navigator.clipboard.writeText(viewPhoto.file_name);
              setShowCopied(true);
              setTimeout(() => setShowCopied(false), 2000);
            }}
            downloadDisabled={downloadDisabled}
          />

          {/* Область с изображением */}
          <div 
            className="relative w-full h-full flex items-center justify-center overflow-auto"
            style={{ cursor: zoom === 0 ? 'zoom-in' : (isDragging ? 'grabbing' : 'grab') }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {viewPhoto.is_raw && !viewPhoto.thumbnail_s3_url ? (
              <div className="flex flex-col items-center justify-center text-white/60 p-8">
                <Icon name="Loader2" size={48} className="animate-spin mb-4" />
                <p className="text-lg mb-2">Конвертация RAW файла...</p>
                <p className="text-sm text-white/40">Это может занять до минуты</p>
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                {/* Thumbnail для быстрой навигации (показывается при zoom = 0) */}
                {zoom === 0 && viewPhoto.thumbnail_s3_url && (
                  <img
                    src={viewPhoto.thumbnail_s3_url}
                    alt={viewPhoto.file_name}
                    className="object-contain cursor-zoom-in select-none touch-manipulation absolute inset-0"
                    style={{
                      width: '100%',
                      height: '100%',
                      touchAction: 'none',
                      pointerEvents: 'none',
                      opacity: imageError ? 0.5 : 1
                    }}
                    onLoad={() => {
                      console.log('[PHOTO_VIEWER] Thumbnail loaded:', viewPhoto.file_name);
                    }}
                    draggable={false}
                  />
                )}
                
                {/* Оригинал в высоком разрешении (подгружается при зуме > 0) */}
                {zoom > 0 && (
                  <img
                    src={viewPhoto.s3_url || viewPhoto.data_url || viewPhoto.thumbnail_s3_url || ''}
                    alt={viewPhoto.file_name}
                    className="object-contain cursor-move select-none touch-manipulation absolute inset-0"
                    style={{
                      width: '100%',
                      height: '100%',
                      transform: `scale(${1 + zoom}) translate(${panOffset.x / (1 + zoom)}px, ${panOffset.y / (1 + zoom)}px)`,
                      transition: isDragging ? 'none' : (isZooming ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'transform 0.2s ease-out'),
                      imageRendering: zoom > 0.5 ? 'high-quality' : 'auto',
                      touchAction: 'none',
                      pointerEvents: 'none',
                      opacity: imageError ? 0.5 : 1
                    }}
                    onLoad={() => {
                      console.log('[PHOTO_VIEWER] Full-res loaded:', viewPhoto.file_name, 's3_url:', viewPhoto.s3_url);
                    }}
                    onError={(e) => {
                      console.error('[PHOTO_VIEWER] Image load error:', {
                        fileName: viewPhoto.file_name,
                        s3Url: viewPhoto.s3_url,
                        thumbnailUrl: viewPhoto.thumbnail_s3_url,
                        error: e
                      });
                    }}
                    draggable={false}
                  />
                )}
                
                {isLoadingFullRes && zoom > 0 && (
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-full flex items-center gap-2">
                    <Icon name="Loader2" size={16} className="animate-spin text-white/80" />
                    <span className="text-xs text-white/80">Загрузка оригинала...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Нижняя панель с информацией */}
          <PhotoGridInfo
            viewPhoto={viewPhoto}
            isLandscape={isLandscape}
            formatBytes={formatBytes}
          />

          {/* Контекстное меню */}
          <PhotoGridContextMenu
            viewPhoto={viewPhoto}
            showContextMenu={showContextMenu}
            onClose={() => setShowContextMenu(false)}
            onDownload={onDownload}
            onShowExif={() => setShowExif(true)}
            formatBytes={formatBytes}
          />

          {/* Уведомление о копировании */}
          {showCopied && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] bg-green-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
              Имя скопировано
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