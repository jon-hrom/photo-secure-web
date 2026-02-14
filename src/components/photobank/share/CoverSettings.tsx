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
  bgTheme: 'light' | 'dark' | 'auto' | 'custom';
  bgColor: string | null;
  bgImageUrl: string | null;
  bgImageData: string | null;
  bgImageExt: string;
  textColor: string | null;
  coverTextPosition: 'bottom-center' | 'center' | 'bottom-left' | 'bottom-right' | 'top-center';
  coverTitle: string | null;
  coverFontSize: number;
}

interface CoverSettingsProps {
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
  photos: Photo[];
  folderName: string;
  extractDominantColor: (photo: Photo) => Promise<string>;
}

export default function CoverSettings({
  settings,
  onSettingsChange,
  photos,
  folderName,
  extractDominantColor
}: CoverSettingsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(settings.coverTitle || '');
  const coverImageRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const coverPhoto = photos.find(p => p.id === settings.coverPhotoId) || photos[0] || null;
  const coverUrl = coverPhoto?.thumbnail_url || coverPhoto?.photo_url;
  const isVertical = settings.coverOrientation === 'vertical';

  const handleSelectCoverPhoto = (photoId: number) => {
    onSettingsChange({ ...settings, coverPhotoId: photoId });
    if (settings.bgTheme === 'auto') {
      const photo = photos.find(p => p.id === photoId);
      if (photo) {
        extractDominantColor(photo).then(color => {
          onSettingsChange({ ...settings, coverPhotoId: photoId, bgColor: color });
        });
      }
    }
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

  return (
    <>
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
              <div className={`absolute inset-0 flex flex-col pointer-events-none p-3 ${
                settings.coverTextPosition === 'center' ? 'items-center justify-center text-center' :
                settings.coverTextPosition === 'top-center' ? 'items-center justify-start text-center pt-4' :
                settings.coverTextPosition === 'bottom-left' ? 'items-start justify-end' :
                settings.coverTextPosition === 'bottom-right' ? 'items-end justify-end text-right' :
                'items-center justify-end text-center'
              }`}>
                <div className="pointer-events-auto flex items-center gap-1">
                  {isEditingTitle ? (
                    <input
                      ref={titleInputRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => {
                        setIsEditingTitle(false);
                        onSettingsChange({ ...settings, coverTitle: editTitle || null });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setIsEditingTitle(false);
                          onSettingsChange({ ...settings, coverTitle: editTitle || null });
                        }
                      }}
                      className="bg-black/40 backdrop-blur-sm text-white font-bold text-sm px-2 py-0.5 rounded border border-white/30 outline-none max-w-[200px]"
                      style={{ color: settings.textColor || '#ffffff', fontSize: `${Math.max(10, settings.coverFontSize * 0.45)}px` }}
                      autoFocus
                      placeholder={folderName}
                    />
                  ) : (
                    <>
                      <span
                        className="font-bold drop-shadow-lg truncate max-w-[180px]"
                        style={{
                          color: settings.textColor || '#ffffff',
                          fontSize: `${Math.max(10, settings.coverFontSize * 0.45)}px`
                        }}
                      >
                        {settings.coverTitle || folderName}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setEditTitle(settings.coverTitle || folderName);
                          setIsEditingTitle(true);
                          setTimeout(() => titleInputRef.current?.focus(), 50);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-5 h-5 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors"
                      >
                        <Icon name="Pencil" size={10} className="text-white" />
                      </button>
                    </>
                  )}
                </div>
              </div>
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Размер названия
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">{settings.coverFontSize}px</span>
        </div>
        <Slider
          value={[settings.coverFontSize]}
          onValueChange={(v) => onSettingsChange({ ...settings, coverFontSize: v[0] })}
          min={16}
          max={72}
          step={2}
        />
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">16px</span>
          <span className="text-xs text-gray-400">72px</span>
        </div>
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
          Положение названия на обложке
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {([
            { key: 'top-center' as const, label: 'Сверху', dotPos: 'top-1.5 left-1/2 -translate-x-1/2' },
            { key: 'center' as const, label: 'Центр', dotPos: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' },
            { key: 'bottom-left' as const, label: 'Лево', dotPos: 'bottom-1.5 left-2' },
            { key: 'bottom-center' as const, label: 'Низ', dotPos: 'bottom-1.5 left-1/2 -translate-x-1/2' },
            { key: 'bottom-right' as const, label: 'Право', dotPos: 'bottom-1.5 right-2' },
          ]).map(pos => (
            <button
              key={pos.key}
              onClick={() => onSettingsChange({ ...settings, coverTextPosition: pos.key })}
              className={`relative p-2 rounded-lg border-2 transition-all ${
                settings.coverTextPosition === pos.key
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="relative w-full aspect-video bg-gray-200 dark:bg-gray-700 rounded mb-1">
                <div className={`absolute w-3 h-1 bg-gray-500 rounded-full ${pos.dotPos}`} />
              </div>
              <span className="text-[9px] font-medium text-gray-600 dark:text-gray-400">{pos.label}</span>
              {settings.coverTextPosition === pos.key && (
                <div className="absolute top-1 right-1 w-3 h-3 bg-blue-500 rounded-full flex items-center justify-center">
                  <Icon name="Check" size={7} className="text-white" />
                </div>
              )}
            </button>
          ))}
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
    </>
  );
}
