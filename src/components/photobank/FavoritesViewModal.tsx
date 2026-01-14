import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface FavoritesViewModalProps {
  folderId: number;
  folderName: string;
  userId: number;
  onClose: () => void;
}

interface ClientData {
  client_id: number;
  full_name: string;
  phone: string;
  email?: string;
  photos: Array<{
    photo_id: number;
    added_at?: string;
  }>;
}

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
}

export default function FavoritesViewModal({ folderId, folderName, userId, onClose }: FavoritesViewModalProps) {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const init = async () => {
      await loadPhotos();
      await loadFavorites();
    };
    init();
  }, [folderId]);

  const loadPhotos = async () => {
    try {
      const response = await fetch(
        `https://functions.poehali.dev/647801b3-1db8-4ded-bf80-1f278b3b5f94?action=list_photos&folder_id=${folderId}`,
        { headers: { 'X-User-Id': userId.toString() } }
      );
      const result = await response.json();
      
      if (response.ok) {
        const photos = (result.photos || []).map((photo: Photo) => ({
          ...photo,
          thumbnail_url: photo.thumbnail_url || photo.photo_url
        }));
        
        setAllPhotos(photos);
        console.log('[FAVORITES] Loaded', photos.length, 'photos with presigned URLs');
      }
    } catch (e) {
      console.error('[FAVORITES] Failed to load photos:', e);
    }
  };

  const loadFavorites = async () => {
    setLoading(true);
    setError('');
    
    const galleryCode = localStorage.getItem(`folder_${folderId}_gallery_code`);
    console.log('[FAVORITES] Gallery code:', galleryCode);
    
    if (!galleryCode) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723?gallery_code=${galleryCode}`
      );
      
      const result = await response.json();
      console.log('[FAVORITES] Clients API response:', result);
      
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка загрузки избранного');
      }
      
      const clients = result.clients || [];
      console.log('[FAVORITES] Loaded clients:', clients.length);
      clients.forEach((client: ClientData) => {
        console.log('[FAVORITES] Client:', {
          name: client.full_name,
          photoIds: client.photos.map(p => p.photo_id)
        });
      });
      
      setClients(clients);
    } catch (e) {
      console.error('[FAVORITES] Failed to load favorites:', e);
      setError(e instanceof Error ? e.message : 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
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

  if (selectedClient) {
    const displayPhotos = selectedClient.photos
      .map(fp => allPhotos.find(p => p.id === fp.photo_id))
      .filter((p): p is Photo => p !== undefined);

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
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{selectedClient.full_name}</h2>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 ml-10">
                {selectedClient.phone} {selectedClient.email && `· ${selectedClient.email}`} · {displayPhotos.length} фото
              </p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
              <Icon name="X" size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {displayPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all aspect-square"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={photo.file_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const icon = target.nextElementSibling;
                      if (icon) icon.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden absolute inset-0 flex items-center justify-center">
                    <Icon name="Camera" size={48} className="text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedPhoto) {
    return (
      <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
        <button
          onClick={() => setSelectedPhoto(null)}
          className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
        >
          <Icon name="X" size={24} className="text-white" />
        </button>
        <img
          src={selectedPhoto.photo_url}
          alt={selectedPhoto.file_name}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
          style={{ cursor: 'zoom-in' }}
        />
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
          {error ? (
            <div className="text-center py-12">
              <Icon name="AlertCircle" size={48} className="text-red-500 mx-auto mb-4" />
              <p className="text-red-600">{error}</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Icon name="ImageOff" size={48} className="mx-auto mb-3 opacity-50" />
              <p>Клиенты ещё не добавили фото в избранное</p>
              <p className="text-sm mt-2">Настройте избранное в разделе "Ссылка на папку"</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => {
                const clientPhotos = client.photos
                  .map(fp => allPhotos.find(p => p.id === fp.photo_id))
                  .filter((p): p is Photo => p !== undefined);
                
                return (
                  <div
                    key={client.client_id}
                    onClick={() => setSelectedClient(client)}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {client.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{client.full_name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{client.phone}</p>
                        {client.email && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{client.email}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      {clientPhotos.slice(0, 3).map((photo) => (
                        <div key={photo.id} className="relative w-full h-20 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                          <img
                            src={photo.thumbnail_url || photo.photo_url}
                            alt={photo.file_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              const icon = target.nextElementSibling;
                              if (icon) icon.classList.remove('hidden');
                            }}
                          />
                          <div className="hidden absolute inset-0 flex items-center justify-center">
                            <Icon name="Camera" size={32} className="text-gray-400" />
                          </div>
                        </div>
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