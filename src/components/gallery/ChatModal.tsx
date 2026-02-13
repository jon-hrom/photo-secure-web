import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { playNotificationSound, enableNotificationSound } from '@/utils/notificationSound';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import FullscreenImage from './FullscreenImage';

interface Message {
  id: number;
  message: string;
  sender_type: 'client' | 'photographer';
  created_at: string;
  is_read: boolean;
  is_delivered: boolean;
  image_url?: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  photographerId: number;
  senderType: 'client' | 'photographer';
  clientName?: string;
  photographerName?: string;
  embedded?: boolean;
  onMessageSent?: () => void;
  timezone?: string;
}

export default function ChatModal({ 
  isOpen, 
  onClose, 
  clientId, 
  photographerId, 
  senderType,
  clientName,
  photographerName,
  embedded = false,
  onMessageSent,
  timezone
}: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{dataUrl: string; fileName: string; file?: File}[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await fetch(
        `https://functions.poehali.dev/a083483c-6e5e-4fbc-a120-e896c9bf0a86?client_id=${clientId}&photographer_id=${photographerId}`
      );
      
      if (!response.ok) throw new Error('Ошибка загрузки сообщений');
      
      const data = await response.json();
      const newMessages = data.messages || [];
      
      previousMessageCountRef.current = newMessages.length;
      setMessages(newMessages);
      
      if (!silent) setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      const oppositeType = senderType === 'client' ? 'photographer' : 'client';
      await fetch(`https://functions.poehali.dev/a083483c-6e5e-4fbc-a120-e896c9bf0a86?action=mark_read&client_id=${clientId}&photographer_id=${photographerId}&sender_type=${oppositeType}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const updateTypingStatus = async (isTyping: boolean) => {
    try {
      await fetch(`https://functions.poehali.dev/a083483c-6e5e-4fbc-a120-e896c9bf0a86?action=typing&client_id=${clientId}&photographer_id=${photographerId}&sender_type=${senderType}&is_typing=${isTyping}`, {
        method: 'GET'
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  const checkOpponentTyping = async () => {
    try {
      const response = await fetch(`https://functions.poehali.dev/a083483c-6e5e-4fbc-a120-e896c9bf0a86?action=check_typing&client_id=${clientId}&photographer_id=${photographerId}&sender_type=${senderType}`);
      const data = await response.json();
      setIsOpponentTyping(data.is_typing || false);
    } catch (error) {
      console.error('Error checking typing status:', error);
    }
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (value.trim().length > 0) {
      updateTypingStatus(true);
      typingTimeoutRef.current = setTimeout(() => {
        updateTypingStatus(false);
      }, 3000);
    } else {
      updateTypingStatus(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: {dataUrl: string; fileName: string}[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Проверяем тип файла - для видео нет ограничений, для фото - 50 МБ
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? Infinity : 50 * 1024 * 1024;
      
      if (file.size > maxSize) {
        alert(`Файл ${file.name} слишком большой. Максимальный размер: 50 МБ`);
        continue;
      }
      
      // Для превью создаем data URL
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      
      // Сохраняем оригинальный файл для последующей загрузки
      newImages.push({ 
        dataUrl, 
        fileName: file.name,
        file: file // сохраняем File объект для прямой загрузки
      });
    }
    
    setSelectedImages(prev => [...prev, ...newImages]);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && selectedImages.length === 0) || sending) return;
    
    try {
      setSending(true);
      
      console.log('[CHAT_SEND] Sending message:', {
        client_id: clientId,
        photographer_id: photographerId,
        sender_type: senderType,
        message_length: newMessage.trim().length,
        has_images: selectedImages.length > 0
      });

      // Загружаем файлы напрямую в S3, если есть
      const uploadedImageUrls: string[] = [];
      const base64Images: string[] = [];
      const fileNames: string[] = [];
      
      if (selectedImages.length > 0) {
        console.log('[CHAT_SEND] Preparing files for upload...');
        
        for (const img of selectedImages) {
          base64Images.push(img.dataUrl);
          fileNames.push(img.fileName);
        }
      }
      
      // Отправляем сообщение с готовыми CDN URLs
      const body: Record<string, unknown> = {
        client_id: clientId,
        photographer_id: photographerId,
        message: newMessage.trim(),
        sender_type: senderType
      };
      
      if (base64Images.length > 0) {
        body.images_base64 = base64Images;
        body.file_names = fileNames;
        console.log('[CHAT_SEND] Sending message with', base64Images.length, 'attached files');
      }
      
      const response = await fetch(`https://functions.poehali.dev/a083483c-6e5e-4fbc-a120-e896c9bf0a86`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      console.log('[CHAT_SEND] Response status:', response.status);
      
      if (!response.ok) throw new Error('Ошибка отправки сообщения');
      
      setNewMessage('');
      setSelectedImages([]);
      await loadMessages();
      
      if (onMessageSent) {
        onMessageSent();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Ошибка при отправке сообщения');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageRemove = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (isOpen) {
      enableNotificationSound();
      loadMessages();
      markAsRead();
      
      const interval = setInterval(() => {
        loadMessages(true);
        markAsRead();
        checkOpponentTyping();
      }, 3000);
      
      return () => {
        clearInterval(interval);
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        updateTypingStatus(false);
      };
    }
  }, [isOpen, clientId, photographerId]);

  if (!isOpen) return null;

  if (embedded) {
    return (
      <div className="w-full h-full flex flex-col bg-background">
        <div className="hidden md:flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Icon name="MessageCircle" size={24} className="text-primary" />
            <h2 className="text-xl font-semibold">
              {senderType === 'photographer' ? clientName || 'Чат с клиентом' : 'Чат с фотографом'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 hover:bg-muted rounded-full transition-colors touch-manipulation"
          >
            <Icon name="X" size={20} className="text-muted-foreground" />
          </button>
        </div>

        <div 
          ref={messageContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <ChatMessageList
            messages={messages}
            loading={loading}
            senderType={senderType}
            onImageClick={setFullscreenImage}
            variant="embedded"
            isOpponentTyping={isOpponentTyping}
            clientName={clientName}
            photographerName={photographerName}
            timezone={timezone}
            ref={messagesEndRef}
          />
        </div>

        <ChatInput
          newMessage={newMessage}
          onMessageChange={handleInputChange}
          onSend={sendMessage}
          onKeyPress={handleKeyPress}
          selectedImages={selectedImages}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          sending={sending}
          onFocus={enableNotificationSound}
          variant="embedded"
        />
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-2xl h-[90vh] sm:max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100vh - env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b dark:border-gray-800 safe-top">
          <div className="flex items-center gap-2">
            <Icon name="MessageCircle" size={24} className="text-blue-500" />
            <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
              {senderType === 'photographer' ? clientName || 'Чат с клиентом' : 'Чат с фотографом'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors touch-manipulation"
          >
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        <div 
          ref={messageContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <ChatMessageList
            messages={messages}
            loading={loading}
            senderType={senderType}
            onImageClick={setFullscreenImage}
            variant="default"
            isOpponentTyping={isOpponentTyping}
            clientName={clientName}
            photographerName={photographerName}
            timezone={timezone}
            ref={messagesEndRef}
          />
        </div>

        <ChatInput
          newMessage={newMessage}
          onMessageChange={handleInputChange}
          onSend={sendMessage}
          onKeyPress={handleKeyPress}
          selectedImages={selectedImages}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          sending={sending}
          onFocus={enableNotificationSound}
          variant="default"
        />
      </div>

      {fullscreenImage && (
        <FullscreenImage 
          imageUrl={fullscreenImage}
          onClose={() => setFullscreenImage(null)}
        />
      )}
    </div>
  );
}