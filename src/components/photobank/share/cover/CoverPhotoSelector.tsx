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

export default function CoverPhotoSelector({
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
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        {title}
      </h3>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {subtitle}
        </p>
      )}
      <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
        {photos.filter(p => !p.file_name?.toLowerCase().endsWith('.mp4')).map(photo => {
          const w = photo.width || 1;
          const h = photo.height || 1;
          const ratio = w / h;
          const thumbHeight = 80;
          const thumbWidth = Math.round(thumbHeight * ratio);
          const isSelected = selectedPhotoId === photo.id;
          return (
            <button
              key={photo.id}
              onClick={() => onSelect(photo.id)}
              className={`relative rounded-md overflow-hidden border-2 transition-all flex-shrink-0 ${
                isSelected
                  ? `${colorClasses.border} ring-2 ${colorClasses.ring}`
                  : 'border-transparent hover:border-gray-300'
              }`}
              style={{ width: thumbWidth, height: thumbHeight }}
            >
              <img
                src={photo.thumbnail_url || photo.photo_url}
                alt={photo.file_name}
                className="w-full h-full object-cover"
              />
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
