import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { playNotificationSound, enableNotificationSound } from '@/utils/notificationSound';

interface Message {
  id: number;
  message: string;
  sender_type: 'client' | 'photographer';
  created_at: string;
  is_read: boolean;
  image_url?: string;
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  photographerId: number;
  senderType: 'client' | 'photographer';
  clientName?: string;
}

export default function ChatModal({ 
  isOpen, 
  onClose, 
  clientId, 
  photographerId, 
  senderType,
  clientName 
}: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await fetch(
        `https://functions.poehali.dev/4efc4114-28bb-4e58-820d-6275fe30e7c0?client_id=${clientId}&photographer_id=${photographerId}`
      );
      
      if (!response.ok) throw new Error('Ошибка загрузки сообщений');
      
      const data = await response.json();
      const newMessages = data.messages || [];
      
      // Проверяем есть ли новые сообщения от собеседника
      if (silent && previousMessageCountRef.current > 0 && newMessages.length > previousMessageCountRef.current) {
        const latestMessage = newMessages[newMessages.length - 1];
        if (latestMessage.sender_type !== senderType) {
          playNotificationSound();
        }
      }
      
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
      await fetch('https://functions.poehali.dev/4efc4114-28bb-4e58-820d-6275fe30e7c0', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          photographer_id: photographerId,
          mark_as_read: true
        })
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Размер файла не должен превышать 10 МБ');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !selectedImage) || sending) return;
    
    try {
      setSending(true);
      
      const payload: any = {
        client_id: clientId,
        photographer_id: photographerId,
        message: newMessage.trim(),
        sender_type: senderType
      };
      
      if (selectedImage) {
        payload.image = selectedImage.split(',')[1];
      }
      
      const response = await fetch('https://functions.poehali.dev/4efc4114-28bb-4e58-820d-6275fe30e7c0', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) throw new Error('Ошибка отправки сообщения');
      
      setNewMessage('');
      setSelectedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadMessages();
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

  useEffect(() => {
    if (isOpen) {
      enableNotificationSound();
      loadMessages();
      markAsRead();
      
      const interval = setInterval(() => {
        loadMessages(true);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [isOpen, clientId, photographerId]);

  if (!isOpen) return null;

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
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        <div 
          ref={messageContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {loading && messages.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Icon name="MessageCircle" size={48} className="mb-2 opacity-50" />
              <p>Нет сообщений</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isMyMessage = msg.sender_type === senderType;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-lg px-3 py-2 ${
                        isMyMessage
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                      }`}
                    >
                      {msg.image_url && (
                        <img 
                          src={msg.image_url} 
                          alt="Изображение" 
                          className="rounded-lg mb-2 max-w-full cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(msg.image_url, '_blank')}
                        />
                      )}
                      {msg.message && <p className="whitespace-pre-wrap break-words">{msg.message}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <p className={`text-xs ${isMyMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                          {new Date(msg.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        {isMyMessage && msg.is_read && (
                          <Icon name="CheckCheck" size={14} className="text-blue-100" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="p-3 sm:p-4 border-t dark:border-gray-800 safe-bottom">
          {selectedImage && (
            <div className="mb-2 relative inline-block">
              <img src={selectedImage} alt="Preview" className="max-h-32 rounded-lg" />
              <button
                onClick={() => {
                  setSelectedImage(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <Icon name="Image" size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={enableNotificationSound}
              placeholder="Введите сообщение..."
              className="flex-1 px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              rows={2}
              disabled={sending}
              style={{ fontSize: '16px' }}
            />
            <Button
              onClick={sendMessage}
              disabled={(!newMessage.trim() && !selectedImage) || sending}
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
      </div>
    </div>
  );
}