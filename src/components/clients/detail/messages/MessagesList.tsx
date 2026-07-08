import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Message } from '@/components/clients/ClientsTypes';
import { DeliveryStatus } from './messagesShared';
import MessageBubble from './MessageBubble';

interface MessagesListProps {
  messages: Message[];
  sortedMessages: Message[];
  clientName: string;
  photographerName: string;
  clientAvatarUrl: string | null;
  onDeleteMessage?: (messageId: number) => void;
  onDeleteAllMessages?: () => void;
  localStatuses: Record<number, { status: DeliveryStatus; error?: string | null }>;
  resendingIds: Set<number>;
  onResend: (messageId: number) => void;
  messagesEndRef: RefObject<HTMLDivElement>;
}

const MessagesList = ({
  messages,
  sortedMessages,
  clientName,
  photographerName,
  clientAvatarUrl,
  onDeleteMessage,
  onDeleteAllMessages,
  localStatuses,
  resendingIds,
  onResend,
  messagesEndRef,
}: MessagesListProps) => {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-background border-b">
        <h3 className="text-sm font-semibold text-foreground">История переписки</h3>
        {messages.length > 0 && onDeleteAllMessages && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteAllMessages}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
          >
            <Icon name="Trash2" size={16} className="mr-1" />
            Очистить переписку
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-muted/50 to-muted">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Icon name="MessageSquare" size={48} className="mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">История переписки пуста</p>
              <p className="text-sm text-muted-foreground mt-1">
                Начните переписку с клиентом
              </p>
            </div>
          </div>
        ) : (
          sortedMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              clientName={clientName}
              photographerName={photographerName}
              clientAvatarUrl={clientAvatarUrl}
              onDeleteMessage={onDeleteMessage}
              localStatuses={localStatuses}
              resendingIds={resendingIds}
              onResend={onResend}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </>
  );
};

export default MessagesList;
