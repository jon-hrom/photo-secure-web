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
  bgTheme: 'light' | 'dark' | 'custom';
  bgColor: string | null;
  bgImageUrl: string | null;
  bgImageData: string | null;
  bgImageExt: string;
  textColor: string | null;
}

interface PageDesignTabProps {
  folderId: number;
  folderName: string;
  userId: number;
  photos: Photo[];
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
}

const PRESET_COLORS = [
  '#ffffff','#f8f9fa','#f1f3f5','#e9ecef','#dee2e6',
  '#1a1a2e','#16213e','#0f3460','#1b1b2f','#162447',
  '#fdf6e3','#faf3dd','#f0ead2','#e8d5b7','#ddb892',
  '#f8f0e3','#eae2d6','#d5c4a1','#b8a88a','#a69076',
  '#e8f5e9','#c8e6c9','#a5d6a7','#81c784','#66bb6a',
  '#e3f2fd','#bbdefb','#90caf9','#64b5f6','#42a5f5',
  '#fce4ec','#f8bbd0','#f48fb1','#f06292','#ec407a',
  '#f3e5f5','#e1bee7','#ce93d8','#ba68c8','#ab47bc',
];

const TEXT_COLORS = [
  '#ffffff','#f5f5f5','#e0e0e0','#bdbdbd','#9e9e9e',
  '#757575','#616161','#424242','#212121','#000000',
  '#ffeb3b','#ffc107','#ff9800','#ff5722','#e91e63',
];

