import Icon from '@/components/ui/icon';

interface Client {
  id: number;
  name: string;
  phone: string;
  telegram_chat_id?: string;
}

interface ShareLinkResultProps {
  shareUrl: string;
  selectedClient: Client | null;
  onCopyLink: () => void;
  onSendViaMax: () => void;
  onSendViaTelegram: () => void;
}

export default function ShareLinkResult({ 
  shareUrl, 
  selectedClient, 
  onCopyLink, 
  onSendViaMax,
  onSendViaTelegram,
}: ShareLinkResultProps) {
  const hasTelegram = !!selectedClient?.telegram_chat_id;

  return (
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
          onClick={onCopyLink}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium text-gray-900 dark:text-white touch-manipulation"
        >
          <Icon name="Copy" size={20} />
          <span>Скопировать</span>
        </button>

        <button
          onClick={onSendViaMax}
          disabled={!selectedClient}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#FFB800] hover:bg-[#E5A600] text-black rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          <Icon name="Send" size={20} />
          <span>MAX</span>
        </button>

        <button
          onClick={onSendViaTelegram}
          disabled={!selectedClient || !hasTelegram}
          title={!hasTelegram ? 'У клиента не подключен Telegram' : 'Отправить в Telegram'}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          <Icon name="Send" size={20} />
          <span>Telegram</span>
        </button>
      </div>
    </>
  );
}