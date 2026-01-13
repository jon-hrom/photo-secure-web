import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface FavoriteItem {
  photo: {
    id: number;
    file_name: string;
    photo_url: string;
    thumbnail_url?: string;
  };
  fullName: string;
  phone: string;
  email?: string;
  timestamp: number;
}

interface FavoritesViewModalProps {
  folderId: number;
  folderName: string;
  onClose: () => void;
}

export default function FavoritesViewModal({ folderId, folderName, onClose }: FavoritesViewModalProps) {
  const [groupedFavorites, setGroupedFavorites] = useState<Record<string, FavoriteItem[]>>({});
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [folderId]);

  const loadFavorites = () => {
    const galleryCode = localStorage.getItem(`folder_${folderId}_gallery_code`);
    if (!galleryCode) {
      setLoading(false);
      return;
    }

    const savedFavorites = localStorage.getItem(`favorites_${galleryCode}`);
    if (savedFavorites) {
      try {
        const data: FavoriteItem[] = JSON.parse(savedFavorites);
        
        const grouped = data.reduce((acc: Record<string, FavoriteItem[]>, fav) => {
          const key = fav.fullName;
          if (!acc[key]) acc[key] = [];
          acc[key].push(fav);
          return acc;
        }, {});
        
        setGroupedFavorites(grouped);
      } catch (e) {
        console.error('Failed to parse favorites:', e);
      }
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-8">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const clientNames = Object.keys(groupedFavorites);

  if (selectedClient) {
    const clientPhotos = groupedFavorites[selectedClient] || [];
    const clientInfo = clientPhotos[0];

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedClient(null)}
                >
                  <Icon name="ArrowLeft" size={18} />
                </Button>
                <Icon name="Star" size={24} className="text-yellow-500 fill-yellow-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClient}</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 ml-10">
                {clientInfo.phone} {clientInfo.email && `· ${clientInfo.email}`} · {clientPhotos.length} фото
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <Icon name="X" size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
              {clientPhotos.map((item, idx) => (
                <div
                  key={idx}
                  className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden break-inside-avoid mb-4"
                >
                  <img
                    src={item.photo.thumbnail_url || item.photo.photo_url}
                    alt={item.photo.file_name}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-white text-xs truncate">{item.photo.file_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Icon name="Star" size={24} className="text-yellow-500 fill-yellow-500" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Избранное</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{folderName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {clientNames.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Icon name="ImageOff" size={48} className="mx-auto mb-3 opacity-50" />
              <p>Клиенты ещё не добавили фото в избранное</p>
              <p className="text-sm mt-2">Настройте избранное в разделе "Ссылка на папку"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientNames.map((clientName) => {
                const clientPhotos = groupedFavorites[clientName];
                const clientInfo = clientPhotos[0];
                
                return (
                  <div
                    key={clientName}
                    onClick={() => setSelectedClient(clientName)}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {clientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{clientName}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{clientInfo.phone}</p>
                        {clientInfo.email && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{clientInfo.email}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      {clientPhotos.slice(0, 3).map((item, idx) => (
                        <img
                          key={idx}
                          src={item.photo.thumbnail_url || item.photo.photo_url}
                          alt={item.photo.file_name}
                          className="w-full h-20 object-cover rounded"
                        />
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{clientPhotos.length} фото</span>
                      <Icon name="ChevronRight" size={16} className="text-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
