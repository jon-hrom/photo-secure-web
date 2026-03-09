import React from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import GalleryGrid from './GalleryGrid';
import GalleryModals from './GalleryModals';
import { type GallerySubfolder } from './GalleryGrid';

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
  fields: { fullName: boolean; phone: boolean; email: boolean };
  photoCount: number;
  photos: Photo[];
}

interface GalleryData {
  folder_name: string;
  photos: Photo[];
  total_size: number;
  watermark?: { enabled: boolean; text?: string; position?: string; opacity?: number; font_size?: number };
  screenshot_protection?: boolean;
  download_disabled?: boolean;
  favorite_config?: FavoriteFolder | null;
  photographer_id?: number;
  photographer_timezone?: string;
  subfolders?: GallerySubfolder[];
}

interface ClientData {
  client_id: number;
  full_name: string;
  phone: string;
  email?: string;
  upload_enabled?: boolean;
}

interface GalleryState {
  selectedPhoto: Photo | null;
  setSelectedPhoto: (value: Photo | null) => void;
  clientData: ClientData | null;
  clientFavoritePhotoIds: number[];
  viewingFavorites: boolean;
  setViewingFavorites: (value: boolean) => void;
  isFavoritesModalOpen: boolean;
  setIsFavoritesModalOpen: (value: boolean) => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (value: boolean) => void;
  isMyFavoritesOpen: boolean;
  setIsMyFavoritesOpen: (value: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (value: boolean) => void;
  isWelcomeModalOpen: boolean;
  setIsWelcomeModalOpen: (value: boolean) => void;
  favoriteFolder: FavoriteFolder | null;
  photoToAdd: Photo | null;
  setPhotoToAdd: (value: Photo | null) => void;
  unreadCount: number;
  setUnreadCount: (value: number) => void;
  code?: string;
}

interface GalleryHandlers {
  handleAddToFavorites: (photo: Photo) => void;
  handleRegisterToDownload: (photo: Photo) => void;
  handleFavoriteSubmit: (data: { fullName: string; phone: string; email?: string; client_id?: number }) => void;
  handleClientLogin: (clientData: ClientData) => void;
  handleRemoveFromFavorites: (photoId: number) => void;
  loadClientFavorites: (clientId: number) => void;
}

interface SubfolderPasswordViewProps {
  viewingSubfolder: GallerySubfolder;
  subfolderPassword: string;
  subfolderPasswordError: string;
  subfolderLoading: boolean;
  isDarkTheme: boolean;
  galleryTextColor: string;
  galleryBgStyles: React.CSSProperties;
  onPasswordChange: (value: string) => void;
  onPasswordSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
}

export const SubfolderPasswordView = ({
  viewingSubfolder,
  subfolderPassword,
  subfolderPasswordError,
  subfolderLoading,
  isDarkTheme,
  galleryTextColor,
  galleryBgStyles,
  onPasswordChange,
  onPasswordSubmit,
  onBack,
}: SubfolderPasswordViewProps) => {
  const secondaryColor = isDarkTheme ? 'rgba(255,255,255,0.6)' : '#6b7280';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={galleryBgStyles}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: isDarkTheme ? 'rgba(255,255,255,0.08)' : 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
        <button onClick={onBack} className="flex items-center gap-1 text-sm mb-2" style={{ color: secondaryColor }}>
          <Icon name="ArrowLeft" size={16} />Назад
        </button>
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: isDarkTheme ? 'rgba(99,102,241,0.2)' : '#eef2ff' }}>
            <Icon name="FolderLock" size={28} style={{ color: isDarkTheme ? '#a5b4fc' : '#6366f1' }} />
          </div>
          <h3 className="font-semibold text-lg" style={{ color: galleryTextColor }}>{viewingSubfolder.folder_name}</h3>
          <p className="text-sm mt-1" style={{ color: secondaryColor }}>Введите пароль для доступа</p>
        </div>
        <form onSubmit={onPasswordSubmit} className="space-y-3">
          <Input
            type="password"
            value={subfolderPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Пароль"
            autoFocus
          />
          {subfolderPasswordError && (
            <p className="text-sm text-red-500">{subfolderPasswordError}</p>
          )}
          <Button type="submit" className="w-full" disabled={subfolderLoading}>
            {subfolderLoading ? <Icon name="Loader2" size={16} className="animate-spin mr-2" /> : null}
            Открыть
          </Button>
        </form>
      </div>
    </div>
  );
};

