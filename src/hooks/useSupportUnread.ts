import { useState, useEffect, useCallback } from 'react';

const SUPPORT_URL = 'https://functions.poehali.dev/d007b2e4-7b81-49f7-b426-06c2a7aa7d12';

export const useSupportUnread = (userId: number | string | null) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${SUPPORT_URL}?action=unread`, {
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

  const markRead = useCallback(async () => {
    if (!userId) return;
    setUnreadCount(0);
    try {
      await fetch(`${SUPPORT_URL}?action=mark_read`, {
        headers: { 'X-User-Id': String(userId) },
      });
    } catch {
      // silently fail
    }
  }, [userId]);

  return { unreadCount, markRead };
};

export default useSupportUnread;
