import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface Appeal {
  id: number;
  user_identifier: string;
  user_email: string | null;
  user_phone: string | null;
  auth_method: string;
  message: string;
  block_reason: string | null;
  is_blocked: boolean;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
  admin_response: string | null;
  responded_at: string | null;
}

interface FloatingAppealsButtonProps {
  userId: number;
  isAdmin: boolean;
}

const FloatingAppealsButton = ({ userId, isAdmin }: FloatingAppealsButtonProps) => {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [respondingTo, setRespondingTo] = useState<number | null>(null);
  const [responseText, setResponseText] = useState('');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [customSound, setCustomSound] = useState<string | null>(null);
  const previousUnreadCount = useRef<number>(0);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: 20 });
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  const fetchAppeals = async () => {
    if (!isAdmin) return;

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_appeals',
          admin_user_id: userId
        }),
      });

      const data = await response.json();

      if (response.ok && data.appeals) {
        setAppeals(data.appeals);
        const unread = data.appeals.filter((a: Appeal) => !a.is_read).length;
        
        if (unread > previousUnreadCount.current && previousUnreadCount.current > 0) {
          playNotificationSound();
        }
        previousUnreadCount.current = unread;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error fetching appeals:', error);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAppeals();
      const interval = setInterval(fetchAppeals, 10000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, userId]);

  useEffect(() => {
    const savedSound = localStorage.getItem('admin_notification_sound');
    if (savedSound) {
      setCustomSound(savedSound);
    }
  }, []);

  const playNotificationSound = () => {
    try {
      const soundUrl = customSound || 'data:audio/wav;base64,UklGRmQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAEAACAP4CAf4B/gICAgH+AgIB/gH+AgICAgICAf4CAgH+Af4CAgICAgICAgH+AgICAgH+Af4B/gICAgICAf4CAgICAf4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+AgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+AgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgICAgA==';
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Sound play failed:', err));
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !dragRef.current) return;

    const deltaX = e.clientX - dragRef.current.startX;
    const deltaY = e.clientY - dragRef.current.startY;

    const newX = Math.max(0, Math.min(window.innerWidth - 80, dragRef.current.initialX + deltaX));
    const newY = Math.max(0, Math.min(window.innerHeight - 80, dragRef.current.initialY + deltaY));

    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragRef.current = null;
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const handleClick = () => {
    if (!isDragging) {
      setShowDialog(true);
    }
  };

  const markAsRead = async (appealId: number) => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_appeal_read',
          appeal_id: appealId,
          admin_user_id: userId
        }),
      });

      if (response.ok) {
        toast.success('Отмечено как прочитанное');
        await fetchAppeals();
      }
    } catch (error) {
      console.error('Error marking appeal as read:', error);
      toast.error('Ошибка при обновлении статуса');
    } finally {
      setLoading(false);
    }
  };

  const sendResponse = async (appeal: Appeal) => {
    if (!responseText.trim()) {
      toast.error('Введите текст ответа');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'respond_to_appeal',
          appeal_id: appeal.id,
          admin_user_id: userId,
          admin_response: responseText.trim()
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Ответ отправлен на ${appeal.user_email}`);
        setResponseText('');
        setRespondingTo(null);
        setSelectedAppeal(null);
        await fetchAppeals();
      } else {
        toast.error(data.error || 'Ошибка при отправке ответа');
      }
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdmin) return null;

  return (
    <>
      <div
        className={`fixed z-50 flex items-center justify-center cursor-move ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '80px',
          height: '80px',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform duration-200 border-4 border-white">
            <Icon name="Mail" size={32} className="text-white" />
          </div>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-red-500 border-4 border-white flex items-center justify-center shadow-lg animate-pulse">
              <span className="text-white font-bold text-sm">{unreadCount}</span>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <Icon name="Mail" size={28} className="text-blue-600" />
              Обращения пользователей
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  {unreadCount} новых
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 h-[calc(85vh-120px)]">
            <ScrollArea className="h-full pr-3">
              <div className="space-y-3">
                {appeals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Icon name="Inbox" size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Нет обращений</p>
                  </div>
                ) : (
                  appeals.map((appeal) => (
                    <div
                      key={appeal.id}
                      onClick={() => {
                        setSelectedAppeal(appeal);
                        if (!appeal.is_read) {
                          markAsRead(appeal.id);
                        }
                      }}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedAppeal?.id === appeal.id
                          ? 'bg-blue-50 border-blue-400 shadow-lg scale-[1.02]'
                          : appeal.is_read
                          ? 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          : 'bg-amber-50 border-amber-400 hover:border-amber-500 shadow-md'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon 
                            name={appeal.is_blocked ? 'ShieldAlert' : 'CheckCircle'} 
                            size={20} 
                            className={appeal.is_blocked ? 'text-red-600' : 'text-green-600'}
                          />
                          <span className="font-semibold text-sm">
                            {appeal.user_email || appeal.user_identifier}
                          </span>
                        </div>
                        {!appeal.is_read && (
                          <Badge variant="destructive" className="text-xs">Новое</Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {appeal.message}
                      </p>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{formatDate(appeal.created_at)}</span>
                        {appeal.admin_response && (
                          <Badge variant="outline" className="text-xs">
                            <Icon name="CheckCheck" size={12} className="mr-1" />
                            Отвечено
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="border-l-2 pl-4">
              {selectedAppeal ? (
                <div className="h-full flex flex-col">
                  <div className="flex-1 overflow-auto">
                    <div className="mb-4 pb-4 border-b">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="User" size={20} className="text-blue-600" />
                        <h3 className="font-bold text-lg">{selectedAppeal.user_email || selectedAppeal.user_identifier}</h3>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                        <div className="flex items-center gap-2">
                          <Icon name="Mail" size={16} className="text-muted-foreground" />
                          <span>{selectedAppeal.user_email || 'Нет email'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Icon name="Clock" size={16} className="text-muted-foreground" />
                          <span>{formatDate(selectedAppeal.created_at)}</span>
                        </div>
                      </div>

                      {selectedAppeal.is_blocked && selectedAppeal.block_reason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                          <div className="flex items-start gap-2">
                            <Icon name="ShieldAlert" size={18} className="text-red-600 mt-0.5" />
                            <div>
                              <p className="font-semibold text-sm text-red-900 mb-1">Причина блокировки:</p>
                              <p className="text-sm text-red-700">{selectedAppeal.block_reason}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="font-semibold text-sm text-blue-900 mb-2">Сообщение от пользователя:</p>
                        <p className="text-sm text-blue-800 whitespace-pre-wrap">{selectedAppeal.message}</p>
                      </div>

                      {selectedAppeal.admin_response && (
                        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon name="CheckCircle" size={18} className="text-green-600" />
                            <p className="font-semibold text-sm text-green-900">Ваш ответ:</p>
                          </div>
                          <p className="text-sm text-green-800 whitespace-pre-wrap">{selectedAppeal.admin_response}</p>
                          <p className="text-xs text-green-600 mt-2">
                            Отправлено: {formatDate(selectedAppeal.responded_at!)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t">
                    <Label htmlFor="response" className="text-sm font-semibold mb-2 block">
                      Ответ пользователю (будет отправлен на email):
                    </Label>
                    <Textarea
                      id="response"
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Напишите ответ пользователю..."
                      className="min-h-[120px] resize-none mb-3"
                      disabled={loading}
                    />
                    <Button
                      onClick={() => sendResponse(selectedAppeal)}
                      disabled={loading || !responseText.trim()}
                      className="w-full"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                          Отправка...
                        </>
                      ) : (
                        <>
                          <Icon name="Send" size={18} className="mr-2" />
                          Отправить ответ на email
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Icon name="MousePointerClick" size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Выберите обращение для просмотра</p>
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

export default FloatingAppealsButton;