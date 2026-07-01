import { memo } from 'react';
import Icon from '@/components/ui/icon';
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
        {photos.filter(p => !p.file_name?.toLowerCase().endsWith('.mp4')).map(photo => {
          const isSelected = selectedPhotoId === photo.id;
          // В мелкую плитку грузим только миниатюру. Полноразмерный оригинал
          // (особенно RAW/.CR2) не подставляем — он тяжёлый и не рендерится как картинка.
          const isRaw = /\.(cr2|cr3|nef|arw|dng|orf|rw2|raw|raf)$/i.test(photo.file_name || '');
          const thumbSrc = photo.thumbnail_url || (isRaw ? '' : photo.photo_url);
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
                  <Icon name="Image" size={16} />
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