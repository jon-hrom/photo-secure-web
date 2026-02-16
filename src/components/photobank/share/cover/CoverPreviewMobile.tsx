import { useState, useEffect, useRef, useCallback } from 'react';
import { Photo, PageDesignSettings } from './types';

interface CoverPreviewMobileProps {
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
  mobileCoverPhoto: Photo | null;
  folderName: string;
}

export default function CoverPreviewMobile({
  settings,
  onSettingsChange,
  mobileCoverPhoto,
  folderName,
}: CoverPreviewMobileProps) {
  const [isMobileDragging, setIsMobileDragging] = useState(false);
  const mobileCoverImageRef = useRef<HTMLDivElement>(null);

  const mobileCoverUrl = mobileCoverPhoto?.thumbnail_url || mobileCoverPhoto?.photo_url;

  const handleMobileFocusDrag = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!mobileCoverImageRef.current) return;
    const rect = mobileCoverImageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onSettingsChange({ ...settings, mobileCoverFocusX: x, mobileCoverFocusY: y });
  }, [settings, onSettingsChange]);

  const handleMobileMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsMobileDragging(true);
    handleMobileFocusDrag(e);
  };

  useEffect(() => {
    if (!isMobileDragging) return;
    const handleMove = (e: MouseEvent) => handleMobileFocusDrag(e);
    const handleUp = () => setIsMobileDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isMobileDragging, handleMobileFocusDrag]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Обложка проекта mobile
      </h3>
      {mobileCoverUrl ? (
        <div className="relative">
          <div
            ref={mobileCoverImageRef}
            className="relative overflow-hidden rounded-lg cursor-crosshair select-none mx-auto"
            style={{ 
              maxHeight: 240,
              width: 135,
              aspectRatio: '9/16'
            }}
            onMouseDown={handleMobileMouseDown}
          >
            <img
              src={mobileCoverUrl}
              alt="mobile cover"
              className="w-full h-full object-cover pointer-events-none"
              style={{
                objectPosition: `${settings.mobileCoverFocusX * 100}% ${settings.mobileCoverFocusY * 100}%`
              }}
              draggable={false}
            />
            <div
              className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
              style={{
                left: `${settings.mobileCoverFocusX * 100}%`,
                top: `${settings.mobileCoverFocusY * 100}%`
              }}
            >
              <div className="w-6 h-6 rounded-full border-2 border-white shadow-lg bg-blue-500/60 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
              <span
                className="font-bold drop-shadow-lg truncate max-w-[110px] text-center"
                style={{
                  color: settings.textColor || '#ffffff',
                  fontSize: `${Math.max(8, settings.coverFontSize * 0.3)}px`
                }}
              >
                {settings.coverTitle || folderName}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Перетащите точку для выбора центра кадра на мобильных
          </p>
          {settings.mobileCoverPhotoId && settings.mobileCoverPhotoId !== settings.coverPhotoId && (
            <button
              onClick={() => onSettingsChange({ ...settings, mobileCoverPhotoId: null, mobileCoverFocusX: 0.5, mobileCoverFocusY: 0.5 })}
              className="mt-2 text-xs text-red-500 hover:text-red-600 mx-auto block"
            >
              Сбросить (использовать web-обложку)
            </button>
          )}
        </div>
      ) : (
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 mx-auto" style={{ width: 135 }}>
          <span className="text-sm text-center px-2">Нет фото в папке</span>
        </div>
      )}
    </div>
  );
}
