import { useRef, useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const WATERMARK_UPLOAD_URL = 'https://functions.poehali.dev/74fcfd0b-6b2e-459a-9f6d-0ea541a586d5';

interface SavedLogo { id: number; url: string; created_at: string; }

interface LinkSettings {
  password: string;
  downloadDisabled: boolean;
  expiresIn: string;
  customDate: string;
  watermarkEnabled: boolean;
  watermarkType: string;
  watermarkText: string;
  watermarkImageUrl: string;
  watermarkFrequency: number;
  watermarkSize: number;
  watermarkOpacity: number;
  watermarkRotation: number;
  screenshotProtection: boolean;
}

interface LinkSettingsFormProps {
  linkSettings: LinkSettings;
  setLinkSettings: (settings: LinkSettings) => void;
  loading: boolean;
  error: string;
  onGenerateLink: () => void;
  userId: number;
}

export default function LinkSettingsForm({ 
  linkSettings, 
  setLinkSettings, 
  loading, 
  error, 
  onGenerateLink,
  userId,
}: LinkSettingsFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savedLogos, setSavedLogos] = useState<SavedLogo[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadLogos = useCallback(async () => {
    const res = await fetch(WATERMARK_UPLOAD_URL, {
      headers: { 'X-User-Id': String(userId) },
    });
    const data = await res.json();
    if (data.logos) setSavedLogos(data.logos);
  }, [userId]);

  useEffect(() => {
    if (linkSettings.watermarkEnabled && linkSettings.watermarkType === 'image') {
      loadLogos();
    }
  }, [linkSettings.watermarkEnabled, linkSettings.watermarkType, loadLogos]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Сбрасываем input чтобы можно было загрузить тот же файл повторно
    e.target.value = '';
    setUploadingLogo(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch(WATERMARK_UPLOAD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
          body: JSON.stringify({ file_data: base64, content_type: file.type }),
        });
        const data = await res.json();
        if (data.logo) {
          setSavedLogos(prev => [data.logo, ...prev]);
          setLinkSettings({ ...linkSettings, watermarkImageUrl: data.logo.url });
        }
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadingLogo(false);
    }
  };

  const handleDeleteLogo = async (logo: SavedLogo) => {
    setDeletingId(logo.id);
    await fetch(WATERMARK_UPLOAD_URL, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
      body: JSON.stringify({ id: logo.id }),
    });
    setSavedLogos(prev => prev.filter(l => l.id !== logo.id));
    if (linkSettings.watermarkImageUrl === logo.url) {
      setLinkSettings({ ...linkSettings, watermarkImageUrl: '' });
    }
    setDeletingId(null);
  };

  return (
    <>
      <div className="space-y-4 border-t dark:border-gray-800 pt-4">
        <div className="flex items-start gap-3">
          <Icon name="Eye" size={20} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white">Просмотр</p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              Просматривать смогут все, у кого есть ссылка
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Icon name="Shield" size={20} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white">Пароль</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">От 4 символов</p>
            </div>
          </div>
          <input
            type="text"
            placeholder="Готово"
            value={linkSettings.password}
            onChange={(e) => setLinkSettings({ ...linkSettings, password: e.target.value })}
            className="w-full sm:w-32 px-3 py-2 border dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#FFB800] focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Icon name="Download" size={20} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 dark:text-white">Запретить скачивание</p>
            </div>
          </div>
          <Switch
            checked={linkSettings.downloadDisabled}
            onCheckedChange={(checked) => setLinkSettings({ ...linkSettings, downloadDisabled: checked })}
            className="flex-shrink-0"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Icon name="Calendar" size={20} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
            <p className="font-medium text-gray-900 dark:text-white">Срок действия ссылки</p>
          </div>
          
          <Select value={linkSettings.expiresIn} onValueChange={(value) => setLinkSettings({ ...linkSettings, expiresIn: value })}>
            <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
              <SelectItem value="forever" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Бессрочно</SelectItem>
              <SelectItem value="day" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Сутки</SelectItem>
              <SelectItem value="week" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Неделя</SelectItem>
              <SelectItem value="month" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Месяц</SelectItem>
              <SelectItem value="custom" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Выбрать дату и время</SelectItem>
            </SelectContent>
          </Select>

          {linkSettings.expiresIn === 'custom' && (
            <input
              type="datetime-local"
              value={linkSettings.customDate}
              onChange={(e) => setLinkSettings({ ...linkSettings, customDate: e.target.value })}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#FFB800] focus:border-transparent transition-all"
            />
          )}
        </div>

        <div className="space-y-4 border-t dark:border-gray-800 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Icon name="Droplet" size={20} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white">Водяной знак</p>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Защита от копирования</p>
              </div>
            </div>
            <Switch
              checked={linkSettings.watermarkEnabled}
              onCheckedChange={(checked) => setLinkSettings({ ...linkSettings, watermarkEnabled: checked })}
              className="flex-shrink-0"
            />
          </div>

          {linkSettings.watermarkEnabled && (
            <div className="space-y-4 pl-8 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-white">Тип знака</label>
                <Select value={linkSettings.watermarkType} onValueChange={(value) => setLinkSettings({ ...linkSettings, watermarkType: value })}>
                  <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                    <SelectItem value="text" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Текст</SelectItem>
                    <SelectItem value="image" className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">Картинка</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {linkSettings.watermarkType === 'text' ? (
                <input
                  type="text"
                  placeholder="Текст водяного знака"
                  value={linkSettings.watermarkText}
                  onChange={(e) => setLinkSettings({ ...linkSettings, watermarkText: e.target.value })}
                  className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#FFB800] focus:border-transparent transition-all"
                />
              ) : (
                <div className="space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />

                  {/* Сохранённые логотипы */}
                  {savedLogos.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Мои логотипы — нажмите чтобы выбрать:</p>
                      <div className="flex gap-2 flex-wrap">
                        {savedLogos.map(logo => (
                          <div
                            key={logo.id}
                            className={`relative group cursor-pointer rounded-lg border-2 transition-all ${
                              linkSettings.watermarkImageUrl === logo.url
                                ? 'border-[#FFB800] bg-[#FFB800]/10'
                                : 'border-gray-200 dark:border-gray-700 hover:border-[#FFB800]/60'
                            }`}
                            style={{ width: 64, height: 64 }}
                            onClick={() => setLinkSettings({ ...linkSettings, watermarkImageUrl: logo.url })}
                          >
                            <img
                              src={logo.url}
                              alt="Логотип"
                              className="w-full h-full object-contain rounded-md p-1 bg-white dark:bg-gray-800"
                            />
                            {linkSettings.watermarkImageUrl === logo.url && (
                              <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#FFB800] flex items-center justify-center">
                                <Icon name="Check" size={10} className="text-white" />
                              </div>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteLogo(logo); }}
                              disabled={deletingId === logo.id}
                              className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-500 text-white hidden group-hover:flex items-center justify-center shadow-sm hover:bg-red-600 transition-all"
                            >
                              {deletingId === logo.id
                                ? <Icon name="Loader2" size={10} className="animate-spin" />
                                : <Icon name="X" size={10} />
                              }
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Кнопка загрузки нового */}
                  {savedLogos.length < 3 ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:border-[#FFB800] hover:text-[#FFB800] transition-all disabled:opacity-50"
                    >
                      {uploadingLogo ? (
                        <><Icon name="Loader2" size={15} className="animate-spin" />Загружаем...</>
                      ) : (
                        <><Icon name="Upload" size={15} />Загрузить логотип ({savedLogos.length}/3)</>
                      )}
                    </button>
                  ) : (
                    <p className="text-xs text-amber-500 dark:text-amber-400 text-center">Максимум 3 логотипа. Удалите один чтобы загрузить новый.</p>
                  )}

                  <p className="text-xs text-gray-400 dark:text-gray-500">PNG с прозрачным фоном — логотип виден поверх фото</p>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">Частота показа</label>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{linkSettings.watermarkFrequency}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={linkSettings.watermarkFrequency}
                  onChange={(e) => setLinkSettings({ ...linkSettings, watermarkFrequency: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">Размер</label>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{linkSettings.watermarkSize}%</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="80"
                  step="5"
                  value={linkSettings.watermarkSize}
                  onChange={(e) => setLinkSettings({ ...linkSettings, watermarkSize: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">Прозрачность</label>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{linkSettings.watermarkOpacity}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  step="10"
                  value={linkSettings.watermarkOpacity}
                  onChange={(e) => setLinkSettings({ ...linkSettings, watermarkOpacity: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-900 dark:text-white">Наклон</label>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{linkSettings.watermarkRotation}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="5"
                  value={linkSettings.watermarkRotation}
                  onChange={(e) => setLinkSettings({ ...linkSettings, watermarkRotation: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Предпросмотр</p>
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg h-32 flex items-center justify-center overflow-hidden">
                  <Icon name="Image" size={48} className="text-white/30" />
                  {(linkSettings.watermarkType === 'text' && linkSettings.watermarkText) || (linkSettings.watermarkType === 'image' && linkSettings.watermarkImageUrl) ? (() => {
                    const count = Math.ceil((linkSettings.watermarkFrequency / 10) * 10);
                    const watermarks = [];
                    
                    for (let i = 0; i < count; i++) {
                      const top = (i * (100 / count)) % 100;
                      const left = ((i * 37) % 100);
                      
                      watermarks.push(
                        <div
                          key={i}
                          className="absolute pointer-events-none"
                          style={{
                            top: `${top}%`,
                            left: `${left}%`,
                            transform: 'translate(-50%, -50%)',
                            opacity: linkSettings.watermarkOpacity / 100
                          }}
                        >
                          {linkSettings.watermarkType === 'text' ? (
                            <p
                              className="text-white font-bold text-center px-1 whitespace-nowrap"
                              style={{
                                fontSize: `${linkSettings.watermarkSize / 2}px`,
                                textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                                transform: `rotate(${linkSettings.watermarkRotation}deg)`
                              }}
                            >
                              {linkSettings.watermarkText}
                            </p>
                          ) : (
                            <img
                              src={linkSettings.watermarkImageUrl}
                              alt="Watermark preview"
                              style={{ 
                                width: `${linkSettings.watermarkSize}%`,
                                maxWidth: `${linkSettings.watermarkSize}%`,
                                height: 'auto',
                                transform: `rotate(${linkSettings.watermarkRotation}deg)`,
                              }}
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          )}
                        </div>
                      );
                    }
                    
                    return watermarks;
                  })() : null}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Icon name="ShieldAlert" size={20} className="text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">Защита от скриншотов</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Чёрный экран при скрине</p>
                  </div>
                </div>
                <Switch
                  checked={linkSettings.screenshotProtection}
                  onCheckedChange={(checked) => setLinkSettings({ ...linkSettings, screenshotProtection: checked })}
                  className="flex-shrink-0"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      <Button
        onClick={onGenerateLink}
        disabled={loading}
        className="w-full bg-[#FFB800] hover:bg-[#E5A600] text-black font-medium py-3 sm:py-2.5 h-auto touch-manipulation"
      >
        {loading ? (
          <>
            <Icon name="Loader2" size={20} className="animate-spin mr-2" />
            Создание...
          </>
        ) : (
          <>
            <Icon name="Link" size={20} className="mr-2" />
            Создать ссылку
          </>
        )}
      </Button>
    </>
  );
}