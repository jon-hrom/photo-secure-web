import { useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { useLongPress } from './chat/useLongPress';
import type { ChatMessageData, ReplyPreview } from './chat/types';

type Message = ChatMessageData;

interface GalleryPhoto {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
}

interface ChatMessageProps {
  message: Message;
  isMyMessage: boolean;
  onImageClick: (imageUrl: string) => void;
  variant?: 'default' | 'embedded';
  senderName?: string;
  timezone?: string;
  galleryPhotos?: GalleryPhoto[];
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onOpenMenu?: (id: number, pos: { x: number; y: number }) => void;
  onJumpToMessage?: (id: number) => void;
  highlight?: boolean;
}

const PHOTO_REF_PATTERN = /(?:фото\s*)?(?:\((\d+)\)\.(?:jpg|jpeg|png|gif|webp|heic)|(\d+)\.(?:jpg|jpeg|png|gif|webp|heic)|#(\d+)|(?:фото|photo)\s+(\d+))/gi;

function extractPhotoNumber(match: string): number | null {
  const m = match.match(/\((\d+)\)|(\d+)/);
  if (m) return parseInt(m[1] || m[2], 10);
  return null;
}

function findPhotoByRef(num: number, photos: GalleryPhoto[]): GalleryPhoto | undefined {
  const patterns = [`(${num}).jpg`, `(${num}).jpeg`, `(${num}).png`, `${num}.jpg`, `${num}.jpeg`, `${num}.png`];
  for (const pat of patterns) {
    const found = photos.find(p => p.file_name.toLowerCase() === pat.toLowerCase());
    if (found) return found;
  }
  const byNumber = photos.find(p => {
    const nameNum = p.file_name.match(/\(?(\d+)\)?\.(?:jpg|jpeg|png|gif|webp|heic)/i);
    return nameNum && parseInt(nameNum[1], 10) === num;
  });
  return byNumber;
}

function ReplyBadge({
  reply,
  isMyMessage,
  isEmbedded,
  onClick,
}: {
  reply: ReplyPreview;
  isMyMessage: boolean;
  isEmbedded: boolean;
  onClick?: () => void;
}) {
  const borderColor = isEmbedded
    ? 'border-primary/60'
    : isMyMessage
      ? 'border-white/70'
      : 'border-blue-400';
  const bg = isEmbedded
    ? 'bg-black/5 dark:bg-white/10'
    : isMyMessage
      ? 'bg-white/15'
      : 'bg-black/5';
  const who = reply.sender_type === 'client' ? 'Клиент' : 'Фотограф';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`block w-full text-left mb-1.5 rounded-md border-l-2 ${borderColor} ${bg} px-2 py-1 text-xs`}
    >
      <div className="font-semibold truncate opacity-90">{who}</div>
      <div className="flex items-center gap-1.5 truncate opacity-80">
        {reply.image_url && <Icon name={reply.video_url ? 'Video' : 'Image'} size={12} />}
        <span className="truncate">{reply.message || (reply.image_url ? 'Вложение' : '')}</span>
      </div>
    </button>
  );
}

