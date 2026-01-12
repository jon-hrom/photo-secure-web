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
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [linkSettings, setLinkSettings] = useState({
    password: '',
    downloadDisabled: false,
    expiresIn: 'forever',
    customDate: ''
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
      const response = await fetch(CLIENTS_URL, {
        headers: {
          'X-User-Id': userId.toString()
        }
      });
      const data = await response.json();
      if (data.clients) {
        setClients(data.clients);
      }
    } catch (err) {
      console.error('Error loading clients:', err);
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
        body: JSON.dumps({
          folder_id: folderId,
          user_id: userId,
          expires_days: expiresInDays,
          password: linkSettings.password || null,
          download_disabled: linkSettings.downloadDisabled
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
        body: JSON.dumps({
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ссылка на папку</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Папка</p>
            <p className="font-medium">{folderName}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Клиент</label>
            <Select value={selectedClient?.id.toString()} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите клиента" />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id.toString()}>
                    {client.name} {client.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!shareUrl ? (
            <>
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon name="Eye" size={20} className="text-gray-500" />
                    <div>
                      <p className="font-medium">Просмотр</p>
                      <p className="text-sm text-gray-500">Просматривать смогут все, у кого есть ссылка</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon name="Shield" size={20} className="text-gray-500" />
                    <div>
                      <p className="font-medium">Пароль</p>
                      <p className="text-sm text-gray-500">От 4 символов</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="Готово"
                    value={linkSettings.password}
                    onChange={(e) => setLinkSettings({ ...linkSettings, password: e.target.value })}
                    className="w-32 px-3 py-2 border rounded-lg text-sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon name="Download" size={20} className="text-gray-500" />
                    <div>
                      <p className="font-medium">Запретить скачивание</p>
                    </div>
                  </div>
                  <Switch
                    checked={linkSettings.downloadDisabled}
                    onCheckedChange={(checked) => setLinkSettings({ ...linkSettings, downloadDisabled: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Icon name="Calendar" size={20} className="text-gray-500" />
                    <p className="font-medium">Срок действия ссылки</p>
                  </div>
                  
                  <Select value={linkSettings.expiresIn} onValueChange={(value) => setLinkSettings({ ...linkSettings, expiresIn: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forever">Бессрочно</SelectItem>
                      <SelectItem value="day">Сутки</SelectItem>
                      <SelectItem value="week">Неделя</SelectItem>
                      <SelectItem value="month">Месяц</SelectItem>
                      <SelectItem value="custom">Выбрать дату и время</SelectItem>
                    </SelectContent>
                  </Select>

                  {linkSettings.expiresIn === 'custom' && (
                    <input
                      type="datetime-local"
                      value={linkSettings.customDate}
                      onChange={(e) => setLinkSettings({ ...linkSettings, customDate: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  )}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Button
                onClick={generateShareLink}
                disabled={loading}
                className="w-full bg-[#FFB800] hover:bg-[#E5A600] text-black"
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
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Icon name="CheckCircle" size={20} className="text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 mb-2">Ссылка создана</p>
                    <div className="bg-white border border-green-200 rounded px-3 py-2 text-sm break-all font-mono">
                      {shareUrl}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Icon name="Copy" size={20} />
                  Скопировать
                </button>

                <button
                  onClick={handleSendViaMax}
                  disabled={!selectedClient}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#FFB800] hover:bg-[#E5A600] text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="Send" size={20} />
                  MAX
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
