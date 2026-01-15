import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import PasswordForm from './gallery/PasswordForm';
import GalleryGrid from './gallery/GalleryGrid';
import PhotoViewer from './gallery/PhotoViewer';
import LoadingIndicators from './gallery/LoadingIndicators';
import FavoritesModal from '@/components/gallery/FavoritesModal';
import ClientLoginModal from '@/components/gallery/ClientLoginModal';
import MyFavoritesModal from '@/components/gallery/MyFavoritesModal';
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
  
  const [clientData, setClientData] = useState<{ client_id: number; full_name: string; phone: string; email?: string } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMyFavoritesOpen, setIsMyFavoritesOpen] = useState(false);
  const [clientFavoritePhotoIds, setClientFavoritePhotoIds] = useState<number[]>([]);
  const [viewingFavorites, setViewingFavorites] = useState(false);

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

  const loadClientFavorites = async (clientId: number) => {
    try {
      const response = await fetch(
        `https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723?client_id=${clientId}`
      );
      const result = await response.json();
      
      if (response.ok && result.photos) {
        const photoIds = result.photos.map((p: { photo_id: number }) => p.photo_id);
        setClientFavoritePhotoIds(photoIds);
        console.log('[FAVORITES] Loaded client favorites:', photoIds);
      }
    } catch (error) {
      console.error('[FAVORITES] Error loading client favorites:', error);
    }
  };

  const handleAddToFavorites = async (photo: Photo) => {
    if (!favoriteFolder) {
      alert('Фотограф ещё не настроил папку избранного');
      return;
    }
    
    if (clientData && clientData.client_id > 0) {
      const galleryCode = code;
      console.log('[FAVORITES] Adding photo for logged-in client:', {
        gallery_code: galleryCode,
        full_name: clientData.full_name,
        phone: clientData.phone,
        photo_id: photo.id
      });
      
      try {
        const response = await fetch('https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_to_favorites',
            gallery_code: galleryCode,
            full_name: clientData.full_name,
            phone: clientData.phone,
            email: clientData.email || null,
            photo_id: photo.id
          })
        });
        
        const result = await response.json();
        console.log('[FAVORITES] Add response:', result);
        
        if (!response.ok) {
          throw new Error(result.error || 'Ошибка при добавлении в избранное');
        }
        
        setClientFavoritePhotoIds(prev => [...prev, photo.id]);
      } catch (error) {
        console.error('[FAVORITES] Error adding photo:', error);
        alert(error instanceof Error ? error.message : 'Ошибка при добавлении в избранное');
      }
    } else {
      setPhotoToAdd(photo);
      setIsFavoritesModalOpen(true);
    }
  };

  const handleSubmitToFavorites = async (data: { fullName: string; phone: string; email?: string; client_id?: number }) => {
    console.log('[FAVORITES] Photo added to favorites:', data);
    
    const newClientData = {
      client_id: data.client_id || 0,
      full_name: data.fullName,
      phone: data.phone,
      email: data.email
    };
    
    setClientData(newClientData);
    
    if (photoToAdd) {
      setClientFavoritePhotoIds(prev => [...prev, photoToAdd.id]);
    }
    
    if (data.client_id) {
      await loadClientFavorites(data.client_id);
    }
    
    setPhotoToAdd(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' Б';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
    return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    if (!gallery || !selectedPhoto) return;
    
    const photosToUse = viewingFavorites
      ? gallery.photos.filter(p => clientFavoritePhotoIds.includes(p.id))
      : gallery.photos;
    
    const currentIndex = photosToUse.findIndex(p => p.id === selectedPhoto.id);
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : photosToUse.length - 1;
    } else {
      newIndex = currentIndex < photosToUse.length - 1 ? currentIndex + 1 : 0;
    }

    setSelectedPhoto(photosToUse[newIndex]);
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
          gallery={{
            ...gallery,
            photos: (clientData && clientData.client_id > 0)
              ? gallery.photos.filter(p => !clientFavoritePhotoIds.includes(p.id))
              : gallery.photos
          }}
          downloadingAll={downloadingAll}
          onDownloadAll={downloadAll}
          onPhotoClick={(photo) => {
            setImageError(false);
            setViewingFavorites(false);
            setSelectedPhoto(photo);
          }}
          onDownloadPhoto={downloadPhoto}
          onAddToFavorites={handleAddToFavorites}
          onOpenFavoriteFolders={() => {}}
          formatFileSize={formatFileSize}
          onPhotoLoad={() => setPhotosLoaded(prev => prev + 1)}
          clientName={clientData?.full_name}
          onClientLogin={() => setIsLoginModalOpen(true)}
          onOpenMyFavorites={() => setIsMyFavoritesOpen(true)}
        />
      )}

      {selectedPhoto && gallery && (
        <PhotoViewer
          selectedPhoto={selectedPhoto}
          gallery={gallery}
          imageError={imageError}
          onClose={() => {
            setSelectedPhoto(null);
            setViewingFavorites(false);
          }}
          onNavigate={navigatePhoto}
          onDownloadPhoto={downloadPhoto}
          onAddToFavorites={handleAddToFavorites}
          onImageError={() => setImageError(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      )}

      {favoriteFolder && photoToAdd && (
        <FavoritesModal
          isOpen={isFavoritesModalOpen}
          onClose={() => {
            setIsFavoritesModalOpen(false);
            setPhotoToAdd(null);
          }}
          folder={favoriteFolder}
          onSubmit={handleSubmitToFavorites}
          galleryCode={code || ''}
          photoId={photoToAdd.id}
        />
      )}

      <ClientLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={(data) => {
          setClientData(data);
          loadClientFavorites(data.client_id);
          console.log('[CLIENT_LOGIN] Logged in:', data);
        }}
        galleryCode={code || ''}
      />

      {clientData && gallery && (
        <MyFavoritesModal
          isOpen={isMyFavoritesOpen}
          onClose={() => setIsMyFavoritesOpen(false)}
          clientId={clientData.client_id}
          clientName={clientData.full_name}
          galleryPhotos={gallery.photos}
          onPhotoClick={(photo) => {
            setIsMyFavoritesOpen(false);
            setViewingFavorites(true);
            setSelectedPhoto(photo);
            setImageError(false);
          }}
          onPhotoRemoved={(photoId) => {
            setClientFavoritePhotoIds(prev => prev.filter(id => id !== photoId));
          }}
        />
      )}
    </>
  );
}