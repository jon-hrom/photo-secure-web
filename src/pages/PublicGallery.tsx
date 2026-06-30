import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import GalleryGrid from './gallery/GalleryGrid';
import LoadingIndicators from './gallery/LoadingIndicators';
import GalleryModals from './gallery/GalleryModals';
import ClientUploadModal from '@/components/gallery/ClientUploadModal';
import ClientFolderPage from '@/components/gallery/ClientFolderPage';
import CreateFavoriteListModal from '@/components/gallery/CreateFavoriteListModal';
import FavoriteListView from '@/components/gallery/FavoriteListView';
import GalleryStatusScreens from './gallery/GalleryStatusScreens';
import { SubfolderPasswordView, SubfolderPhotosView } from './gallery/SubfolderView';
import { useGalleryProtection } from './gallery/hooks/useGalleryProtection';
import { useGalleryLoader } from './gallery/hooks/useGalleryLoader';
import { usePhotoDownloader } from './gallery/hooks/usePhotoDownloader';
import { useGalleryState } from './gallery/hooks/useGalleryState';
import { useGalleryHandlers } from './gallery/hooks/useGalleryHandlers';
import { useSubfolderState } from './gallery/hooks/useSubfolderState';
import { useYandexDisk } from './gallery/hooks/useYandexDisk';
import YandexDiskCodeDialog from './gallery/components/YandexDiskCodeDialog';
import YandexDiskProgress from './gallery/components/YandexDiskProgress';

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

const FAVORITES_URL = 'https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723';

