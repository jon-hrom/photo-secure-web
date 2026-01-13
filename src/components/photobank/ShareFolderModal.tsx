import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import ClientSelector from './share/ClientSelector';
import LinkSettingsForm from './share/LinkSettingsForm';
import ShareLinkResult from './share/ShareLinkResult';

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
const CLIENTS_URL = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d';
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

          <ClientSelector
            clients={clients}
            selectedClient={selectedClient}
            onClientChange={handleClientChange}
          />

          {!shareUrl ? (
            <LinkSettingsForm
              linkSettings={linkSettings}
              setLinkSettings={setLinkSettings}
              loading={loading}
              error={error}
              onGenerateLink={generateShareLink}
            />
          ) : (
            <ShareLinkResult
              shareUrl={shareUrl}
              selectedClient={selectedClient}
              onCopyLink={handleCopyLink}
              onSendViaMax={handleSendViaMax}
            />
          )}
        </div>

        <div className="h-safe-bottom sm:hidden" />
      </div>
    </div>
  );
}
