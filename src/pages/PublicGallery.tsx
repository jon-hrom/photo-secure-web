import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import PasswordForm from './gallery/PasswordForm';
import GalleryGrid from './gallery/GalleryGrid';
import PhotoViewer from './gallery/PhotoViewer';
import JSZip from 'jszip';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
}

interface WatermarkSettings {
  enabled: boolean;
  type: string;
  text?: string;
  image_url?: string;
  frequency: number;
  size: number;
  opacity: number;
  rotation?: number;
}

interface GalleryData {
  folder_name: string;
  photos: Photo[];
  total_size: number;
  watermark?: WatermarkSettings;
  screenshot_protection?: boolean;
  download_disabled?: boolean;
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
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState({
    show: false,
    current: 0,
    total: 0,
    status: 'preparing' as 'preparing' | 'downloading' | 'completed'
  });

  useEffect(() => {
    if (gallery?.screenshot_protection) {
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
      
      const preventScreenshot = (e: Event) => {
        if ((e as KeyboardEvent).key === 'PrintScreen') {
          e.preventDefault();
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:black;z-index:999999';
          document.body.appendChild(overlay);
          setTimeout(() => overlay.remove(), 100);
        }
      };
      
      const preventContextMenu = (e: Event) => {
        e.preventDefault();
        return false;
      };
      
      window.addEventListener('keyup', preventScreenshot);
      document.addEventListener('contextmenu', preventContextMenu);
      
      return () => {
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        window.removeEventListener('keyup', preventScreenshot);
        document.removeEventListener('contextmenu', preventContextMenu);
      };
    }
  }, [gallery?.screenshot_protection]);

  useEffect(() => {
    console.log('[PUBLIC_GALLERY] Component mounted, code:', code);
    loadGallery();
  }, [code]);

