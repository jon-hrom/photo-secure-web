import GalleryPhotoViewer from '@/components/gallery/GalleryPhotoViewer';
import FavoritesModal from '@/components/gallery/FavoritesModal';
import ClientLoginModal from '@/components/gallery/ClientLoginModal';
import MyFavoritesModal from '@/components/gallery/MyFavoritesModal';
import ChatModal from '@/components/gallery/ChatModal';
import WelcomeModal from '@/components/gallery/WelcomeModal';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
  is_video?: boolean;
  content_type?: string;
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
  favorite_config?: FavoriteFolder | null;
  photographer_id?: number;
}

interface GalleryModalsProps {
  selectedPhoto: Photo | null;
  gallery: GalleryData | null;
  clientData: { client_id: number; full_name: string; phone: string; email?: string } | null;
  clientFavoritePhotoIds: number[];
  viewingFavorites: boolean;
  isFavoritesModalOpen: boolean;
  isLoginModalOpen: boolean;
  isMyFavoritesOpen: boolean;
  isChatOpen: boolean;
  isWelcomeModalOpen: boolean;
  favoriteFolder: FavoriteFolder | null;
  photoToAdd: Photo | null;
  unreadCount: number;
  code?: string;
  setSelectedPhoto: (photo: Photo | null) => void;
  setViewingFavorites: (viewing: boolean) => void;
  setIsFavoritesModalOpen: (open: boolean) => void;
  setIsLoginModalOpen: (open: boolean) => void;
  setIsMyFavoritesOpen: (open: boolean) => void;
  setIsChatOpen: (open: boolean) => void;
  setIsWelcomeModalOpen: (open: boolean) => void;
  setUnreadCount: (count: number) => void;
  setPhotoToAdd: (photo: Photo | null) => void;
  onFavoriteSubmit: (data: { fullName: string; phone: string; email?: string; client_id?: number }) => void;
  onClientLogin: (clientData: { client_id: number; full_name: string; phone: string; email?: string }) => void;
  onRemoveFromFavorites: (photoId: number) => void;
  onDownloadPhoto: (photo: Photo) => void;
  loadClientFavorites: (clientId: number) => void;
}

export default function GalleryModals({
  selectedPhoto,
  gallery,
  clientData,
  clientFavoritePhotoIds,
  viewingFavorites,
  isFavoritesModalOpen,
  isLoginModalOpen,
  isMyFavoritesOpen,
  isChatOpen,
  isWelcomeModalOpen,
  favoriteFolder,
  photoToAdd,
  unreadCount,
  code,
  setSelectedPhoto,
  setViewingFavorites,
  setIsFavoritesModalOpen,
  setIsLoginModalOpen,
  setIsMyFavoritesOpen,
  setIsChatOpen,
  setIsWelcomeModalOpen,
  setUnreadCount,
  setPhotoToAdd,
  onFavoriteSubmit,
  onClientLogin,
  onRemoveFromFavorites,
  onDownloadPhoto,
  loadClientFavorites
}: GalleryModalsProps) {
  const visiblePhotos = (clientData && clientData.client_id > 0 && gallery)
    ? gallery.photos.filter((p: Photo) => !clientFavoritePhotoIds.includes(p.id))
    : gallery?.photos || [];

  return (
    <>
      {selectedPhoto && (
        <GalleryPhotoViewer
          photos={viewingFavorites ? gallery.photos.filter((p: Photo) => clientFavoritePhotoIds.includes(p.id)) : visiblePhotos}
          initialPhotoId={selectedPhoto.id}
          onClose={() => {
            setSelectedPhoto(null);
            setViewingFavorites(false);
          }}
          downloadDisabled={gallery?.download_disabled}
          screenshotProtection={gallery?.screenshot_protection}
          watermark={gallery?.watermark}
          onDownload={onDownloadPhoto}
        />
      )}

      {isFavoritesModalOpen && favoriteFolder && photoToAdd && code && (
        <FavoritesModal
          isOpen={isFavoritesModalOpen}
          onClose={() => {
            setIsFavoritesModalOpen(false);
            setPhotoToAdd(null);
          }}
          folder={favoriteFolder}
          onSubmit={onFavoriteSubmit}
          galleryCode={code}
          photoId={photoToAdd.id}
        />
      )}

      {isLoginModalOpen && code && (
        <ClientLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={onClientLogin}
          galleryCode={code}
          favoriteConfig={gallery?.favorite_config}
        />
      )}

      {isMyFavoritesOpen && clientData && (
        <MyFavoritesModal
          isOpen={isMyFavoritesOpen}
          onClose={() => setIsMyFavoritesOpen(false)}
          clientId={clientData.client_id}
          clientName={clientData.full_name || clientData.phone}
          galleryPhotos={gallery?.photos || []}
          onPhotoClick={(photo) => {
            setSelectedPhoto(photo);
            setViewingFavorites(true);
            setIsMyFavoritesOpen(false);
          }}
          onPhotoRemoved={onRemoveFromFavorites}
          downloadDisabled={gallery?.download_disabled}
        />
      )}

      {isChatOpen && clientData && gallery && (
        <ChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          photographerId={gallery.photographer_id}
          clientId={clientData.client_id}
          clientName={clientData.full_name || clientData.phone}
          senderType="client"
        />
      )}

      {isWelcomeModalOpen && (
        <WelcomeModal
          isOpen={isWelcomeModalOpen}
          onClose={() => {
            setIsWelcomeModalOpen(false);
            if (code) {
              localStorage.setItem(`welcome_shown_${code}`, 'true');
            }
          }}
        />
      )}
    </>
  );
}