import Icon from '@/components/ui/icon';
import PhotoGridViewer from '../PhotoGridViewer';
import type { ClientData, Photo } from './useFavoritesData';

interface FavoritesPhotoViewerProps {
  selectedPhoto: Photo;
  selectedClient: ClientData;
  allPhotos: Photo[];
  onClose: () => void;
  onDownload: (photo: Photo) => void;
  onNavigate: (direction: 'prev' | 'next') => void;
}

export default function FavoritesPhotoViewer({
  selectedPhoto,
  selectedClient,
  allPhotos,
  onClose,
  onDownload,
  onNavigate
}: FavoritesPhotoViewerProps) {
  const displayPhotos = selectedClient.photos
    .map(fp => allPhotos.find(p => p.id === fp.photo_id))
    .filter((p): p is Photo => p !== undefined);
  
  const currentIndex = displayPhotos.findIndex(p => p.id === selectedPhoto.id);
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < displayPhotos.length - 1;

  return (
    <PhotoGridViewer
      photos={displayPhotos}
      selectedPhoto={selectedPhoto}
      onClose={onClose}
      onPhotoSelect={() => {}}
      renderHeader={() => (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-white">
            {selectedClient.full_name}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => onDownload(selectedPhoto)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              title="Скачать фото"
            >
              <Icon name="Download" size={20} className="text-white" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Icon name="X" size={20} className="text-white" />
            </button>
          </div>
        </div>
      )}
      renderNavigation={() => (
        <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 pointer-events-none">
          <button
            onClick={() => onNavigate('prev')}
            disabled={!canGoPrev}
            className={`p-3 rounded-full bg-black/50 backdrop-blur-sm transition-all pointer-events-auto ${
              canGoPrev
                ? 'hover:bg-black/70 text-white'
                : 'opacity-30 cursor-not-allowed text-gray-500'
            }`}
          >
            <Icon name="ChevronLeft" size={24} />
          </button>
          <button
            onClick={() => onNavigate('next')}
            disabled={!canGoNext}
            className={`p-3 rounded-full bg-black/50 backdrop-blur-sm transition-all pointer-events-auto ${
              canGoNext
                ? 'hover:bg-black/70 text-white'
                : 'opacity-30 cursor-not-allowed text-gray-500'
            }`}
          >
            <Icon name="ChevronRight" size={24} />
          </button>
        </div>
      )}
    />
  );
}
