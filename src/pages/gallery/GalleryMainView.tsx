import { useEffect, useRef, useState } from 'react';
import GalleryGrid from './GalleryGrid';
import LoadingIndicators from './LoadingIndicators';
import GalleryModals from './GalleryModals';
import ClientUploadModal from '@/components/gallery/ClientUploadModal';
import CreateFavoriteListModal from '@/components/gallery/CreateFavoriteListModal';
import YandexDiskCodeDialog from './components/YandexDiskCodeDialog';
import YandexDiskProgress from './components/YandexDiskProgress';
import GalleryReviewInvite from '@/components/gallery/GalleryReviewInvite';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GalleryMainViewProps {
  gallery: any;
  code: string | undefined;
  state: any;
  handlers: any;
  subfolder: any;
  visiblePhotos: any;
  actualProgress: number;
  formatFileSize: (bytes: number) => string;
  isDarkTheme: boolean;
  setPhotosLoaded: (fn: (prev: number) => number) => void;
  downloadPhoto: any;
  downloadAll: any;
  downloadingAll: any;
  downloadProgress: any;
  cancelDownload: any;
  saveToYandexDisk: any;
  savingToYandexDisk: any;
  yandexDiskProgress: number;
  yandexDiskTotal: number;
  yandexDiskDone: number;
  yandexDiskCodeOpen: boolean;
  setYandexDiskCodeOpen: (v: boolean) => void;
  submitYandexDiskCode: (code: string) => void;
  yandexDiskAuthUrl: any;
  favoriteLists: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Основной вид публичной галереи (сетка фото, модалки, загрузки). */
export default function GalleryMainView(props: GalleryMainViewProps) {
  const {
    gallery, code, state, handlers, subfolder, visiblePhotos, actualProgress,
    formatFileSize, isDarkTheme, setPhotosLoaded,
    downloadPhoto, downloadAll, downloadingAll, downloadProgress, cancelDownload,
    saveToYandexDisk, savingToYandexDisk,
    yandexDiskProgress, yandexDiskTotal, yandexDiskDone,
    yandexDiskCodeOpen, setYandexDiskCodeOpen, submitYandexDiskCode, yandexDiskAuthUrl,
    favoriteLists,
  } = props;

  // Отмечаем момент, когда клиент только что скачал все фото / архив
  const [justDownloadedAll, setJustDownloadedAll] = useState(false);
  const wasDownloadingRef = useRef(false);
  useEffect(() => {
    if (downloadingAll) {
      wasDownloadingRef.current = true;
    } else if (wasDownloadingRef.current) {
      wasDownloadingRef.current = false;
      setJustDownloadedAll(true);
    }
  }, [downloadingAll]);

  const accent = gallery?.accent_color || '#7c3aed';

  // Функция "Избранное" доступна клиенту только если фотограф включил её для ссылки.
  const favoritesEnabled = !!gallery?.favorite_config;

  // «Просмотрел всё» — клиент долистал галерею до конца
  const [viewedAll, setViewedAll] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = bottomRef.current;
    if (!el || viewedAll) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setViewedAll(true);
    }, { rootMargin: '0px 0px 200px 0px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [viewedAll, visiblePhotos]);

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
        onAddToFavorites={favoritesEnabled ? handlers.handleAddToFavorites : undefined}
        onOpenFavoriteFolders={favoritesEnabled ? () => state.setIsFavoritesModalOpen(true) : undefined}
        formatFileSize={formatFileSize}
        onPhotoLoad={() => setPhotosLoaded(prev => prev + 1)}
        clientName={state.clientData?.full_name || state.clientData?.phone || state.clientData?.email || ''}
        onClientLogin={() => state.setIsLoginModalOpen(true)}
        onOpenMyFavorites={favoritesEnabled ? () => state.setIsMyFavoritesOpen(true) : undefined}
        onOpenChat={() => state.setIsChatOpen(true)}
        unreadMessagesCount={state.unreadCount}
        onLogout={handlers.handleLogout}
        clientUploadEnabled={!!state.clientData?.upload_enabled}
        onOpenUpload={() => subfolder.setIsUploadOpen(true)}
        clientFolders={subfolder.clientUploadFolders}
        showClientFolders={!!(subfolder.clientUploadFolders.length > 0 && (gallery.client_folders_visibility || subfolder.clientUploadFolders.some((f: { is_own?: boolean }) => f.is_own !== false)))}
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
        onCreateFavoriteList={favoritesEnabled && state.clientData?.client_id ? favoriteLists.handleOpenCreateList : undefined}
        activeFavoriteList={favoriteLists.activeFavoriteList}
        onSubmitListSelection={favoriteLists.handleSubmitListSelection}
        onCancelListSelection={() => favoriteLists.setActiveFavoriteList(null)}
        favoriteLists={favoritesEnabled && state.clientData?.client_id ? favoriteLists.favoriteLists : []}
        onOpenFavoriteList={favoriteLists.handleOpenList}
      />

      {/* Маркер конца галереи — по нему определяем, что клиент всё просмотрел */}
      <div ref={bottomRef} className="h-1 w-full" aria-hidden />

      {/* Приглашение оставить отзыв после просмотра/скачивания */}
      <GalleryReviewInvite
        portfolioSlug={gallery?.portfolio_slug}
        galleryCode={code}
        clientData={state.clientData}
        accent={accent}
        justDownloadedAll={justDownloadedAll}
        viewedAll={viewedAll}
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
        onAddToFavorites={favoritesEnabled ? handlers.handleAddToFavorites : undefined}
        loadClientFavorites={handlers.loadClientFavorites}
        isDarkTheme={isDarkTheme}
      />

      {code && state.clientData?.client_id && (
        <CreateFavoriteListModal
          isOpen={favoriteLists.isCreateListOpen}
          onClose={() => favoriteLists.setIsCreateListOpen(false)}
          shortCode={code}
          clientId={state.clientData.client_id}
          isDarkTheme={isDarkTheme}
          onCreated={favoriteLists.handleListCreated}
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