import { useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';

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

interface WatermarkSettings {
  enabled: boolean;
  type: string;
  text?: string;
  image_url?: string;
  frequency: number;
  size: number;
  opacity: number;
  rotation?: number;
}

interface GalleryData {
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
}

interface GalleryGridProps {
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
  onLogout
}: GalleryGridProps) {
  console.log('[GALLERY_GRID] Rendering with photos count:', gallery.photos.length);
  
  const coverPhoto = gallery.cover_photo_id 
    ? gallery.photos.find(p => p.id === gallery.cover_photo_id) || gallery.photos[0]
    : null;
  const isVerticalCover = gallery.cover_orientation === 'vertical';
  const focusX = gallery.cover_focus_x ?? 0.5;
  const focusY = gallery.cover_focus_y ?? 0.5;
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
        <div 
          className="relative overflow-hidden"
          style={{
            width: 'calc(100% + env(safe-area-inset-left, 0px) + env(safe-area-inset-right, 0px))',
            marginLeft: 'calc(-1 * env(safe-area-inset-left, 0px))',
            marginRight: 'calc(-1 * env(safe-area-inset-right, 0px))',
            marginTop: 'calc(-1 * env(safe-area-inset-top, 0px))',
            height: '100vh',
            minHeight: 500,
            background: '#0a0a0a'
          }}
        >
          <img
            src={coverPhoto.photo_url}
            alt={gallery.folder_name}
            className="w-full h-full object-contain"
            draggable={false}
            onContextMenu={(e) => gallery.screenshot_protection && e.preventDefault()}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" style={{ pointerEvents: 'none' }} />
          {(() => {
            const pos = gallery.cover_text_position || 'bottom-center';
            const posClasses = pos === 'center' ? 'inset-0 flex flex-col items-center justify-center text-center px-6'
              : pos === 'top-center' ? 'inset-0 flex flex-col items-center justify-start text-center px-6 pt-12 sm:pt-16'
              : pos === 'bottom-left' ? 'bottom-0 left-0 right-0 flex flex-col items-start text-left px-6 pb-6 sm:pb-10'
              : pos === 'bottom-right' ? 'bottom-0 left-0 right-0 flex flex-col items-end text-right px-6 pb-6 sm:pb-10'
              : 'bottom-0 left-0 right-0 flex flex-col items-center text-center px-6 pb-6 sm:pb-10';
            return (
              <div
                className={`absolute ${posClasses}`}
                style={{
                  opacity: 0,
                  transform: 'translateY(20px)',
                  animation: 'coverTextFadeIn 2.5s ease forwards 0.3s'
                }}
              >
                <h1 className="font-bold mb-3 drop-shadow-lg" style={{
                  color: gallery.text_color || '#ffffff',
                  fontSize: `${gallery.cover_font_size || 36}px`
                }}>
                  {gallery.cover_title || gallery.folder_name}
                </h1>
                <button
                  onClick={scrollToGrid}
                  className="group inline-flex items-center gap-1.5 text-sm transition-colors"
                  style={{
                    color: gallery.text_color ? `${gallery.text_color}cc` : 'rgba(255,255,255,0.8)',
                    opacity: 0,
                    animation: 'coverTextFadeIn 2s ease forwards 1.2s'
                  }}
                >
                  <span>Просмотр фото</span>
                  <Icon name="ChevronDown" size={16} className="animate-bounce" />
                </button>
              </div>
            );
          })()}
        </div>
      )}
      <div className="sticky top-0 z-50" style={{ 
        background: isDarkBg ? 'rgba(26,26,46,0.92)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isDarkBg ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.08)'
      }}>
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="flex items-center gap-2 py-2 sm:py-2.5 overflow-x-auto">
            <p className="text-xs sm:text-sm whitespace-nowrap flex-shrink-0" style={{ color: secondaryText }}>
              {gallery.photos.length} фото · {formatFileSize(gallery.total_size)}
            </p>
            <div className="flex-1" />
            {clientName ? (
              <>
                <button
                  onClick={onOpenChat}
                  className="relative w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 bg-blue-500 text-white rounded-full sm:rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                >
                  <Icon name="MessageCircle" size={14} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Написать</span>
                  {unreadMessagesCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5 shadow-lg">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={onOpenMyFavorites}
                  className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 bg-yellow-500 text-white rounded-full sm:rounded-lg hover:bg-yellow-600 active:bg-yellow-700 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                >
                  <Icon name="Star" size={14} className="flex-shrink-0" />
                  <span className="hidden sm:inline">Избранное</span>
                </button>
                {!gallery.download_disabled && (
                  <button
                    onClick={onDownloadAll}
                    disabled={downloadingAll}
                    className="w-8 h-8 sm:w-auto sm:h-auto flex items-center justify-center sm:gap-1.5 sm:px-2.5 sm:py-2 bg-blue-600 text-white rounded-full sm:rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                  >
                    <Icon name={downloadingAll ? "Loader2" : "Download"} size={14} className={`flex-shrink-0 ${downloadingAll ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{downloadingAll ? 'Загрузка...' : 'Скачать всё'}</span>
                  </button>
                )}
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg flex-shrink-0" style={{
                  background: isDarkBg ? 'rgba(255,255,255,0.1)' : '#f3f4f6'
                }}>
                  <Icon name="User" size={13} className="flex-shrink-0" style={{ color: secondaryText }} />
                  <span className="text-xs font-medium truncate max-w-[80px] sm:max-w-[120px]" style={{ color: textColor }}>{clientName}</span>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors text-xs touch-manipulation flex-shrink-0"
                  style={{
                    background: isDarkBg ? 'rgba(239,68,68,0.15)' : '#fee2e2',
                    color: isDarkBg ? '#fca5a5' : '#b91c1c'
                  }}
                >
                  <Icon name="LogOut" size={13} className="flex-shrink-0" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClientLogin}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                  style={{
                    background: isDarkBg ? 'rgba(59,130,246,0.2)' : '#dbeafe',
                    color: isDarkBg ? '#93c5fd' : '#1d4ed8'
                  }}
                >
                  <Icon name="User" size={14} className="flex-shrink-0" />
                  Войти
                </button>
                {!gallery.download_disabled && (
                  <button
                    onClick={onDownloadAll}
                    disabled={downloadingAll}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors text-xs sm:text-sm touch-manipulation whitespace-nowrap flex-shrink-0"
                  >
                    <Icon name={downloadingAll ? "Loader2" : "Download"} size={14} className={`flex-shrink-0 ${downloadingAll ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{downloadingAll ? 'Загрузка...' : 'Скачать всё'}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <div id="gallery-photo-grid" className="max-w-7xl mx-auto px-2 sm:px-4 pb-4 sm:pb-8 pt-2 md:pt-0"
        style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div 
          className="columns-2 sm:columns-2 md:columns-3 lg:columns-4"
          style={{ gap: `${gridGap}px` }}
        >
          {gallery.photos.map((photo, index) => {
            return (
              <div
                key={photo.id}
                ref={photoCardRef}
                className="group relative rounded-md sm:rounded-lg overflow-hidden cursor-pointer break-inside-avoid touch-manipulation"
                style={{ 
                  marginBottom: `${gridGap}px`,
                  background: isDarkBg ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                  opacity: 0,
                  transform: 'translateY(24px)',
                  transition: `opacity 0.5s ease ${(index % 8) * 0.06}s, transform 0.5s ease ${(index % 8) * 0.06}s`
                }}
                onClick={() => onPhotoClick(photo)}
              >
                {photo.is_video ? (
                  <video
                    src={`${photo.photo_url}#t=0.1`}
                    className="w-full h-auto transition-transform group-hover:scale-105"
                    preload="metadata"
                    onContextMenu={(e) => gallery.screenshot_protection && e.preventDefault()}
                    onLoadedData={() => onPhotoLoad?.()}
                    onError={() => onPhotoLoad?.()}
                    muted={true}
                    playsInline={true}
                  />
                ) : (
                  <img
                    src={photo.thumbnail_url || photo.photo_url}
                    alt={photo.file_name}
                    className="w-full h-auto transition-transform group-hover:scale-105"
                    loading="lazy"
                    onContextMenu={(e) => gallery.screenshot_protection && e.preventDefault()}
                    draggable={false}
                    onLoad={() => onPhotoLoad?.()}
                    onError={() => onPhotoLoad?.()}
                  />
                )}
                {photo.is_video && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <Icon name="Play" size={24} className="text-white sm:w-8 sm:h-8" />
                    </div>
                  </div>
                )}
                {gallery.watermark?.enabled && (() => {
                  const frequency = gallery.watermark.frequency || 50;
                  const count = Math.ceil((frequency / 10) * 10);
                  const watermarks = [];
                  
                  for (let i = 0; i < count; i++) {
                    const top = (i * (100 / count)) % 100;
                    const left = ((i * 37) % 100);
                    
                    watermarks.push(
                      <div
                        key={i}
                        className="absolute pointer-events-none"
                        style={{
                          top: `${top}%`,
                          left: `${left}%`,
                          transform: 'translate(-50%, -50%)',
                          opacity: (gallery.watermark.opacity || 50) / 100
                        }}
                      >
                        {gallery.watermark.type === 'text' ? (
                          <p 
                            className="text-white font-bold text-center px-2 whitespace-nowrap" 
                            style={{ 
                              fontSize: `${gallery.watermark.size || 20}px`,
                              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                              transform: `rotate(${gallery.watermark.rotation || 0}deg)`
                            }}
                          >
                            {gallery.watermark.text}
                          </p>
                        ) : (
                          <img 
                            src={gallery.watermark.image_url} 
                            alt="Watermark" 
                            style={{ 
                              maxWidth: `${gallery.watermark.size}px`,
                              maxHeight: `${gallery.watermark.size}px`,
                              transform: `rotate(${gallery.watermark.rotation || 0}deg)` 
                            }}
                          />
                        )}
                      </div>
                    );
                  }
                  
                  return watermarks;
                })()}
                <div className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 flex gap-1 sm:gap-2 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToFavorites(photo);
                    }}
                    className="w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full hover:bg-yellow-500 active:bg-yellow-600 hover:scale-110 active:scale-95 transition-all shadow-lg group/btn touch-manipulation"
                    title="Добавить в избранное"
                  >
                    <Icon name="Star" size={10} className="text-yellow-500 group-hover/btn:text-white sm:[&>svg]:w-3.5 sm:[&>svg]:h-3.5" />
                  </button>
                  {!gallery.download_disabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadPhoto(photo);
                      }}
                      className="w-5 h-5 sm:w-7 sm:h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm rounded-full hover:bg-blue-500 active:bg-blue-600 hover:scale-110 active:scale-95 transition-all shadow-lg group/btn touch-manipulation"
                      title="Скачать фото"
                    >
                      <Icon name="Download" size={10} className="text-gray-900 group-hover/btn:text-white sm:[&>svg]:w-3.5 sm:[&>svg]:h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}