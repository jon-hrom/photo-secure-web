import GalleryGrid from './GalleryGrid';
import LoadingIndicators from './LoadingIndicators';
import GalleryModals from './GalleryModals';
import ClientUploadModal from '@/components/gallery/ClientUploadModal';
import CreateFavoriteListModal from '@/components/gallery/CreateFavoriteListModal';
import YandexDiskCodeDialog from './components/YandexDiskCodeDialog';
import YandexDiskProgress from './components/YandexDiskProgress';

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
        onCreateFavoriteList={state.clientData?.client_id ? favoriteLists.handleOpenCreateList : undefined}
        activeFavoriteList={favoriteLists.activeFavoriteList}
        onSubmitListSelection={favoriteLists.handleSubmitListSelection}
        onCancelListSelection={() => favoriteLists.setActiveFavoriteList(null)}
        favoriteLists={state.clientData?.client_id ? favoriteLists.favoriteLists : []}
        onOpenFavoriteList={favoriteLists.handleOpenList}
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
