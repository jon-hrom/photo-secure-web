import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface ShareFolderModalProps {
  folderId: number;
  folderName: string;
  userId: number;
  onClose: () => void;
}

export default function ShareFolderModal({ folderId, folderName, userId, onClose }: ShareFolderModalProps) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [error, setError] = useState('');

  const generateShareLink = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://functions.poehali.dev/9eee0a77-78fd-4687-a47b-cae3dc4b46ab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString()
        },
        body: JSON.stringify({
          folder_id: folderId,
          user_id: userId,
          expires_days: 30
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

  const handleSendToClient = () => {
    if (!clientName || !clientPhone) {
      alert('Заполните имя и телефон клиента');
      return;
    }

    const message = `Добрый день, ${clientName}!\n\n` +
      `Ваши фотографии готовы.\n` +
      `Ссылка для просмотра и скачивания: ${shareUrl}\n` +
      (totalPrice ? `\nИтого к оплате: ${totalPrice} ₽` : '') +
      `\n\nСсылка действует 30 дней.`;

    const whatsappUrl = `https://wa.me/${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Поделиться папкой</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Icon name="X" size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 mb-1">Папка</p>
            <p className="font-medium">{folderName}</p>
          </div>

          {!shareUrl ? (
            <>
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <Button
                onClick={generateShareLink}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Icon name="Loader2" size={20} className="animate-spin mr-2" />
                    Создание ссылки...
                  </>
                ) : (
                  <>
                    <Icon name="Link" size={20} className="mr-2" />
                    Создать ссылку для клиента
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

              <button
                onClick={handleCopyLink}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Icon name="Copy" size={20} />
                Скопировать ссылку
              </button>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm font-medium mb-3">Отправить клиенту</p>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Ваше имя</label>
                    <input
                      type="text"
                      placeholder="Иван Иванов"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Телефон</label>
                    <input
                      type="tel"
                      placeholder="+7 (999) 123-45-67"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Итого (необязательно)</label>
                    <input
                      type="text"
                      placeholder="45 000 ₽"
                      value={totalPrice}
                      onChange={(e) => setTotalPrice(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <button
                  onClick={handleSendToClient}
                  disabled={!clientName || !clientPhone}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Icon name="MessageCircle" size={20} />
                  Отправить в WhatsApp
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
