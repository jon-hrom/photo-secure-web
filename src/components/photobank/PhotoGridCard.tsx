import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import { useState, useEffect } from 'react';

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
  shot_date?: string | null;
  photo_download_count?: number;
}

interface PhotoGridCardProps {
  photo: Photo;
  selectionMode: boolean;
  isSelected: boolean;
  emailVerified: boolean;
  onPhotoClick: (photo: Photo) => void;
  onDownload: (s3Key: string, fileName: string, userId: number) => Promise<void>;
  onDeletePhoto: (photoId: number, fileName: string) => void;
  onShowExif?: (photo: Photo) => void;
  isAdminViewing?: boolean;
}

const PhotoGridCard = ({
  photo,
  selectionMode,
  isSelected,
  emailVerified,
  onPhotoClick,
  onDownload,
  onDeletePhoto,
  onShowExif,
  isAdminViewing = false
}: PhotoGridCardProps) => {
  const [showButtons, setShowButtons] = useState(false);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    return () => {
      if (clickTimeout) clearTimeout(clickTimeout);
    };
  }, [clickTimeout]);

  const handleClick = () => {
    if (selectionMode) {
      onPhotoClick(photo);
      return;
    }

    if (showButtons) {
      onPhotoClick(photo);
    } else {
      setShowButtons(true);
      const timeout = setTimeout(() => setShowButtons(false), 5000);
      setClickTimeout(timeout);
    }
  };

  const fixDoubleSpacesInUrl = (url: string | undefined): string | undefined => {
    if (!url) return url;
    return url.replace(/%20%20/g, '%20');
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  return (
    <div className="flex flex-col">
      <div
        className={`relative group rounded-lg overflow-hidden border transition-colors bg-gray-50 aspect-[4/5] ${
          isSelected 
            ? 'border-primary ring-2 ring-primary' 
            : showButtons
            ? 'border-primary'
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onClick={handleClick}
        style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none' } as React.CSSProperties}
      >
        {selectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
              isSelected
                ? 'bg-primary border-primary'
                : 'bg-white/80 border-white'
            }`}>
              {isSelected && (
                <Icon name="Check" size={16} className="text-white" />
              )}
            </div>
          </div>
        )}
        {!selectionMode && onShowExif && (photo.thumbnail_s3_url || photo.s3_url) && showButtons && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowExif(photo);
            }}
            className="absolute top-0.5 right-0.5 z-10 w-5 h-5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-all touch-manipulation"
          >
            <Icon name="Info" size={10} className="text-white" />
          </button>
        )}
        <div className="w-full h-full flex items-center justify-center p-1">
          {(photo.thumbnail_s3_url || photo.s3_url) ? (
            <>
              {!imageLoaded && !imageError && (
                <div className="w-full h-full flex items-center justify-center bg-muted animate-pulse rounded">
                  <Icon name="Image" size={32} className="text-muted-foreground/50" />
                </div>
              )}
              {imageError && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted rounded">
                  <Icon name="ImageOff" size={32} className="text-muted-foreground/50 mb-2" />
                  <span className="text-xs text-muted-foreground">Загрузка...</span>
                </div>
              )}
              <img
                src={fixDoubleSpacesInUrl(photo.thumbnail_s3_url || photo.s3_url)}
                alt={photo.file_name}
                className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${imageLoaded && !imageError ? 'opacity-100' : 'opacity-0'}`}
                loading="lazy"
                onLoad={handleImageLoad}
                onError={handleImageError}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
                style={{ 
                  touchAction: 'none',
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  userSelect: 'none',
                  pointerEvents: 'none'
                } as React.CSSProperties}
              />
              {photo.is_video && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                    <Icon name="Play" size={32} className="text-white" />
                  </div>
                </div>
              )}
              {(photo.photo_download_count ?? 0) > 0 && (
                <div className="absolute bottom-2 left-2 z-10 px-2 py-1 rounded-md bg-emerald-600/90 backdrop-blur-sm flex items-center gap-1.5" title="Скачиваний клиентами">
                  <Icon name="Download" size={14} className="text-white" />
                  <span className="text-white text-xs font-medium">{photo.photo_download_count}</span>
                </div>
              )}
            </>
          ) : photo.data_url ? (
            <img
              src={photo.data_url}
              alt={photo.file_name}
              className="max-w-full max-h-full object-contain opacity-50"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {photo.is_raw ? (
                <div className="text-center p-4">
                  <Icon name="Loader2" size={32} className="text-muted-foreground animate-spin mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Конвертация RAW...</p>
                </div>
              ) : photo.is_video ? (
                <div className="text-center p-4">
                  <Icon name="Loader2" size={32} className="text-muted-foreground animate-spin mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Обработка видео...</p>
                </div>
              ) : (
                <Icon name="ImageOff" size={32} className="text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        {!selectionMode && showButtons && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeletePhoto(photo.id, photo.file_name);
              }}
              className="absolute top-0.5 left-0.5 z-10 w-5 h-5 rounded-full bg-red-500/70 hover:bg-red-600 backdrop-blur-sm flex items-center justify-center transition-all touch-manipulation"
            >
              <Icon name="Trash2" size={10} className="text-white" />
            </button>
            {emailVerified && photo.s3_key && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const userIdStr = getAuthUserId();
                  const userId = userIdStr ? parseInt(userIdStr, 10) : 0;
                  console.log('[PHOTO_CARD] Download button clicked:', { s3Key: photo.s3_key, fileName: photo.file_name, userId });
                  onDownload(photo.s3_key!, photo.file_name, userId);
                }}
                className="absolute bottom-0.5 right-0.5 z-10 w-5 h-5 rounded-full bg-blue-500/70 hover:bg-blue-600 backdrop-blur-sm flex items-center justify-center transition-all touch-manipulation"
              >
                <Icon name="Download" size={10} className="text-white" />
              </button>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 px-0.5 truncate" title={photo.file_name}>
        {photo.file_name}
      </p>
    </div>
  );
};

export default PhotoGridCard;
