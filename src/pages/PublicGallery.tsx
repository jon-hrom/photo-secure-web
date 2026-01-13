import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import PasswordForm from './gallery/PasswordForm';
import GalleryGrid from './gallery/GalleryGrid';
import PhotoViewer from './gallery/PhotoViewer';
import LoadingIndicators from './gallery/LoadingIndicators';
import FavoritesModal from '@/components/gallery/FavoritesModal';
import FavoriteFoldersModal from '@/components/gallery/FavoriteFoldersModal';
import FolderPhotosModal from '@/components/gallery/FolderPhotosModal';
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
  
  const [favoriteFolders, setFavoriteFolders] = useState<FavoriteFolder[]>([]);
  const [isFavoritesModalOpen, setIsFavoritesModalOpen] = useState(false);
  const [isFoldersModalOpen, setIsFoldersModalOpen] = useState(false);
  const [isFolderPhotosModalOpen, setIsFolderPhotosModalOpen] = useState(false);
  const [selectedFolderForAdd, setSelectedFolderForAdd] = useState<FavoriteFolder | null>(null);
  const [selectedFolderForView, setSelectedFolderForView] = useState<FavoriteFolder | null>(null);
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
    const saved = localStorage.getItem(`favorites_${code}`);
    if (saved) {
      setFavoriteFolders(JSON.parse(saved));
    }
  }, [code]);

  const saveFolders = (folders: FavoriteFolder[]) => {
    setFavoriteFolders(folders);
    localStorage.setItem(`favorites_${code}`, JSON.stringify(folders));
  };

  const handleAddToFavorites = (photo: Photo) => {
    if (favoriteFolders.length === 0) {
      alert('Сначала создайте папку избранного');
      setIsFoldersModalOpen(true);
      return;
    }
    
    if (favoriteFolders.length === 1) {
      setSelectedFolderForAdd(favoriteFolders[0]);
      setPhotoToAdd(photo);
      setIsFavoritesModalOpen(true);
    } else {
      setPhotoToAdd(photo);
      setIsFoldersModalOpen(true);
    }
  };

  const handleCreateFolder = (name: string, fields: { fullName: boolean; phone: boolean; email: boolean }) => {
    const newFolder: FavoriteFolder = {
      id: Date.now().toString(),
      name,
      fields,
      photoCount: 0,
      photos: []
    };
    saveFolders([...favoriteFolders, newFolder]);
  };

  const handleDeleteFolder = (id: string) => {
    saveFolders(favoriteFolders.filter(f => f.id !== id));
  };

  const handleOpenFolder = (folder: FavoriteFolder) => {
    if (photoToAdd) {
      setSelectedFolderForAdd(folder);
      setIsFoldersModalOpen(false);
      setIsFavoritesModalOpen(true);
    } else {
      setSelectedFolderForView(folder);
      setIsFoldersModalOpen(false);
      setIsFolderPhotosModalOpen(true);
    }
  };

  const handleSubmitToFavorites = (data: { fullName: string; phone: string; email?: string }) => {
    if (!selectedFolderForAdd || !photoToAdd) return;

    const updatedFolders = favoriteFolders.map(folder => {
      if (folder.id === selectedFolderForAdd.id) {
        const photoExists = folder.photos.some(p => p.id === photoToAdd.id);
        if (!photoExists) {
          return {
            ...folder,
            photos: [...folder.photos, photoToAdd],
            photoCount: folder.photoCount + 1
          };
        }
      }
      return folder;
    });

    saveFolders(updatedFolders);
    setPhotoToAdd(null);
    setSelectedFolderForAdd(null);
  };

  const handleRemovePhoto = (photoId: number) => {
    if (!selectedFolderForView) return;

    const updatedFolders = favoriteFolders.map(folder => {
      if (folder.id === selectedFolderForView.id) {
        return {
          ...folder,
          photos: folder.photos.filter(p => p.id !== photoId),
          photoCount: folder.photoCount - 1
        };
      }
      return folder;
    });

    saveFolders(updatedFolders);
    setSelectedFolderForView(updatedFolders.find(f => f.id === selectedFolderForView.id) || null);
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
          onOpenFavoriteFolders={() => {
            setPhotoToAdd(null);
            setIsFoldersModalOpen(true);
          }}
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

      {selectedFolderForAdd && (
        <FavoritesModal
          isOpen={isFavoritesModalOpen}
          onClose={() => {
            setIsFavoritesModalOpen(false);
            setSelectedFolderForAdd(null);
            setPhotoToAdd(null);
          }}
          folder={selectedFolderForAdd}
          onSubmit={handleSubmitToFavorites}
        />
      )}

      <FavoriteFoldersModal
        isOpen={isFoldersModalOpen}
        onClose={() => {
          setIsFoldersModalOpen(false);
          setPhotoToAdd(null);
        }}
        folders={favoriteFolders}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onOpenFolder={handleOpenFolder}
      />

      {selectedFolderForView && (
        <FolderPhotosModal
          isOpen={isFolderPhotosModalOpen}
          onClose={() => {
            setIsFolderPhotosModalOpen(false);
            setSelectedFolderForView(null);
          }}
          folderName={selectedFolderForView.name}
          photos={selectedFolderForView.photos}
          onRemovePhoto={handleRemovePhoto}
          onViewPhoto={(photo) => {
            setSelectedPhoto(photo);
            setIsFolderPhotosModalOpen(false);
          }}
        />
      )}
    </>
  );
}