import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface WhatsAppChat {
  id: number;
  phone_number: string;
  contact_name: string | null;
  last_message_text: string | null;
  last_message_time: string | null;
  unread_count: number;
  is_admin_chat: boolean;
}

interface WhatsAppMessage {
  id: number;
  message_text: string;
  is_from_me: boolean;
  timestamp: string;
  status: string;
  is_read: boolean;
}

interface WhatsAppMessengerProps {
  userId: number;
}

const WhatsAppMessenger = ({ userId }: WhatsAppMessengerProps) => {
  // Получаем session token из localStorage
  const getSessionToken = () => {
    const authSession = localStorage.getItem('authSession');
    if (authSession) {
      const session = JSON.parse(authSession);
      return `user_${session.userId}_${Date.now()}`;
    }
    const vkToken = localStorage.getItem('auth_token');
    return vkToken || '';
  };
  
  const [sessionToken] = useState(getSessionToken());
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Звук уведомления (простой beep)
  useEffect(() => {
    // Создаём простой звук уведомления через Web Audio API
    const createBeep = () => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
        
        return audioContext;
      } catch (e) {
        console.log('Web Audio API not supported:', e);
        return null;
      }
    };
    
    // Функция для воспроизведения
    audioRef.current = { play: createBeep } as any;
  }, []);

  const API_URL = 'https://functions.poehali.dev/0a053c97-18f2-42c4-95e3-8f02894ee0c1';

  const fetchChats = async () => {
    try {
      const response = await fetch(`${API_URL}?action=chats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': String(userId),
          'X-Session-Token': sessionToken,
        },
      });

      const data = await response.json();

      if (response.ok && data.chats) {
        setChats(data.chats);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API_URL}?action=unread_count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': String(userId),
          'X-Session-Token': sessionToken,
        },
      });

      const data = await response.json();

      if (response.ok) {
        const newCount = data.unread_count || 0;
        
        // Воспроизводим звук если появились новые сообщения
        if (newCount > unreadCount && unreadCount > 0) {
          playNotificationSound();
        }
        
        setUnreadCount(newCount);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const fetchMessages = async (chatId: number) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}?action=messages&chat_id=${chatId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': String(userId),
          'X-Session-Token': sessionToken,
        },
      });

      const data = await response.json();

      if (response.ok && data.messages) {
        setMessages(data.messages);
        scrollToBottom();
        
        // Отмечаем как прочитанные
        await markAsRead(chatId);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (chatId: number) => {
    try {
      await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': String(userId),
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({
          action: 'mark_as_read',
          chat_id: chatId,
        }),
      });
      
      // Обновляем счётчик
      await fetchUnreadCount();
      await fetchChats();
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedChat) return;

    setSending(true);
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': String(userId),
          'X-Session-Token': sessionToken,
        },
        body: JSON.stringify({
          action: 'send_message',
          phone: selectedChat.phone_number,
          message: messageText.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Сообщение отправлено');
        setMessageText('');
        await fetchMessages(selectedChat.id);
        await fetchChats();
      } else {
        toast.error(data.error || 'Ошибка отправки сообщения');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Ошибка сети');
    } finally {
      setSending(false);
    }
  };

  const playNotificationSound = () => {
    if (audioRef.current && audioRef.current.play) {
      try {
        audioRef.current.play();
      } catch (e) {
        console.log('Audio play error:', e);
      }
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchChats();
    fetchUnreadCount();
    
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchChats();
      
      if (selectedChat) {
        fetchMessages(selectedChat.id);
      }
    }, 10000); // Каждые 10 секунд
    
    return () => clearInterval(interval);
  }, [userId, sessionToken, selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleChatSelect = (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    
    if (date.toDateString() === today.toDateString()) {
      return 'Сегодня';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Вчера';
    }
    
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <>
      <Button
        onClick={() => setShowDialog(true)}
        className="fixed bottom-6 right-6 rounded-full shadow-2xl z-50 h-14 w-14 p-0"
        size="lg"
        variant={unreadCount > 0 ? "default" : "secondary"}
      >
        <div className="relative">
          <Icon name="MessageCircle" size={24} />
          {unreadCount > 0 && (
            <Badge className="absolute -top-2 -right-2 bg-red-500 text-white h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </div>
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] p-0">
          <div className="flex h-[80vh]">
            {/* Список чатов */}
            <div className="w-1/3 border-r flex flex-col">
              <DialogHeader className="p-4 border-b">
                <DialogTitle className="flex items-center gap-2">
                  <Icon name="MessageCircle" size={24} className="text-green-600" />
                  WhatsApp
                </DialogTitle>
              </DialogHeader>
              
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {chats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Icon name="MessageSquare" size={48} className="mx-auto mb-2 opacity-50" />
                      <p>Нет диалогов</p>
                    </div>
                  ) : (
                    chats.map((chat) => (
                      <div
                        key={chat.id}
                        onClick={() => handleChatSelect(chat)}
                        className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors mb-1 ${
                          selectedChat?.id === chat.id ? 'bg-green-50 border-2 border-green-200' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                              <Icon name="User" size={20} className="text-green-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm truncate">
                                {chat.contact_name || chat.phone_number}
                              </h4>
                              <p className="text-xs text-muted-foreground truncate">
                                {chat.phone_number}
                              </p>
                            </div>
                          </div>
                          {chat.unread_count > 0 && (
                            <Badge className="bg-green-600 text-white text-xs">
                              {chat.unread_count}
                            </Badge>
                          )}
                        </div>
                        {chat.last_message_text && (
                          <p className="text-xs text-muted-foreground truncate ml-12">
                            {chat.last_message_text}
                          </p>
                        )}
                        {chat.last_message_time && (
                          <p className="text-xs text-muted-foreground ml-12">
                            {formatTime(chat.last_message_time)}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Окно сообщений */}
            <div className="flex-1 flex flex-col">
              {selectedChat ? (
                <>
                  {/* Заголовок чата */}
                  <div className="p-4 border-b bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Icon name="User" size={20} className="text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold">
                          {selectedChat.contact_name || selectedChat.phone_number}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {selectedChat.phone_number}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Сообщения */}
                  <ScrollArea className="flex-1 p-4">
                    {loading ? (
                      <div className="flex justify-center py-8">
                        <Icon name="Loader" size={32} className="animate-spin text-gray-400" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Icon name="MessageSquare" size={48} className="mx-auto mb-2 opacity-50" />
                        <p>Нет сообщений</p>
                        <p className="text-xs mt-1">Начните диалог первым</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg, idx) => {
                          const showDate = idx === 0 || 
                            new Date(messages[idx - 1].timestamp).toDateString() !== 
                            new Date(msg.timestamp).toDateString();
                          
                          return (
                            <div key={msg.id}>
                              {showDate && (
                                <div className="text-center my-4">
                                  <span className="text-xs bg-gray-200 px-3 py-1 rounded-full">
                                    {formatDate(msg.timestamp)}
                                  </span>
                                </div>
                              )}
                              <div className={`flex ${msg.is_from_me ? 'justify-end' : 'justify-start'}`}>
                                <div
                                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                    msg.is_from_me
                                      ? 'bg-green-100 text-gray-900'
                                      : 'bg-gray-100 text-gray-900'
                                  }`}
                                >
                                  <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
                                  <div className="flex items-center justify-end gap-1 mt-1">
                                    <span className="text-xs text-gray-500">
                                      {formatTime(msg.timestamp)}
                                    </span>
                                    {msg.is_from_me && (
                                      <Icon 
                                        name={msg.is_read ? 'CheckCheck' : 'Check'} 
                                        size={14} 
                                        className={msg.is_read ? 'text-blue-500' : 'text-gray-400'} 
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </div>
                    )}
                  </ScrollArea>

                  {/* Поле ввода */}
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Textarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Введите сообщение..."
                        className="flex-1 min-h-[60px] max-h-[120px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!messageText.trim() || sending}
                        className="bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        {sending ? (
                          <Icon name="Loader" size={20} className="animate-spin" />
                        ) : (
                          <Icon name="Send" size={20} />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Icon name="MessageCircle" size={64} className="mx-auto mb-4 opacity-30" />
                    <p>Выберите чат для начала общения</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WhatsAppMessenger;