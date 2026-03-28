import { useState, useEffect } from 'react';
import * as zip from '@zip.js/zip.js';
import GalleryCover from './components/GalleryCover';
import GalleryToolbar from './components/GalleryToolbar';
import GallerySubfolderGrid from './components/GallerySubfolderGrid';
import GalleryJustifiedLayout from './components/GalleryJustifiedLayout';
import GallerySelectionBar from './components/GallerySelectionBar';
import useGalleryTheme from './hooks/useGalleryTheme';

export interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  grid_thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
  s3_key?: string;
  is_video?: boolean;
  content_type?: string;
}

export interface WatermarkSettings {
  enabled: boolean;
  type: string;
  text?: string;
  image_url?: string;
  frequency: number;
  size: number;
  opacity: number;
  rotation?: number;
}

export interface GalleryData {
  folder_name: string;
  photos: Photo[];
  total_size: number;
  watermark?: WatermarkSettings;
  screenshot_protection?: boolean;
  download_disabled?: boolean;
  cover_photo_id?: number | null;
  cover_orientation?: string;
  cover_focus_x?: number;
  cover_focus_y?: number;
  grid_gap?: number;
  bg_theme?: string;
  bg_color?: string | null;
  bg_image_url?: string | null;
  text_color?: string | null;
  cover_text_position?: string;
  cover_title?: string | null;
  cover_font_size?: number;
  mobile_cover_photo_id?: number | null;
  mobile_cover_focus_x?: number;
  mobile_cover_focus_y?: number;
  subfolders?: GallerySubfolder[];
}

export interface GallerySubfolder {
  id: number;
  folder_name: string;
  has_password: boolean;
  photo_count: number;
}

interface ClientFolder {
  id: number;
  folder_name: string;
  client_name: string | null;
  photo_count: number;
}

export interface GalleryGridProps {
  gallery: GalleryData;
  downloadingAll: boolean;
  onDownloadAll: () => void;
  onPhotoClick: (photo: Photo) => void;
  onDownloadPhoto: (photo: Photo) => void;
  onAddToFavorites: (photo: Photo) => void;
  onOpenFavoriteFolders: () => void;
  formatFileSize: (bytes: number) => string;
  onPhotoLoad?: () => void;
  clientName?: string;
  onClientLogin?: () => void;
  onOpenMyFavorites?: () => void;
  onOpenChat?: () => void;
  unreadMessagesCount?: number;
  onLogout?: () => void;
  clientUploadEnabled?: boolean;
  onOpenUpload?: () => void;
  clientFolders?: ClientFolder[];
  showClientFolders?: boolean;
  onOpenClientFolder?: (folder: ClientFolder) => void;
  onRegisterToDownload?: () => void;
  onOpenSubfolder?: (subfolder: GallerySubfolder) => void;
}

