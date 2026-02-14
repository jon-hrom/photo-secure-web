import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface PageDesignSettings {
  coverPhotoId: number | null;
  coverOrientation: 'horizontal' | 'vertical';
  coverFocusX: number;
  coverFocusY: number;
  gridGap: number;
}

interface PageDesignTabProps {
  folderId: number;
  folderName: string;
  userId: number;
  photos: Photo[];
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
}

export default function PageDesignTab({ 
  folderId,
  folderName,
  userId,
  photos,
  settings, 
  onSettingsChange 
}: PageDesignTabProps) {
  const [isDragging, setIsDragging] = useState(false);
  const coverImageRef = useRef<HTMLDivElement>(null);

  const coverPhoto = photos.find(p => p.id === settings.coverPhotoId) || photos[0] || null;

  const handleSelectCoverPhoto = (photoId: number) => {
    onSettingsChange({ ...settings, coverPhotoId: photoId });
  };

  const handleOrientationChange = (orientation: 'horizontal' | 'vertical') => {
    onSettingsChange({ ...settings, coverOrientation: orientation });
  };

  const handleGridGapChange = (value: number[]) => {
    onSettingsChange({ ...settings, gridGap: value[0] });
  };

  const handleFocusPointDrag = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!coverImageRef.current) return;
    const rect = coverImageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onSettingsChange({ ...settings, coverFocusX: x, coverFocusY: y });
  }, [settings, onSettingsChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleFocusPointDrag(e);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => handleFocusPointDrag(e);
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, handleFocusPointDrag]);

  const scrollToPhotos = () => {
    const el = document.getElementById('preview-photo-grid');
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  const coverUrl = coverPhoto?.thumbnail_url || coverPhoto?.photo_url;
  const isVertical = settings.coverOrientation === 'vertical';

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Обложка проекта
          </h3>
          {coverUrl ? (
            <div className="relative">
              <div
                ref={coverImageRef}
                className="relative overflow-hidden rounded-lg cursor-crosshair select-none"
                style={{ 
                  maxHeight: 200,
                  aspectRatio: isVertical ? '9/16' : '16/9'
                }}
                onMouseDown={handleMouseDown}
              >
                <img
                  src={coverUrl}
                  alt="cover"
                  className="w-full h-full object-cover pointer-events-none"
                  style={{
                    objectPosition: `${settings.coverFocusX * 100}% ${settings.coverFocusY * 100}%`
                  }}
                  draggable={false}
                />
                <div
                  className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
                  style={{
                    left: `${settings.coverFocusX * 100}%`,
                    top: `${settings.coverFocusY * 100}%`
                  }}
                >
                  <div className="w-6 h-6 rounded-full border-2 border-white shadow-lg bg-blue-500/60 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Перетащите точку для выбора центра кадра
              </p>
            </div>
          ) : (
            <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
              <span className="text-sm">Нет фото в папке</span>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Ориентация обложки
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleOrientationChange('horizontal')}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                !isVertical
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="w-full aspect-video bg-gray-200 dark:bg-gray-700 rounded mb-2 flex items-center justify-center">
                <Icon name="Image" size={20} className="text-gray-400" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Горизонтальная</span>
              {!isVertical && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <Icon name="Check" size={12} className="text-white" />
                  </div>
                </div>
              )}
            </button>
            <button
              onClick={() => handleOrientationChange('vertical')}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                isVertical
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="w-1/2 mx-auto aspect-[9/16] bg-gray-200 dark:bg-gray-700 rounded mb-2 flex items-center justify-center">
                <Icon name="Image" size={16} className="text-gray-400" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Вертикальная</span>
              {isVertical && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                    <Icon name="Check" size={12} className="text-white" />
                  </div>
                </div>
              )}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Выбрать фото для обложки
          </h3>
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
            {photos.filter(p => !p.file_name?.toLowerCase().endsWith('.mp4')).map(photo => (
              <button
                key={photo.id}
                onClick={() => handleSelectCoverPhoto(photo.id)}
                className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${
                  settings.coverPhotoId === photo.id
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-transparent hover:border-gray-300'
                }`}
              >
                <img
                  src={photo.thumbnail_url || photo.photo_url}
                  alt={photo.file_name}
                  className="w-full h-full object-cover"
                />
                {settings.coverPhotoId === photo.id && (
                  <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Icon name="Check" size={10} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Отступ между фото в сетке
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">{settings.gridGap}px</span>
          </div>
          <Slider
            value={[settings.gridGap]}
            onValueChange={handleGridGapChange}
            min={0}
            max={24}
            step={1}
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">0px</span>
            <span className="text-xs text-gray-400">24px</span>
          </div>
        </div>
      </div>

      <div className="lg:w-[280px] flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 text-center">
          Предпросмотр
        </h3>
        <div className="mx-auto" style={{ maxWidth: 260 }}>
          <div className="relative rounded-[24px] border-[3px] border-gray-800 dark:border-gray-600 bg-black overflow-hidden shadow-xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-20" />
            
            <div className="bg-gray-50 overflow-y-auto" style={{ height: 480 }}>
              {coverUrl ? (
                <div className="relative" style={{ 
                  height: isVertical ? 380 : 180,
                  overflow: 'hidden'
                }}>
                  <img
                    src={coverUrl}
                    alt="preview cover"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${settings.coverFocusX * 100}% ${settings.coverFocusY * 100}%`
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <h2 className="font-bold text-sm leading-tight">{folderName}</h2>
                    <button
                      onClick={scrollToPhotos}
                      className="flex items-center gap-1 mt-1 text-[9px] text-white/80 hover:text-white transition-colors"
                    >
                      Просмотр фото
                      <Icon name="ChevronDown" size={10} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-32 bg-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-400">{folderName}</span>
                </div>
              )}

              <div id="preview-photo-grid" className="p-2">
                <div 
                  className="columns-2"
                  style={{ gap: `${Math.max(1, settings.gridGap / 3)}px` }}
                >
                  {photos.slice(0, 8).map(photo => (
                    <div
                      key={photo.id}
                      className="rounded-sm overflow-hidden bg-gray-200 break-inside-avoid"
                      style={{ marginBottom: `${Math.max(1, settings.gridGap / 3)}px` }}
                    >
                      <img
                        src={photo.thumbnail_url || photo.photo_url}
                        alt=""
                        className="w-full h-auto"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}