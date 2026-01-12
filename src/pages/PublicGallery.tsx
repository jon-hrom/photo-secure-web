import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
}

interface GalleryData {
  folder_name: string;
  photos: Photo[];
  total_size: number;
}

export default function PublicGallery() {
  const { code } = useParams<{ code: string }>();
  const [gallery, setGallery] = useState<GalleryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    loadGallery();
  }, [code]);

  const loadGallery = async (enteredPassword?: string) => {
    try {
      const passwordParam = enteredPassword || password;
      const url = passwordParam 
        ? `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?code=${code}&password=${encodeURIComponent(passwordParam)}`
        : `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?code=${code}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.status === 401 && data.requires_password) {
        setRequiresPassword(true);
        setPasswordError(enteredPassword ? 'Неверный пароль' : '');
        setLoading(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Галерея не найдена');
      }
      
      setGallery(data);
      setRequiresPassword(false);
      setPasswordError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Введите пароль');
      return;
    }
    setLoading(true);
    setPasswordError('');
    await loadGallery(password);
  };

  const downloadPhoto = async (photo: Photo) => {
    try {
      const response = await fetch(photo.photo_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Ошибка скачивания:', err);
    }
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    try {
      const url = password 
        ? `https://functions.poehali.dev/08b459b7-c9d2-4c3d-8778-87ffc877fb2a?code=${code}&password=${encodeURIComponent(password)}`
        : `https://functions.poehali.dev/08b459b7-c9d2-4c3d-8778-87ffc877fb2a?code=${code}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok || !data.files) {
        throw new Error(data.error || 'Ошибка получения списка файлов');
      }

      for (const file of data.files) {
        const a = document.createElement('a');
        a.href = file.url;
        a.download = file.filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      alert(`Начато скачивание ${data.files.length} фото`);
    } catch (err: any) {
      console.error('Ошибка скачивания:', err);
      alert('Ошибка: ' + err.message);
    } finally {
      setDownloadingAll(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка галереи...</p>
        </div>
      </div>
    );
  }

  if (requiresPassword && !gallery) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon name="Lock" size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Галерея защищена</h1>
            <p className="text-gray-600 dark:text-gray-400">Введите пароль для доступа</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="Пароль"
                className="w-full px-4 py-3 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              {passwordError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{passwordError}</p>
              )}
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Проверка...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Icon name="AlertCircle" size={64} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ошибка</h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{gallery?.folder_name}</h1>
              <p className="text-gray-600">
                {gallery?.photos.length} фото · {formatFileSize(gallery?.total_size || 0)}
              </p>
            </div>
            <button
              onClick={downloadAll}
              disabled={downloadingAll}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name={downloadingAll ? "Loader2" : "Download"} size={20} className={downloadingAll ? "animate-spin" : ""} />
              {downloadingAll ? 'Подготовка...' : 'Скачать всё архивом'}
            </button>
          </div>
        </div>

        <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
          {gallery?.photos.map((photo) => {
            const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 1;
            const isLandscape = aspectRatio > 1;
            const isPortrait = aspectRatio < 1;
            
            return (
              <div
                key={photo.id}
                className="group relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer break-inside-avoid mb-4"
                onClick={() => {
                setImageError(false);
                setSelectedPhoto(photo);
              }}
              >
                <img
                  src={photo.thumbnail_url || photo.photo_url}
                  alt={photo.file_name}
                  className="w-full h-auto transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      downloadPhoto(photo);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-3 bg-white rounded-full transition-opacity"
                  >
                    <Icon name="Download" size={24} className="text-gray-900" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors z-10"
            onClick={() => setSelectedPhoto(null)}
          >
            <Icon name="X" size={24} className="text-white" />
          </button>
          
          <div className="absolute top-4 left-4 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 z-10">
            <p className="text-white text-sm">{selectedPhoto.file_name}</p>
          </div>
          
          <button
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors z-10"
            onClick={(e) => {
              e.stopPropagation();
              downloadPhoto(selectedPhoto);
            }}
          >
            <Icon name="Download" size={20} />
            Скачать
          </button>
          
          {imageError ? (
            <div className="text-center text-white">
              <Icon name="FileWarning" size={64} className="mx-auto mb-4" />
              <p className="mb-4">CR2/RAW файлы не поддерживаются браузером для просмотра</p>
              <button
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  downloadPhoto(selectedPhoto);
                }}
              >
                <Icon name="Download" size={20} className="inline mr-2" />
                Скачать файл
              </button>
            </div>
          ) : (
            <img
              src={selectedPhoto.photo_url}
              alt={selectedPhoto.file_name}
              className="max-w-[95vw] max-h-[95vh] object-contain"
              onError={() => setImageError(true)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}