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
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-50 bg-white shadow-md md:static md:shadow-none">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4 md:py-8">
          <div className="bg-white rounded-lg md:shadow-sm p-3 sm:p-4 md:p-6">
            <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">{gallery.folder_name}</h1>
              <p className="text-sm sm:text-base text-gray-600">
                {gallery.photos.length} фото · {formatFileSize(gallery.total_size)}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {clientName ? (
                <>
                  <div className="grid grid-cols-2 gap-2 w-full sm:w-auto">
                    <button
                      onClick={onOpenChat}
                      className="relative flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors text-xs sm:text-sm touch-manipulation"
                    >
                      <Icon name="MessageCircle" size={16} className="flex-shrink-0" />
                      <span className="hidden sm:inline">Написать фотографу</span>
                      <span className="sm:hidden">Написать</span>
                      {unreadMessagesCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg">
                          {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={onOpenMyFavorites}
                      className="flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 active:bg-yellow-700 transition-colors text-xs sm:text-sm touch-manipulation"
                    >
                      <Icon name="Star" size={16} className="flex-shrink-0" />
                      <span className="hidden sm:inline">Мой список избранного</span>
                      <span className="sm:hidden">Избранное</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg">
                    <Icon name="User" size={16} className="text-gray-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">{clientName}</span>
                  </div>
                  <button
                    onClick={onLogout}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 active:bg-red-300 transition-colors text-xs sm:text-sm touch-manipulation"
                  >
                    <Icon name="LogOut" size={16} className="flex-shrink-0" />
                    <span>Выход</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={onClientLogin}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 active:bg-blue-300 transition-colors text-xs sm:text-sm touch-manipulation"
                >
                  <Icon name="User" size={16} className="flex-shrink-0" />
                  Войти
                </button>
              )}
              {!gallery.download_disabled && (
                <button
                  onClick={onDownloadAll}
                  disabled={downloadingAll}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm touch-manipulation"
                >
                  <Icon name={downloadingAll ? "Loader2" : "Download"} size={18} className={`flex-shrink-0 ${downloadingAll ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{downloadingAll ? 'Подготовка...' : 'Скачать всё архивом'}</span>
                  <span className="sm:hidden">{downloadingAll ? 'Загрузка...' : 'Скачать всё'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-4 sm:pb-8 pt-2 md:pt-0">
        <div className="columns-2 sm:columns-2 md:columns-3 lg:columns-4 gap-2 sm:gap-3 md:gap-4">
          {gallery.photos.map((photo) => {
            return (
              <div
                key={photo.id}
                className="group relative bg-gray-100 rounded-md sm:rounded-lg overflow-hidden cursor-pointer break-inside-avoid mb-2 sm:mb-3 md:mb-4 touch-manipulation"
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
                <div className="absolute bottom-1.5 sm:bottom-2 right-1.5 sm:right-2 flex gap-1.5 sm:gap-2 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToFavorites(photo);
                    }}
                    className="p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-yellow-500 active:bg-yellow-600 hover:scale-110 active:scale-95 transition-all shadow-lg group/btn touch-manipulation"
                    title="Добавить в избранное"
                  >
                    <Icon name="Star" size={16} className="text-yellow-500 group-hover/btn:text-white" />
                  </button>
                  {!gallery.download_disabled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadPhoto(photo);
                      }}
                      className="p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-blue-500 active:bg-blue-600 hover:scale-110 active:scale-95 transition-all shadow-lg group/btn touch-manipulation"
                      title="Скачать фото"
                    >
                      <Icon name="Download" size={16} className="text-gray-900 group-hover/btn:text-white" />
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