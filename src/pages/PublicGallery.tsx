import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PasswordForm from './gallery/PasswordForm';
import GalleryGrid, { type GallerySubfolder } from './gallery/GalleryGrid';
import LoadingIndicators from './gallery/LoadingIndicators';
import GalleryModals from './gallery/GalleryModals';
import ClientUploadModal from '@/components/gallery/ClientUploadModal';
import ClientFolderPage from '@/components/gallery/ClientFolderPage';
import { useGalleryProtection } from './gallery/hooks/useGalleryProtection';
import { useGalleryLoader } from './gallery/hooks/useGalleryLoader';
import { usePhotoDownloader } from './gallery/hooks/usePhotoDownloader';
import { useGalleryState } from './gallery/hooks/useGalleryState';
import { useGalleryHandlers } from './gallery/hooks/useGalleryHandlers';

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

export default function PublicGallery() {
  const { code } = useParams<{ code: string }>();
  
  const state = useGalleryState();
  
  const {
    gallery,
    loading,
    error,
    requiresPassword,
    password,
    passwordError,
    loadingProgress,
    photosLoaded,
    isBlocked,
    photographerEmail,
    setPassword,
    setPhotosLoaded,
    handlePasswordSubmit,
    reloadClientFolders
  } = useGalleryLoader(code, state.clientData?.client_id || undefined);

  useGalleryProtection(gallery?.screenshot_protection);

  const {
    downloadingAll,
    downloadProgress,
    downloadPhoto,
    downloadAll,
    cancelDownload
  } = usePhotoDownloader(code, password, gallery?.folder_name);

  const handlers = useGalleryHandlers({
    code,
    gallery,
    clientData: state.clientData,
    favoriteFolder: state.favoriteFolder,
    isChatOpen: state.isChatOpen,
    setClientData: state.setClientData,
    setFavoriteFolder: state.setFavoriteFolder,
    setClientFavoritePhotoIds: state.setClientFavoritePhotoIds,
    setUnreadCount: state.setUnreadCount,
    setPhotoToAdd: state.setPhotoToAdd,
    setIsFavoritesModalOpen: state.setIsFavoritesModalOpen,
    previousUnreadCount: state.previousUnreadCount
  });

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [folderToOpen, setFolderToOpen] = useState<{ id: number; folder_name: string } | null>(null);
  const [viewingClientFolder, setViewingClientFolder] = useState<{ id: number; folder_name: string } | null>(null);
  const [viewingSubfolder, setViewingSubfolder] = useState<GallerySubfolder | null>(null);
  const [subfolderPhotos, setSubfolderPhotos] = useState<Photo[]>([]);
  const [subfolderLoading, setSubfolderLoading] = useState(false);
  const [subfolderPasswordRequired, setSubfolderPasswordRequired] = useState(false);
  const [subfolderPassword, setSubfolderPassword] = useState('');
  const [subfolderPasswordError, setSubfolderPasswordError] = useState('');
  const [subfolderFolderName, setSubfolderFolderName] = useState('');
  const [clientUploadFolders, setClientUploadFolders] = useState<Array<{
    id: number;
    folder_name: string;
    client_name: string | null;
    photo_count: number;
    created_at: string | null;
    is_own?: boolean;
  }>>(gallery?.client_upload_folders || []);

  useEffect(() => {
    if (gallery?.client_upload_folders && state.clientData?.client_id) {
      setClientUploadFolders(gallery.client_upload_folders);
    }
  }, [gallery?.client_upload_folders]);

  useEffect(() => {
    if (state.clientData?.client_id) {
      reloadClientFolders(state.clientData.client_id);
    } else {
      setClientUploadFolders([]);
    }
  }, [state.clientData?.client_id]);

  const visiblePhotos = (state.clientData && state.clientData.client_id > 0 && gallery)
    ? gallery.photos.filter((p: Photo) => !state.clientFavoritePhotoIds.includes(p.id))
    : gallery?.photos || [];

  const actualProgress = visiblePhotos.length > 0
    ? Math.min((photosLoaded / visiblePhotos.length) * 100, 100)
    : loadingProgress;

  useEffect(() => {
    if (visiblePhotos.length > 0 && photosLoaded >= visiblePhotos.length) {
      setTimeout(() => state.setShowProgress(false), 500);
      
      if (!state.clientData && code) {
        const welcomeShown = localStorage.getItem(`welcome_shown_${code}`);
        if (!welcomeShown) {
          setTimeout(() => state.setIsWelcomeModalOpen(true), 800);
        }
      }
    } else if (visiblePhotos.length > 0 && photosLoaded < visiblePhotos.length) {
      state.setShowProgress(true);
    }
  }, [photosLoaded, visiblePhotos.length, state.clientData, code, state.setShowProgress, state.setIsWelcomeModalOpen]);

  const loadSubfolderPhotos = useCallback(async (subfolder: GallerySubfolder, enteredPassword?: string) => {
    setSubfolderLoading(true);
    try {
      const params = new URLSearchParams({ code: code || '', subfolder_id: String(subfolder.id) });
      if (password) params.set('password', password);
      if (enteredPassword) params.set('subfolder_password', enteredPassword);
      const url = `https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (res.status === 401 && data.requires_password) {
        setSubfolderPasswordRequired(true);
        setSubfolderPasswordError(enteredPassword ? 'Неверный пароль' : '');
        setViewingSubfolder(subfolder);
        return;
      }
      
      if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
      
      setSubfolderPhotos(data.photos || []);
      setSubfolderFolderName(data.folder_name || subfolder.folder_name);
      setViewingSubfolder(subfolder);
      setSubfolderPasswordRequired(false);
      setSubfolderPasswordError('');
    } catch (err) {
      console.error('[SUBFOLDER] Error:', err);
    } finally {
      setSubfolderLoading(false);
    }
  }, [code, password]);

  const handleOpenSubfolder = useCallback((subfolder: GallerySubfolder) => {
    if (subfolder.has_password) {
      setSubfolderPasswordRequired(true);
      setViewingSubfolder(subfolder);
      setSubfolderPassword('');
      setSubfolderPasswordError('');
    } else {
      loadSubfolderPhotos(subfolder);
    }
  }, [loadSubfolderPhotos]);

  const handleSubfolderPasswordSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subfolderPassword.trim() || !viewingSubfolder) return;
    await loadSubfolderPhotos(viewingSubfolder, subfolderPassword);
  }, [subfolderPassword, viewingSubfolder, loadSubfolderPhotos]);

  const handleBackFromSubfolder = useCallback(() => {
    setViewingSubfolder(null);
    setSubfolderPhotos([]);
    setSubfolderPasswordRequired(false);
    setSubfolderPassword('');
    setSubfolderPasswordError('');
    setSubfolderFolderName('');
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader2" size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Загрузка галереи...</p>
        </div>
      </div>
    );
  }

  if (isBlocked) {
    if (code) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(code)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Icon name="ShieldOff" size={32} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ссылка недоступна</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Ссылка была заблокирована или удалена по истечению времени действия ссылки. 
            Обратитесь к вашему фотографу для создания новой ссылки с вашими фото.
          </p>
          {photographerEmail && (
            <div className="bg-gray-50 rounded-lg p-4 mb-2">
              <p className="text-sm text-gray-500 mb-1">Почта фотографа:</p>
              <a 
                href={`mailto:${photographerEmail}`} 
                className="text-blue-600 hover:text-blue-700 font-medium text-lg"
              >
                {photographerEmail}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <Icon name="AlertCircle" size={48} className="text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-600">{error}</p>
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

  if (!gallery) {
    return null;
  }

  const bgTheme = gallery.bg_theme || 'light';
  const isDarkTheme = bgTheme === 'dark' || ((bgTheme === 'custom' || bgTheme === 'auto') && gallery.bg_color && (() => {
    const hex = gallery.bg_color!.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  })()) || false;

  const galleryBgStyles: React.CSSProperties = {};
  if (bgTheme === 'dark') {
    galleryBgStyles.background = '#1a1a2e';
  } else if (bgTheme === 'auto' && gallery.bg_color) {
    galleryBgStyles.background = gallery.bg_color;
  } else if (bgTheme === 'custom') {
    if (gallery.bg_image_url) {
      galleryBgStyles.backgroundImage = `url(${gallery.bg_image_url})`;
      galleryBgStyles.backgroundSize = 'cover';
      galleryBgStyles.backgroundPosition = 'center';
      galleryBgStyles.backgroundAttachment = 'fixed';
    } else if (gallery.bg_color) {
      galleryBgStyles.background = gallery.bg_color;
    }
  } else {
    galleryBgStyles.background = '#f9fafb';
  }

  const galleryTextColor = gallery.text_color || (isDarkTheme ? '#ffffff' : '#111827');

  if (viewingClientFolder && state.clientData?.client_id && code) {
    return (
      <ClientFolderPage
        folderId={viewingClientFolder.id}
        folderName={viewingClientFolder.folder_name}
        shortCode={code}
        clientId={state.clientData.client_id}
        onBack={() => setViewingClientFolder(null)}
        bgStyles={galleryBgStyles}
        isDarkBg={isDarkTheme}
        textColor={galleryTextColor}
      />
    );
  }

  if (viewingSubfolder && subfolderPasswordRequired && subfolderPhotos.length === 0) {
    const secondaryColor = isDarkTheme ? 'rgba(255,255,255,0.6)' : '#6b7280';
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={galleryBgStyles}>
        <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
          style={{ background: isDarkTheme ? 'rgba(255,255,255,0.08)' : 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.1)' }}>
          <button onClick={handleBackFromSubfolder} className="flex items-center gap-1 text-sm mb-2" style={{ color: secondaryColor }}>
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
          <form onSubmit={handleSubfolderPasswordSubmit} className="space-y-3">
            <Input
              type="password"
              value={subfolderPassword}
              onChange={(e) => setSubfolderPassword(e.target.value)}
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
  }

  if (viewingSubfolder && subfolderPhotos.length > 0) {
    const sfSecondaryText = isDarkTheme ? 'rgba(255,255,255,0.6)' : '#6b7280';
    return (
      <div className="min-h-screen" style={galleryBgStyles}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={handleBackFromSubfolder}
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
          code={code}
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
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LoadingIndicators
        showProgress={state.showProgress}
        loadingProgress={actualProgress}
        downloadingAll={downloadingAll}
        downloadProgress={downloadProgress}
        onCancelDownload={cancelDownload}
      />
      
      <GalleryGrid
        gallery={{ ...gallery, photos: visiblePhotos }}
        downloadingAll={downloadingAll}
        onDownloadAll={downloadAll}
        onPhotoClick={state.setSelectedPhoto}
        onDownloadPhoto={downloadPhoto}
        onAddToFavorites={handlers.handleAddToFavorites}
        onOpenFavoriteFolders={() => state.setIsFavoritesModalOpen(true)}
        formatFileSize={formatFileSize}
        onPhotoLoad={() => setPhotosLoaded(prev => prev + 1)}
        clientName={state.clientData?.full_name || state.clientData?.phone || state.clientData?.email || ''}
        onClientLogin={() => state.setIsLoginModalOpen(true)}
        onOpenMyFavorites={() => state.setIsMyFavoritesOpen(true)}
        onOpenChat={() => state.setIsChatOpen(true)}
        unreadMessagesCount={state.unreadCount}
        onLogout={handlers.handleLogout}
        clientUploadEnabled={!!state.clientData?.upload_enabled}
        onOpenUpload={() => setIsUploadOpen(true)}
        clientFolders={clientUploadFolders}
        showClientFolders={!!(clientUploadFolders.length > 0 && (gallery.client_folders_visibility || clientUploadFolders.some(f => f.is_own !== false)))}
        onOpenClientFolder={(folder) => {
          if (state.clientData?.client_id) {
            setViewingClientFolder(folder);
          } else {
            setFolderToOpen(folder);
            setIsUploadOpen(true);
          }
        }}
        onRegisterToDownload={handlers.handleRegisterToDownload}
        onOpenSubfolder={handleOpenSubfolder}
      />

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
        isWelcomeModalOpen={state.isWelcomeModalOpen}
        favoriteFolder={state.favoriteFolder}
        photoToAdd={state.photoToAdd}
        unreadCount={state.unreadCount}
        code={code}
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

      {state.clientData?.upload_enabled && code && state.clientData?.client_id && (
        <ClientUploadModal
          isOpen={isUploadOpen}
          onClose={() => { setIsUploadOpen(false); setFolderToOpen(null); }}
          shortCode={code}
          clientId={state.clientData.client_id}
          existingFolders={clientUploadFolders}
          onFoldersUpdate={setClientUploadFolders}
          isDarkTheme={isDarkTheme}
          initialFolderId={folderToOpen?.id}
          initialFolderName={folderToOpen?.folder_name}
        />
      )}
    </div>
  );
}