import Icon from '@/components/ui/icon';

interface Message {
  id: number;
  message: string;
  sender_type: 'client' | 'photographer';
  created_at: string;
  is_read: boolean;
  is_delivered: boolean;
  image_url?: string;
  video_url?: string;
}

interface ChatMessageProps {
  message: Message;
  isMyMessage: boolean;
  onImageClick: (imageUrl: string) => void;
  variant?: 'default' | 'embedded';
  senderName?: string;
}

export default function ChatMessage({ 
  message, 
  isMyMessage, 
  onImageClick,
  variant = 'default',
  senderName
}: ChatMessageProps) {
  const renderMessageText = (text: string) => {
    return text.split(/(#\d+|фото\s*\d+|photo\s*\d+)/gi).map((part, i) => {
      if (/(#\d+|фото\s*\d+|photo\s*\d+)/i.test(part)) {
        return <span key={i} className="font-semibold underline">{part}</span>;
      }
      return part;
    });
  };

  const isEmbedded = variant === 'embedded';

  return (
    <div
      className={`flex flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}
    >
      {senderName && (
        <span className="text-xs text-muted-foreground mb-1 px-1">
          {senderName}
        </span>
      )}
      <div
        className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 ${
          isEmbedded
            ? isMyMessage
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
            : isMyMessage
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
        }`}
      >
        {message.image_url && !message.video_url && (
          <img 
            src={message.image_url} 
            alt="Изображение" 
            className="rounded-lg mb-2 max-w-full cursor-pointer hover:opacity-90 transition-opacity touch-manipulation"
            onClick={() => onImageClick(message.image_url!)}
            loading="lazy"
            style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
          />
        )}
        {message.video_url && (
          <div className="relative mb-2">
            <video 
              src={message.video_url}
              poster={message.image_url}
              controls
              playsInline
              className="rounded-lg max-w-full"
              style={{ maxHeight: '300px' }}
            />
          </div>
        )}
        {message.message && (
          <p className="whitespace-pre-wrap break-words">
            {renderMessageText(message.message)}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <p className={`text-xs ${
            isEmbedded
              ? isMyMessage ? 'opacity-80' : 'text-muted-foreground'
              : isMyMessage ? 'text-blue-100' : 'text-gray-500'
          }`}>
            {new Date(message.created_at).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
          {isMyMessage && (
            message.is_read ? (
              <Icon 
                name="CheckCheck" 
                size={14} 
                className={isEmbedded ? 'text-green-500' : 'text-green-400'} 
              />
            ) : message.is_delivered ? (
              <Icon 
                name="CheckCheck" 
                size={14} 
                className={isEmbedded ? 'opacity-80' : 'text-blue-100'} 
              />
            ) : (
              <Icon 
                name="Check" 
                size={14} 
                className={isEmbedded ? 'opacity-80' : 'text-blue-100'} 
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}