import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import ClientSelector from './share/ClientSelector';
import LinkSettingsForm from './share/LinkSettingsForm';
import ShareLinkResult from './share/ShareLinkResult';
import MaxMessageModal from './share/MaxMessageModal';
import FavoritesTab from './share/FavoritesTab';
import PageDesignTab from './share/PageDesignTab';

interface Client {
  id: number;
  name: string;
  phone: string;
}

interface GalleryPhoto {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface ShareFolderModalProps {
  folderId: number;
  folderName: string;
  userId: number;
  onClose: () => void;
}

const MAX_URL = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';
const CLIENTS_URL = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
const FOLDER_CLIENT_URL = 'https://functions.poehali.dev/579eccc8-1cf2-4ef4-b5ad-d011a71ba393';

export default function ShareFolderModal({ folderId, folderName, userId, onClose }: ShareFolderModalProps) {
  console.log('═══════════════════════════════════════════');
  console.log('[SHARE_MODAL] 🚀 MODAL OPENED');
  console.log('[SHARE_MODAL] folderId:', folderId);
  console.log('[SHARE_MODAL] folderName:', folderName);
  console.log('[SHARE_MODAL] userId:', userId);
  console.log('[SHARE_MODAL] userId type:', typeof userId);
  console.log('═══════════════════════════════════════════');
  
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [showMaxModal, setShowMaxModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'design' | 'link' | 'favorites'>('design');
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([]);
  const [pageDesign, setPageDesign] = useState({
    coverPhotoId: null as number | null,
    coverOrientation: 'horizontal' as 'horizontal' | 'vertical',
    coverFocusX: 0.5,
    coverFocusY: 0.5,
    gridGap: 8,
    bgTheme: 'light' as 'light' | 'dark' | 'custom',
    bgColor: null as string | null,
    bgImageUrl: null as string | null,
    bgImageData: null as string | null,
    bgImageExt: 'jpg',
    textColor: null as string | null,
  });
  
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
    watermarkRotation: 0,
    screenshotProtection: false
  });
  
  const [error, setError] = useState('');

  useEffect(() => {
    loadClients();
    loadSavedLink();
    loadFolderPhotos();
  }, []);

  const loadFolderPhotos = async () => {
    try {
      const res = await fetch(
        `https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc?action=list_photos&folder_id=${folderId}`,
        { headers: { 'X-User-Id': userId.toString() } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.photos && data.photos.length > 0) {
          const mapped = data.photos.map((p: { id: number; file_name: string; s3_url?: string; thumbnail_s3_url?: string; width?: number; height?: number }) => ({
            id: p.id,
            file_name: p.file_name,
            photo_url: p.s3_url || '',
            thumbnail_url: p.thumbnail_s3_url || p.s3_url || '',
            width: p.width,
            height: p.height
          }));
          setGalleryPhotos(prev => prev.length > 0 ? prev : mapped);
        }
      }
    } catch (err) {
      console.error('[SHARE_MODAL] Error loading folder photos:', err);
    }
  };

  useEffect(() => {
    if (clients.length > 0) {
      loadFolderClient();
    }
  }, [clients]);

