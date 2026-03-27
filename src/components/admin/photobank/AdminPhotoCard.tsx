import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useState, useEffect, type CSSProperties } from 'react';
import { extractDominantColor } from '@/utils/dominantColor';
import type { Photo } from './types';
import { formatBytes } from './types';

type FrameMode = 'none' | 'theme' | 'adaptive';

interface AdminPhotoCardProps {
  photo: Photo;
  isSelected: boolean;
  onToggleSelection: (photoId: number, e: React.MouseEvent) => void;
  onViewPhoto: (photo: Photo) => void;
  frameMode: FrameMode;
  getFrameStyle: (dominantColor?: string) => CSSProperties;
}

const AdminPhotoCard = ({
  photo,
  isSelected,
  onToggleSelection,
  onViewPhoto,
  frameMode,
  getFrameStyle,
}: AdminPhotoCardProps) => {
  const [dominantColor, setDominantColor] = useState<string | undefined>();

  useEffect(() => {
    if (frameMode !== 'adaptive') return;
    const imgUrl = photo.thumbnail_s3_url || photo.s3_url;
    if (!imgUrl) return;
    extractDominantColor(imgUrl).then(setDominantColor);
  }, [frameMode, photo.thumbnail_s3_url, photo.s3_url]);

  const frameStyle = frameMode !== 'none' ? getFrameStyle(dominantColor) : {};
  const hasFrame = frameMode !== 'none';

  return (
    <div className="flex flex-col">
      <div
        className={`transition-all ${hasFrame ? 'rounded-xl' : ''}`}
        style={hasFrame ? { ...frameStyle, borderRadius: 12 } : undefined}
      >
        <div
          className={`relative bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden cursor-pointer group transition-all aspect-[4/5] border ${
            isSelected
              ? 'ring-2 ring-red-500 border-red-400'
              : hasFrame
              ? 'border-transparent'
              : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
          }`}
          onClick={() => onViewPhoto(photo)}
        >
          <div className="w-full h-full flex items-center justify-center p-1">
            {photo.is_video ? (
              <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded">
                <Icon name="Play" size={32} className="text-white/70" />
              </div>
            ) : (
              <img
                src={photo.thumbnail_s3_url || photo.s3_url || ''}
                alt={photo.file_name}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
              />
            )}
          </div>
          {photo.is_raw && (
            <span className="absolute top-1 right-1 text-[9px] bg-orange-500 text-white px-1 rounded">RAW</span>
          )}
          {photo.tech_reject_reason && (
            <span className="absolute top-1 left-7">
              <Icon name="AlertTriangle" size={14} className="text-red-500 drop-shadow" />
            </span>
          )}
          <div
            className={`absolute top-1 left-1 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            onClick={(e) => onToggleSelection(photo.id, e)}
          >
            <Checkbox
              checked={isSelected}
              className="h-5 w-5 bg-white/80 border-gray-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
            />
          </div>
          {(photo.photo_download_count ?? 0) > 0 && (
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-emerald-600/90 flex items-center gap-1">
              <Icon name="Download" size={10} className="text-white" />
              <span className="text-white text-[10px] font-medium">{photo.photo_download_count}</span>
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 px-0.5 truncate" title={photo.file_name}>
        {photo.file_name}
      </p>
      <p className="text-[10px] text-muted-foreground/70 px-0.5">
        {formatBytes(photo.file_size)}
        {photo.width && photo.height ? ` • ${photo.width}×${photo.height}` : ''}
      </p>
    </div>
  );
};

export default AdminPhotoCard;
