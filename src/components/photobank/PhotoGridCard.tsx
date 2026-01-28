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
  const isVertical = (photo.height || 0) > (photo.width || 0);
  const [showButtons, setShowButtons] = useState(false);
  const [clickTimeout, setClickTimeout] = useState<NodeJS.Timeout | null>(null);

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

  return (
    <div
      className={`relative group rounded-lg overflow-hidden border-2 transition-colors ${
        isSelected 
          ? 'border-primary ring-2 ring-primary' 
          : showButtons
          ? 'border-primary'
          : 'border-muted hover:border-muted-foreground/20'
      } ${isVertical ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}
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
          className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center transition-all touch-manipulation"
          title="Информация о фото"
        >
          <Icon name="Info" size={12} className="text-white" />
        </button>
      )}
      <div className="w-full h-full relative">
        {(photo.thumbnail_s3_url || photo.s3_url) ? (
          <>
            <img
              src={photo.thumbnail_s3_url || photo.s3_url}
              alt={photo.file_name}
              className="w-full h-full object-contain"
              loading="lazy"
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
            className="w-full h-full object-contain opacity-50"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
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
            className="absolute top-1 left-1 z-10 w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-600 backdrop-blur-sm flex items-center justify-center transition-all touch-manipulation"
            title="Удалить файл"
          >
            <Icon name="Trash2" size={12} className="text-white" />
          </button>
          {emailVerified && photo.s3_key && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const userIdStr = getAuthUserId();
                const userId = userIdStr ? parseInt(userIdStr, 10) : 0;
                console.log('[PHOTO_CARD] Download clicked:', { userId, s3_key: photo.s3_key });
                if (userId) {
                  onDownload(photo.s3_key!, photo.file_name, userId);
                }
              }}
              className="absolute bottom-1 right-1 z-10 w-6 h-6 rounded-full bg-blue-500/90 hover:bg-blue-600 backdrop-blur-sm flex items-center justify-center transition-all touch-manipulation"
              title="Скачать"
            >
              <Icon name="Download" size={12} className="text-white" />
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default PhotoGridCard;