export default function PageDesignTab({ 
  folderId,
  folderName,
  userId,
  photos,
  settings, 
  onSettingsChange 
}: PageDesignTabProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState(settings.bgColor || '#1a1a2e');
  const [customTextColor, setCustomTextColor] = useState(settings.textColor || '#ffffff');
  const coverImageRef = useRef<HTMLDivElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

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

  const handleThemeChange = (theme: 'light' | 'dark' | 'custom') => {
    const updates: Partial<PageDesignSettings> = { bgTheme: theme };
    if (theme === 'light') {
      updates.bgColor = null;
      updates.textColor = null;
      updates.bgImageUrl = null;
      updates.bgImageData = null;
    } else if (theme === 'dark') {
      updates.bgColor = null;
      updates.textColor = null;
      updates.bgImageUrl = null;
      updates.bgImageData = null;
    }
    onSettingsChange({ ...settings, ...updates });
  };

  const handleBgColorSelect = (color: string) => {
    onSettingsChange({ ...settings, bgTheme: 'custom', bgColor: color, bgImageUrl: null, bgImageData: null });
    setCustomColor(color);
  };

  const handleTextColorSelect = (color: string) => {
    onSettingsChange({ ...settings, textColor: color });
    setCustomTextColor(color);
  };

  const handleBgImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      onSettingsChange({
        ...settings,
        bgTheme: 'custom',
        bgImageData: base64,
        bgImageExt: ext,
        bgImageUrl: reader.result as string,
        bgColor: null
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveBgImage = () => {
    onSettingsChange({ ...settings, bgImageUrl: null, bgImageData: null });
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

  const getPreviewBg = (): React.CSSProperties => {
    if (settings.bgTheme === 'dark') return { background: '#1a1a2e' };
    if (settings.bgTheme === 'custom' && settings.bgImageUrl) {
      return {
        backgroundImage: `url(${settings.bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (settings.bgTheme === 'custom' && settings.bgColor) return { background: settings.bgColor };
    return { background: '#f8f9fa' };
  };

  const getPreviewTextColor = () => {
    if (settings.textColor) return settings.textColor;
    if (settings.bgTheme === 'dark') return '#ffffff';
    if (settings.bgTheme === 'custom' && settings.bgColor) {
      const hex = settings.bgColor.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return (r * 0.299 + g * 0.587 + b * 0.114) > 150 ? '#1a1a2e' : '#ffffff';
    }
    return '#1a1a2e';
  };

  const previewTextColor = getPreviewTextColor();
  const secondaryTextColor = previewTextColor === '#ffffff' || previewTextColor === '#f5f5f5' || previewTextColor === '#e0e0e0'
    ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 space-y-6 max-h-[65vh] overflow-y-auto pr-1">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Фон галереи
          </h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <button
              onClick={() => handleThemeChange('light')}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                settings.bgTheme === 'light'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="w-full aspect-square rounded bg-gray-100 border border-gray-200 mb-2 flex items-center justify-center">
                <Icon name="Sun" size={18} className="text-yellow-500" />
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Светлый</span>
              {settings.bgTheme === 'light' && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Icon name="Check" size={10} className="text-white" />
                </div>
              )}
            </button>
            <button
              onClick={() => handleThemeChange('dark')}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                settings.bgTheme === 'dark'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="w-full aspect-square rounded bg-gray-900 border border-gray-700 mb-2 flex items-center justify-center">
                <Icon name="Moon" size={18} className="text-blue-300" />
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Тёмный</span>
              {settings.bgTheme === 'dark' && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Icon name="Check" size={10} className="text-white" />
                </div>
              )}
            </button>
            <button
              onClick={() => handleThemeChange('custom')}
              className={`relative p-3 rounded-lg border-2 transition-all ${
                settings.bgTheme === 'custom'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="w-full aspect-square rounded mb-2 flex items-center justify-center overflow-hidden"
                style={{
                  background: settings.bgColor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
              >
                <Icon name="Palette" size={18} className="text-white drop-shadow" />
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Свой</span>
              {settings.bgTheme === 'custom' && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                  <Icon name="Check" size={10} className="text-white" />
                </div>
              )}
            </button>
          </div>

          {settings.bgTheme === 'custom' && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Цвет фона</p>
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="text-xs text-blue-500 hover:text-blue-600"
                  >
                    {showColorPicker ? 'Скрыть' : 'Показать палитру'}
                  </button>
                </div>
                {showColorPicker && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-10 gap-1">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => handleBgColorSelect(c)}
                          className={`w-6 h-6 rounded border transition-all ${
                            settings.bgColor === c ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : 'hover:scale-110'
                          }`}
                          style={{ background: c, borderColor: c === '#ffffff' ? '#e5e7eb' : 'transparent' }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={customColor}
                        onChange={(e) => {
                          setCustomColor(e.target.value);
                          handleBgColorSelect(e.target.value);
                        }}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={customColor}
                        onChange={(e) => {
                          setCustomColor(e.target.value);
                          if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                            handleBgColorSelect(e.target.value);
                          }
                        }}
                        className="flex-1 text-xs px-2 py-1.5 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Или своя картинка фона</p>
                <input
                  ref={bgImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleBgImageUpload}
                />
                {settings.bgImageUrl ? (
                  <div className="relative rounded-lg overflow-hidden">
                    <img src={settings.bgImageUrl} alt="bg" className="w-full h-24 object-cover rounded-lg" />
                    <button
                      onClick={handleRemoveBgImage}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                    >
                      <Icon name="X" size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => bgImageInputRef.current?.click()}
                    className="w-full h-20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
                  >
                    <Icon name="Upload" size={18} className="text-gray-400" />
                    <span className="text-xs text-gray-500">Загрузить картинку</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Цвет текста
            </h3>
            <button
              onClick={() => setShowTextColorPicker(!showTextColorPicker)}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              {showTextColorPicker ? 'Скрыть' : 'Настроить'}
            </button>
          </div>
          {showTextColorPicker && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {TEXT_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => handleTextColorSelect(c)}
                    className={`w-6 h-6 rounded border transition-all ${
                      settings.textColor === c ? 'ring-2 ring-blue-500 ring-offset-1 scale-110' : 'hover:scale-110'
                    }`}
                    style={{ background: c, borderColor: '#d1d5db' }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customTextColor}
                  onChange={(e) => {
                    setCustomTextColor(e.target.value);
                    handleTextColorSelect(e.target.value);
                  }}
                  className="w-8 h-8 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={customTextColor}
                  onChange={(e) => {
                    setCustomTextColor(e.target.value);
                    if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                      handleTextColorSelect(e.target.value);
                    }
                  }}
                  className="flex-1 text-xs px-2 py-1.5 border rounded-md dark:bg-gray-800 dark:border-gray-700"
                  placeholder="#ffffff"
                />
                <button
                  onClick={() => onSettingsChange({ ...settings, textColor: null })}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Авто
                </button>
              </div>
            </div>
          )}
        </div>

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
            
            <div className="overflow-y-auto" style={{ height: 480, ...getPreviewBg() }}>
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
                    <h2 className="font-bold text-sm leading-tight" style={{ color: settings.textColor || '#ffffff' }}>
                      {folderName}
                    </h2>
                    <button
                      onClick={scrollToPhotos}
                      className="flex items-center gap-1 mt-1 text-[9px] transition-colors"
                      style={{ color: settings.textColor ? `${settings.textColor}cc` : 'rgba(255,255,255,0.8)' }}
                    >
                      Просмотр фото
                      <Icon name="ChevronDown" size={10} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center" style={{ background: 'rgba(128,128,128,0.2)' }}>
                  <span className="text-xs" style={{ color: previewTextColor }}>{folderName}</span>
                </div>
              )}

              <div className="p-2">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div>
                    <p className="text-[9px] font-semibold" style={{ color: previewTextColor }}>{folderName}</p>
                    <p className="text-[8px]" style={{ color: secondaryTextColor }}>{photos.length} фото</p>
                  </div>
                </div>
              </div>

              <div id="preview-photo-grid" className="px-2 pb-2">
                <div 
                  className="columns-2"
                  style={{ gap: `${Math.max(1, settings.gridGap / 3)}px` }}
                >
                  {photos.slice(0, 8).map(photo => (
                    <div
                      key={photo.id}
                      className="rounded-sm overflow-hidden break-inside-avoid"
                      style={{ 
                        marginBottom: `${Math.max(1, settings.gridGap / 3)}px`,
                        background: 'rgba(128,128,128,0.2)'
                      }}
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
