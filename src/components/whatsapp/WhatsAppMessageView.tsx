import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';

interface WhatsAppChat {
  id: number;
  phone_number: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_time: string | null;
  unread_count: number;
  is_admin_chat: boolean;
}

interface WhatsAppMessage {
  id: number;
  message_text: string;
  is_from_me: boolean;
  timestamp: string;
  status: string;
  is_read: boolean;
}

interface WhatsAppMessageViewProps {
  selectedChat: WhatsAppChat | null;
  messages: WhatsAppMessage[];
  loading: boolean;
  messageText: string;
  sending: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onMessageChange: (text: string) => void;
  onSendMessage: () => void;
  formatTime: (dateString: string) => string;
  formatDate: (dateString: string) => string;
}

const WhatsAppMessageView = ({
  selectedChat,
  messages,
  loading,
  messageText,
  sending,
  messagesEndRef,
  onMessageChange,
  onSendMessage,
  formatTime,
  formatDate,
}: WhatsAppMessageViewProps) => {
  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Icon name="MessageCircle" size={64} className="mx-auto mb-4 opacity-30" />
          <p>Выберите чат для начала общения</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Icon name="User" size={20} className="text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold">
              {selectedChat.contact_name || selectedChat.phone_number}
            </h3>
            <p className="text-xs text-muted-foreground">
              {selectedChat.phone_number}
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Icon name="Loader" size={32} className="animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="MessageSquare" size={48} className="mx-auto mb-2 opacity-50" />
            <p>Нет сообщений</p>
            <p className="text-xs mt-1">Начните диалог первым</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => {
              const showDate = idx === 0 || 
                new Date(messages[idx - 1].timestamp).toDateString() !== 
                new Date(msg.timestamp).toDateString();
              
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center my-4">
                      <span className="text-xs bg-gray-200 px-3 py-1 rounded-full">
                        {formatDate(msg.timestamp)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.is_from_me
                          ? 'bg-green-100 text-gray-900'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-xs text-gray-500">
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.is_from_me && (
                          <Icon 
                            name={msg.is_read ? 'CheckCheck' : 'Check'} 
                            size={14} 
                            className={msg.is_read ? 'text-blue-500' : 'text-gray-400'} 
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Textarea
            value={messageText}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Введите сообщение..."
            className="flex-1 min-h-[60px] max-h-[120px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSendMessage();
              }
            }}
          />
          <Button
            onClick={onSendMessage}
            disabled={!messageText.trim() || sending}
            className="bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {sending ? (
              <Icon name="Loader" size={20} className="animate-spin" />
            ) : (
              <Icon name="Send" size={20} />
            )}
          </Button>
        </div>
      </div>
    </>
  );
};

export default WhatsAppMessageView;
