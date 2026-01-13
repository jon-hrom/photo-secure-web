import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
}

interface FavoritePhoto {
  photo_id: number;
  added_at?: string;
}

interface MyFavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  clientName: string;
  galleryPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onPhotoRemoved?: (photoId: number) => void;
}

export default function MyFavoritesModal({ 
  isOpen, 
  onClose, 
  clientId, 
  clientName,
  galleryPhotos,
  onPhotoClick,
  onPhotoRemoved
}: MyFavoritesModalProps) {
  const [favoritePhotos, setFavoritePhotos] = useState<FavoritePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    loadFavorites();
  }, [isOpen, clientId]);

  const loadFavorites = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723?client_id=${clientId}`
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка загрузки избранного');
      }

      setFavoritePhotos(result.photos || []);
    } catch (error) {
      console.error('[MY_FAVORITES] Error loading:', error);
      setError(error instanceof Error ? error.message : 'Ошибка загрузки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFromFavorites = async (photoId: number) => {
    if (!confirm('Удалить это фото из избранного?')) return;

    try {
      const response = await fetch(
        `https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723?client_id=${clientId}&photo_id=${photoId}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Ошибка удаления');
      }

      setFavoritePhotos(prev => prev.filter(p => p.photo_id !== photoId));
      
      if (onPhotoRemoved) {
        onPhotoRemoved(photoId);
      }
    } catch (error) {
      console.error('[MY_FAVORITES] Error removing:', error);
      alert(error instanceof Error ? error.message : 'Ошибка удаления');
    }
  };

  if (!isOpen) return null;

  const displayPhotos = favoritePhotos
    .map(fp => galleryPhotos.find(gp => gp.id === fp.photo_id))
    .filter((p): p is Photo => p !== undefined);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Icon name="Star" size={24} className="text-yellow-500 fill-yellow-500" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Мой список избранного</h2>
              <p className="text-sm text-gray-600 mt-1">{clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Icon name="AlertCircle" size={48} className="text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
              <Button onClick={loadFavorites} className="mt-4">
                Попробовать снова
              </Button>
            </div>
          ) : displayPhotos.length === 0 ? (
            <div className="text-center py-12">
              <Icon name="Star" size={64} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Вы ещё не добавили фото в избранное</p>
              <p className="text-gray-400 text-sm mt-2">
                Нажмите на звёздочку на любом фото, чтобы добавить его сюда
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group bg-gray-100 rounded-lg overflow-hidden cursor-pointer aspect-square"
                >
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={photo.file_name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    onClick={() => onPhotoClick(photo)}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromFavorites(photo.id);
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                    title="Удалить из избранного"
                  >
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Всего фото в избранном: {displayPhotos.length}</span>
            <Button variant="outline" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}