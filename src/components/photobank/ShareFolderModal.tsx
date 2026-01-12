import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Client {
  id: number;
  name: string;
  phone: string;
}

interface ShareFolderModalProps {
  folderId: number;
  folderName: string;
  userId: number;
  onClose: () => void;
}

const MAX_URL = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';
const CLIENTS_URL = 'https://functions.poehali.dev/95efe27b-1ad9-49b5-a77b-1870a4cdd8e4';
const FOLDER_CLIENT_URL = 'https://functions.poehali.dev/579eccc8-1cf2-4ef4-b5ad-d011a71ba393';

export default function ShareFolderModal({ folderId, folderName, userId, onClose }: ShareFolderModalProps) {
  console.log('[SHARE_MODAL] Component mounted with:', { folderId, folderName, userId });
  
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [linkSettings, setLinkSettings] = useState({
    password: '',
    downloadDisabled: false,
    expiresIn: 'forever',
    customDate: '',
    watermarkEnabled: false,
    watermarkType: 'text',
    watermarkText: '',
    watermarkImageUrl: '',
    watermarkFrequency: 50,
    watermarkSize: 20,
    watermarkOpacity: 50,
    screenshotProtection: false
  });
  
  const [error, setError] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    if (clients.length > 0) {
      loadFolderClient();
    }
  }, [clients]);

  const loadClients = async () => {
    try {
      console.log('[SHARE_MODAL] Loading clients for userId:', userId);
      const response = await fetch(CLIENTS_URL, {
        headers: {
          'X-User-Id': userId.toString()
        }
      });
      const data = await response.json();
      console.log('[SHARE_MODAL] Clients response:', data);
      if (data.clients) {
        setClients(data.clients);
        console.log('[SHARE_MODAL] Loaded clients count:', data.clients.length);
      } else {
        console.warn('[SHARE_MODAL] No clients in response');
      }
    } catch (err) {
      console.error('[SHARE_MODAL] Error loading clients:', err);
    }
  };

  const loadFolderClient = async () => {
    try {
      const response = await fetch(`${FOLDER_CLIENT_URL}?folder_id=${folderId}`, {
        headers: {
          'X-User-Id': userId.toString()
        }
      });
      const data = await response.json();
      if (data.folder?.client_id) {
        const client = clients.find(c => c.id === data.folder.client_id);
        if (client) setSelectedClient(client);
      }
    } catch (err) {
      console.error('Error loading folder client:', err);
    }
  };

  const linkFolderToClient = async (clientId: number) => {
    try {
      await fetch(FOLDER_CLIENT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          folder_id: folderId,
          client_id: clientId
        })
      });
    } catch (err) {
      console.error('Error linking client:', err);
    }
  };

  const generateShareLink = async () => {
    setLoading(true);
    setError('');
    try {
      let expiresInDays = null;
      if (linkSettings.expiresIn === 'day') expiresInDays = 1;
      else if (linkSettings.expiresIn === 'week') expiresInDays = 7;
      else if (linkSettings.expiresIn === 'month') expiresInDays = 30;
      else if (linkSettings.expiresIn === 'custom' && linkSettings.customDate) {
        const targetDate = new Date(linkSettings.customDate);
        const now = new Date();
        expiresInDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      const response = await fetch('https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          folder_id: folderId,
          user_id: userId,
          expires_days: expiresInDays,
          password: linkSettings.password || null,
          download_disabled: linkSettings.downloadDisabled,
          watermark_enabled: linkSettings.watermarkEnabled,
          watermark_type: linkSettings.watermarkType,
          watermark_text: linkSettings.watermarkText,
          watermark_image_url: linkSettings.watermarkImageUrl,
          watermark_frequency: linkSettings.watermarkFrequency,
          watermark_size: linkSettings.watermarkSize,
          watermark_opacity: linkSettings.watermarkOpacity,
          screenshot_protection: linkSettings.screenshotProtection
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка создания ссылки');
      }

      setShareUrl(data.share_url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendViaMax = async () => {
    if (!selectedClient) {
      alert('Выберите клиента');
      return;
    }

    try {
      const response = await fetch(MAX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          action: 'send_message_to_client',
          client_id: selectedClient.id,
          message: `Добрый день!\n\nВаши фотографии готовы.\nСсылка для просмотра: ${shareUrl}\n\nСсылка действует ${getExpiryText()}.`
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Сообщение отправлено через MAX');
        onClose();
      } else {
        alert('Ошибка отправки: ' + (data.error || 'Неизвестная ошибка'));
      }
    } catch (err: any) {
      alert('Ошибка: ' + err.message);
    }
  };

  const getExpiryText = () => {
    if (linkSettings.expiresIn === 'day') return 'сутки';
    if (linkSettings.expiresIn === 'week') return 'неделю';
    if (linkSettings.expiresIn === 'month') return 'месяц';
    if (linkSettings.expiresIn === 'custom' && linkSettings.customDate) {
      const date = new Date(linkSettings.customDate);
      return `до ${date.toLocaleDateString('ru-RU')}`;
    }
    return 'бессрочно';
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Ссылка скопирована!');
    } catch (err) {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      alert('Ссылка скопирована!');
    }
  };

  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === parseInt(clientId));
    if (client) {
      setSelectedClient(client);
      linkFolderToClient(client.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div 
        className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-4 sm:px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Ссылка на папку</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <Icon name="X" size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Папка</p>
            <p className="font-medium text-gray-900 dark:text-white break-words">{folderName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-white">Клиент</label>
            {clients.length === 0 ? (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon name="AlertCircle" size={20} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                      У вас пока нет клиентов
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-3">
                      Создайте карточку клиента в разделе "Клиенты", чтобы связать её с папкой и отправлять ссылки через MAX
                    </p>
                    <a
                      href="/clients"
                      className="inline-flex items-center gap-2 text-sm font-medium text-yellow-900 dark:text-yellow-200 hover:underline"
                    >
                      <Icon name="UserPlus" size={16} />
                      Перейти к клиентам
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <Select value={selectedClient?.id.toString()} onValueChange={handleClientChange}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white">
                  <SelectValue placeholder="Выберите клиента" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700">
                  {clients.map(client => (
                    <SelectItem 
                      key={client.id} 
                      value={client.id.toString()}
                      className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <span className="block truncate">{client.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{client.phone}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!shareUrl ? (
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
                        <input
                          type="url"
                          placeholder="URL картинки"
                          value={linkSettings.watermarkImageUrl}
                          onChange={(e) => setLinkSettings({ ...linkSettings, watermarkImageUrl: e.target.value })}
                          className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-[#FFB800] focus:border-transparent transition-all"
                        />
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
                          min="10"
                          max="50"
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

                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Предпросмотр</p>
                        <div className="relative bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg h-32 flex items-center justify-center overflow-hidden">
                          <Icon name="Image" size={48} className="text-white/30" />
                          {(linkSettings.watermarkType === 'text' && linkSettings.watermarkText) || (linkSettings.watermarkType === 'image' && linkSettings.watermarkImageUrl) ? (
                            <div
                              className="absolute inset-0 flex items-center justify-center pointer-events-none"
                              style={{ opacity: linkSettings.watermarkOpacity / 100 }}
                            >
                              {linkSettings.watermarkType === 'text' ? (
                                <p
                                  className="text-white font-bold text-center px-4"
                                  style={{
                                    fontSize: `${linkSettings.watermarkSize}px`,
                                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                                  }}
                                >
                                  {linkSettings.watermarkText}
                                </p>
                              ) : (
                                <img
                                  src={linkSettings.watermarkImageUrl}
                                  alt="Watermark preview"
                                  style={{ maxWidth: `${linkSettings.watermarkSize * 2}%`, maxHeight: `${linkSettings.watermarkSize * 2}%` }}
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              )}
                            </div>
                          ) : null}
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
                onClick={generateShareLink}
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
                    Скопировать ссылку
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Icon name="CheckCircle" size={20} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-900 dark:text-green-200 mb-2">Ссылка создана</p>
                    <div className="bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 rounded px-3 py-2 text-xs sm:text-sm break-all font-mono text-gray-900 dark:text-gray-100">
                      {shareUrl}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium text-gray-900 dark:text-white touch-manipulation"
                >
                  <Icon name="Copy" size={20} />
                  <span>Скопировать</span>
                </button>

                <button
                  onClick={handleSendViaMax}
                  disabled={!selectedClient}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#FFB800] hover:bg-[#E5A600] text-black rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  <Icon name="Send" size={20} />
                  <span>MAX</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="h-safe-bottom sm:hidden" />
      </div>
    </div>
  );
}