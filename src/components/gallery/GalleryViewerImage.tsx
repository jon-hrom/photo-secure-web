import { useRef, useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';

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
  watermark?: WatermarkSettings;
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
  watermark,
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
  // dvh — dynamic viewport height (учитывает скрывающийся адресбар на Android/iOS)
  // fallback на 100vh для браузеров без поддержки dvh
  const vh = 'calc(var(--dvh, 1vh) * 100)';
  const imgMaxWidth = isFullscreen
    ? 'calc(100vw - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px))'
    : (zoom === 0 ? '96vw' : '100%');
  const imgMaxHeight = isFullscreen
    ? vh
    : (zoom === 0 ? `calc(${vh} - 100px)` : vh);

  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  // Измеряем реальный размер картинки после загрузки и при ресайзе
  useEffect(() => {
    const measure = () => {
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setImgSize({ w: rect.width, h: rect.height });
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (imgRef.current) ro.observe(imgRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [src]);

  // Сбрасываем размер при смене фото
  useEffect(() => {
    setImgSize(null);
  }, [src]);

  const logoSizePx = imgSize ? (imgSize.w * (watermark?.size || 20)) / 100 : null;

  return (
    <>
      {/* Область изображения */}
      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ cursor: zoom === 0 ? 'default' : (isDragging ? 'grabbing' : 'grab'), touchAction: 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Обёртка по размеру фото — watermark позиционируется внутри неё */}
        <div
          className="relative inline-block"
          style={{
            transform: zoom > 0
              ? `scale(${1 + zoom}) translate(${panOffset.x / (1 + zoom)}px, ${panOffset.y / (1 + zoom)}px)`
              : 'none',
            transition: isDragging ? 'none' : (isZooming ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'transform 0.2s ease-out'),
            touchAction: 'none',
            lineHeight: 0,
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={fileName}
            className="object-contain select-none touch-manipulation block"
            style={{
              maxWidth: imgMaxWidth,
              maxHeight: imgMaxHeight,
              width: isFullscreen ? '100vw' : undefined,
              height: isFullscreen ? '100vh' : undefined,
              touchAction: 'none',
              pointerEvents: 'none',
            }}
            onLoad={() => {
              if (imgRef.current) {
                const rect = imgRef.current.getBoundingClientRect();
                if (rect.width > 0) setImgSize({ w: rect.width, h: rect.height });
              }
            }}
            onContextMenu={(e) => screenshotProtection && e.preventDefault()}
            draggable={false}
          />
          {watermark?.enabled && logoSizePx !== null && (() => {
            const frequency = watermark.frequency || 50;
            const count = Math.ceil((frequency / 10) * 10);
            const items = [];
            for (let i = 0; i < count; i++) {
              const top = (i * (100 / count)) % 100;
              const left = ((i * 37) % 100);
              items.push(
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    top: `${top}%`,
                    left: `${left}%`,
                    transform: 'translate(-50%, -50%)',
                    opacity: (watermark.opacity || 50) / 100,
                  }}
                >
                  {watermark.type === 'text' ? (
                    <p
                      className="text-white font-bold text-center px-2 whitespace-nowrap"
                      style={{
                        fontSize: `${logoSizePx * 0.3}px`,
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        transform: `rotate(${watermark.rotation || 0}deg)`,
                      }}
                    >
                      {watermark.text}
                    </p>
                  ) : (
                    <img
                      src={watermark.image_url}
                      alt="Watermark"
                      style={{
                        width: `${logoSizePx}px`,
                        height: 'auto',
                        transform: `rotate(${watermark.rotation || 0}deg)`,
                      }}
                    />
                  )}
                </div>
              );
            }
            return items;
          })()}
        </div>

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
            className="absolute top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/30 active:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all w-9 h-9 sm:w-11 sm:h-11"
            style={{ left: 'max(8px, env(safe-area-inset-left))' }}
          >
            <Icon name="ChevronLeft" size={22} className="text-white" />
          </button>
        )}
        {currentIndex < totalCount - 1 && (
          <button
            onClick={onNavigateNext}
            className="absolute top-1/2 -translate-y-1/2 z-50 rounded-full bg-black/30 active:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-all w-9 h-9 sm:w-11 sm:h-11"
            style={{ right: 'max(8px, env(safe-area-inset-right))' }}
          >
            <Icon name="ChevronRight" size={22} className="text-white" />
          </button>
        )}
      </div>

      {/* Кнопка полного экрана — правый нижний угол */}
      <button
        onClick={onToggleFullscreen}
        className="absolute z-50 flex items-center justify-center rounded-full bg-black/40 active:bg-black/70 backdrop-blur-sm transition-all w-9 h-9 sm:w-11 sm:h-11"
        style={{
          right: 'max(12px, env(safe-area-inset-right))',
          bottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
        title={isFullscreen ? 'Выйти из полного экрана' : 'Полный экран'}
      >
        <Icon name={isFullscreen ? 'Minimize2' : 'Maximize2'} size={18} className="text-white" />
      </button>

      {/* Нижняя панель с информацией */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-4 pt-8 transition-opacity duration-300"
        style={{
          paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(4rem, env(safe-area-inset-right))',
          opacity: showUI ? 1 : 0,
          pointerEvents: showUI ? 'auto' : 'none',
        }}
      >
        <p className="text-white font-medium text-sm sm:text-base mb-0.5 truncate">{fileName}</p>
        <div className="flex items-center gap-4 text-xs">
          {fileSize && <span className="text-white/60">{(fileSize / 1024 / 1024).toFixed(2)} МБ</span>}
          {width && height && <span className="text-white/60">{width} × {height}</span>}
        </div>
      </div>
    </>
  );
}