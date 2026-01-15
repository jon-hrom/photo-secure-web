import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import PhotoGridViewer from './PhotoGridViewer';

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

  const handleDownloadSinglePhoto = async (photo: Photo) => {
    try {
      console.log('[FAVORITES] Downloading photo:', photo.photo_url);
      const urlParts = photo.photo_url.split('/bucket/');
      let s3_key = urlParts[1] || photo.photo_url.split('/').slice(-3).join('/');
      // Удаляем параметры presigned URL если есть
      s3_key = s3_key.split('?')[0];
      console.log('[FAVORITES] Extracted s3_key:', s3_key);
      
      // Для больших файлов (RAW > 3MB) используем presigned URL
      const isLargeFile = photo.file_name.toUpperCase().endsWith('.CR2') || 
                         photo.file_name.toUpperCase().endsWith('.NEF') ||
                         photo.file_name.toUpperCase().endsWith('.ARW');
      
      const response = await fetch(
        `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?s3_key=${encodeURIComponent(s3_key)}${isLargeFile ? '&presigned=true' : ''}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[FAVORITES] Download error:', errorData);
        throw new Error(errorData.error || 'Ошибка скачивания');
      }

      if (isLargeFile) {
        const data = await response.json();
        const a = document.createElement('a');
        a.href = data.download_url;
        a.download = photo.file_name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = photo.file_name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (e) {
      console.error('[FAVORITES] Download failed:', e);
      alert('Ошибка при скачивании фото: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    }
  };

  const handleDownloadClientPhotos = async (client: ClientData) => {
    const displayPhotos = client.photos
      .map(fp => allPhotos.find(p => p.id === fp.photo_id))
      .filter((p): p is Photo => p !== undefined);

    if (displayPhotos.length === 0) {
      alert('Нет фото для скачивания');
      return;
    }

    try {
      const { ZipWriter, BlobWriter, HttpReader } = await import('@zip.js/zip.js');
      const zipWriter = new ZipWriter(new BlobWriter('application/zip'));

      for (const photo of displayPhotos) {
        try {
          const urlParts = photo.photo_url.split('/bucket/');
          let s3_key = urlParts[1] || photo.photo_url.split('/').slice(-3).join('/');
          // Удаляем параметры presigned URL если есть
          s3_key = s3_key.split('?')[0];
          
          const proxyUrl = `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?s3_key=${encodeURIComponent(s3_key)}`;
          
          await zipWriter.add(photo.file_name, new HttpReader(proxyUrl));
        } catch (photoError) {
          console.error(`Failed to add ${photo.file_name} to archive:`, photoError);
        }
      }

      const blob = await zipWriter.close();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${client.full_name}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Download failed:', e);
      alert('Ошибка при скачивании архива');
    }
  };

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
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{displayPhotos.length} фото</p>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleDownloadClientPhotos(selectedClient)}
                className="flex items-center gap-2"
              >
                <Icon name="Archive" size={16} />
                Скачать все архивом
              </Button>
            </div>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {displayPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all aspect-square group"
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadSinglePhoto(photo);
                    }}
                    className="absolute top-1 right-1 bg-blue-500 hover:bg-blue-600 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Скачать фото"
                  >
                    <Icon name="Download" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedPhoto) {
    const displayPhotos = selectedClient?.photos
      .map(fp => allPhotos.find(p => p.id === fp.photo_id))
      .filter((p): p is Photo => p !== undefined) || [];

    const viewerPhotos = displayPhotos.map(p => {
      let s3_key = p.photo_url.split('/bucket/')[1] || p.photo_url.split('/').slice(-3).join('/');
      // Удаляем параметры presigned URL если есть
      s3_key = s3_key.split('?')[0];
      
      return {
        id: p.id,
        file_name: p.file_name,
        s3_url: p.photo_url,
        s3_key: s3_key,
        thumbnail_s3_url: p.thumbnail_url,
        is_raw: false,
        file_size: 0,
        width: null,
        height: null,
        created_at: new Date().toISOString()
      };
    });

    const viewerPhoto = viewerPhotos.find(p => p.id === selectedPhoto.id) || null;

    return (
      <PhotoGridViewer
        viewPhoto={viewerPhoto}
        photos={viewerPhotos}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={handleNavigate}
        onDownload={async (s3Key, fileName) => {
          try {
            const isLargeFile = fileName.toUpperCase().endsWith('.CR2') || 
                               fileName.toUpperCase().endsWith('.NEF') ||
                               fileName.toUpperCase().endsWith('.ARW');
            
            const response = await fetch(
              `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?s3_key=${encodeURIComponent(s3Key)}${isLargeFile ? '&presigned=true' : ''}`
            );
            if (!response.ok) throw new Error('Ошибка скачивания');
            
            if (isLargeFile) {
              const data = await response.json();
              const a = document.createElement('a');
              a.href = data.download_url;
              a.download = fileName;
              a.target = '_blank';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            } else {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              window.URL.revokeObjectURL(url);
              document.body.removeChild(a);
            }
          } catch (e) {
            console.error('Download failed:', e);
            alert('Ошибка при скачивании фото');
          }
        }}
        formatBytes={(bytes) => {
          if (bytes === 0) return 'N/A';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-6xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Icon name="Star" size={24} className="text-yellow-500 fill-yellow-500" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Избранное клиентов</h2>
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
            <div className="text-center py-12">
              <Icon name="Star" size={64} className="text-gray-300 dark:text-gray-700 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Пока нет избранного</h3>
              <p className="text-gray-600 dark:text-gray-400">Клиенты смогут добавлять фото в избранное после получения ссылки на галерею</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {clients.map((client) => {
                const clientPhotos = client.photos
                  .map(fp => allPhotos.find(p => p.id === fp.photo_id))
                  .filter((p): p is Photo => p !== undefined);
                
                return (
                  <div
                    key={client.client_id}
                    className="relative group cursor-pointer"
                    onClick={() => setSelectedClient(client)}
                  >
                    <div className="relative bg-gradient-to-br from-yellow-50 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 rounded-2xl p-6 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-105 aspect-[3/4] flex flex-col items-center justify-center border-2 border-yellow-200/50 dark:border-yellow-700/50">
                      <div className="absolute top-3 right-3 z-10">
                        <Icon name="Star" size={20} className="text-yellow-500 fill-yellow-500 drop-shadow-md" />
                      </div>
                      
                      <div className="flex-1 flex items-center justify-center mb-3">
                        <Icon name="Folder" size={72} className="text-yellow-600 dark:text-yellow-500 drop-shadow-sm" />
                      </div>
                      
                      <div className="w-full text-center">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 truncate px-2" title={client.full_name}>
                          {client.full_name}
                        </h3>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate px-2" title={client.phone}>
                          {client.phone}
                        </p>
                      </div>

                      <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm rounded-lg px-2 py-1 shadow-sm border border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-1">
                          <Icon name="Image" size={14} className="text-gray-600 dark:text-gray-400" />
                          <span className="text-xs font-semibold text-gray-900 dark:text-white">{clientPhotos.length}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadClientPhotos(client);
                        }}
                        className="absolute bottom-3 right-3 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg shadow-md hover:shadow-lg transition-all z-10 hover:scale-110 active:scale-95"
                        title="Скачать все фото архивом"
                      >
                        <Icon name="Archive" size={16} />
                      </button>
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