import { forwardRef } from 'react';
import Icon from '@/components/ui/icon';
import ChatMessage from './ChatMessage';
import type { ChatMessageData } from './chat/types';

type Message = ChatMessageData;

interface GalleryPhoto {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
}

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  senderType: 'client' | 'photographer';
  onImageClick: (imageUrl: string) => void;
  variant?: 'default' | 'embedded';
  isOpponentTyping?: boolean;
  clientName?: string;
  photographerName?: string;
  timezone?: string;
  galleryPhotos?: GalleryPhoto[];
  selectionMode?: boolean;
  selectedIds?: Set<number>;
  onToggleSelect?: (id: number) => void;
  onOpenMenu?: (id: number, pos: { x: number; y: number }) => void;
  onJumpToMessage?: (id: number) => void;
  highlightedId?: number | null;
}

const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  (
    {
      messages,
      loading,
      senderType,
      onImageClick,
      variant = 'default',
      isOpponentTyping = false,
      clientName,
      photographerName,
      timezone,
      galleryPhotos = [],
      selectionMode = false,
      selectedIds,
      onToggleSelect,
      onOpenMenu,
      onJumpToMessage,
      highlightedId,
    },
    ref
  ) => {
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
              senderName={msg.sender_type === 'client' ? clientName : photographerName}
              timezone={timezone}
              galleryPhotos={galleryPhotos}
              selectionMode={selectionMode}
              isSelected={selectedIds?.has(msg.id) ?? false}
              onToggleSelect={onToggleSelect}
              onOpenMenu={onOpenMenu}
              onJumpToMessage={onJumpToMessage}
              highlight={highlightedId === msg.id}
            />
          );
        })}
        {isOpponentTyping && (
          <div className="flex justify-start mb-3">
            <div className={`inline-block px-4 py-2 rounded-2xl ${
              isEmbedded
                ? 'bg-muted'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}>
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={ref} />
      </>
    );
  }
);

ChatMessageList.displayName = 'ChatMessageList';

export default ChatMessageList;
