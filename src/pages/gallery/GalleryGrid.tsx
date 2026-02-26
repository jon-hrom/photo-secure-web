import { useState, useEffect, useRef, useCallback } from 'react';
import GalleryCover from './components/GalleryCover';
import GalleryToolbar from './components/GalleryToolbar';
import GalleryPhotoCard from './components/GalleryPhotoCard';
import Icon from '@/components/ui/icon';
import * as zip from '@zip.js/zip.js';

export interface Photo {
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
  onRegisterToDownload
}: GalleryGridProps) {
  console.log('[GALLERY_GRID] Rendering with photos count:', gallery.photos.length);

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

  const desktopCoverPhoto = gallery.cover_photo_id 
    ? gallery.photos.find(p => p.id === gallery.cover_photo_id) || gallery.photos[0]
    : null;

  const mobileCoverPhoto = gallery.mobile_cover_photo_id
    ? gallery.photos.find(p => p.id === gallery.mobile_cover_photo_id) || desktopCoverPhoto
    : desktopCoverPhoto;

  const coverPhoto = isMobile ? mobileCoverPhoto : desktopCoverPhoto;
  const isVerticalCover = gallery.cover_orientation === 'vertical';
  const focusX = isMobile ? (gallery.mobile_cover_focus_x ?? gallery.cover_focus_x ?? 0.5) : (gallery.cover_focus_x ?? 0.5);
  const focusY = isMobile ? (gallery.mobile_cover_focus_y ?? gallery.cover_focus_y ?? 0.5) : (gallery.cover_focus_y ?? 0.5);
  const gridGap = gallery.grid_gap ?? 8;

  const bgTheme = gallery.bg_theme || 'light';
  const isDarkBg = bgTheme === 'dark' || ((bgTheme === 'custom' || bgTheme === 'auto') && gallery.bg_color && (() => {
    const hex = gallery.bg_color!.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 0.299 + g * 0.587 + b * 0.114) < 150;
  })());

  const textColor = gallery.text_color || (isDarkBg ? '#ffffff' : '#111827');
  const secondaryText = isDarkBg ? 'rgba(255,255,255,0.6)' : 'rgba(55,65,81,1)';
  const cardBg = isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,1)';
  const cardShadow = isDarkBg ? 'none' : undefined;

  const bgStyles: React.CSSProperties = {};
  if (bgTheme === 'dark') {
    bgStyles.background = '#1a1a2e';
  } else if (bgTheme === 'auto' && gallery.bg_color) {
    bgStyles.background = gallery.bg_color;
  } else if (bgTheme === 'custom') {
    if (gallery.bg_image_url) {
      bgStyles.backgroundImage = `url(${gallery.bg_image_url})`;
      bgStyles.backgroundSize = 'cover';
      bgStyles.backgroundPosition = 'center';
      bgStyles.backgroundAttachment = 'fixed';
    } else if (gallery.bg_color) {
      bgStyles.background = gallery.bg_color;
    }
  } else {
    bgStyles.background = '#f9fafb';
  }

  useEffect(() => {
    const themeColor = bgTheme === 'dark' ? '#1a1a2e' 
      : (bgTheme === 'custom' || bgTheme === 'auto') && gallery.bg_color ? gallery.bg_color 
      : '#f9fafb';
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = themeColor;
    return () => { meta.content = '#ffffff'; };
  }, [bgTheme, gallery.bg_color]);

  const scrollToGrid = () => {
    document.getElementById('gallery-photo-grid')?.scrollIntoView({ behavior: 'smooth' });
  };

  const pendingNodes = useRef<Set<HTMLDivElement>>(new Set());
  const animatedSet = useRef<Set<Element>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !animatedSet.current.has(entry.target)) {
              animatedSet.current.add(entry.target);
              const el = entry.target as HTMLElement;
              el.style.opacity = '1';
              el.style.transform = 'translateY(0)';
            }
          });
        },
        { threshold: 0.05, rootMargin: '80px' }
      );
      pendingNodes.current.forEach(n => observerRef.current!.observe(n));
      pendingNodes.current.clear();
    }
    return observerRef.current;
  }, []);

  useEffect(() => {
    getObserver();
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [getObserver]);

  const photoCardRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    if (observerRef.current) {
      observerRef.current.observe(node);
    } else {
      pendingNodes.current.add(node);
    }
  }, []);

  return (
    <div className="min-h-screen" style={{
      ...bgStyles,
      paddingTop: 'env(safe-area-inset-top, 0px)',
      paddingLeft: 'env(safe-area-inset-left, 0px)',
      paddingRight: 'env(safe-area-inset-right, 0px)',
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
      />
      <div id="gallery-photo-grid" className="max-w-7xl mx-auto px-2 sm:px-4 pt-2 md:pt-0"
        style={{ paddingBottom: selectionMode ? '100px' : 'max(2rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div 
          className="columns-2 sm:columns-2 md:columns-3 lg:columns-4"
          style={{ gap: `${gridGap}px` }}
        >
          {gallery.photos.map((photo, index) => {
            return (
              <GalleryPhotoCard
                key={photo.id}
                ref={photoCardRef}
                photo={photo}
                index={index}
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
                isSelected={selectedIds.has(photo.id)}
                onToggleSelect={toggleSelect}
              />
            );
          })}
        </div>
      </div>

      {selectionMode && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex flex-col gap-2 px-4 py-3"
          style={{
            background: isDarkBg ? 'rgba(15,15,30,0.97)' : 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 -2px 16px rgba(0,0,0,0.15)',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))'
          }}
        >
          {downloadingSelected && (
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${selectedProgress}%` }}
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium flex-1" style={{ color: textColor }}>
              {selectedIds.size > 0 ? `Выбрано: ${selectedIds.size}` : 'Выберите фото'}
            </span>
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : '#f3f4f6', color: textColor }}
            >
              <Icon name="CheckSquare" size={15} />
              Выбрать все
            </button>
            <button
              onClick={downloadSelected}
              disabled={selectedIds.size === 0 || downloadingSelected}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white disabled:opacity-40 transition-colors hover:bg-indigo-700"
            >
              {downloadingSelected
                ? <><Icon name="Loader2" size={15} className="animate-spin" />{selectedProgress}%</>
                : <><Icon name="Download" size={15} />Скачать</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}