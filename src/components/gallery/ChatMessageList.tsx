import { forwardRef } from 'react';
import Icon from '@/components/ui/icon';
import ChatMessage from './ChatMessage';

interface Message {
  id: number;
  message: string;
  sender_type: 'client' | 'photographer';
  created_at: string;
  is_read: boolean;
  is_delivered: boolean;
  image_url?: string;
}

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  senderType: 'client' | 'photographer';
  onImageClick: (imageUrl: string) => void;
  variant?: 'default' | 'embedded';
}

const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ messages, loading, senderType, onImageClick, variant = 'default' }, ref) => {
    const isEmbedded = variant === 'embedded';

    if (loading && messages.length === 0) {
      return (
        <div className="flex justify-center items-center h-full">
          <div className={`w-8 h-8 border-4 border-t-transparent rounded-full animate-spin ${
            isEmbedded ? 'border-primary' : 'border-blue-500'
          }`} />
        </div>
      );
    }

    if (messages.length === 0) {
      return (
        <div className={`flex flex-col items-center justify-center h-full ${
          isEmbedded ? 'text-muted-foreground' : 'text-gray-400'
        }`}>
          <Icon name="MessageCircle" size={48} className="mb-2 opacity-50" />
          <p>Нет сообщений</p>
        </div>
      );
    }

    return (
      <>
        {messages.map((msg) => {
          const isMyMessage = msg.sender_type === senderType;
          
          return (
            <ChatMessage
              key={msg.id}
              message={msg}
              isMyMessage={isMyMessage}
              onImageClick={onImageClick}
              variant={variant}
            />
          );
        })}
        <div ref={ref} />
      </>
    );
  }
);

ChatMessageList.displayName = 'ChatMessageList';

export default ChatMessageList;
