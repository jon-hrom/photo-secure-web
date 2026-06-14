import { useState, useEffect, useCallback } from 'react';
import { SUPPORT_TICKETS_URL } from '@/components/support/supportTicketsApi';

export const useSupportUnread = (userId: number | string | null) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${SUPPORT_TICKETS_URL}?action=unread`, {
        headers: { 'X-User-Id': String(userId) },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // silently fail
    }
  }, [userId]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const markRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return { unreadCount, markRead };
};

export default useSupportUnread;