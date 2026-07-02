import React from 'react';
import ClientFolderPage from '@/components/gallery/ClientFolderPage';
import FavoriteListView from '@/components/gallery/FavoriteListView';
import GalleryStatusScreens from './GalleryStatusScreens';
import { SubfolderPasswordView, SubfolderPhotosView } from './SubfolderView';
import YandexDiskCodeDialog from './components/YandexDiskCodeDialog';
import YandexDiskProgress from './components/YandexDiskProgress';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GallerySpecialViewsProps {
  loading: boolean;
  isBlocked: boolean;
  error: any;
  requiresPassword: boolean;
  gallery: any;
  code: string | undefined;
  photographerEmail: any;
  blockedPhotographerId: any;
  password: any;
  passwordError: any;
  setPassword: (v: any) => void;
  handlePasswordSubmit: () => void;
  isDarkTheme: boolean;
  galleryTextColor: string;
  galleryBgStyles: React.CSSProperties;
  state: any;
  handlers: any;
  subfolder: any;
  favoriteLists: {
    viewingList: { id: number; name: string } | null;
    setViewingList: (v: { id: number; name: string } | null) => void;
    setActiveFavoriteList: (v: { id: number; name: string } | null) => void;
    loadFavoriteLists: () => void;
  };
  downloadPhoto: any;
  downloadAll: any;
  downloadingAll: any;
  downloadProgress: any;
  cancelDownload: any;
  formatFileSize: (bytes: number) => string;
  saveToYandexDisk: any;
  savingToYandexDisk: any;
  yandexDiskProgress: number;
  yandexDiskTotal: number;
  yandexDiskDone: number;
  yandexDiskCodeOpen: boolean;
  setYandexDiskCodeOpen: (v: boolean) => void;
  submitYandexDiskCode: (code: string) => void;
  yandexDiskAuthUrl: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Все "особые" экраны публичной галереи (ранние возвраты исходного компонента):
 * загрузка, блокировка, ошибка, ввод пароля, папка клиента, список избранного,
 * подпапка (пароль/фото). Возвращает React-элемент или null, если ни один
 * особый экран не активен — тогда родитель рендерит основной вид.
 */
export default function GallerySpecialViews(props: GallerySpecialViewsProps): React.ReactElement | null {
  const {
    loading, isBlocked, error, requiresPassword, gallery, code,
    photographerEmail, blockedPhotographerId, password, passwordError,
    setPassword, handlePasswordSubmit, isDarkTheme, galleryTextColor, galleryBgStyles,
    state, handlers, subfolder, favoriteLists,
    downloadPhoto, downloadAll, downloadingAll, downloadProgress, cancelDownload, formatFileSize,
    saveToYandexDisk, savingToYandexDisk,
    yandexDiskProgress, yandexDiskTotal, yandexDiskDone,
    yandexDiskCodeOpen, setYandexDiskCodeOpen, submitYandexDiskCode, yandexDiskAuthUrl,
  } = props;

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

  if (favoriteLists.viewingList && state.clientData?.client_id && code) {
    const viewingList = favoriteLists.viewingList;
    return (
      <FavoriteListView
        listId={viewingList.id}
        listName={viewingList.name}
        shortCode={code}
        clientId={state.clientData.client_id}
        galleryPhotos={gallery.photos}
        onBack={() => { favoriteLists.setViewingList(null); favoriteLists.loadFavoriteLists(); }}
        onAddMore={() => {
          favoriteLists.setActiveFavoriteList({ id: viewingList.id, name: viewingList.name });
          favoriteLists.setViewingList(null);
        }}
        onListDeleted={() => { favoriteLists.setViewingList(null); favoriteLists.loadFavoriteLists(); }}
        onListRenamed={(newName) => { favoriteLists.setViewingList({ id: viewingList.id, name: newName }); favoriteLists.loadFavoriteLists(); }}
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

  return null;
}
