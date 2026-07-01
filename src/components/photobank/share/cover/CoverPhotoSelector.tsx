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
          return (
            <button
              key={photo.id}
              onClick={() => onSelect(photo.id)}
              className={`relative rounded-md overflow-hidden border-2 aspect-square ${
                isSelected
                  ? `${colorClasses.border} ring-2 ${colorClasses.ring}`
                  : 'border-transparent hover:border-gray-300'
              }`}
            >
              <img
                src={photo.thumbnail_url || photo.photo_url}
                alt={photo.file_name}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
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