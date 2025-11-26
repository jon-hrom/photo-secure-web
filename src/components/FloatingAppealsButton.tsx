import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Appeal, GroupedAppeals } from './appeals/types';
import AppealsListSidebar from './appeals/AppealsListSidebar';
import AppealDetail from './appeals/AppealDetail';

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
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [customSound, setCustomSound] = useState<string | null>(null);
  const previousUnreadCount = useRef<number>(0);
  const hasPlayedInitialSound = useRef<boolean>(false);

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: 20 });
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);

  const fetchAppeals = async () => {
    if (!isAdmin) {
      console.log('[APPEALS] Not admin, skipping fetch');
      return;
    }

    console.log('[APPEALS] Fetching appeals for admin userId:', userId);

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
      console.log('[APPEALS] Response:', { status: response.status, data });

      if (response.ok && data.appeals) {
        console.log('[APPEALS] Got appeals:', data.appeals.length);
        setAppeals(data.appeals);
        const unread = data.appeals.filter((a: Appeal) => !a.is_read && !a.is_archived).length;
        console.log('[APPEALS] Unread count:', unread);
        
        if (!hasPlayedInitialSound.current && unread > 0) {
          console.log('[APPEALS] Playing initial sound');
          playNotificationSound();
          hasPlayedInitialSound.current = true;
        } else if (unread > previousUnreadCount.current && previousUnreadCount.current >= 0) {
          console.log('[APPEALS] Playing new appeal sound');
          playNotificationSound();
        }
        previousUnreadCount.current = unread;
        setUnreadCount(unread);
      } else {
        console.error('[APPEALS] Error in response:', data);
      }
    } catch (error) {
      console.error('[APPEALS] Error fetching appeals:', error);
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

  const groupAppealsByUser = (appeals: Appeal[]): GroupedAppeals[] => {
    const grouped = new Map<string, GroupedAppeals>();
    
    appeals.forEach((appeal) => {
      const key = appeal.user_identifier;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          userIdentifier: appeal.user_identifier,
          userEmail: appeal.user_email,
          appeals: [],
          totalCount: 0,
          unreadCount: 0,
          isBlocked: appeal.is_blocked,
          latestDate: appeal.created_at,
        });
      }
      
      const group = grouped.get(key)!;
      group.appeals.push(appeal);
      group.totalCount++;
      if (!appeal.is_read) group.unreadCount++;
      
      if (new Date(appeal.created_at) > new Date(group.latestDate)) {
        group.latestDate = appeal.created_at;
      }
    });
    
    return Array.from(grouped.values()).sort(
      (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  };

  const archiveAppeal = async (appealId: number) => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'archive_appeal',
          appeal_id: appealId,
          admin_user_id: userId
        }),
      });

      if (response.ok) {
        toast.success('Обращение перенесено в архив');
        await fetchAppeals();
      }
    } catch (error) {
      console.error('Error archiving appeal:', error);
      toast.error('Ошибка при архивировании');
    } finally {
      setLoading(false);
    }
  };

  const deleteAppeal = async (appealId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это обращение?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_appeal',
          appeal_id: appealId,
          admin_user_id: userId
        }),
      });

      if (response.ok) {
        toast.success('Обращение удалено');
        setSelectedAppeal(null);
        await fetchAppeals();
      }
    } catch (error) {
      console.error('Error deleting appeal:', error);
      toast.error('Ошибка при удалении');
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = async (userIdentifier: string) => {
    setLoading(true);
    try {
      const userAppeals = appeals.filter(
        a => a.user_identifier === userIdentifier && !a.is_read
      );

      for (const appeal of userAppeals) {
        await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'mark_appeal_read',
            appeal_id: appeal.id,
            admin_user_id: userId
          }),
        });
      }

      toast.success('Все сообщения отмечены как прочитанные');
      await fetchAppeals();
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Ошибка при обновлении статуса');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[APPEALS_BTN] Component rendered:', { isAdmin, userId });
  }, [isAdmin, userId]);

  if (!isAdmin) {
    console.log('[APPEALS_BTN] Not rendering - isAdmin:', isAdmin);
    return null;
  }

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
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden sm:max-w-[95vw]">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl">
                <Icon name="Mail" size={24} className="text-blue-600 sm:hidden" />
                <Icon name="Mail" size={28} className="text-blue-600 hidden sm:block" />
                <span className="hidden sm:inline">Обращения пользователей</span>
                <span className="sm:hidden">Обращения</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs sm:text-sm px-2 sm:px-3 py-1">
                    {unreadCount}
                  </Badge>
                )}
              </DialogTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDialog(false)}
                className="sm:hidden h-8 w-8 p-0"
              >
                <Icon name="X" size={20} />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 h-[calc(85vh-160px)]">
            <AppealsListSidebar
              appeals={appeals}
              showArchived={showArchived}
              selectedAppeal={selectedAppeal}
              expandedUser={expandedUser}
              loading={loading}
              onToggleArchive={setShowArchived}
              onSelectAppeal={setSelectedAppeal}
              onToggleUserExpanded={setExpandedUser}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              groupAppealsByUser={groupAppealsByUser}
              formatDate={formatDate}
            />

            <div className={`border-l-0 sm:border-l-2 pl-0 sm:pl-4 ${
              selectedAppeal ? 'block' : 'hidden sm:block'
            }`}>
              <AppealDetail
                selectedAppeal={selectedAppeal}
                responseText={responseText}
                loading={loading}
                onBack={() => setSelectedAppeal(null)}
                onMarkAsRead={markAsRead}
                onArchive={archiveAppeal}
                onDelete={deleteAppeal}
                onResponseChange={setResponseText}
                onSendResponse={sendResponse}
                formatDate={formatDate}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FloatingAppealsButton;
