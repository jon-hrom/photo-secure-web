import Icon from '@/components/ui/icon';
import type { Photo, GalleryData } from '../GalleryGrid';

interface GalleryCoverProps {
  coverPhoto: Photo;
  gallery: GalleryData;
  isMobile: boolean;
  focusX: number;
  focusY: number;
  scrollToGrid: () => void;
}

export default function GalleryCover({
  coverPhoto,
  gallery,
  isMobile,
  focusX,
  focusY,
  scrollToGrid
}: GalleryCoverProps) {
  return (
    <div 
      className="relative overflow-hidden"
      style={{
        width: 'calc(100% + env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))',
        marginLeft: 'calc(-1 * env(safe-area-inset-left, 0px))',
        marginRight: 'calc(-1 * env(safe-area-inset-right, 0px))',
        marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
        height: '100vh',
        minHeight: 500,
        background: '#0a0a0a'
      }}
    >
      <img
        src={coverPhoto.photo_url}
        alt={gallery.folder_name}
        className={`w-full h-full ${isMobile ? 'object-cover' : 'object-contain'}`}
        style={isMobile ? { objectPosition: `${focusX * 100}% ${focusY * 100}%` } : undefined}
        draggable={false}
        onContextMenu={(e) => gallery.screenshot_protection && e.preventDefault()}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" style={{ pointerEvents: 'none' }} />
      {(() => {
        const pos = gallery.cover_text_position || 'bottom-center';
        const posClasses = pos === 'center' ? 'inset-0 flex flex-col items-center justify-center text-center px-6'
          : pos === 'top-center' ? 'inset-0 flex flex-col items-center justify-start text-center px-6 pt-[max(3rem,env(safe-area-inset-top,3rem))]'
          : pos === 'bottom-left' ? 'bottom-0 left-0 right-0 flex flex-col items-start text-left px-6'
          : pos === 'bottom-right' ? 'bottom-0 left-0 right-0 flex flex-col items-end text-right px-6'
          : 'bottom-0 left-0 right-0 flex flex-col items-center text-center px-6';
        return (
          <div
            className={`absolute ${posClasses}`}
            style={{
              opacity: 0,
              transform: 'translateY(20px)',
              animation: 'coverTextFadeIn 2.5s ease forwards 0.3s',
              paddingBottom: pos.startsWith('bottom') ? 'max(5rem, calc(env(safe-area-inset-bottom, 0px) + 4rem))' : undefined
            }}
          >
            <h1 className="font-bold mb-3 drop-shadow-lg" style={{
              color: gallery.text_color || '#ffffff',
              fontSize: `${gallery.cover_font_size || 36}px`
            }}>
              {gallery.cover_title || gallery.folder_name}
            </h1>
            <button
              onClick={scrollToGrid}
              className="inline-flex items-center gap-1.5 text-sm active:opacity-70 transition-opacity touch-manipulation"
              style={{
                color: gallery.text_color ? `${gallery.text_color}cc` : 'rgba(255,255,255,0.8)',
                opacity: 0,
                animation: 'coverTextFadeIn 2s ease forwards 1.2s',
                minHeight: 44,
                minWidth: 44
              }}
            >
              <span>Просмотр фото</span>
              <Icon name="ChevronDown" size={16} className="animate-bounce" />
            </button>
          </div>
        );
      })()}
    </div>
  );
}