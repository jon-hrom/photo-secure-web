import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { TrashedPhoto } from './types';

interface TrashedPhotoInfoProps {
  viewPhoto: TrashedPhoto;
  restoring: number | null;
  deleting: number | null;
  isLandscape: boolean;
  onRestorePhoto: (photoId: number, fileName: string) => void;
  onDeletePhotoForever: (photoId: number, fileName: string) => void;
  onCloseDialog: () => void;
  getDaysLeftBadge: (dateStr: string) => { days: number; variant: string; text: string };
  formatDate: (dateStr: string) => string;
  formatBytes: (bytes: number) => string;
}

const TrashedPhotoInfo = ({
  viewPhoto,
  restoring,
  deleting,
  isLandscape,
  onRestorePhoto,
  onDeletePhotoForever,
  onCloseDialog,
  getDaysLeftBadge,
  formatDate,
  formatBytes
}: TrashedPhotoInfoProps) => {
  if (isLandscape) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 md:p-6">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-white font-medium text-lg">{viewPhoto.file_name}</p>
        <Badge 
          variant={getDaysLeftBadge(viewPhoto.trashed_at).variant as any}
          className="text-xs"
        >
          <Icon name="Clock" size={12} className="mr-1" />
          {getDaysLeftBadge(viewPhoto.trashed_at).text}
        </Badge>
      </div>
      <div className="flex items-center gap-4 text-white/70 text-sm mb-4">
        <span>{formatBytes(viewPhoto.file_size || 0)}</span>
        {viewPhoto.width && viewPhoto.height && (
          <span>{viewPhoto.width} × {viewPhoto.height}</span>
        )}
        <span>Удалено: {formatDate(viewPhoto.trashed_at)}</span>
      </div>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRestorePhoto(viewPhoto.id, viewPhoto.file_name);
            onCloseDialog();
          }}
          disabled={restoring === viewPhoto.id}
          className="bg-green-600/80 hover:bg-green-600 text-white border-0"
        >
          {restoring === viewPhoto.id ? (
            <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
          ) : (
            <Icon name="Undo2" size={16} className="mr-2" />
          )}
          Восстановить
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDeletePhotoForever(viewPhoto.id, viewPhoto.file_name);
            onCloseDialog();
          }}
          disabled={deleting === viewPhoto.id}
          className="bg-red-600/80 hover:bg-red-600 border-0"
        >
          {deleting === viewPhoto.id ? (
            <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
          ) : (
            <Icon name="Trash2" size={16} className="mr-2" />
          )}
          Удалить навсегда
        </Button>
      </div>
    </div>
  );
};

export default TrashedPhotoInfo;
