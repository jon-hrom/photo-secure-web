import { useEffect, MutableRefObject } from 'react';
import { getSessionTimeoutMs, touchStoredSession, getStoredLastActivity } from '@/utils/sessionTimeout';

interface UseActivityTrackingProps {
  isAuthenticated: boolean;
  userEmail: string;
  lastActivityRef: MutableRefObject<number>;
  onLogout: () => void;
}

export const useActivityTracking = ({
  isAuthenticated,
  userEmail,
  lastActivityRef,
  onLogout
}: UseActivityTrackingProps) => {
  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivityOnServer = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        if (userEmail) {
          const res = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update-activity', email: userEmail })
          });
          if (!res.ok) {
            console.warn(`[ACTIVITY] Activity tracking failed (${res.status}), continuing...`);
          }
        }
      } catch (error) {
        console.warn('[ACTIVITY] Activity tracking error (non-critical):', error);
      }
    };

    // Реальная последняя активность: максимум из памяти этой страницы и localStorage
    // (туда пишут активность внутренние страницы и другие вкладки).
    const getLastActivity = () => Math.max(lastActivityRef.current || 0, getStoredLastActivity());

    const isExpired = (now: number) => now - getLastActivity() > getSessionTimeoutMs();

    const expire = () => {
      console.log('⏰ Session expired during inactivity. Logging out...');
      onLogout();
      alert('Сессия истекла. Пожалуйста, войдите снова.');
    };

    let lastWrite = 0;
    const updateActivity = () => {
      const now = Date.now();
      if (isExpired(now)) {
        expire();
        return;
      }
      lastActivityRef.current = now;
      // Не чаще раза в 5 секунд пишем в localStorage (scroll/mousemove шлют много событий)
      if (now - lastWrite > 5000) {
        lastWrite = now;
        touchStoredSession(now);
      }
    };

    const checkSession = () => {
      if (isExpired(Date.now())) expire();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkSession();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, updateActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibility);

    const sessionCheckInterval = setInterval(checkSession, 30000);
    const activityUpdateInterval = setInterval(updateActivityOnServer, 60000);

    updateActivityOnServer();

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(sessionCheckInterval);
      clearInterval(activityUpdateInterval);
    };
  }, [isAuthenticated, userEmail, lastActivityRef, onLogout]);
};