export default function GalleryGrid({
  gallery, 
  downloadingAll, 
  onDownloadAll, 
  onPhotoClick, 
  onDownloadPhoto,
  onAddToFavorites,
  onOpenFavoriteFolders,
  formatFileSize,
  onPhotoLoad,
  clientName,
  onClientLogin,
  onOpenMyFavorites,
  onOpenChat,
  unreadMessagesCount = 0,
  onLogout,
  clientUploadEnabled = false,
  onOpenUpload,
  clientFolders = [],
  showClientFolders = false,
  onOpenClientFolder,
  onRegisterToDownload,
  onOpenSubfolder
}: GalleryGridProps) {
  console.log('[GALLERY_GRID] Rendering with photos count:', gallery.photos.length, 'subfolders:', gallery.subfolders?.length || 0, gallery.subfolders);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [downloadingSelected, setDownloadingSelected] = useState(false);
  const [selectedProgress, setSelectedProgress] = useState(0);

  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelect = (photo: Photo) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(photo.id)) next.delete(photo.id);
      else next.add(photo.id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(gallery.photos.map(p => p.id)));
  };

  const downloadSelected = async () => {
    const photos = gallery.photos.filter(p => selectedIds.has(p.id));
    if (!photos.length) return;
    setDownloadingSelected(true);
    setSelectedProgress(0);
    try {
      const zipFileStream = new zip.BlobWriter();
      const zipWriter = new zip.ZipWriter(zipFileStream, { zip64: false });
      const usedFilenames = new Set<string>();
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        try {
          const fileResponse = await fetch(photo.photo_url);
          if (fileResponse.ok && fileResponse.body) {
            let filename = photo.file_name;
            if (usedFilenames.has(filename)) {
              const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
              const base = ext ? filename.substring(0, filename.lastIndexOf('.')) : filename;
              let counter = 1;
              do { filename = `${base}_${counter}${ext}`; counter++; } while (usedFilenames.has(filename));
            }
            usedFilenames.add(filename);
            await zipWriter.add(filename, fileResponse.body, { level: 0, dataDescriptor: false });
          }
        } catch { /* skip */ }
        setSelectedProgress(Math.round(((i + 1) / photos.length) * 100));
      }
      await zipWriter.close();
      const blob = await zipFileStream.getData();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${gallery.folder_name || 'photos'}_selected.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSelectionMode(false);
      setSelectedIds(new Set());
    } catch { /* ignore */ }
    setDownloadingSelected(false);
  };

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const firstPhoto = gallery.photos.length > 0 ? gallery.photos[0] : null;

  const desktopCoverPhoto = gallery.cover_photo_id 
    ? gallery.photos.find(p => p.id === gallery.cover_photo_id) || firstPhoto
    : firstPhoto;

  const mobileCoverPhoto = gallery.mobile_cover_photo_id
    ? gallery.photos.find(p => p.id === gallery.mobile_cover_photo_id) || desktopCoverPhoto
    : desktopCoverPhoto;

  const coverPhoto = isMobile ? mobileCoverPhoto : desktopCoverPhoto;
  const focusX = isMobile ? (gallery.mobile_cover_focus_x ?? gallery.cover_focus_x ?? 0.5) : (gallery.cover_focus_x ?? 0.5);
  const focusY = isMobile ? (gallery.mobile_cover_focus_y ?? gallery.cover_focus_y ?? 0.5) : (gallery.cover_focus_y ?? 0.5);
  const gridGap = gallery.grid_gap ?? 8;

  const { isDarkBg, textColor, secondaryText, bgStyles, toggleClientTheme } = useGalleryTheme(gallery);

  const scrollToGrid = () => {
    document.getElementById('gallery-photo-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen" style={{
      ...bgStyles,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
      WebkitOverflowScrolling: 'touch',
    }}>
      {coverPhoto && (
        <GalleryCover
          coverPhoto={coverPhoto}
          gallery={gallery}
          isMobile={isMobile}
          focusX={focusX}
          focusY={focusY}
          scrollToGrid={scrollToGrid}
        />
      )}
      <GalleryToolbar
        gallery={gallery}
        isDarkBg={!!isDarkBg}
        textColor={textColor}
        secondaryText={secondaryText}
        formatFileSize={formatFileSize}
        clientName={clientName}
        onOpenChat={onOpenChat}
        unreadMessagesCount={unreadMessagesCount}
        onOpenMyFavorites={onOpenMyFavorites}
        clientUploadEnabled={clientUploadEnabled}
        onOpenUpload={onOpenUpload}
        downloadingAll={downloadingAll}
        onDownloadAll={onDownloadAll}
        onLogout={onLogout}
        onClientLogin={onClientLogin}
        clientFolders={clientFolders}
        showClientFolders={showClientFolders}
        onOpenClientFolder={onOpenClientFolder}
        selectionMode={selectionMode}
        onToggleSelectionMode={toggleSelectionMode}
        onRegisterToDownload={onRegisterToDownload}
        onToggleTheme={toggleClientTheme}
      />
      <div id="gallery-photo-grid" className="max-w-7xl mx-auto px-2 sm:px-4 pt-2 md:pt-0"
        style={{ paddingBottom: selectionMode ? '100px' : 'max(2rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {gallery.subfolders && gallery.subfolders.length > 0 && (
          <GallerySubfolderGrid
            subfolders={gallery.subfolders}
            isDarkBg={!!isDarkBg}
            textColor={textColor}
            secondaryText={secondaryText}
            onOpenSubfolder={onOpenSubfolder}
          />
        )}
        <GalleryJustifiedLayout
          photos={gallery.photos}
          gridGap={gridGap}
          isDarkBg={!!isDarkBg}
          screenshotProtection={gallery.screenshot_protection}
          downloadDisabled={gallery.download_disabled}
          watermark={gallery.watermark}
          onPhotoClick={onPhotoClick}
          onDownloadPhoto={onDownloadPhoto}
          onAddToFavorites={onAddToFavorites}
          onPhotoLoad={onPhotoLoad}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      </div>

      {selectionMode && (
        <GallerySelectionBar
          isDarkBg={!!isDarkBg}
          textColor={textColor}
          selectedCount={selectedIds.size}
          downloadingSelected={downloadingSelected}
          selectedProgress={selectedProgress}
          onSelectAll={selectAll}
          onDownloadSelected={downloadSelected}
        />
      )}
    </div>
  );
}