export default function PublicGallery() {
  const { code } = useParams<{ code: string }>();
  
  const state = useGalleryState();
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [activeFavoriteList, setActiveFavoriteList] = useState<{ id: number; name: string } | null>(null);
  const [favoriteLists, setFavoriteLists] = useState<Array<{ id: number; name: string; note: string | null; photo_count: number; created_at: string | null }>>([]);
  const [viewingList, setViewingList] = useState<{ id: number; name: string } | null>(null);

  const loadFavoriteLists = React.useCallback(async () => {
    if (!code || !state.clientData?.client_id) {
      setFavoriteLists([]);
      return;
    }
    try {
      const resp = await fetch(`${FAVORITES_URL}?action=client_lists&gallery_code=${encodeURIComponent(code)}&client_id=${state.clientData.client_id}`);
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.lists)) setFavoriteLists(data.lists);
    } catch (e) {
      console.error('load favorite lists error', e);
    }
  }, [code, state.clientData?.client_id]);

  useEffect(() => { loadFavoriteLists(); }, [loadFavoriteLists]);

  const handleOpenCreateList = () => {
    if (!state.clientData?.client_id) {
      state.setIsLoginModalOpen(true);
      return;
    }
    setIsCreateListOpen(true);
  };

  const handleListCreated = (list: { id: number; name: string }) => {
    setActiveFavoriteList({ id: list.id, name: list.name });
    loadFavoriteLists();
  };

  const handleSubmitListSelection = async (photoIds: number[]) => {
    if (!activeFavoriteList || !state.clientData?.client_id || !code) return;
    try {
      await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_photos_to_list',
          list_id: activeFavoriteList.id,
          gallery_code: code,
          client_id: state.clientData.client_id,
          photo_ids: photoIds,
        }),
      });
    } catch (e) {
      console.error('add to list error', e);
    }
    const justAddedListId = activeFavoriteList.id;
    const justAddedListName = activeFavoriteList.name;
    setActiveFavoriteList(null);
    await loadFavoriteLists();
    setViewingList({ id: justAddedListId, name: justAddedListName });
  };

  const handleOpenList = (list: { id: number; name: string }) => {
    setViewingList(list);
  };
  
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
    blockedPhotographerId,
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

  const {
    saveToYandexDisk,
    savingToYandexDisk,
    codeDialogOpen: yandexDiskCodeOpen,
    setCodeDialogOpen: setYandexDiskCodeOpen,
    submitAuthCode: submitYandexDiskCode,
    progress: yandexDiskProgress,
    progressTotal: yandexDiskTotal,
    progressDone: yandexDiskDone,
    authUrl: yandexDiskAuthUrl,
  } = useYandexDisk(code);

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
    setIsLoginModalOpen: state.setIsLoginModalOpen,
    previousUnreadCount: state.previousUnreadCount
  });

  const subfolder = useSubfolderState({
    code,
    password,
    gallery,
    clientId: state.clientData?.client_id || undefined,
    reloadClientFolders,
  });

  // При переходе между уровнями (открытие/закрытие подпапки) закрываем
  // окно входа и окно избранного — чтобы папка открывалась "чисто",
  // а окно авторизации появлялось только по клику на звёздочку.
  // НЕ трогаем selectedPhoto, чтобы не мешать открытию фото на большой экран.
  const viewingSubfolderId = subfolder.viewingSubfolder?.id;
  useEffect(() => {
    state.setIsLoginModalOpen(false);
    state.setIsFavoritesModalOpen(false);
    state.setPhotoToAdd(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingSubfolderId]);

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
    return (
      <GalleryStatusScreens
        type="blocked"
        code={code}
        photographerEmail={photographerEmail}
        photographerId={blockedPhotographerId}
      />
    );
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

  if (viewingList && state.clientData?.client_id && code) {
    return (
      <FavoriteListView
        listId={viewingList.id}
        listName={viewingList.name}
        shortCode={code}
        clientId={state.clientData.client_id}
        galleryPhotos={gallery.photos}
        onBack={() => { setViewingList(null); loadFavoriteLists(); }}
        onAddMore={() => {
          setActiveFavoriteList({ id: viewingList.id, name: viewingList.name });
          setViewingList(null);
        }}
        onListDeleted={() => { setViewingList(null); loadFavoriteLists(); }}
        onListRenamed={(newName) => { setViewingList({ id: viewingList.id, name: newName }); loadFavoriteLists(); }}
        bgStyles={galleryBgStyles}
        isDarkBg={isDarkTheme}
        textColor={galleryTextColor}
        downloadPhoto={downloadPhoto}
        downloadDisabled={gallery.download_disabled}
        coverSelectEnabled={gallery.cover_select_enabled}
        vignetteSelectEnabled={gallery.vignette_select_enabled}
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
      <>
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
        downloadAll={downloadAll}
        downloadingAll={downloadingAll}
        downloadProgress={downloadProgress}
        cancelDownload={cancelDownload}
        formatFileSize={formatFileSize}
        onBack={subfolder.handleBackFromSubfolder}
        subfolderId={subfolder.viewingSubfolder?.id}
        onSaveToYandexDisk={state.clientData?.client_id ? saveToYandexDisk : undefined}
        savingToYandexDisk={savingToYandexDisk}
      />
        <YandexDiskProgress
          show={savingToYandexDisk}
          percent={yandexDiskProgress}
          done={yandexDiskDone}
          total={yandexDiskTotal}
        />
        <YandexDiskCodeDialog
          open={yandexDiskCodeOpen}
          onOpenChange={setYandexDiskCodeOpen}
          onSubmit={submitYandexDiskCode}
          authUrl={yandexDiskAuthUrl}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <YandexDiskProgress
        show={savingToYandexDisk}
        percent={yandexDiskProgress}
        done={yandexDiskDone}
        total={yandexDiskTotal}
      />
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
        onSaveToYandexDisk={state.clientData?.client_id ? saveToYandexDisk : undefined}
        savingToYandexDisk={savingToYandexDisk}
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
        onCreateFavoriteList={state.clientData?.client_id ? handleOpenCreateList : undefined}
        activeFavoriteList={activeFavoriteList}
        onSubmitListSelection={handleSubmitListSelection}
        onCancelListSelection={() => setActiveFavoriteList(null)}
        favoriteLists={state.clientData?.client_id ? favoriteLists : []}
        onOpenFavoriteList={handleOpenList}
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
        onAddToFavorites={handlers.handleAddToFavorites}
        loadClientFavorites={handlers.loadClientFavorites}
        isDarkTheme={isDarkTheme}
      />

      {code && state.clientData?.client_id && (
        <CreateFavoriteListModal
          isOpen={isCreateListOpen}
          onClose={() => setIsCreateListOpen(false)}
          shortCode={code}
          clientId={state.clientData.client_id}
          isDarkTheme={isDarkTheme}
          onCreated={handleListCreated}
        />
      )}

      <YandexDiskCodeDialog
        open={yandexDiskCodeOpen}
        onOpenChange={setYandexDiskCodeOpen}
        onSubmit={submitYandexDiskCode}
        authUrl={yandexDiskAuthUrl}
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