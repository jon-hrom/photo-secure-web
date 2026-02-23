import Icon from '@/components/ui/icon';

interface GalleryViewerImageProps {
  src: string;
  fileName: string;
  fileSize: number;
  width?: number;
  height?: number;
  zoom: number;
  panOffset: { x: number; y: number };
  isDragging: boolean;
  isZooming: boolean;
  isFullscreen: boolean;
  screenshotProtection: boolean;
  showFullImage: boolean;
  fullImageLoaded: boolean;
  currentIndex: number;
  totalCount: number;
  showUI: boolean;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onToggleFullscreen: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
}

export default function GalleryViewerImage({
  src,
  fileName,
  fileSize,
  width,
  height,
  zoom,
  panOffset,
  isDragging,
  isZooming,
  isFullscreen,
  screenshotProtection,
  showFullImage,
  fullImageLoaded,
  currentIndex,
  totalCount,
  showUI,
  onNavigatePrev,
  onNavigateNext,
  onToggleFullscreen,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: GalleryViewerImageProps) {
  const imgMaxWidth = isFullscreen ? '100vw' : (zoom === 0 ? '96vw' : '100%');
  const imgMaxHeight = isFullscreen ? '100vh' : (zoom === 0 ? 'calc(100vh - 100px)' : '100vh');

  return (
    <>
      {/* Область изображения */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        style={{ cursor: zoom === 0 ? 'default' : (isDragging ? 'grabbing' : 'grab'), touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <img
          src={src}
          alt={fileName}
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
            pointerEvents: 'none',
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
            onClick={onNavigatePrev}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/30 active:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all"
            style={{ width: 44, height: 44 }}
          >
            <Icon name="ChevronLeft" size={26} className="text-white" />
          </button>
        )}
        {currentIndex < totalCount - 1 && (
          <button
            onClick={onNavigateNext}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/30 active:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all"
            style={{ width: 44, height: 44 }}
          >
            <Icon name="ChevronRight" size={28} className="text-white" />
          </button>
        )}
      </div>

      {/* Кнопка полного экрана — правый нижний угол */}
      <button
        onClick={onToggleFullscreen}
        className="absolute z-50 flex items-center justify-center rounded-full bg-black/40 active:bg-black/70 backdrop-blur-sm transition-all"
        style={{
          width: 44,
          height: 44,
          right: 12,
          bottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
        title={isFullscreen ? 'Выйти из полного экрана' : 'Полный экран'}
      >
        <Icon name={isFullscreen ? 'Minimize2' : 'Maximize2'} size={20} className="text-white" />
      </button>

      {/* Нижняя панель с информацией */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-8 transition-opacity duration-300"
        style={{
          paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
          opacity: showUI ? 1 : 0,
          pointerEvents: showUI ? 'auto' : 'none',
        }}
      >
        <p className="text-white font-medium text-base mb-1 truncate">{fileName}</p>
        <div className="flex items-center gap-4 text-white/60 text-xs">
          {fileSize && <span>{(fileSize / 1024 / 1024).toFixed(2)} МБ</span>}
          {width && height && <span>{width} × {height}</span>}
        </div>
      </div>
    </>
  );
}
