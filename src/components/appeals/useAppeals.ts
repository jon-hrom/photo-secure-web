import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Appeal, GroupedAppeals } from './types';

interface UseAppealsParams {
  userId: number;
  isAdmin: boolean;
  openSignal?: number;
}

export function useAppeals({ userId, isAdmin, openSignal }: UseAppealsParams) {
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

  const fetchAppeals = async () => {
    if (!isAdmin) {
      return;
    }

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
        const unread = data.appeals.filter((a: Appeal) => !a.is_read && !a.is_archived).length;
        
        if (!hasPlayedInitialSound.current && unread > 0) {
          playNotificationSound();
          hasPlayedInitialSound.current = true;
        } else if (unread > previousUnreadCount.current && previousUnreadCount.current >= 0) {
          playNotificationSound();
        }
        previousUnreadCount.current = unread;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('[APPEALS] Error fetching appeals:', error);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAppeals();
      const interval = setInterval(fetchAppeals, 60000);
      return () => clearInterval(interval);
    }
  }, [isAdmin, userId]);

  useEffect(() => {
    const savedSound = localStorage.getItem('admin_notification_sound');
    if (savedSound) {
      setCustomSound(savedSound);
    }
  }, []);

  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setShowDialog(true);
    }
  }, [openSignal]);

  const playNotificationSound = () => {
    try {
      const soundUrl = customSound || 'data:audio/wav;base64,UklGRmQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAEAACAP4CAf4B/gICAgH+AgIB/gH+AgICAgICAf4CAgH+Af4CAgICAgICAgH+AgICAgH+Af4B/gICAgICAf4CAgICAf4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+AgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+AgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgICAgA==';
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch {
      // ignore sound errors
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

  const sendResponse = async (appeal: Appeal, mode: 'email' | 'chat' = 'email') => {
    if (!responseText.trim()) {
      toast.error('Введите текст ответа');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'chat' && appeal.is_support) {
        // Отправляем через respond_to_appeal — оно пишет admin_response в БД
        const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'respond_to_appeal',
            appeal_id: appeal.id,
            admin_user_id: userId,
            admin_response: responseText.trim(),
            skip_email: true
          }),
        });
        const data = await response.json();
        if (response.ok && data.success) {
          toast.success('Ответ отправлен в чат пользователю');
          setResponseText('');
          setRespondingTo(null);
          setSelectedAppeal(null);
          await fetchAppeals();
        } else {
          toast.error(data.error || 'Ошибка при отправке');
        }
      } else {
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
          toast.success(`Ответ отправлен на ${appeal.user_email || 'email'}`);
          setResponseText('');
          setRespondingTo(null);
          setSelectedAppeal(null);
          await fetchAppeals();
        } else {
          toast.error(data.error || 'Ошибка при отправке ответа');
        }
      }
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const decideRegistration = async (appeal: Appeal, approve: boolean) => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
        body: JSON.stringify({
          action: approve ? 'approve-registration' : 'reject-registration',
          user_id: appeal.user_identifier,
          admin_id: userId,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(approve ? 'Регистрация одобрена — фотограф уведомлён' : 'Заявка отклонена');
        setSelectedAppeal(null);
        await fetchAppeals();
      } else {
        toast.error(data.error || 'Не удалось обработать заявку');
      }
    } catch (error) {
      console.error('Error deciding registration:', error);
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const raw = dateString.includes('Z') || dateString.includes('+') ? dateString : dateString.replace(' ', 'T') + 'Z';
    const date = new Date(raw);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Samara'
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

  return {
    appeals,
    showDialog,
    setShowDialog,
    unreadCount,
    loading,
    respondingTo,
    responseText,
    setResponseText,
    selectedAppeal,
    setSelectedAppeal,
    expandedUser,
    setExpandedUser,
    showArchived,
    setShowArchived,
    markAsRead,
    sendResponse,
    decideRegistration,
    formatDate,
    groupAppealsByUser,
    archiveAppeal,
    deleteAppeal,
    markAllAsRead,
  };
}

export default useAppeals;
