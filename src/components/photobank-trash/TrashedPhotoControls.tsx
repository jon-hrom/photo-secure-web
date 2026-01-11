import Icon from '@/components/ui/icon';
import { TrashedPhoto } from './types';

interface TrashedPhotoControlsProps {
  viewPhoto: TrashedPhoto;
  photos: TrashedPhoto[];
  zoom: number;
  isLandscape: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onResetZoom: () => void;
}

const TrashedPhotoControls = ({
  viewPhoto,
  photos,
  zoom,
  isLandscape,
  onClose,
  onNavigate,
  onResetZoom
}: TrashedPhotoControlsProps) => {
  const currentPhotoIndex = photos.findIndex(p => p.id === viewPhoto.id);
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photos.length - 1;

  return (
    <>
      {!isLandscape && (
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-50">
          <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
            {currentPhotoIndex + 1} / {photos.length}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2">
              <span>{Math.round(zoom * 100)}%</span>
              {zoom >= 3.0 && (
                <span className="text-xs font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">HD</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
            >
              <Icon name="X" size={24} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {isLandscape && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
        >
          <Icon name="X" size={20} className="text-white" />
        </button>
      )}

      {hasPrev && (
        <button
          onClick={() => { onNavigate('prev'); onResetZoom(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
        >
          <Icon name="ChevronLeft" size={28} className="text-white" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={() => { onNavigate('next'); onResetZoom(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all"
        >
          <Icon name="ChevronRight" size={28} className="text-white" />
        </button>
      )}
    </>
  );
};

export default TrashedPhotoControls;
