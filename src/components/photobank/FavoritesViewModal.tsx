import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useFavoritesData } from './favorites/useFavoritesData';
import FavoritesClientsList from './favorites/FavoritesClientsList';
import FavoritesPhotoViewer from './favorites/FavoritesPhotoViewer';
import type { ClientData, Photo } from './favorites/useFavoritesData';

interface FavoritesViewModalProps {
  folderId: number | null;
  folderName: string;
  userId: number;
  onClose: () => void;
}

export default function FavoritesViewModal({ folderId, folderName, userId, onClose }: FavoritesViewModalProps) {
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const {
    clients,
    allPhotos,
    loading,
    error,
    handleDownloadSinglePhoto,
    handleDownloadClientPhotos
  } = useFavoritesData(folderId, userId);

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedClient || !selectedPhoto) return;
    
    const displayPhotos = selectedClient.photos
      .map(fp => allPhotos.find(p => p.id === fp.photo_id))
      .filter((p): p is Photo => p !== undefined);
    
    const currentIndex = displayPhotos.findIndex(p => p.id === selectedPhoto.id);
    
    if (direction === 'prev' && currentIndex > 0) {
      setSelectedPhoto(displayPhotos[currentIndex - 1]);
    } else if (direction === 'next' && currentIndex < displayPhotos.length - 1) {
      setSelectedPhoto(displayPhotos[currentIndex + 1]);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-8">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (selectedPhoto && selectedClient) {
    return (
      <FavoritesPhotoViewer
        selectedPhoto={selectedPhoto}
        selectedClient={selectedClient}
        allPhotos={allPhotos}
        onClose={() => setSelectedPhoto(null)}
        onDownload={handleDownloadSinglePhoto}
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Избранные фото клиентов
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {folderName}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          {error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icon name="AlertCircle" size={48} className="text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{error}</p>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icon name="Heart" size={48} className="text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                Пока нет избранных фото
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                Клиенты смогут добавлять фото в избранное через галерею
              </p>
            </div>
          ) : (
            <FavoritesClientsList
              clients={clients}
              allPhotos={allPhotos}
              onClientSelect={setSelectedClient}
              onPhotoSelect={(photo, client) => {
                setSelectedClient(client);
                setSelectedPhoto(photo);
              }}
              onDownloadClient={handleDownloadClientPhotos}
            />
          )}
        </div>
      </div>
    </div>
  );
}
