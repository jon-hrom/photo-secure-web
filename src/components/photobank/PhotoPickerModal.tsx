import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { Photo, getPhotoUrl } from './retouchTypes';

interface PhotoPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: Photo[];
  selectedId: number | null;
  onSelect: (photo: Photo) => void;
}

const PhotoPickerModal = ({ open, onOpenChange, photos, selectedId, onSelect }: PhotoPickerModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[calc(100%-1rem)] rounded-2xl sm:rounded-xl p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-sm sm:text-base">Выберите фото для предпросмотра</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Это фото будет использоваться для предварительного просмотра настроек
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[50vh] overflow-y-auto -mx-1 px-1 mt-2">
          {photos.map(photo => (
            <button
              key={photo.id}
              onClick={() => { onSelect(photo); onOpenChange(false); }}
              className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all active:scale-95 ${
                selectedId === photo.id
                  ? 'border-rose-500 ring-2 ring-rose-300 shadow-lg'
                  : 'border-transparent hover:border-rose-200'
              }`}
            >
              <img
                src={getPhotoUrl(photo)}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {selectedId === photo.id && (
                <div className="absolute inset-0 bg-rose-500/20 flex items-center justify-center">
                  <Icon name="Check" size={18} className="text-white drop-shadow-lg" />
                </div>
              )}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoPickerModal;
