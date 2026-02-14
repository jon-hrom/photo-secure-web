import { useState } from 'react';
import Icon from '@/components/ui/icon';

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

interface Photo {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
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

interface BackgroundSettingsProps {
  settings: PageDesignSettings;
  onSettingsChange: (settings: PageDesignSettings) => void;
  photos: Photo[];
  extractDominantColor: (photo: Photo) => Promise<string>;
}

export default function BackgroundSettings({
  settings,
  onSettingsChange,
  photos,
  extractDominantColor
}: BackgroundSettingsProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState(settings.bgColor || '#1a1a2e');
  const [customTextColor, setCustomTextColor] = useState(settings.textColor || '#ffffff');
  const bgImageInputRef = (document.getElementById('bg-image-input') as HTMLInputElement) || null;

  const handleThemeChange = (theme: 'light' | 'dark' | 'auto' | 'custom') => {
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
    } else if (theme === 'auto') {
      updates.bgImageUrl = null;
      updates.bgImageData = null;
      updates.textColor = null;
      const targetPhoto = photos.find(p => p.id === settings.coverPhotoId) || photos[0];
      if (targetPhoto) {
        extractDominantColor(targetPhoto).then(color => {
          onSettingsChange({ ...settings, bgTheme: 'auto', bgColor: color, bgImageUrl: null, bgImageData: null, textColor: null });
        });
        return;
      }
      updates.bgColor = '#2d2d3a';
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

  return (
    <>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Фон галереи
        </h3>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {([
            { key: 'auto' as const, label: 'Авто', icon: 'Wand2', iconColor: 'text-purple-400',
              bgStyle: { background: settings.bgTheme === 'auto' && settings.bgColor ? settings.bgColor : 'linear-gradient(135deg, #2d2d3a 0%, #4a3f5c 100%)' } },
            { key: 'light' as const, label: 'Светлый', icon: 'Sun', iconColor: 'text-yellow-500',
              bgStyle: { background: '#f3f4f6', border: '1px solid #e5e7eb' } },
            { key: 'dark' as const, label: 'Тёмный', icon: 'Moon', iconColor: 'text-blue-300',
              bgStyle: { background: '#111827', border: '1px solid #374151' } },
            { key: 'custom' as const, label: 'Свой', icon: 'Palette', iconColor: 'text-white drop-shadow',
              bgStyle: { background: (settings.bgTheme === 'custom' && settings.bgColor) || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' } },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => handleThemeChange(t.key)}
              className={`relative p-2 rounded-lg border-2 transition-all ${
                settings.bgTheme === t.key
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="w-full aspect-square rounded mb-1.5 flex items-center justify-center overflow-hidden" style={t.bgStyle}>
                <Icon name={t.icon} size={16} className={t.iconColor} />
              </div>
              <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">{t.label}</span>
              {settings.bgTheme === t.key && (
                <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center">
                  <Icon name="Check" size={8} className="text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        {settings.bgTheme === 'auto' && settings.bgColor && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'rgba(128,128,128,0.1)' }}>
            <div className="w-6 h-6 rounded border border-gray-300 flex-shrink-0" style={{ background: settings.bgColor }} />
            <p className="text-xs text-gray-500 dark:text-gray-400 flex-1">
              Цвет определён из фото: <span className="font-mono">{settings.bgColor}</span>
            </p>
          </div>
        )}

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
                id="bg-image-input"
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
                  onClick={() => (document.getElementById('bg-image-input') as HTMLInputElement)?.click()}
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
    </>
  );
}
