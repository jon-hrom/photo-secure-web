import { useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  newMessage: string;
  onMessageChange: (message: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
  selectedImages: string[];
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImageRemove: (index: number) => void;
  sending: boolean;
  onFocus?: () => void;
  variant?: 'default' | 'embedded';
}

export default function ChatInput({
  newMessage,
  onMessageChange,
  onSend,
  onKeyPress,
  selectedImages,
  onImageSelect,
  onImageRemove,
  sending,
  onFocus,
  variant = 'default'
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEmbedded = variant === 'embedded';

  return (
    <div className={isEmbedded 
      ? "p-4 border-t bg-background" 
      : "p-3 sm:p-4 border-t dark:border-gray-800 safe-bottom"
    }>
      {selectedImages.length > 0 && (
        <div className="mb-2 flex gap-2 flex-wrap">
          {selectedImages.map((img, index) => (
            <div key={index} className="relative inline-block">
              <img src={img} alt={`Preview ${index + 1}`} className="h-20 w-20 object-cover rounded-lg" />
              <button
                onClick={() => onImageRemove(index)}
                className={isEmbedded
                  ? "absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:opacity-90"
                  : "absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                }
              >
                <Icon name="X" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*,.zip,.rar,.7z"
          multiple
          onChange={onImageSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          className={isEmbedded
            ? "p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
            : "p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          }
          title="Прикрепить фото или архив"
        >
          <Icon 
            name="Paperclip" 
            size={20} 
            className={isEmbedded ? "text-muted-foreground" : "text-gray-600 dark:text-gray-400"} 
          />
        </button>
        <textarea
          value={newMessage}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyPress={onKeyPress}
          onFocus={onFocus}
          placeholder="Введите сообщение..."
          className={isEmbedded
            ? "flex-1 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background"
            : "flex-1 px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          }
          rows={2}
          disabled={sending}
          style={{ fontSize: '16px' }}
        />
        <Button
          onClick={onSend}
          disabled={(!newMessage.trim() && selectedImages.length === 0) || sending}
          className="px-4"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="Send" size={20} />
          )}
        </Button>
      </div>
    </div>
  );
}
