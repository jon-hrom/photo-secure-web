import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import PasswordForm from './gallery/PasswordForm';
import GalleryGrid from './gallery/GalleryGrid';
import PhotoViewer from './gallery/PhotoViewer';
import LoadingIndicators from './gallery/LoadingIndicators';
import FavoritesModal from '@/components/gallery/FavoritesModal';
import { useGalleryProtection } from './gallery/hooks/useGalleryProtection';
import { useGalleryLoader } from './gallery/hooks/useGalleryLoader';
import { usePhotoDownloader } from './gallery/hooks/usePhotoDownloader';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
}

interface FavoriteFolder {
  id: string;
  name: string;
  fields: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
  photoCount: number;
  photos: Photo[];
}

export default function PublicGallery() {
  const { code } = useParams<{ code: string }>();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [imageError, setImageError] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  const [favoriteFolder, setFavoriteFolder] = useState<FavoriteFolder | null>(null);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [photoToAdd, setPhotoToAdd] = useState<Photo | null>(null);

  const {
    gallery,
    loading,
    error,
    requiresPassword,
    password,
    passwordError,
    loadingProgress,
    photosLoaded,
    setPassword,
    setPhotosLoaded,
    handlePasswordSubmit
  } = useGalleryLoader(code);

  useGalleryProtection(gallery?.screenshot_protection);

  const {
    downloadingAll,
    downloadProgress,
    downloadPhoto,
    downloadAll,
    cancelDownload
  } = usePhotoDownloader(code, password, gallery?.folder_name);

  useEffect(() => {
    // Читаем настройки избранного из данных галереи (приходят с сервера)
    if (gallery?.favorite_config) {
      console.log('[FAVORITES] Loaded favorite config from server:', gallery.favorite_config);
      setFavoriteFolder(gallery.favorite_config);
    }
  }, [gallery]);

  const handleAddToFavorites = (photo: Photo) => {
    if (!favoriteFolder) {
      alert('Фотограф ещё не настроил папку избранного');
      return;
    }
    setPhotoToAdd(photo);
    setIsFavoritesModalOpen(true);
  };

  const handleSubmitToFavorites = (data: { fullName: string; phone: string; email?: string }) => {
    if (!photoToAdd || !favoriteFolder) return;

    const favorites = JSON.parse(localStorage.getItem(`favorites_${code}`) || '[]');
    favorites.push({
      photo: photoToAdd,
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      timestamp: Date.now()
    });
    localStorage.setItem(`favorites_${code}`, JSON.stringify(favorites));
    
    alert('Фото добавлено в избранное!');
    setPhotoToAdd(null);
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
      <LoadingIndicators
        loadingProgress={loadingProgress}
        photosLoaded={photosLoaded}
        totalPhotos={gallery?.photos.length || 0}
        downloadProgress={downloadProgress}
        onCancelDownload={cancelDownload}
      />

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
          onAddToFavorites={handleAddToFavorites}
          onOpenFavoriteFolders={() => {}}
          formatFileSize={formatFileSize}
          onPhotoLoad={() => setPhotosLoaded(prev => prev + 1)}
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
          onAddToFavorites={handleAddToFavorites}
          onImageError={() => setImageError(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {favoriteFolder && (
        <FavoritesModal
          isOpen={isFavoritesModalOpen}
          onClose={() => {
            setIsFavoritesModalOpen(false);
            setPhotoToAdd(null);
          }}
          folder={favoriteFolder}
          onSubmit={handleSubmitToFavorites}
        />
      )}
    </>
  );
}