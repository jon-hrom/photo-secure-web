import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
}

interface FolderPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderName: string;
  photos: Photo[];
  onRemovePhoto: (photoId: number) => void;
  onViewPhoto: (photo: Photo) => void;
}

export default function FolderPhotosModal({
  isOpen,
  onClose,
  folderName,
  photos,
  onRemovePhoto,
  onViewPhoto
}: FolderPhotosModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <Icon name="Star" size={24} className="text-yellow-500 fill-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">{folderName}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {photos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Icon name="ImageOff" size={48} className="mx-auto mb-3 opacity-50" />
              <p>В этой папке пока нет фото</p>
            </div>
          ) : (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer break-inside-avoid mb-4"
                >
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={photo.file_name}
                    className="w-full h-auto transition-transform group-hover:scale-105"
                    loading="lazy"
                    onClick={() => onViewPhoto(photo)}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPhoto(photo);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-full transition-opacity"
                    >
                      <Icon name="Eye" size={20} className="text-gray-900" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemovePhoto(photo.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-full transition-opacity"
                    >
                      <Icon name="Trash2" size={20} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t">
          <Button onClick={onClose} variant="outline" className="w-full">
            Закрыть
          </Button>
        </div>
      </div>
    </div>
  );
}
