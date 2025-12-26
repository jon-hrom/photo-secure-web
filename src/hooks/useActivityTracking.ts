import { useEffect, MutableRefObject } from 'react';

const getSessionTimeout = async (): Promise<number> => {
  try {
    const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=session_timeout_minutes');
    const data = await response.json();
    return (data.value || 7) * 60 * 1000;
  } catch (error) {
    return 7 * 60 * 1000;
  }
};

let SESSION_TIMEOUT = 7 * 60 * 1000;

getSessionTimeout().then(timeout => {
  SESSION_TIMEOUT = timeout;
});

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

    const updateActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      
      const savedSession = localStorage.getItem('authSession');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          localStorage.setItem('authSession', JSON.stringify({
            ...session,
            lastActivity: now,
          }));
        } catch (error) {
          console.error('Ошибка обновления активности:', error);
        }
      }
    };

    const checkSession = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      if (timeSinceLastActivity > SESSION_TIMEOUT) {
        onLogout();
        alert('Сессия истекла. Пожалуйста, войдите снова.');
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => window.addEventListener(event, updateActivity));

    const sessionCheckInterval = setInterval(checkSession, 30000);
    const activityUpdateInterval = setInterval(updateActivityOnServer, 60000);
    
    updateActivityOnServer();

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(sessionCheckInterval);
      clearInterval(activityUpdateInterval);
    };
  }, [isAuthenticated, userEmail, lastActivityRef, onLogout]);
};