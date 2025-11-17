import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { UploadedPhoto } from './PhotobookCreator';

interface PhotoPanelProps {
  photos: UploadedPhoto[];
  onPhotoSelect: (photoId: string) => void;
}

const PhotoPanel = ({ photos, onPhotoSelect }: PhotoPanelProps) => {
  return (
    <Card className="w-64 p-4 flex flex-col">
      <h3 className="font-semibold mb-2">Фотографии</h3>
      <p className="text-xs text-muted-foreground mb-3">
        Кликните на фото, затем на слот чтобы применить
      </p>
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => onPhotoSelect(photo.id)}
              className="border-2 rounded overflow-hidden hover:border-blue-500 transition-colors aspect-square"
            >
              <img 
                src={photo.url} 
                alt="Фото" 
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};

export default PhotoPanel;
