import { memo } from 'react';
import Icon from '@/components/ui/icon';
import { getThumbUrl } from '@/utils/imageThumb';
import { Photo } from './types';

interface CoverPhotoSelectorProps {
  title: string;
  subtitle?: string;
  photos: Photo[];
  selectedPhotoId: number | null;
  onSelect: (photoId: number) => void;
  accentColor?: string;
}

function CoverPhotoSelector({
  title,
  subtitle,
  photos,
  selectedPhotoId,
  onSelect,
  accentColor = 'blue',
}: CoverPhotoSelectorProps) {
  const colorClasses = accentColor === 'green'
    ? { border: 'border-green-500', ring: 'ring-green-200', bg: 'bg-green-500' }
    : { border: 'border-blue-500', ring: 'ring-blue-200', bg: 'bg-blue-500' };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
        {title}
      </h3>
      <p className={`text-xs mb-2 min-h-[1rem] ${subtitle ? 'text-gray-500 dark:text-gray-400' : 'text-transparent select-none'}`}>
        {subtitle || '\u00A0'}
      </p>
      <div
        className="grid gap-2 max-h-56 overflow-y-auto pr-1"
        style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}
      >
        {photos.map(photo => {
          const isSelected = selectedPhotoId === photo.id;
          // В мелкую плитку грузим лёгкое превью (~150px), а не оригинал на 15+ МБ.
          // RAW/.CR2 не рендерятся как картинка — для них нужен готовый thumbnail.
          // Видео (.mp4) тоже нельзя рисовать как картинку — берём его постер.
          const isRaw = /\.(cr2|cr3|nef|arw|dng|orf|rw2|raw|raf)$/i.test(photo.file_name || '');
          const isVideo = photo.is_video || /\.(mp4|mov|webm|mkv|avi|m4v)$/i.test(photo.file_name || '');
          const source = photo.thumbnail_url || ((isRaw || isVideo) ? '' : photo.photo_url);
          const thumbSrc = source ? getThumbUrl(source, 150) : '';
          return (
            <button
              key={photo.id}
              onClick={() => onSelect(photo.id)}
              className={`relative rounded-md overflow-hidden border-2 aspect-square bg-gray-100 dark:bg-gray-800 ${
                isSelected
                  ? `${colorClasses.border} ring-2 ${colorClasses.ring}`
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              {thumbSrc ? (
                <img
                  src={thumbSrc}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Icon name={isVideo ? 'Video' : 'Image'} size={16} />
                </div>
              )}
              {isVideo && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-6 h-6 rounded-full bg-black/50 flex items-center justify-center">
                    <Icon name="Play" size={12} className="text-white" />
                  </div>
                </div>
              )}
              {isSelected && (
                <div className={`absolute top-1 right-1 w-4 h-4 ${colorClasses.bg} rounded-full flex items-center justify-center`}>
                  <Icon name="Check" size={10} className="text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// memo: галерея из десятков миниатюр не должна перерисовываться при
// перетаскивании точки центра кадра или автосохранении — только когда реально
// меняются список фото или выбранное фото.
export default memo(CoverPhotoSelector);