import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import PhotoGridViewer from '@/components/photobank/PhotoGridViewer';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
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
  onPhotoClick?: (photo: Photo) => void;
  onPhotoRemoved?: (photoId: number) => void;
  downloadDisabled?: boolean;
  isDarkTheme?: boolean;
}

export default function MyFavoritesModal({ 
  isOpen, 
  onClose, 
  clientId, 
  clientName,
  galleryPhotos,
  onPhotoClick,
  onPhotoRemoved,
  downloadDisabled = false,
  isDarkTheme = false
}: MyFavoritesModalProps) {
  const [favoritePhotos, setFavoritePhotos] = useState<FavoritePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

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

  const displayPhotos = favoritePhotos
    .map(fp => galleryPhotos.find(gp => gp.id === fp.photo_id))
    .filter((p): p is Photo => p !== undefined);

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedPhoto) return;
    const currentIndex = displayPhotos.findIndex(p => p.id === selectedPhoto.id);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : displayPhotos.length - 1;
    } else {
      newIndex = currentIndex < displayPhotos.length - 1 ? currentIndex + 1 : 0;
    }

    setSelectedPhoto(displayPhotos[newIndex]);
  };

  if (!isOpen) return null;

  if (selectedPhoto) {
    const viewerPhotos = displayPhotos.map(p => {
      let s3_key = p.s3_key || p.photo_url.split('/bucket/')[1] || p.photo_url.split('/').slice(-3).join('/');
      // Удаляем параметры presigned URL если есть
      s3_key = s3_key.split('?')[0];
      
      return {
        id: p.id,
        file_name: p.file_name,
        s3_url: p.photo_url,
        s3_key: s3_key,
        thumbnail_s3_url: p.thumbnail_url,
        is_raw: false,
        file_size: p.file_size,
        width: p.width || null,
        height: p.height || null,
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
        downloadDisabled={downloadDisabled}
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
          const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4" onClick={onClose}>
      <div 
        className={`rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col ${isDarkTheme ? 'bg-gray-900' : 'bg-white'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-3 sm:p-4 md:p-6 border-b ${isDarkTheme ? 'border-gray-700' : ''}`}>
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Icon name="Star" size={20} className="text-yellow-500 fill-yellow-500 flex-shrink-0 sm:w-6 sm:h-6" />
            <div className="min-w-0">
              <h2 className={`text-lg sm:text-xl md:text-2xl font-bold ${isDarkTheme ? 'text-white' : 'text-gray-900'}`}>Мой список избранного</h2>
              <p className={`text-xs sm:text-sm mt-0.5 sm:mt-1 truncate ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>{clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className={`p-1.5 sm:p-2 rounded-full transition-colors touch-manipulation flex-shrink-0 ${isDarkTheme ? 'hover:bg-gray-800 active:bg-gray-700' : 'hover:bg-gray-100 active:bg-gray-200'}`}>
            <Icon name="X" size={20} className={isDarkTheme ? 'text-gray-400' : 'text-gray-500'} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 sm:py-12">
              <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8 sm:py-12 px-4">
              <Icon name="AlertCircle" size={40} className="text-red-500 mx-auto mb-3 sm:mb-4 sm:w-12 sm:h-12" />
              <p className={`text-sm sm:text-base ${isDarkTheme ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
              <Button onClick={loadFavorites} className="mt-3 sm:mt-4 touch-manipulation">
                Попробовать снова
              </Button>
            </div>
          ) : displayPhotos.length === 0 ? (
            <div className="text-center py-8 sm:py-12 px-4">
              <Icon name="Star" size={48} className={`mx-auto mb-3 sm:mb-4 sm:w-16 sm:h-16 ${isDarkTheme ? 'text-gray-600' : 'text-gray-300'}`} />
              <p className={`text-base sm:text-lg ${isDarkTheme ? 'text-gray-400' : 'text-gray-500'}`}>Вы ещё не добавили фото в избранное</p>
              <p className={`text-xs sm:text-sm mt-2 ${isDarkTheme ? 'text-gray-500' : 'text-gray-400'}`}>
                Нажмите на звёздочку на любом фото, чтобы добавить его сюда
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
              {displayPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className={`relative group rounded-md sm:rounded-lg overflow-hidden cursor-pointer aspect-square touch-manipulation ${isDarkTheme ? 'bg-gray-800' : 'bg-gray-100'}`}
                >
                  <div 
                    className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 z-10 bg-black/60 backdrop-blur-sm text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded max-w-[calc(100%-1rem)] truncate cursor-pointer hover:bg-black/70 active:bg-black/80 transition-colors touch-manipulation"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(photo.file_name);
                      const btn = e.currentTarget;
                      const originalText = btn.textContent;
                      btn.textContent = 'Имя скопировано';
                      setTimeout(() => {
                        btn.textContent = originalText;
                      }, 2000);
                    }}
                    title="Нажмите, чтобы скопировать"
                  >
                    {photo.file_name}
                  </div>
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={photo.file_name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 active:scale-95"
                    onClick={() => {
                      setSelectedPhoto(photo);
                    }}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromFavorites(photo.id);
                    }}
                    className="absolute top-1.5 sm:top-2 right-1.5 sm:right-2 p-1 bg-red-500 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-600 active:bg-red-700 shadow-lg touch-manipulation"
                    title="Удалить из избранного"
                  >
                    <Icon name="Trash2" size={12} />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        let s3_key = photo.s3_key || photo.photo_url.split('/bucket/')[1] || photo.photo_url.split('/').slice(-3).join('/');
                        s3_key = s3_key.split('?')[0];
                        
                        const isLargeFile = photo.file_name.toUpperCase().endsWith('.CR2') || 
                                           photo.file_name.toUpperCase().endsWith('.NEF') ||
                                           photo.file_name.toUpperCase().endsWith('.ARW') ||
                                           photo.file_size > 3 * 1024 * 1024;
                        
                        const response = await fetch(
                          `https://functions.poehali.dev/f72c163a-adb8-41ae-9555-db32a2f8e215?s3_key=${encodeURIComponent(s3_key)}${isLargeFile ? '&presigned=true' : ''}`
                        );
                        if (!response.ok) throw new Error('Ошибка скачивания');
                        
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
                        console.error('Download failed:', e);
                        alert('Ошибка при скачивании фото');
                      }
                    }}
                    className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 p-1 bg-blue-500 text-white rounded-full opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-blue-600 active:bg-blue-700 shadow-lg touch-manipulation"
                    title="Скачать фото"
                  >
                    <Icon name="Download" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`border-t p-3 sm:p-4 ${isDarkTheme ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50'}`}>
          <div className={`flex items-center justify-between text-xs sm:text-sm ${isDarkTheme ? 'text-gray-400' : 'text-gray-600'}`}>
            <span className="truncate mr-2">Всего фото в избранном: {displayPhotos.length}</span>
            <Button variant="outline" onClick={onClose} className="touch-manipulation flex-shrink-0">
              Закрыть
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}