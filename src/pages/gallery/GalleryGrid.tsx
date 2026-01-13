import Icon from '@/components/ui/icon';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  file_size: number;
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
  formatFileSize: (bytes: number) => string;
}

export default function GalleryGrid({ 
  gallery, 
  downloadingAll, 
  onDownloadAll, 
  onPhotoClick, 
  onDownloadPhoto,
  formatFileSize 
}: GalleryGridProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{gallery.folder_name}</h1>
              <p className="text-gray-600">
                {gallery.photos.length} фото · {formatFileSize(gallery.total_size)}
              </p>
            </div>
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
                />
                {gallery.watermark?.enabled && (() => {
                  const frequency = gallery.watermark.frequency || 50;
                  const count = Math.ceil(frequency / 10);
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
                {!gallery.download_disabled && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadPhoto(photo);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-3 bg-white rounded-full transition-opacity"
                    >
                      <Icon name="Download" size={24} className="text-gray-900" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}