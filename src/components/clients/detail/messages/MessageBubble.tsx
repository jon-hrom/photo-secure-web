import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Message } from '@/components/clients/ClientsTypes';
import {
  DeliveryStatus,
  messageTypeIcons,
  messageTypeLabels,
  renderDeliveryBadge,
} from './messagesShared';

interface MessageBubbleProps {
  message: Message;
  clientName: string;
  photographerName: string;
  clientAvatarUrl: string | null;
  onDeleteMessage?: (messageId: number) => void;
  localStatuses: Record<number, { status: DeliveryStatus; error?: string | null }>;
  resendingIds: Set<number>;
  onResend: (messageId: number) => void;
}

const MessageBubble = ({
  message,
  clientName,
  photographerName,
  clientAvatarUrl,
  onDeleteMessage,
  localStatuses,
  resendingIds,
  onResend,
}: MessageBubbleProps) => {
  const isClient = message.author.toLowerCase() === 'клиент' || message.author.toLowerCase() === clientName.toLowerCase();

  return (
    <div
      className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isClient ? 'justify-start' : 'justify-end'}`}
    >
      {isClient && (
        clientAvatarUrl ? (
          <img
            src={clientAvatarUrl}
            alt={clientName}
            className="flex-shrink-0 w-10 h-10 rounded-full object-cover shadow-lg border border-border"
          />
        ) : (
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
            {clientName.charAt(0).toUpperCase()}
          </div>
        )
      )}

      <div className={`flex flex-col max-w-[70%] ${isClient ? 'items-start' : 'items-end'}`}>
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-semibold text-foreground">
            {isClient ? clientName : (message.author || photographerName)}
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(message.date).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>

        <div className={`group relative rounded-2xl p-4 shadow-md ${
          isClient
            ? 'bg-card border-2 border-blue-200 dark:border-blue-800 rounded-tl-none'
            : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-tr-none'
        }`}>
          <div className="flex items-start gap-2 mb-2">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
              isClient ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-white/20'
            }`}>
              <Icon
                name={messageTypeIcons[message.type]}
                size={12}
                className={isClient ? 'text-blue-600 dark:text-blue-400' : 'text-white'}
              />
            </div>
            <span className={`text-xs font-medium ${isClient ? 'text-blue-700 dark:text-blue-400' : 'text-white/90'}`}>
              {messageTypeLabels[message.type]}
            </span>
            {onDeleteMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteMessage(message.id)}
                className={`ml-auto h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                  isClient ? 'hover:bg-red-50 dark:hover:bg-red-950' : 'hover:bg-white/20'
                }`}
              >
                <Icon name="Trash2" size={14} className={isClient ? 'text-red-500' : 'text-white'} />
              </Button>
            )}
          </div>
          <p className={`text-sm whitespace-pre-wrap leading-relaxed ${
            isClient ? 'text-foreground' : 'text-white'
          }`}>
            {message.content}
          </p>
          {!isClient && (message.delivery_status || localStatuses[message.id]) && (() => {
            const effective = localStatuses[message.id] || {
              status: message.delivery_status,
              error: message.delivery_error,
            };
            const canRetry = effective.status === 'failed' || effective.status === 'unknown';
            const isResending = resendingIds.has(message.id);
            return (
              <div className="flex items-center justify-end gap-2 mt-2 -mb-1">
                {renderDeliveryBadge(effective.status, effective.error)}
                {canRetry && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isResending}
                    onClick={() => onResend(message.id)}
                    className="h-6 px-2 py-0 text-[10px] text-white bg-white/15 hover:bg-white/25"
                    title={effective.error || 'Отправить повторно'}
                  >
                    <Icon
                      name={isResending ? 'Loader2' : 'RefreshCw'}
                      size={11}
                      className={isResending ? 'animate-spin' : ''}
                    />
                    <span className="ml-1">{isResending ? 'Отправляю...' : 'Повторить'}</span>
                  </Button>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {!isClient && (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold shadow-lg">
          {(message.author || photographerName).charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
