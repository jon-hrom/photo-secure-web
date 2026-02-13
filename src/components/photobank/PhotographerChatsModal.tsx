import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import ChatModal from '@/components/gallery/ChatModal';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import { getTimezoneForRegion } from '@/utils/regionTimezone';

interface Chat {
  client_id: number;
  client_name: string;
  client_phone: string;
  client_email: string;
  last_message: string;
  last_message_image: string | null;
  last_sender: 'client' | 'photographer';
  last_message_time: string;
  unread_count: number;
}

interface PhotographerChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  photographerId: number;
}

export default function PhotographerChatsModal({ 
  isOpen, 
  onClose, 
  photographerId 
}: PhotographerChatsModalProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [photographerName, setPhotographerName] = useState<string>('Фотограф');
  const [photographerTimezone, setPhotographerTimezone] = useState<string>('Europe/Moscow');

  // Получаем имя фотографа из localStorage
  useEffect(() => {
    const authSession = localStorage.getItem('authSession');
    const vkUser = localStorage.getItem('vk_user');
    const googleUser = localStorage.getItem('google_user');
    
    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        if (session.userName) {
          setPhotographerName(session.userName);
        }
      } catch {
        // Ignore parse errors
      }
    } else if (vkUser) {
      try {
        const userData = JSON.parse(vkUser);
        const name = `${userData.first_name || ''} ${userData.last_name || ''}`.trim();
        if (name) {
          setPhotographerName(name);
        }
      } catch {
        // Ignore parse errors
      }
    } else if (googleUser) {
      try {
        const userData = JSON.parse(googleUser);
        if (userData.name) {
          setPhotographerName(userData.name);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const loadChats = async () => {
    try {
      setLoading(true);
      const userId = getAuthUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const response = await fetch(
        `https://functions.poehali.dev/5a4dec63-cfc7-46ad-b6dd-449909398c79`,
        {
          headers: {
            'X-User-Id': userId.toString()
          }
        }
      );
      
      if (!response.ok) throw new Error('Ошибка загрузки чатов');
      
      const data = await response.json();
      console.log('[PHOTOGRAPHER_CHATS] Loaded chats:', data);
      setChats(data.chats || []);
      
      if (data.chats && data.chats.length > 0) {
        setSelectedClientId(data.chats[0].client_id);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (clientId: number) => {
    if (!confirm('Удалить всю переписку с этим клиентом?')) return;

    try {
      const userId = getAuthUserId();
      if (!userId) throw new Error('User not authenticated');

      const response = await fetch(
        `https://functions.poehali.dev/5a4dec63-cfc7-46ad-b6dd-449909398c79?client_id=${clientId}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-Id': userId.toString()
          }
        }
      );

      if (!response.ok) throw new Error('Ошибка удаления');

      // Обновляем список чатов
      setChats(prev => prev.filter(c => c.client_id !== clientId));
      
      // Если удаленный чат был выбран, сбрасываем выбор
      if (selectedClientId === clientId) {
        setSelectedClientId(null);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      alert('Не удалось удалить переписку');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadChats();
      const userId = getAuthUserId();
      if (userId) {
        fetch('https://functions.poehali.dev/8ce3cb93-2701-441d-aa3b-e9c0e99a9994', {
          headers: { 'Content-Type': 'application/json', 'X-User-Id': userId.toString() }
        })
          .then(r => r.json())
          .then(data => {
            if (data.success && data.settings?.region) {
              setPhotographerTimezone(getTimezoneForRegion(data.settings.region));
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen]);

  const selectedChat = chats.find(c => c.client_id === selectedClientId);

  if (!isOpen) return null;

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}д назад`;
    } else if (diffHours > 0) {
      return `${diffHours}ч назад`;
    } else if (diffMins > 0) {
      return `${diffMins}м назад`;
    } else {
      return 'только что';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex" onClick={onClose}>
      <div 
        className="bg-background w-full h-full md:m-4 md:rounded-xl shadow-2xl flex flex-col overflow-hidden md:max-w-7xl md:mx-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <Icon name="MessagesSquare" size={24} className="text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Переписки с клиентами</h2>
              <p className="text-sm text-muted-foreground">Чатов: {chats.length}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Контент */}
        <div className="flex-1 flex overflow-hidden">
          {/* Список чатов - скрывается на мобильных если выбран клиент */}
          <div className={`
            w-full md:w-80 border-r flex flex-col bg-background
            ${selectedChat ? 'hidden md:flex' : 'flex'}
          `}>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : chats.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground p-4">
                  <Icon name="Users" size={32} className="mb-2 opacity-50" />
                  <p className="text-sm text-center">Нет активных переписок</p>
                </div>
              ) : (
                chats.map(chat => (
                  <div
                    key={chat.client_id}
                    className={`w-full border-b hover:bg-muted transition-colors group ${
                      selectedClientId === chat.client_id ? 'bg-muted border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-stretch">
                      <button
                        onClick={() => setSelectedClientId(chat.client_id)}
                        className="flex-1 p-4 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{chat.client_name}</p>
                              {chat.unread_count > 0 && (
                                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium text-white bg-red-600 rounded-full">
                                  {chat.unread_count}
                                </span>
                              )}
                            </div>
                            <div className="space-y-0.5">
                              {chat.client_phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Icon name="Phone" size={12} />
                                  {chat.client_phone}
                                </p>
                              )}
                              {chat.client_email && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Icon name="Mail" size={12} />
                                  {chat.client_email}
                                </p>
                              )}
                            </div>
                          </div>
                          <Icon name="ChevronRight" size={16} className="flex-shrink-0 text-muted-foreground" />
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(chat.client_id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity m-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Icon name="Trash2" size={18} />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Область чата - полный экран на мобильных */}
          <div className={`
            flex-1 flex flex-col bg-muted/30
            ${selectedChat ? 'flex' : 'hidden md:flex'}
          `}>
            {selectedChat ? (
              <>
                {/* Кнопка "Назад" на мобильных */}
                <div className="md:hidden flex items-center gap-3 p-3 border-b bg-background">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedClientId(null)}
                    className="flex items-center gap-2"
                  >
                    <Icon name="ChevronLeft" size={20} />
                    Назад
                  </Button>
                </div>

                <ChatModal
                  isOpen={true}
                  onClose={() => {
                    setSelectedClientId(null);
                    loadChats();
                  }}
                  clientId={selectedChat.client_id}
                  photographerId={photographerId}
                  senderType="photographer"
                  clientName={selectedChat.client_name}
                  photographerName={photographerName}
                  embedded={true}
                  onMessageSent={loadChats}
                  timezone={photographerTimezone}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center p-4">
                  <Icon name="MessageSquare" size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Выберите чат для просмотра</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}