import { useState, useEffect, useCallback } from 'react';

const MAX_API_URL = 'https://functions.poehali.dev/0a053c97-18f2-42c4-95e3-8f02894ee0c1';
const CLIENT_MESSAGES_UNREAD_URL = 'https://functions.poehali.dev/ac9cc03a-3a9c-4359-acca-5cf58252f6d1';

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

      // Параллельно считаем непрочитанные из MAX-мессенджера и из чатов с клиентами
      const [maxResp, clientResp] = await Promise.all([
        fetch(`${MAX_API_URL}?action=unread_count`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': String(userId),
            'X-Session-Token': token,
          },
        }).catch(() => null),
        fetch(`${CLIENT_MESSAGES_UNREAD_URL}?action=total&photographer_id=${encodeURIComponent(String(userId))}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => null),
      ]);

      let maxCount = 0;
      let clientCount = 0;

      if (maxResp && maxResp.ok) {
        const data = await maxResp.json();
        maxCount = Number(data.unread_count) || 0;
      }
      if (clientResp && clientResp.ok) {
        const data = await clientResp.json();
        clientCount = Number(data.unread_count) || 0;
      }

      setUnreadCount(maxCount + clientCount);
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
