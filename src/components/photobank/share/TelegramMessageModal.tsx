import { useState } from 'react';
import Icon from '@/components/ui/icon';

interface Client {
  id: number;
  name: string;
  phone: string;
  telegram_chat_id?: string;
}

interface TelegramMessageModalProps {
  client: Client;
  shareUrl: string;
  expiryText: string;
  onSend: (message: string) => void;
  onClose: () => void;
}

export default function TelegramMessageModal({ client, shareUrl, expiryText, onSend, onClose }: TelegramMessageModalProps) {
  const defaultMessage = `Добрый день, ${client.name}! 👋

Ваши фотографии готовы! 📸✨

Ссылка для просмотра:
${shareUrl}

Ссылка действует ${expiryText}.

С наилучшими пожеланиями,
Ваш фотограф 📷`;

  const [message, setMessage] = useState(defaultMessage);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#2AABEE] to-[#229ED9] rounded-full flex items-center justify-center">
              <Icon name="Send" size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Отправить в Telegram</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Клиент: {client.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Icon name="X" size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Сообщение клиенту
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2AABEE] focus:border-transparent resize-none"
              placeholder="Введите сообщение..."
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              💡 Совет: персонализируйте сообщение для лучшего отклика
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Icon name="Info" size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-1">
                  Отправка через Telegram
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Сообщение будет отправлено клиенту в Telegram-бот
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Отмена
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-[#2AABEE] to-[#229ED9] text-white rounded-lg hover:from-[#229ED9] hover:to-[#1E8FC7] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <Icon name="Loader2" size={20} className="animate-spin" />
                Отправка...
              </>
            ) : (
              <>
                <Icon name="Send" size={20} />
                Отправить
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
