import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Photo, PageDesignSettings } from './types';

interface CoverPreviewDesktopProps {
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
  coverPhoto: Photo | null;
  folderName: string;
}

export default function CoverPreviewDesktop({
  settings,
  onSettingsChange,
  coverPhoto,
  folderName,
}: CoverPreviewDesktopProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(settings.coverTitle || '');
  const coverImageRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const coverUrl = coverPhoto?.thumbnail_url || coverPhoto?.photo_url;
  const isVertical = settings.coverOrientation === 'vertical';

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

  if (!coverUrl) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Обложка проекта
        </h3>
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
          <span className="text-sm">Нет фото в папке</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Обложка проекта
      </h3>
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
    </div>
  );
}
