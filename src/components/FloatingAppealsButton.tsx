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
  is_archived: boolean;
  created_at: string;
  read_at: string | null;
  admin_response: string | null;
  responded_at: string | null;
}

interface GroupedAppeals {
  userIdentifier: string;
  userEmail: string | null;
  appeals: Appeal[];
  totalCount: number;
  unreadCount: number;
  isBlocked: boolean;
  latestDate: string;
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

          <div className="flex items-center gap-2 mb-3 px-1">
            <Button
              variant={showArchived ? 'outline' : 'default'}
              size="sm"
              onClick={() => setShowArchived(false)}
              className="text-xs"
            >
              <Icon name="Inbox" size={14} className="mr-1" />
              Активные
            </Button>
            <Button
              variant={showArchived ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowArchived(true)}
              className="text-xs"
            >
              <Icon name="Archive" size={14} className="mr-1" />
              Архив
            </Button>
          </div>

          <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 h-[calc(85vh-160px)]">
            <ScrollArea className={`h-full pr-0 sm:pr-3 ${
              selectedAppeal ? 'hidden sm:block' : 'block'
            }`}>
              <div className="space-y-2">
                {appeals.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Icon name="Inbox" size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Нет обращений</p>
                  </div>
                ) : (
                  (() => {
                    const filteredAppeals = appeals.filter(a => 
                      showArchived ? a.is_archived : !a.is_archived
                    );
                    const grouped = groupAppealsByUser(filteredAppeals);
                    
                    return grouped.map((group) => (
                      <div key={group.userIdentifier} className="border rounded-lg overflow-hidden">
                        <div
                          onClick={() => {
                            if (expandedUser === group.userIdentifier) {
                              setExpandedUser(null);
                            } else {
                              setExpandedUser(group.userIdentifier);
                            }
                          }}
                          className={`p-3 cursor-pointer transition-colors ${
                            group.unreadCount > 0
                              ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Icon 
                                name={expandedUser === group.userIdentifier ? 'ChevronDown' : 'ChevronRight'} 
                                size={16}
                                className="shrink-0"
                              />
                              <Icon 
                                name={group.isBlocked ? 'ShieldAlert' : 'User'} 
                                size={16} 
                                className={`shrink-0 ${group.isBlocked ? 'text-red-600' : 'text-blue-600'}`}
                              />
                              <span className="font-semibold text-xs sm:text-sm truncate">
                                {group.userEmail || group.userIdentifier}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {group.unreadCount > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {group.unreadCount}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {group.totalCount}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {expandedUser === group.userIdentifier && (
                          <div className="border-t">
                            <div className="p-2 bg-muted/50 flex items-center gap-1 border-b">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAllAsRead(group.userIdentifier);
                                }}
                                disabled={loading || group.unreadCount === 0}
                                className="h-7 text-xs"
                              >
                                <Icon name="CheckCheck" size={12} className="mr-1" />
                                Все прочитано
                              </Button>
                            </div>
                            {group.appeals.map((appeal) => (
                              <div
                                key={appeal.id}
                                onClick={() => {
                                  setSelectedAppeal(appeal);
                                  if (!appeal.is_read) {
                                    markAsRead(appeal.id);
                                  }
                                }}
                                className={`p-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                                  selectedAppeal?.id === appeal.id
                                    ? 'bg-blue-100'
                                    : !appeal.is_read
                                    ? 'bg-amber-50 hover:bg-amber-100'
                                    : 'bg-white hover:bg-gray-50'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 flex-1">
                                    {appeal.message}
                                  </p>
                                  {!appeal.is_read && (
                                    <Badge variant="destructive" className="text-xs ml-2 shrink-0">Новое</Badge>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <span>{formatDate(appeal.created_at)}</span>
                                  {appeal.admin_response && (
                                    <Badge variant="outline" className="text-xs">
                                      <Icon name="CheckCheck" size={10} className="mr-1" />
                                      Отвечено
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ));
                  })()
                )}
              </div>
            </ScrollArea>

            <div className={`border-l-0 sm:border-l-2 pl-0 sm:pl-4 ${
              selectedAppeal ? 'block' : 'hidden sm:block'
            }`}>
              {selectedAppeal ? (
                <div className="h-full flex flex-col">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAppeal(null)}
                    className="sm:hidden mb-3 self-start -ml-2"
                  >
                    <Icon name="ArrowLeft" size={20} className="mr-2" />
                    Назад
                  </Button>
                  <div className="flex-1 overflow-auto">
                    <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b">
                      <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Icon name="User" size={18} className="text-blue-600 sm:hidden" />
                          <Icon name="User" size={20} className="text-blue-600 hidden sm:block" />
                          <h3 className="font-bold text-base sm:text-lg truncate">{selectedAppeal.user_email || selectedAppeal.user_identifier}</h3>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!selectedAppeal.is_read && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markAsRead(selectedAppeal.id)}
                              disabled={loading}
                              className="h-7 text-xs"
                              title="Отметить как прочитанное"
                            >
                              <Icon name="Check" size={12} />
                            </Button>
                          )}
                          {!selectedAppeal.is_archived ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => archiveAppeal(selectedAppeal.id)}
                              disabled={loading}
                              className="h-7 text-xs"
                              title="В архив"
                            >
                              <Icon name="Archive" size={12} />
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              <Icon name="Archive" size={10} className="mr-1" />
                              В архиве
                            </Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => deleteAppeal(selectedAppeal.id)}
                            disabled={loading}
                            className="h-7 text-xs text-red-600 hover:text-red-700"
                            title="Удалить обращение"
                          >
                            <Icon name="Trash2" size={12} />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm mb-3 sm:mb-4">
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

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                        <p className="font-semibold text-xs sm:text-sm text-blue-900 mb-2">Сообщение от пользователя:</p>
                        <p className="text-xs sm:text-sm text-blue-800 whitespace-pre-wrap break-words">{selectedAppeal.message}</p>
                      </div>

                      {selectedAppeal.admin_response && (
                        <div className="mt-3 sm:mt-4 bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon name="CheckCircle" size={18} className="text-green-600" />
                            <p className="font-semibold text-xs sm:text-sm text-green-900">Ваш ответ:</p>
                          </div>
                          <p className="text-xs sm:text-sm text-green-800 whitespace-pre-wrap break-words">{selectedAppeal.admin_response}</p>
                          <p className="text-xs text-green-600 mt-2">
                            Отправлено: {formatDate(selectedAppeal.responded_at!)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto pt-3 sm:pt-4 border-t">
                    <Label htmlFor="response" className="text-xs sm:text-sm font-semibold mb-2 block">
                      Ответ пользователю (будет отправлен на email):
                    </Label>
                    <Textarea
                      id="response"
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Напишите ответ пользователю..."
                      className="min-h-[100px] sm:min-h-[120px] resize-none mb-3 text-sm"
                      disabled={loading}
                    />
                    <Button
                      onClick={() => sendResponse(selectedAppeal)}
                      disabled={loading || !responseText.trim()}
                      className="w-full text-sm sm:text-base"
                      size="default"
                    >
                      {loading ? (
                        <>
                          <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                          <span className="hidden sm:inline">Отправка...</span>
                          <span className="sm:hidden">Отправка</span>
                        </>
                      ) : (
                        <>
                          <Icon name="Send" size={16} className="mr-2" />
                          <span className="hidden sm:inline">Отправить ответ на email</span>
                          <span className="sm:hidden">Отправить</span>
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