interface SubfolderPhotosViewProps {
  subfolderPhotos: Photo[];
  subfolderFolderName: string;
  isDarkTheme: boolean;
  galleryTextColor: string;
  galleryBgStyles: React.CSSProperties;
  gallery: GalleryData;
  state: GalleryState;
  handlers: GalleryHandlers;
  downloadPhoto: (photo: Photo) => void;
  formatFileSize: (bytes: number) => string;
  onBack: () => void;
}

export const SubfolderPhotosView = ({
  subfolderPhotos,
  subfolderFolderName,
  isDarkTheme,
  galleryTextColor,
  galleryBgStyles,
  gallery,
  state,
  handlers,
  downloadPhoto,
  formatFileSize,
  onBack,
}: SubfolderPhotosViewProps) => {
  const sfSecondaryText = isDarkTheme ? 'rgba(255,255,255,0.6)' : '#6b7280';

  return (
    <div className="min-h-screen" style={galleryBgStyles}>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ background: isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
            <Icon name="ArrowLeft" size={18} style={{ color: galleryTextColor }} />
          </button>
          <div>
            <h2 className="font-semibold" style={{ color: galleryTextColor }}>{subfolderFolderName}</h2>
            <p className="text-xs" style={{ color: sfSecondaryText }}>{subfolderPhotos.length} фото</p>
          </div>
        </div>
        <GalleryGrid
          gallery={{ ...gallery, photos: subfolderPhotos, subfolders: [] }}
          downloadingAll={false}
          onDownloadAll={() => {}}
          onPhotoClick={state.setSelectedPhoto}
          onDownloadPhoto={downloadPhoto}
          onAddToFavorites={handlers.handleAddToFavorites}
          onOpenFavoriteFolders={() => state.setIsFavoritesModalOpen(true)}
          formatFileSize={formatFileSize}
          onPhotoLoad={() => {}}
          onRegisterToDownload={handlers.handleRegisterToDownload}
        />
      </div>
      <GalleryModals
        selectedPhoto={state.selectedPhoto}
        gallery={gallery}
        clientData={state.clientData}
        clientFavoritePhotoIds={state.clientFavoritePhotoIds}
        viewingFavorites={state.viewingFavorites}
        isFavoritesModalOpen={state.isFavoritesModalOpen}
        isLoginModalOpen={state.isLoginModalOpen}
        isMyFavoritesOpen={state.isMyFavoritesOpen}
        isChatOpen={state.isChatOpen}
        isWelcomeModalOpen={false}
        favoriteFolder={state.favoriteFolder}
        photoToAdd={state.photoToAdd}
        unreadCount={state.unreadCount}
        code={state.code}
        setSelectedPhoto={state.setSelectedPhoto}
        setViewingFavorites={state.setViewingFavorites}
        setIsFavoritesModalOpen={state.setIsFavoritesModalOpen}
        setIsLoginModalOpen={state.setIsLoginModalOpen}
        setIsMyFavoritesOpen={state.setIsMyFavoritesOpen}
        setIsChatOpen={state.setIsChatOpen}
        setIsWelcomeModalOpen={state.setIsWelcomeModalOpen}
        setUnreadCount={state.setUnreadCount}
        setPhotoToAdd={state.setPhotoToAdd}
        onFavoriteSubmit={handlers.handleFavoriteSubmit}
        onClientLogin={handlers.handleClientLogin}
        onRemoveFromFavorites={handlers.handleRemoveFromFavorites}
        onDownloadPhoto={downloadPhoto}
        loadClientFavorites={handlers.loadClientFavorites}
        isDarkTheme={isDarkTheme}
      />
    </div>
  );
};
