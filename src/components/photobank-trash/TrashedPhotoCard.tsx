import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { TrashedPhoto } from './types';
import { formatDeleteDate } from './utils';

interface TrashedPhotoCardProps {
  photo: TrashedPhoto;
  selectionMode: boolean;
  isSelected: boolean;
  restoring: number | null;
  deleting: number | null;
  onPhotoClick: (photo: TrashedPhoto) => void;
  onRestorePhoto: (photoId: number, fileName: string) => void;
  onDeletePhotoForever: (photoId: number, fileName: string) => void;
  getDaysLeftBadge: (dateStr: string) => { days: number; variant: string; text: string };
  formatDate: (dateStr: string) => string;
}

const TrashedPhotoCard = ({
  photo,
  selectionMode,
  isSelected,
  restoring,
  deleting,
  onPhotoClick,
  onRestorePhoto,
  onDeletePhotoForever,
  getDaysLeftBadge,
  formatDate
}: TrashedPhotoCardProps) => {
  const isVertical = (photo.height || 0) > (photo.width || 0);

  return (
    <div
      key={photo.id}
      className={`relative group rounded-lg overflow-hidden border-2 transition-colors bg-muted/30 ${
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
        {photo.s3_url ? (
          <img
            src={photo.s3_url}
            alt={photo.file_name}
            className="w-full h-full object-contain"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon name="ImageOff" size={32} className="text-muted-foreground" />
          </div>
        )}
      </div>
      {!selectionMode && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 p-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onRestorePhoto(photo.id, photo.file_name)}
          disabled={restoring === photo.id || deleting === photo.id}
          className="w-full"
        >
          {restoring === photo.id ? (
            <Icon name="Loader2" size={14} className="animate-spin" />
          ) : (
            <>
              <Icon name="Undo2" size={14} className="mr-1" />
              Восстановить
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => onDeletePhotoForever(photo.id, photo.file_name)}
          disabled={restoring === photo.id || deleting === photo.id}
          className="w-full"
        >
          {deleting === photo.id ? (
            <Icon name="Loader2" size={14} className="animate-spin" />
          ) : (
            <>
              <Icon name="Trash2" size={14} className="mr-1" />
              Удалить навсегда
            </>
          )}
        </Button>
        </div>
      )}
      {!selectionMode && (
        <div className="absolute top-2 right-2">
        <Badge 
          variant={getDaysLeftBadge(photo.trashed_at).variant as 'default' | 'secondary' | 'destructive'}
          className="text-[10px] px-1.5 py-0.5"
        >
          <Icon name="Clock" size={10} className="mr-0.5" />
          {getDaysLeftBadge(photo.trashed_at).text}
        </Badge>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="text-xs text-white truncate">{photo.file_name}</p>
        {photo.auto_delete_date ? (
          <p className="text-[10px] text-white/70">Удалится: {formatDeleteDate(photo.auto_delete_date)}</p>
        ) : (
          <p className="text-[10px] text-white/70">{formatDate(photo.trashed_at)}</p>
        )}
      </div>
    </div>
  );
};

export default TrashedPhotoCard;