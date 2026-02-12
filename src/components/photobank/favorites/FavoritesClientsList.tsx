import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import type { ClientData, Photo } from './useFavoritesData';

interface FavoritesClientsListProps {
  clients: ClientData[];
  allPhotos: Photo[];
  onClientSelect: (client: ClientData) => void;
  onPhotoSelect: (photo: Photo, client: ClientData) => void;
  onDownloadClient: (client: ClientData) => void;
}

export default function FavoritesClientsList({
  clients,
  allPhotos,
  onClientSelect,
  onPhotoSelect,
  onDownloadClient
}: FavoritesClientsListProps) {
  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {clients.map(client => {
        const displayPhotos = client.photos
          .map(fp => allPhotos.find(p => p.id === fp.photo_id))
          .filter((p): p is Photo => p !== undefined);

        if (displayPhotos.length === 0) return null;

        return (
          <div
            key={client.client_id}
            className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {client.full_name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {client.phone}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownloadClient(client)}
                >
                  <Icon name="Download" size={16} />
                  <span className="ml-2">Скачать все ({displayPhotos.length})</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {displayPhotos.map(photo => (
                <div
                  key={photo.id}
                  className="relative aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden cursor-pointer group"
                  onClick={() => onPhotoSelect(photo, client)}
                >
                  <div className="absolute top-1 left-1 text-[10px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded z-10">
                    {photo.file_name}
                  </div>
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onLoad={() => {
                      console.log('[FAVORITES] Image loaded:', photo.file_name);
                    }}
                    onError={(e) => {
                      console.error('[FAVORITES] Image failed to load:', {
                        file: photo.file_name,
                        url: photo.thumbnail_url || photo.photo_url
                      });
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const icon = target.nextElementSibling;
                      if (icon) icon.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-300 dark:bg-gray-600">
                    <Icon name="Image" size={32} className="text-gray-500" />
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <Icon 
                      name="Maximize2" 
                      size={24} 
                      className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
