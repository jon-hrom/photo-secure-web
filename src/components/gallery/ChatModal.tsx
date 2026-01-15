import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface Message {
  id: number;
  message: string;
  sender_type: 'client' | 'photographer';
  created_at: string;
  is_read: boolean;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://functions.poehali.dev/53960ae3-2519-432d-85c8-395435f0f401?client_id=${clientId}&photographer_id=${photographerId}`
      );
      
      if (!response.ok) throw new Error('Ошибка загрузки сообщений');
      
      const data = await response.json();
      setMessages(data.messages || []);
      
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    try {
      await fetch('https://functions.poehali.dev/53960ae3-2519-432d-85c8-395435f0f401', {
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

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    
    try {
      setSending(true);
      const response = await fetch('https://functions.poehali.dev/53960ae3-2519-432d-85c8-395435f0f401', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          photographer_id: photographerId,
          message: newMessage.trim(),
          sender_type: senderType
        })
      });
      
      if (!response.ok) throw new Error('Ошибка отправки сообщения');
      
      setNewMessage('');
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
      loadMessages();
      markAsRead();
      
      const interval = setInterval(() => {
        loadMessages();
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
                      <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                      <p className={`text-xs mt-1 ${isMyMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                        {new Date(msg.created_at).toLocaleString('ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="p-3 sm:p-4 border-t dark:border-gray-800 safe-bottom">
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение..."
              className="flex-1 px-3 py-2 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
              rows={2}
              disabled={sending}
              style={{ fontSize: '16px' }}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
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