  const loadGallery = async (enteredPassword?: string) => {
    console.log('[PUBLIC_GALLERY] Loading gallery, password provided:', !!enteredPassword);
    try {
      const passwordParam = enteredPassword || password;
      const url = passwordParam 
        ? `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?code=${code}&password=${encodeURIComponent(passwordParam)}`
        : `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?code=${code}`;
      
      console.log('[PUBLIC_GALLERY] Fetching URL:', url);
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[PUBLIC_GALLERY] Response status:', response.status, 'Data:', data);
      
      if (response.status === 401 && data.requires_password) {
        console.log('[PUBLIC_GALLERY] Password required');
        setRequiresPassword(true);
        setPasswordError(enteredPassword ? 'Неверный пароль' : '');
        setLoading(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Галерея не найдена');
      }
      
      console.log('[PUBLIC_GALLERY] Gallery loaded successfully, photos:', data.photos?.length);
      setGallery(data);
      setRequiresPassword(false);
      setPasswordError('');
    } catch (err: any) {
      console.error('[PUBLIC_GALLERY] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[PUBLIC_GALLERY] Password submit, value:', password);
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
    setDownloadProgress({ show: true, current: 0, total: 0, status: 'preparing' });
    
    try {
      const url = password 
        ? `https://functions.poehali.dev/08b459b7-c9d2-4c3d-8778-87ffc877fb2a?code=${code}&password=${encodeURIComponent(password)}`
        : `https://functions.poehali.dev/08b459b7-c9d2-4c3d-8778-87ffc877fb2a?code=${code}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok || !data.files) {
        throw new Error(data.error || 'Ошибка получения списка файлов');
      }

      const totalFiles = data.files.length;
      setDownloadProgress({ show: true, current: 0, total: totalFiles, status: 'downloading' });

      const zip = new JSZip();

      for (let i = 0; i < data.files.length; i++) {
        const file = data.files[i];
        try {
          const fileResponse = await fetch(file.url);
          if (!fileResponse.ok) continue;
          const blob = await fileResponse.blob();
          zip.file(file.filename, blob);
          setDownloadProgress({ show: true, current: i + 1, total: totalFiles, status: 'downloading' });
        } catch (err) {
          console.error('Ошибка загрузки файла:', file.filename, err);
        }
      }

      setDownloadProgress({ show: true, current: totalFiles, total: totalFiles, status: 'completed' });
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const zipUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `${gallery?.folder_name || 'gallery'}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => {
        URL.revokeObjectURL(zipUrl);
        setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
      }, 2000);
      
    } catch (err: any) {
      console.error('Ошибка скачивания:', err);
      alert('Ошибка: ' + err.message);
      setDownloadProgress({ show: false, current: 0, total: 0, status: 'preparing' });
    } finally {
      setDownloadingAll(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!gallery || !selectedPhoto) return;
    const currentIndex = gallery.photos.findIndex(p => p.id === selectedPhoto.id);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : gallery.photos.length - 1;
    } else {
      newIndex = currentIndex < gallery.photos.length - 1 ? currentIndex + 1 : 0;
    }

    setSelectedPhoto(gallery.photos[newIndex]);
    setImageError(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      navigatePhoto('next');
    } else if (isRightSwipe) {
      navigatePhoto('prev');
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!selectedPhoto) return;
    if (e.key === 'ArrowLeft') navigatePhoto('prev');
    if (e.key === 'ArrowRight') navigatePhoto('next');
    if (e.key === 'Escape') setSelectedPhoto(null);
  };

  useEffect(() => {
    if (selectedPhoto) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedPhoto, gallery]);

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

  if (requiresPassword) {
    return (
      <PasswordForm
        password={password}
        passwordError={passwordError}
        onPasswordChange={setPassword}
        onSubmit={handlePasswordSubmit}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="AlertCircle" size={64} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Ошибка</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {downloadProgress.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#111111] rounded-lg shadow-lg p-8 max-w-md w-full mx-4 border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              {downloadProgress.status === 'preparing' && (
                <Icon name="Loader2" size={24} className="text-[#4cc9f0] animate-spin" />
              )}
              {downloadProgress.status === 'downloading' && (
                <Icon name="Download" size={24} className="text-[#4cc9f0]" />
              )}
              {downloadProgress.status === 'completed' && (
                <Icon name="CheckCircle2" size={24} className="text-green-500" />
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-white text-lg">
                  {downloadProgress.status === 'preparing' && 'Подготовка...'}
                  {downloadProgress.status === 'downloading' && 'Создание архива...'}
                  {downloadProgress.status === 'completed' && 'Готово!'}
                </h3>
                {downloadProgress.status === 'downloading' && (
                  <p className="text-sm text-gray-400 mt-1">
                    {downloadProgress.current} из {downloadProgress.total} фото
                  </p>
                )}
              </div>
            </div>

            {downloadProgress.status !== 'completed' && (
              <div className="space-y-2">
                <div className="w-full bg-[#1a1a1a] rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-[#4cc9f0] transition-all duration-300"
                    style={{ width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-sm text-gray-400 text-center">
                  {downloadProgress.status === 'preparing' && 'Получение списка файлов...'}
                  {downloadProgress.status === 'downloading' && `Загружено ${downloadProgress.current} из ${downloadProgress.total}`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {gallery && (
        <GalleryGrid
          gallery={gallery}
          downloadingAll={downloadingAll}
          onDownloadAll={downloadAll}
          onPhotoClick={(photo) => {
            setImageError(false);
            setSelectedPhoto(photo);
          }}
          onDownloadPhoto={downloadPhoto}
          formatFileSize={formatFileSize}
        />
      )}

      {selectedPhoto && gallery && (
        <PhotoViewer
          selectedPhoto={selectedPhoto}
          gallery={gallery}
          imageError={imageError}
          onClose={() => setSelectedPhoto(null)}
          onNavigate={navigatePhoto}
          onDownloadPhoto={downloadPhoto}
          onImageError={() => setImageError(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      )}
    </>
  );
}