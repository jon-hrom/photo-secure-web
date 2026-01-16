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
  unreadMessagesCount = 0
}: GalleryGridProps) {
  console.log('[GALLERY_GRID] Rendering with photos count:', gallery.photos.length);
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{gallery.folder_name}</h1>
              <p className="text-gray-600">
                {gallery.photos.length} фото · {formatFileSize(gallery.total_size)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {clientName ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={onOpenChat}
                    className="relative flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Icon name="MessageCircle" size={18} />
                    Написать фотографу
                    {unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-lg">
                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={onOpenMyFavorites}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  >
                    <Icon name="Star" size={18} />
                    Мой список избранного
                  </button>
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                    <Icon name="User" size={18} className="text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">{clientName}</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={onClientLogin}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Icon name="User" size={18} />
                  Войти
                </button>
              )}
              {!gallery.download_disabled && (
                <button
                  onClick={onDownloadAll}
                  disabled={downloadingAll}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Icon name={downloadingAll ? "Loader2" : "Download"} size={20} className={downloadingAll ? "animate-spin" : ""} />
                  {downloadingAll ? 'Подготовка...' : 'Скачать всё архивом'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
          {gallery.photos.map((photo) => {
            return (
              <div
                key={photo.id}
                className="group relative bg-gray-100 rounded-lg overflow-hidden cursor-pointer break-inside-avoid mb-4"
                onClick={() => onPhotoClick(photo)}
              >
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
                <div className="absolute bottom-2 right-2 flex gap-2 z-10">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToFavorites(photo);
                    }}
                    className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-yellow-500 hover:scale-110 transition-all shadow-lg group/btn"
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
                      className="p-2 bg-white/90 backdrop-blur-sm rounded-full hover:bg-blue-500 hover:scale-110 transition-all shadow-lg group/btn"
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