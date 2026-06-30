import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useFavoritesData, resolveClientPhotos } from './favorites/useFavoritesData';
import FavoritesClientsList from './favorites/FavoritesClientsList';
import FavoritesPhotoViewer from './favorites/FavoritesPhotoViewer';
import { downloadFavoritesListDoc, printFavoritesList } from './favorites/favoritesListExport';
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
    downloadProgress,
    handleDownloadSinglePhoto,
    handleDownloadClientPhotos
  } = useFavoritesData(folderId, userId);

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedClient || !selectedPhoto) return;
    
    const displayPhotos = resolveClientPhotos(selectedClient, allPhotos);
    
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

  const clientsWithPhotos = clients.filter(
    c => resolveClientPhotos(c, allPhotos).length > 0
  );
  const totalPhotos = clientsWithPhotos.reduce(
    (sum, c) => sum + resolveClientPhotos(c, allPhotos).length,
    0
  );

  const pluralize = (n: number, forms: [string, string, string]) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms[0];
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
    return forms[2];
  };

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
            {clientsWithPhotos.length > 0 && (
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">
                {clientsWithPhotos.length}{' '}
                {pluralize(clientsWithPhotos.length, ['клиент', 'клиента', 'клиентов'])}
                {' · '}
                {totalPhotos}{' '}
                {pluralize(totalPhotos, ['фото отобрано', 'фото отобрано', 'фото отобрано'])}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {clientsWithPhotos.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadFavoritesListDoc(folderName, clientsWithPhotos, allPhotos)}
                  className="gap-1.5"
                >
                  <Icon name="FileText" size={16} />
                  <span className="hidden sm:inline">Скачать списком</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => printFavoritesList(folderName, clientsWithPhotos, allPhotos)}
                  className="gap-1.5"
                >
                  <Icon name="Printer" size={16} />
                  <span className="hidden sm:inline">Печать</span>
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <Icon name="X" size={20} />
            </Button>
          </div>
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
              downloadProgress={downloadProgress}
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