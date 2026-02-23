import { useState, useEffect, useCallback } from 'react';

const MAX_API_URL = 'https://functions.poehali.dev/0a053c97-18f2-42c4-95e3-8f02894ee0c1';

const getSessionToken = () => {
  const authSession = localStorage.getItem('authSession');
  if (authSession) {
    try {
      const session = JSON.parse(authSession);
      return `user_${session.userId}_${Date.now()}`;
    } catch {
      return '';
    }
  }
  return localStorage.getItem('auth_token') || '';
};

export const useUnreadCount = (userId: number | string | null) => {
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) return;
    try {
      const token = getSessionToken();
      const response = await fetch(`${MAX_API_URL}?action=unread_count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': String(userId),
          'X-Session-Token': token,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // silently fail
    }
  }, [userId]);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return unreadCount;
};

export default useUnreadCount;