export default function ChatMessage({ 
  message, 
  isMyMessage, 
  onImageClick,
  variant = 'default',
  senderName,
  timezone,
  galleryPhotos = [],
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onOpenMenu,
  onJumpToMessage,
  highlight = false,
}: ChatMessageProps) {
  const matchedPhotos = useMemo(() => {
    if (!message.message || galleryPhotos.length === 0) return [];
    const found: GalleryPhoto[] = [];
    const seen = new Set<number>();
    let match;
    const regex = new RegExp(PHOTO_REF_PATTERN.source, 'gi');
    while ((match = regex.exec(message.message)) !== null) {
      const num = extractPhotoNumber(match[0]);
      if (num !== null && !seen.has(num)) {
        seen.add(num);
        const photo = findPhotoByRef(num, galleryPhotos);
        if (photo) found.push(photo);
      }
    }
    return found;
  }, [message.message, galleryPhotos]);

  const renderMessageText = (text: string) => {
    const splitPattern = /((?:фото\s*)?\(\d+\)\.(?:jpg|jpeg|png|gif|webp|heic)|\d+\.(?:jpg|jpeg|png|gif|webp|heic)|#\d+|(?:фото|photo)\s*\d+)/gi;
    return text.split(splitPattern).map((part, i) => {
      if (splitPattern.test(part)) {
        splitPattern.lastIndex = 0;
        return <span key={i} className="font-semibold underline">{part}</span>;
      }
      splitPattern.lastIndex = 0;
      return part;
    });
  };

  const isEmbedded = variant === 'embedded';
  const isRemoved = !!message.removed_for_all;

  const { longPressHandlers, wasLongPress } = useLongPress(
    (pos) => {
      if (isRemoved) return;
      if (selectionMode) {
        onToggleSelect?.(message.id);
        return;
      }
      onOpenMenu?.(message.id, pos);
    },
    { delay: 450 }
  );

  const handleBubbleClick = (e: React.MouseEvent) => {
    if (wasLongPress()) {
      e.preventDefault();
      return;
    }
    if (selectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggleSelect?.(message.id);
      return;
    }
  };

  const bubbleBase = isEmbedded
    ? isMyMessage
      ? 'bg-primary text-primary-foreground'
      : 'bg-muted text-foreground'
    : isMyMessage
      ? 'bg-blue-500 text-white'
      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white';

  return (
    <div
      data-message-id={message.id}
      className={`flex w-full ${isMyMessage ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 ${highlight ? 'animate-pulse' : ''}`}
    >
      {selectionMode && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.(message.id);
          }}
          className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white border-gray-300'
          }`}
          aria-label={isSelected ? 'Убрать выбор' : 'Выбрать'}
        >
          {isSelected && <Icon name="Check" size={12} />}
        </button>
      )}
      <div className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[66%] ${isMyMessage ? 'items-end' : 'items-start'}`}>
        {senderName && (
          <span className="text-xs text-muted-foreground mb-1 px-1">
            {senderName}
          </span>
        )}
        <div
          {...(isRemoved ? {} : longPressHandlers)}
          onClick={handleBubbleClick}
          className={`relative inline-block w-auto max-w-full rounded-lg px-3 py-2 select-none break-words ${
            isRemoved ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 italic' : bubbleBase
          } ${isSelected ? 'ring-2 ring-blue-400 ring-offset-1' : ''} ${highlight ? 'ring-2 ring-yellow-400' : ''} cursor-pointer`}
          style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
        >
          {isRemoved ? (
            <p className="flex items-center gap-2 text-sm">
              <Icon name="Ban" size={14} />
              Сообщение удалено
            </p>
          ) : (
            <>
              {message.reply_to && (
                <ReplyBadge
                  reply={message.reply_to}
                  isMyMessage={isMyMessage}
                  isEmbedded={isEmbedded}
                  onClick={() => onJumpToMessage?.(message.reply_to!.id)}
                />
              )}
              {message.image_url && !message.video_url && (
                <img
                  src={message.thumbnail_url || message.image_url}
                  alt="Изображение"
                  className="rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity touch-manipulation object-cover"
                  onClick={(e) => {
                    if (selectionMode) return;
                    e.stopPropagation();
                    onImageClick(message.image_url!);
                  }}
                  loading="lazy"
                  style={{
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    width: '180px',
                    height: '180px',
                    maxWidth: '100%',
                  }}
                />
              )}
              {message.video_url && (
                <div className="relative mb-2 inline-block">
                  <video
                    src={message.video_url}
                    poster={message.thumbnail_url || message.image_url}
                    controls
                    playsInline
                    className="rounded-lg"
                    style={{ width: '220px', maxWidth: '100%', maxHeight: '220px' }}
                  />
                </div>
              )}
              {message.message && (
                <p className="whitespace-pre-wrap break-words">
                  {renderMessageText(message.message)}
                </p>
              )}
              {matchedPhotos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {matchedPhotos.map(photo => (
                    <div
                      key={photo.id}
                      className="relative rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ width: 80, height: 80 }}
                      onClick={(e) => {
                        if (selectionMode) return;
                        e.stopPropagation();
                        onImageClick(photo.photo_url);
                      }}
                    >
                      <img
                        src={photo.thumbnail_url || photo.photo_url}
                        alt={photo.file_name}
                        className="object-cover w-full h-full"
                        loading="lazy"
                        style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                        <span className="text-[10px] text-white truncate block">{photo.file_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="flex items-center gap-2 mt-1">
            {message.is_edited && !isRemoved && (
              <span className={`text-[11px] ${isMyMessage && !isEmbedded ? 'text-blue-100' : 'text-gray-500'} italic`}>
                ред.
              </span>
            )}
            <p className={`text-xs ${
              isEmbedded
                ? isMyMessage ? 'opacity-80' : 'text-muted-foreground'
                : isMyMessage ? 'text-blue-100' : 'text-gray-500'
            }`}>
              {new Date(message.created_at + 'Z').toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: timezone || undefined
              })}
            </p>
            {isMyMessage && !isRemoved && (
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
    </div>
  );
}