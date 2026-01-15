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

interface PhotoViewerProps {
  selectedPhoto: Photo;
  gallery: GalleryData;
  imageError: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onDownloadPhoto: (photo: Photo) => void;
  onAddToFavorites: (photo: Photo) => void;
  onImageError: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
}

export default function PhotoViewer({
  selectedPhoto,
  gallery,
  imageError,
  onClose,
  onNavigate,
  onDownloadPhoto,
  onAddToFavorites,
  onImageError,
  onTouchStart,
  onTouchMove,
  onTouchEnd
}: PhotoViewerProps) {
  return (
    <div
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <button
        className="absolute top-4 right-4 p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors z-10"
        onClick={onClose}
      >
        <Icon name="X" size={24} className="text-white" />
      </button>
      
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 z-10">
        <p className="text-white text-sm text-center">
          {gallery.photos.findIndex(p => p.id === selectedPhoto.id)! + 1} из {gallery.photos.length}
        </p>
      </div>
      
      <div className="absolute top-16 left-4 bg-white/10 backdrop-blur-sm rounded-lg px-4 py-2 z-10 max-w-[calc(100%-2rem)]">
        <p className="text-white text-xs truncate">{selectedPhoto.file_name}</p>
      </div>

      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors z-10"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate('prev');
        }}
      >
        <Icon name="ChevronLeft" size={32} className="text-white" />
      </button>

      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 backdrop-blur-sm rounded-full hover:bg-white/20 transition-colors z-10"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate('next');
        }}
      >
        <Icon name="ChevronRight" size={32} className="text-white" />
      </button>
      
      {imageError ? (
        <div className="text-center text-white px-4">
          <Icon name="FileWarning" size={64} className="mx-auto mb-4" />
          <p className="text-lg mb-2">CR2/RAW файлы не поддерживаются</p>
          <p className="text-sm text-gray-300 mb-6">Браузер не может отобразить этот формат</p>
          {!gallery.download_disabled && (
            <button
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                onDownloadPhoto(selectedPhoto);
              }}
            >
              <Icon name="Download" size={20} />
              Скачать файл
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <img
              src={selectedPhoto.photo_url}
              alt={selectedPhoto.file_name}
              className="max-w-[95vw] max-h-[95vh] object-contain"
              onError={onImageError}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => gallery.screenshot_protection && e.preventDefault()}
              draggable={false}
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
                          fontSize: `${gallery.watermark.size * 2}px`,
                          textShadow: '3px 3px 6px rgba(0,0,0,0.9)',
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
                          maxWidth: `${gallery.watermark.size * 2}px`,
                          maxHeight: `${gallery.watermark.size * 2}px`,
                          transform: `rotate(${gallery.watermark.rotation || 0}deg)`
                        }}
                      />
                    )}
                  </div>
                );
              }
              
              return watermarks;
            })()}
          </div>
          <div className="absolute bottom-4 right-4 flex gap-3 z-10">
            <button
              className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-yellow-500 hover:scale-110 transition-all shadow-lg group/btn"
              onClick={(e) => {
                e.stopPropagation();
                onAddToFavorites(selectedPhoto);
              }}
              title="Добавить в избранное"
            >
              <Icon name="Star" size={20} className="text-white" />
            </button>
            {!gallery.download_disabled && (
              <button
                className="flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadPhoto(selectedPhoto);
                }}
              >
                <Icon name="Download" size={20} />
                Скачать
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}