  const loadSavedLink = async () => {
    const key = `folder_${folderId}_link`;
    const saved = localStorage.getItem(key);
    if (saved) {
      setShareUrl(saved);
      
      // Загружаем настройки с сервера (source of truth)
      const galleryCode = saved.split('/').pop();
      if (galleryCode) {
        try {
          const response = await fetch(`https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab?code=${galleryCode}`);
          if (response.ok) {
            const data = await response.json();
            console.log('[SHARE_MODAL] Настройки загружены с сервера:', data);
            
            // Обновляем favorite_config из БД
            if (data.favorite_config) {
              localStorage.setItem(`folder_${folderId}_favorite_config`, JSON.stringify(data.favorite_config));
              console.log('[SHARE_MODAL] favorite_config обновлен из БД');
            }
            
            // Обновляем link settings
            if (data.watermark) {
              setLinkSettings(prev => ({
                ...prev,
                downloadDisabled: data.download_disabled || false,
                watermarkEnabled: data.watermark.enabled || false,
                watermarkType: data.watermark.type || 'text',
                watermarkText: data.watermark.text || '',
                watermarkImageUrl: data.watermark.image_url || '',
                watermarkFrequency: data.watermark.frequency || 50,
                watermarkSize: data.watermark.size || 20,
                watermarkOpacity: data.watermark.opacity || 50,
                watermarkRotation: data.watermark.rotation || 0,
                screenshotProtection: data.screenshot_protection || false,
                password: ''
              }));
            }
            
            setPageDesign({
              coverPhotoId: data.cover_photo_id || null,
              coverOrientation: data.cover_orientation || 'horizontal',
              coverFocusX: data.cover_focus_x ?? 0.5,
              coverFocusY: data.cover_focus_y ?? 0.5,
              gridGap: data.grid_gap ?? 8,
              bgTheme: data.bg_theme || 'light',
              bgColor: data.bg_color || null,
              bgImageUrl: data.bg_image_url || null,
              bgImageData: null,
              bgImageExt: 'jpg',
              textColor: data.text_color || null,
            });
            
            if (data.photos && data.photos.length > 0) {
              setGalleryPhotos(data.photos);
            }
          }
        } catch (err) {
          console.error('[SHARE_MODAL] Ошибка загрузки настроек с сервера:', err);
          
          // Fallback на localStorage
          const settingsKey = `folder_${folderId}_link_settings`;
          const savedSettings = localStorage.getItem(settingsKey);
          
          if (savedSettings) {
            try {
              const settings = JSON.parse(savedSettings);
              setLinkSettings(prev => ({
                ...prev,
                ...settings,
                password: ''
              }));
              console.log('[SHARE_MODAL] Настройки загружены из localStorage (fallback)');
            } catch (err) {
              console.error('[SHARE_MODAL] Ошибка парсинга настроек из localStorage:', err);
            }
          }
        }
      }
    }
  };

  const saveLink = (url: string) => {
    const key = `folder_${folderId}_link`;
    localStorage.setItem(key, url);
  };

