import { useMemo } from 'react';
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

export default function ChatMessage({ 
  message, 
  isMyMessage, 
  onImageClick,
  variant = 'default',
  senderName,
  timezone,
  galleryPhotos = []
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
        {matchedPhotos.length > 0 && (
          <div className={`flex flex-wrap gap-1.5 mt-2 ${matchedPhotos.length === 1 ? '' : ''}`}>
            {matchedPhotos.map(photo => (
              <div
                key={photo.id}
                className="relative rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                style={{ width: 80, height: 80 }}
                onClick={() => onImageClick(photo.photo_url)}
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
        <div className="flex items-center gap-2 mt-1">
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