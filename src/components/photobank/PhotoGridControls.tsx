import Icon from '@/components/ui/icon';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';

interface Photo {
  id: number;
  file_name: string;
  data_url?: string;
  s3_url?: string;
  s3_key?: string;
  thumbnail_s3_url?: string;
  is_raw?: boolean;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
  photo_download_count?: number;
}

interface PhotoGridControlsProps {
  viewPhoto: Photo;
  photos: Photo[];
  zoom: number;
  isLandscape: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onResetZoom: () => void;
  onDownload: (s3Key: string, fileName: string, userId: number) => Promise<void>;
  onShowExif: () => void;
  onCopyFileName?: () => void;
  downloadDisabled?: boolean;
}

const PhotoGridControls = ({
  viewPhoto,
  photos,
  zoom,
  isLandscape,
  onClose,
  onNavigate,
  onResetZoom,
  onDownload,
  onShowExif,
  onCopyFileName,
  downloadDisabled = false
}: PhotoGridControlsProps) => {
  const currentPhotoIndex = photos.findIndex(p => p.id === viewPhoto.id);
  const hasPrev = currentPhotoIndex > 0;
  const hasNext = currentPhotoIndex >= 0 && currentPhotoIndex < photos.length - 1;

  return (
    <>
      {!isLandscape && (
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-50">
          <div className="flex items-center gap-2">
            <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full">
              {currentPhotoIndex + 1} / {photos.length}
            </div>
            <div 
              className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full max-w-xs truncate cursor-pointer hover:bg-black/40 transition-colors"
              onClick={onCopyFileName}
              title="Нажмите, чтобы скопировать"
            >
              {viewPhoto.file_name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-white/80 text-sm bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2">
              <span>{zoom === 0 ? '100%' : `${Math.round((1 + zoom) * 100)}%`}</span>
              {zoom >= 2.0 && !viewPhoto.is_raw && (
                <span className="text-xs font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">HD</span>
              )}
            </div>
            {!downloadDisabled && (
              <button
                onClick={async () => {
                  if (viewPhoto.s3_key) {
                    const userIdStr = getAuthUserId();
                    const userId = userIdStr ? parseInt(userIdStr, 10) : 0;
                    if (userId) {
                      await onDownload(viewPhoto.s3_key, viewPhoto.file_name, userId);
                    }
                  }
                }}
                className="h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 gap-2 px-2.5 hover:scale-110 active:scale-95"
                title={`Скачать фото${(viewPhoto.photo_download_count ?? 0) > 0 ? ` (скачиваний клиентами: ${viewPhoto.photo_download_count})` : ''}`}
              >
                <Icon name="Download" size={16} className="text-white" />
                {(viewPhoto.photo_download_count ?? 0) > 0 && (
                  <span className="text-emerald-400 text-xs font-medium">{viewPhoto.photo_download_count}</span>
                )}
              </button>
            )}
            <button
              onClick={onShowExif}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
              title="Информация о фото"
            >
              <Icon name="Info" size={16} className="text-white" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
            >
              <Icon name="X" size={18} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {isLandscape && (
        <>
          <div 
            className="absolute top-2 left-2 z-50 text-white/80 text-xs bg-black/30 backdrop-blur-sm px-2 py-1 rounded cursor-pointer hover:bg-black/40 transition-colors max-w-[60%] truncate"
            onClick={onCopyFileName}
            title="Нажмите, чтобы скопировать"
          >
            {viewPhoto.file_name}
          </div>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-50 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <Icon name="X" size={16} className="text-white" />
          </button>
        </>
      )}

      {hasPrev && (
        <button
          onClick={() => { onNavigate('prev'); onResetZoom(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <Icon name="ChevronLeft" size={24} className="text-white" />
        </button>
      )}

      {hasNext && (
        <button
          onClick={() => { onNavigate('next'); onResetZoom(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-50 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        >
          <Icon name="ChevronRight" size={24} className="text-white" />
        </button>
      )}
    </>
  );
};

export default PhotoGridControls;