import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GalleryGrid from './gallery/GalleryGrid';
import LoadingIndicators from './gallery/LoadingIndicators';
import GalleryModals from './gallery/GalleryModals';
import ClientUploadModal from '@/components/gallery/ClientUploadModal';
import ClientFolderPage from '@/components/gallery/ClientFolderPage';
import GalleryStatusScreens from './gallery/GalleryStatusScreens';
import { SubfolderPasswordView, SubfolderPhotosView } from './gallery/SubfolderView';
import { useGalleryProtection } from './gallery/hooks/useGalleryProtection';
import { useGalleryLoader } from './gallery/hooks/useGalleryLoader';
import { usePhotoDownloader } from './gallery/hooks/usePhotoDownloader';
import { useGalleryState } from './gallery/hooks/useGalleryState';
import { useGalleryHandlers } from './gallery/hooks/useGalleryHandlers';
import { useSubfolderState } from './gallery/hooks/useSubfolderState';

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

  const subfolder = useSubfolderState({
    code,
    password,
    gallery,
    clientId: state.clientData?.client_id || undefined,
    reloadClientFolders,
  });

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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return <GalleryStatusScreens type="loading" />;
  }

  if (isBlocked) {
    return <GalleryStatusScreens type="blocked" code={code} photographerEmail={photographerEmail} />;
  }

  if (error) {
    return <GalleryStatusScreens type="error" error={error} />;
  }

  if (requiresPassword) {
    return (
      <GalleryStatusScreens
        type="password"
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

  if (subfolder.viewingClientFolder && state.clientData?.client_id && code) {
    return (
      <ClientFolderPage
        folderId={subfolder.viewingClientFolder.id}
        folderName={subfolder.viewingClientFolder.folder_name}
        shortCode={code}
        clientId={state.clientData.client_id}
        onBack={() => subfolder.setViewingClientFolder(null)}
        bgStyles={galleryBgStyles}
        isDarkBg={isDarkTheme}
        textColor={galleryTextColor}
      />
    );
  }

  if (subfolder.viewingSubfolder && subfolder.subfolderPasswordRequired && subfolder.subfolderPhotos.length === 0) {
    return (
      <SubfolderPasswordView
        viewingSubfolder={subfolder.viewingSubfolder}
        subfolderPassword={subfolder.subfolderPassword}
        subfolderPasswordError={subfolder.subfolderPasswordError}
        subfolderLoading={subfolder.subfolderLoading}
        isDarkTheme={isDarkTheme}
        galleryTextColor={galleryTextColor}
        galleryBgStyles={galleryBgStyles}
        onPasswordChange={subfolder.setSubfolderPassword}
        onPasswordSubmit={subfolder.handleSubfolderPasswordSubmit}
        onBack={subfolder.handleBackFromSubfolder}
      />
    );
  }

  if (subfolder.viewingSubfolder && subfolder.subfolderPhotos.length > 0) {
    return (
      <SubfolderPhotosView
        subfolderPhotos={subfolder.subfolderPhotos}
        subfolderFolderName={subfolder.subfolderFolderName}
        isDarkTheme={isDarkTheme}
        galleryTextColor={galleryTextColor}
        galleryBgStyles={galleryBgStyles}
        gallery={gallery}
        state={{ ...state, code }}
        handlers={handlers}
        downloadPhoto={downloadPhoto}
        formatFileSize={formatFileSize}
        onBack={subfolder.handleBackFromSubfolder}
      />
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
        onOpenUpload={() => subfolder.setIsUploadOpen(true)}
        clientFolders={subfolder.clientUploadFolders}
        showClientFolders={!!(subfolder.clientUploadFolders.length > 0 && (gallery.client_folders_visibility || subfolder.clientUploadFolders.some(f => f.is_own !== false)))}
        onOpenClientFolder={(folder) => {
          if (state.clientData?.client_id) {
            subfolder.setViewingClientFolder(folder);
          } else {
            subfolder.setFolderToOpen(folder);
            subfolder.setIsUploadOpen(true);
          }
        }}
        onRegisterToDownload={handlers.handleRegisterToDownload}
        onOpenSubfolder={subfolder.handleOpenSubfolder}
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
          isOpen={subfolder.isUploadOpen}
          onClose={() => { subfolder.setIsUploadOpen(false); subfolder.setFolderToOpen(null); }}
          shortCode={code}
          clientId={state.clientData.client_id}
          existingFolders={subfolder.clientUploadFolders}
          onFoldersUpdate={subfolder.setClientUploadFolders}
          isDarkTheme={isDarkTheme}
          initialFolderId={subfolder.folderToOpen?.id}
          initialFolderName={subfolder.folderToOpen?.folder_name}
        />
      )}
    </div>
  );
}
