import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import PasswordForm from './gallery/PasswordForm';
import GalleryGrid from './gallery/GalleryGrid';
import PhotoGridViewer from '@/components/photobank/PhotoGridViewer';
import LoadingIndicators from './gallery/LoadingIndicators';
import FavoritesModal from '@/components/gallery/FavoritesModal';
import ClientLoginModal from '@/components/gallery/ClientLoginModal';
import MyFavoritesModal from '@/components/gallery/MyFavoritesModal';
import ChatModal from '@/components/gallery/ChatModal';
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
  s3_key?: string;
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
  
  const [favoriteFolder, setFavoriteFolder] = useState<FavoriteFolder | null>(null);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [photoToAdd, setPhotoToAdd] = useState<Photo | null>(null);
  
  const [clientData, setClientData] = useState<{ client_id: number; full_name: string; phone: string; email?: string } | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isMyFavoritesOpen, setIsMyFavoritesOpen] = useState(false);
  const [clientFavoritePhotoIds, setClientFavoritePhotoIds] = useState<number[]>([]);
  const [viewingFavorites, setViewingFavorites] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showProgress, setShowProgress] = useState(true);

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

  // Вычисляем видимые фото (без избранного если клиент залогинен)
  const visiblePhotos = (clientData && clientData.client_id > 0 && gallery)
    ? gallery.photos.filter(p => !clientFavoritePhotoIds.includes(p.id))
    : gallery?.photos || [];

  // Рассчитываем прогресс по видимым фото
  const actualProgress = visiblePhotos.length > 0
    ? Math.min((photosLoaded / visiblePhotos.length) * 100, 100)
    : loadingProgress;

  // Скрываем прогресс-бар когда все видимые фото загружены
  useEffect(() => {
    if (visiblePhotos.length > 0 && photosLoaded >= visiblePhotos.length) {
      setTimeout(() => setShowProgress(false), 500);
    } else if (visiblePhotos.length > 0 && photosLoaded < visiblePhotos.length) {
      setShowProgress(true);
    }
  }, [photosLoaded, visiblePhotos.length]);

  useEffect(() => {
    // Читаем настройки избранного из данных галереи (приходят с сервера)
    if (gallery?.favorite_config) {
      console.log('[FAVORITES] Loaded favorite config from server:', gallery.favorite_config);
      setFavoriteFolder(gallery.favorite_config);
    }
    
    // Автоматический вход клиента из localStorage
    if (gallery && !clientData) {
      const savedClientData = localStorage.getItem(`client_${gallery.photographer_id}_${code}`);
      if (savedClientData) {
        try {
          const parsed = JSON.parse(savedClientData);
          console.log('[CLIENT_LOGIN] Auto-login from localStorage:', parsed);
          setClientData(parsed);
          if (parsed.client_id) {
            loadClientFavorites(parsed.client_id);
          }
        } catch (error) {
          console.error('[CLIENT_LOGIN] Error parsing saved client data:', error);
        }
      }
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

  const loadUnreadCount = async () => {
    if (!clientData || !gallery) return;
    
    try {
      const response = await fetch(
        `https://functions.poehali.dev/ac9cc03a-3a9c-4359-acca-5cf58252f6d1?photographer_id=${gallery.photographer_id}&client_id=${clientData.client_id}`
      );
      const data = await response.json();
      
      if (response.ok) {
        setUnreadCount(data.unread_count || 0);
      }
    } catch (error) {
      console.error('[CHAT] Error loading unread count:', error);
    }
  };

  useEffect(() => {
    if (clientData && gallery) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 5000);
      return () => clearInterval(interval);
    }
  }, [clientData, gallery]);

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
    
    // Сохраняем в localStorage для автоматического входа
    if (gallery && data.client_id) {
      localStorage.setItem(`client_${gallery.photographer_id}_${code}`, JSON.stringify(newClientData));
      console.log('[CLIENT_LOGIN] Saved client data to localStorage');
    }
    
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
        loadingProgress={showProgress ? actualProgress : 0}
        photosLoaded={photosLoaded}
        totalPhotos={gallery?.photos.length || 0}
        visiblePhotos={visiblePhotos.length}
        downloadProgress={downloadProgress}
        onCancelDownload={cancelDownload}
      />

      {gallery && (
        <GalleryGrid
          gallery={{
            ...gallery,
            photos: visiblePhotos
          }}
          downloadingAll={downloadingAll}
          onDownloadAll={downloadAll}
          onPhotoClick={(photo) => {
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
          onOpenChat={() => setIsChatOpen(true)}
          unreadMessagesCount={unreadCount}
        />
      )}

      {selectedPhoto && gallery && (
        <PhotoGridViewer
          viewPhoto={selectedPhoto ? {
            id: selectedPhoto.id,
            file_name: selectedPhoto.file_name,
            s3_url: selectedPhoto.photo_url,
            s3_key: selectedPhoto.s3_key || selectedPhoto.photo_url.split('/bucket/')[1] || selectedPhoto.photo_url.split('/').slice(-3).join('/'),
            thumbnail_s3_url: selectedPhoto.thumbnail_url,
            is_raw: false,
            file_size: selectedPhoto.file_size,
            width: selectedPhoto.width || null,
            height: selectedPhoto.height || null,
            created_at: new Date().toISOString()
          } : null}
          photos={(viewingFavorites ? gallery.photos.filter(p => clientFavoritePhotoIds.includes(p.id)) : gallery.photos).map(p => {
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
          })}
          onClose={() => {
            setSelectedPhoto(null);
            setViewingFavorites(false);
          }}
          onNavigate={navigatePhoto}
          onDownload={async (s3Key, fileName) => {
            const photo = gallery.photos.find(p => (p.s3_key || p.photo_url.includes(s3Key)));
            if (photo) {
              await downloadPhoto(photo);
            }
          }}
          formatBytes={formatFileSize}
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
          
          // Сохраняем в localStorage для автоматического входа
          if (gallery) {
            localStorage.setItem(`client_${gallery.photographer_id}_${code}`, JSON.stringify(data));
            console.log('[CLIENT_LOGIN] Saved to localStorage');
          }
          
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
          }}
          onPhotoRemoved={(photoId) => {
            setClientFavoritePhotoIds(prev => prev.filter(id => id !== photoId));
          }}
        />
      )}

      {clientData && gallery && (
        <ChatModal
          isOpen={isChatOpen}
          onClose={() => {
            setIsChatOpen(false);
            loadUnreadCount();
          }}
          clientId={clientData.client_id}
          photographerId={gallery.photographer_id || 0}
          senderType="client"
        />
      )}
    </>
  );
}