  const loadClients = async () => {
    try {
      console.log('[SHARE_MODAL] Loading clients for userId:', userId);
      console.log('[SHARE_MODAL] Fetching from:', CLIENTS_URL);
      const response = await fetch(CLIENTS_URL, {
        headers: {
          'X-User-Id': userId.toString()
        }
      });
      console.log('[SHARE_MODAL] Response status:', response.status);
      const data = await response.json();
      console.log('[SHARE_MODAL] Clients response:', JSON.stringify(data, null, 2));
      
      // Backend может вернуть массив напрямую или объект с полем clients
      if (Array.isArray(data)) {
        console.log('[SHARE_MODAL] ✅ Got array directly, setting', data.length, 'clients');
        setClients(data);
      } else if (data.clients && Array.isArray(data.clients)) {
        console.log('[SHARE_MODAL] ✅ Got clients from object, setting', data.clients.length, 'clients');
        setClients(data.clients);
      } else {
        console.warn('[SHARE_MODAL] ⚠️ No clients found in response, setting empty array');
        setClients([]);
      }
    } catch (err) {
      console.error('[SHARE_MODAL] ❌ Error loading clients:', err);
      setClients([]);
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

      // Получаем настройки избранного из localStorage
      const favoriteConfigStr = localStorage.getItem(`folder_${folderId}_favorite_config`);
      let favoriteConfig = null;
      if (favoriteConfigStr) {
        try {
          favoriteConfig = JSON.parse(favoriteConfigStr);
        } catch (e) {
          console.error('[SHARE_MODAL] Failed to parse favorite config:', e);
        }
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
          watermark_rotation: linkSettings.watermarkRotation,
          screenshot_protection: linkSettings.screenshotProtection,
          favorite_config: favoriteConfig,
          cover_photo_id: pageDesign.coverPhotoId,
          cover_orientation: pageDesign.coverOrientation,
          cover_focus_x: pageDesign.coverFocusX,
          cover_focus_y: pageDesign.coverFocusY,
          grid_gap: pageDesign.gridGap,
          bg_theme: pageDesign.bgTheme,
          bg_color: pageDesign.bgColor,
          bg_image_url: pageDesign.bgImageData ? null : pageDesign.bgImageUrl,
          bg_image_data: pageDesign.bgImageData,
          bg_image_ext: pageDesign.bgImageExt,
          text_color: pageDesign.textColor
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка создания ссылки');
      }

      setShareUrl(data.share_url);
      saveLink(data.share_url);
      
      // Сохраняем настройки в localStorage для быстрого восстановления
      const settingsKey = `folder_${folderId}_link_settings`;
      localStorage.setItem(settingsKey, JSON.stringify({
        downloadDisabled: linkSettings.downloadDisabled,
        watermarkEnabled: linkSettings.watermarkEnabled,
        watermarkType: linkSettings.watermarkType,
        watermarkText: linkSettings.watermarkText,
        watermarkImageUrl: linkSettings.watermarkImageUrl,
        watermarkFrequency: linkSettings.watermarkFrequency,
        watermarkSize: linkSettings.watermarkSize,
        watermarkOpacity: linkSettings.watermarkOpacity,
        watermarkRotation: linkSettings.watermarkRotation,
        screenshotProtection: linkSettings.screenshotProtection
      }));
      
      const galleryCode = data.share_url.split('/').pop();
      if (galleryCode) {
        localStorage.setItem(`folder_${folderId}_gallery_code`, galleryCode);
        console.log('[SHARE_MODAL] Ссылка создана, настройки сохранены');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendViaMax = async (message: string) => {
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
          message: message
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Сообщение отправлено через MAX ✅');
        setShowMaxModal(false);
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
        className={`bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl transition-all ${
          activeTab === 'design' ? 'max-w-4xl' : 'max-w-lg'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-800 z-10">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Ссылка на папку</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <Icon name="X" size={20} className="text-gray-700 dark:text-gray-300" />
            </button>
          </div>
          
          <div className="flex border-t dark:border-gray-800">
            <button
              onClick={() => setActiveTab('design')}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                activeTab === 'design'
                  ? 'text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon name="Palette" size={16} className="inline mr-1.5" />
              <span className="hidden sm:inline">Настройка страницы</span>
              <span className="sm:hidden">Дизайн</span>
            </button>
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                activeTab === 'link'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon name="Link" size={16} className="inline mr-1.5" />
              Ссылка
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`flex-1 px-3 py-3 text-sm font-medium transition-colors ${
                activeTab === 'favorites'
                  ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon name="Star" size={16} className="inline mr-1.5" />
              Избранное
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {activeTab !== 'design' && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Папка</p>
              <p className="font-medium text-gray-900 dark:text-white break-words">{folderName}</p>
            </div>
          )}

          {activeTab === 'design' ? (
            <PageDesignTab
              folderId={folderId}
              folderName={folderName}
              userId={userId}
              photos={galleryPhotos}
              settings={pageDesign}
              onSettingsChange={setPageDesign}
            />
          ) : activeTab === 'link' ? (
            <>
              <ClientSelector
                clients={clients}
                selectedClient={selectedClient}
                onClientChange={handleClientChange}
              />

              {shareUrl && (
                <ShareLinkResult
                  shareUrl={shareUrl}
                  selectedClient={selectedClient}
                  onCopyLink={handleCopyLink}
                  onSendViaMax={() => setShowMaxModal(true)}
                />
              )}

              <LinkSettingsForm
                linkSettings={linkSettings}
                setLinkSettings={setLinkSettings}
                loading={loading}
                error={error}
                onGenerateLink={generateShareLink}
              />
            </>
          ) : (
            <FavoritesTab folderId={folderId} userId={userId} />
          )}
        </div>

        <div className="h-safe-bottom sm:hidden" />
      </div>

      {showMaxModal && selectedClient && (
        <MaxMessageModal
          client={selectedClient}
          shareUrl={shareUrl}
          expiryText={getExpiryText()}
          onSend={handleSendViaMax}
          onClose={() => setShowMaxModal(false)}
        />
      )}
    </div>
  );
}