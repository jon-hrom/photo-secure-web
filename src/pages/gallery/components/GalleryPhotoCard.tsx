import React from 'react';
import Icon from '@/components/ui/icon';
import type { Photo, WatermarkSettings } from '../GalleryGrid';

interface GalleryPhotoCardProps {
  photo: Photo;
  index: number;
  gridGap: number;
  isDarkBg: boolean;
  screenshotProtection?: boolean;
  downloadDisabled?: boolean;
  watermark?: WatermarkSettings;
  onPhotoClick: (photo: Photo) => void;
  onDownloadPhoto: (photo: Photo) => void;
  onAddToFavorites: (photo: Photo) => void;
  onPhotoLoad?: () => void;
}

const GalleryPhotoCard = React.forwardRef<HTMLDivElement, GalleryPhotoCardProps>(({
  photo,
  index,
  gridGap,
  isDarkBg,
  screenshotProtection,
  downloadDisabled,
  watermark,
  onPhotoClick,
  onDownloadPhoto,
  onAddToFavorites,
  onPhotoLoad
}, ref) => {
  return (
    <div
      ref={ref}
      className="group relative rounded-md sm:rounded-lg overflow-hidden cursor-pointer break-inside-avoid touch-manipulation"
      style={{ 
        marginBottom: `${gridGap}px`,
        background: isDarkBg ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
        opacity: 0,
        transform: 'translateY(24px)',
        transition: `opacity 0.5s ease ${(index % 8) * 0.06}s, transform 0.5s ease ${(index % 8) * 0.06}s`
      }}
      onClick={() => onPhotoClick(photo)}
    >
      {photo.is_video ? (
        <video
          src={`${photo.photo_url}#t=0.1`}
          className="w-full h-auto transition-transform group-hover:scale-105"
          preload="metadata"
          onContextMenu={(e) => screenshotProtection && e.preventDefault()}
          onLoadedData={() => onPhotoLoad?.()}
          onError={() => onPhotoLoad?.()}
          muted={true}
          playsInline={true}
        />
      ) : (
        <img
          src={photo.thumbnail_url || photo.photo_url}
          alt={photo.file_name}
          className="w-full h-auto transition-transform group-hover:scale-105"
          loading="lazy"
          onContextMenu={(e) => screenshotProtection && e.preventDefault()}
          draggable={false}
          onLoad={() => onPhotoLoad?.()}
          onError={() => onPhotoLoad?.()}
        />
      )}
      {photo.is_video && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <Icon name="Play" size={24} className="text-white sm:w-8 sm:h-8" />
          </div>
        </div>
      )}
      {watermark?.enabled && (() => {
        const frequency = watermark.frequency || 50;
        const count = Math.ceil((frequency / 10) * 10);
        const watermarks = [];
        
        for (let i = 0; i < count; i++) {
          const top = (i * (100 / count)) % 100;
          const left = ((i * 37) % 100);
          
          watermarks.push(
            <div
              key={i}
              className="absolute pointer-events-none"
              style={{
                top: `${top}%`,
                left: `${left}%`,
                transform: 'translate(-50%, -50%)',
                opacity: (watermark.opacity || 50) / 100
              }}
            >
              {watermark.type === 'text' ? (
                <p 
                  className="text-white font-bold text-center px-2 whitespace-nowrap" 
                  style={{ 
                    fontSize: `${watermark.size || 20}px`,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                    transform: `rotate(${watermark.rotation || 0}deg)`
                  }}
                >
                  {watermark.text}
                </p>
              ) : (
                <img 
                  src={watermark.image_url} 
                  alt="Watermark" 
                  style={{ 
                    maxWidth: `${watermark.size}px`,
                    maxHeight: `${watermark.size}px`,
                    transform: `rotate(${watermark.rotation || 0}deg)` 
                  }}
                />
              )}
            </div>
          );
        }
        
        return watermarks;
      })()}
      <div className="absolute bottom-1 sm:bottom-1.5 right-1 sm:right-1.5 flex z-10" style={{ gap: '3px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToFavorites(photo);
          }}
          className="flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full hover:bg-yellow-500 active:bg-yellow-600 transition-all group/btn touch-manipulation"
          style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', maxWidth: '22px', maxHeight: '22px', padding: 0 }}
          title="Добавить в избранное"
        >
          <Icon name="Star" size={11} className="text-white group-hover/btn:text-white" />
        </button>
        {!downloadDisabled && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownloadPhoto(photo);
            }}
            className="flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full hover:bg-blue-500 active:bg-blue-600 transition-all group/btn touch-manipulation"
            style={{ width: '22px', height: '22px', minWidth: '22px', minHeight: '22px', maxWidth: '22px', maxHeight: '22px', padding: 0 }}
            title="Скачать фото"
          >
            <Icon name="Download" size={11} className="text-white group-hover/btn:text-white" />
          </button>
        )}
      </div>
    </div>
  );
});

GalleryPhotoCard.displayName = 'GalleryPhotoCard';

export default GalleryPhotoCard;
