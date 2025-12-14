import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import WhatsAppChatList from '@/components/whatsapp/WhatsAppChatList';
import WhatsAppMessageView from '@/components/whatsapp/WhatsAppMessageView';
import WhatsAppNewChatDialog from '@/components/whatsapp/WhatsAppNewChatDialog';

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
  isOpen?: boolean;
  onClose?: () => void;
}

const WhatsAppMessenger = ({ userId, isOpen = false, onClose }: WhatsAppMessengerProps) => {
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
  const [showDialog, setShowDialog] = useState(isOpen);
  
  useEffect(() => {
    setShowDialog(isOpen);
  }, [isOpen]);
  
  const [unreadCount, setUnreadCount] = useState(0);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [newChatName, setNewChatName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
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
    // Запускаем polling только если диалог открыт
    if (!showDialog) return;
    
    fetchChats();
    fetchUnreadCount();
    
    const interval = setInterval(() => {
      if (!showDialog) return; // Проверяем перед каждым запросом
      
      fetchUnreadCount();
      fetchChats();
      
      if (selectedChat) {
        fetchMessages(selectedChat.id);
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [userId, sessionToken, selectedChat, showDialog]);

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

  const handleCreateChat = async () => {
    if (!newChatPhone.trim()) {
      toast.error('Введите номер телефона');
      return;
    }
    
    const welcomeMessage = `Здравствуйте${newChatName ? ', ' + newChatName : ''}! 👋`;
    
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
          phone: newChatPhone.trim(),
          message: welcomeMessage,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Чат создан');
        setShowNewChatDialog(false);
        setNewChatPhone('');
        setNewChatName('');
        await fetchChats();
      } else {
        toast.error(data.error || 'Ошибка создания чата');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      toast.error('Ошибка сети');
    } finally {
      setSending(false);
    }
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

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open && onClose) onClose();
      }}>
        <DialogContent className="max-w-5xl max-h-[85vh] p-0">
          <div className="flex h-[80vh]">
            <WhatsAppChatList
              chats={chats}
              selectedChat={selectedChat}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onChatSelect={handleChatSelect}
              onNewChatClick={() => setShowNewChatDialog(true)}
              formatTime={formatTime}
            />

            <div className="flex-1 flex flex-col">
              <WhatsAppMessageView
                selectedChat={selectedChat}
                messages={messages}
                loading={loading}
                messageText={messageText}
                sending={sending}
                messagesEndRef={messagesEndRef}
                onMessageChange={setMessageText}
                onSendMessage={sendMessage}
                formatTime={formatTime}
                formatDate={formatDate}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <WhatsAppNewChatDialog
        open={showNewChatDialog}
        newChatPhone={newChatPhone}
        newChatName={newChatName}
        sending={sending}
        onOpenChange={setShowNewChatDialog}
        onPhoneChange={setNewChatPhone}
        onNameChange={setNewChatName}
        onCreateChat={handleCreateChat}
      />
    </>
  );
};

export default WhatsAppMessenger;