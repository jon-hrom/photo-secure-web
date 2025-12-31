import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface PhotoGridCardProps {
  photo: Photo;
  selectionMode: boolean;
  isSelected: boolean;
  emailVerified: boolean;
  onPhotoClick: (photo: Photo) => void;
  onDownload: (url: string, fileName: string) => void;
  onDeletePhoto: (photoId: number, fileName: string) => void;
}

const PhotoGridCard = ({
  photo,
  selectionMode,
  isSelected,
  emailVerified,
  onPhotoClick,
  onDownload,
  onDeletePhoto
}: PhotoGridCardProps) => {
  const isVertical = (photo.height || 0) > (photo.width || 0);

  return (
    <div
      className={`relative group rounded-lg overflow-hidden border-2 transition-colors ${
        isSelected 
          ? 'border-primary ring-2 ring-primary' 
          : 'border-muted hover:border-muted-foreground/20'
      } ${isVertical ? 'aspect-[3/4]' : 'aspect-[4/3]'}`}
      onClick={() => onPhotoClick(photo)}
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
      <div className="w-full h-full">
        {(photo.thumbnail_s3_url || photo.s3_url) ? (
          <img
            src={photo.thumbnail_s3_url || photo.s3_url}
            alt={photo.file_name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
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
            ) : (
              <Icon name="ImageOff" size={32} className="text-muted-foreground" />
            )}
          </div>
        )}
      </div>
      {!selectionMode && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 p-2">
          {emailVerified && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                if (photo.s3_url) {
                  onDownload(photo.s3_url, photo.file_name);
                }
              }}
              disabled={!photo.s3_url}
            >
              <Icon name="Download" size={14} />
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDeletePhoto(photo.id, photo.file_name);
            }}
          >
            <Icon name="Trash2" size={14} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default PhotoGridCard;