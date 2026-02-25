import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const SUPPORT_URL = 'https://functions.poehali.dev/d007b2e4-7b81-49f7-b426-06c2a7aa7d12';
const POLL_INTERVAL = 15000;

interface SupportMessage {
  id: number | string;
  message: string;
  sender: 'user' | 'admin';
  created_at: string;
}

interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  userName?: string;
  userEmail?: string;
}

export default function SupportChatModal({ isOpen, onClose, userId, userName, userEmail }: SupportChatModalProps) {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [newReply, setNewReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const fetchMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(SUPPORT_URL, {
        headers: { 'X-User-Id': String(userId) },
      });
      const data = await res.json();
      const msgs: SupportMessage[] = data.messages || [];
      setMessages(prev => {
        // Если появился новый ответ от поддержки — показать уведомление
        const prevAdminCount = prev.filter(m => m.sender === 'admin').length;
        const newAdminCount = msgs.filter(m => m.sender === 'admin').length;
        if (!silent && prevAdminCount < newAdminCount && prevCountRef.current > 0) {
          setNewReply(true);
        }
        prevCountRef.current = msgs.length;
        return msgs;
      });
    } catch (err) {
      console.error('[SUPPORT] load error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [userId]);

  // Начальная загрузка + поллинг
  useEffect(() => {
    if (!isOpen) return;
    prevCountRef.current = 0;
    fetchMessages(false);
    const interval = setInterval(() => {
      if (isOpenRef.current) fetchMessages(true);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [isOpen, fetchMessages]);

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(messages.length === 1 ? 'instant' : 'smooth');
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = newMessage.trim();
    if (!text || sending) return;
    setSending(true);
    setNewMessage('');
    try {
      const res = await fetch(SUPPORT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
        body: JSON.stringify({ message: text, user_name: userName, user_email: userEmail }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages(prev => [...prev, data.message]);
        prevCountRef.current += 1;
      }
    } catch (err) {
      console.error('[SUPPORT] send error:', err);
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex" onClick={onClose}>
      <div
        className="bg-background w-full h-full md:m-4 md:rounded-xl shadow-2xl flex flex-col overflow-hidden md:max-w-2xl md:mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Icon name="Settings" size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Тех поддержка</h2>
              <p className="text-xs text-muted-foreground">Мы ответим в ближайшее время</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Уведомление о новом ответе */}
        {newReply && (
          <div
            className="mx-4 mt-3 flex items-center gap-2 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 rounded-xl px-4 py-2.5 text-sm cursor-pointer animate-in fade-in slide-in-from-top-2 duration-300"
            onClick={() => { setNewReply(false); scrollToBottom(); }}
          >
            <Icon name="MessageCircleCheck" size={16} className="flex-shrink-0" />
            <span className="flex-1 font-medium">Поддержка ответила на ваш вопрос</span>
            <Icon name="ArrowDown" size={14} className="flex-shrink-0 opacity-60" />
          </div>
        )}

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" onScroll={() => newReply && setNewReply(false)}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3 py-12">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Icon name="MessageCircleQuestion" size={32} className="opacity-40" />
              </div>
              <div className="text-center">
                <p className="font-medium text-foreground mb-1">Есть вопрос?</p>
                <p className="text-sm">Напишите нам — мы поможем разобраться</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Icon name="Settings" size={14} className="text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isUser
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm'
                  }`}>
                    {!isUser && (
                      <p className="text-xs font-semibold text-primary mb-1">Тех поддержка</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={`text-[10px] mt-1 ${isUser ? 'text-primary-foreground/70 text-right' : 'text-muted-foreground'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Ввод сообщения */}
        <div className="p-3 border-t bg-background">
          <div className="flex gap-2 items-end">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите ваш вопрос..."
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-muted px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 min-h-[42px] max-h-32 overflow-y-auto"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 128) + 'px';
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              size="sm"
              className="h-[42px] w-[42px] rounded-xl p-0 flex-shrink-0"
            >
              {sending
                ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                : <Icon name="Send" size={18} />
              }
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            Enter — отправить · Shift+Enter — новая строка
          </p>
        </div>
      </div>
    </div>
  );
}
