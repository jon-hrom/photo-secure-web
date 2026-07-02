import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import GallerySpecialViews from './gallery/GallerySpecialViews';
import GalleryMainView from './gallery/GalleryMainView';
import { useGalleryProtection } from './gallery/hooks/useGalleryProtection';
import { useGalleryLoader } from './gallery/hooks/useGalleryLoader';
import { usePhotoDownloader } from './gallery/hooks/usePhotoDownloader';
import { useGalleryState } from './gallery/hooks/useGalleryState';
import { useGalleryHandlers } from './gallery/hooks/useGalleryHandlers';
import { useSubfolderState } from './gallery/hooks/useSubfolderState';
import { useYandexDisk } from './gallery/hooks/useYandexDisk';
import { useFavoriteLists } from './gallery/hooks/useFavoriteLists';
import { useGalleryDerived } from './gallery/hooks/useGalleryDerived';

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
    blockedPhotographerId,
    setPassword,
    setPhotosLoaded,
    handlePasswordSubmit,
    reloadClientFolders
  } = useGalleryLoader(code, state.clientData?.client_id || undefined);

  const favoriteLists = useFavoriteLists({
    code,
    clientId: state.clientData?.client_id || undefined,
    setIsLoginModalOpen: state.setIsLoginModalOpen,
  });

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

  const {
    visiblePhotos,
    actualProgress,
    formatFileSize,
    isDarkTheme,
    galleryBgStyles,
    galleryTextColor,
  } = useGalleryDerived({ gallery, state, code, loadingProgress, photosLoaded });

  const specialView = GallerySpecialViews({
    loading,
    isBlocked,
    error,
    requiresPassword,
    gallery,
    code,
    photographerEmail,
    blockedPhotographerId,
    password,
    passwordError,
    setPassword,
    handlePasswordSubmit,
    isDarkTheme,
    galleryTextColor,
    galleryBgStyles,
    state,
    handlers,
    subfolder,
    favoriteLists,
    downloadPhoto,
    downloadAll,
    downloadingAll,
    downloadProgress,
    cancelDownload,
    formatFileSize,
    saveToYandexDisk,
    savingToYandexDisk,
    yandexDiskProgress,
    yandexDiskTotal,
    yandexDiskDone,
    yandexDiskCodeOpen,
    setYandexDiskCodeOpen,
    submitYandexDiskCode,
    yandexDiskAuthUrl,
  });

  if (specialView !== null) {
    return specialView;
  }

  return (
    <GalleryMainView
      gallery={gallery}
      code={code}
      state={state}
      handlers={handlers}
      subfolder={subfolder}
      visiblePhotos={visiblePhotos}
      actualProgress={actualProgress}
      formatFileSize={formatFileSize}
      isDarkTheme={isDarkTheme}
      setPhotosLoaded={setPhotosLoaded}
      downloadPhoto={downloadPhoto}
      downloadAll={downloadAll}
      downloadingAll={downloadingAll}
      downloadProgress={downloadProgress}
      cancelDownload={cancelDownload}
      saveToYandexDisk={saveToYandexDisk}
      savingToYandexDisk={savingToYandexDisk}
      yandexDiskProgress={yandexDiskProgress}
      yandexDiskTotal={yandexDiskTotal}
      yandexDiskDone={yandexDiskDone}
      yandexDiskCodeOpen={yandexDiskCodeOpen}
      setYandexDiskCodeOpen={setYandexDiskCodeOpen}
      submitYandexDiskCode={submitYandexDiskCode}
      yandexDiskAuthUrl={yandexDiskAuthUrl}
      favoriteLists={favoriteLists}
    />
  );
}