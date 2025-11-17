import { useEffect, MutableRefObject } from 'react';

const SESSION_TIMEOUT = 7 * 60 * 1000;

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
        const vkUser = localStorage.getItem('vk_user');
        
        if (vkUser) {
          const userData = JSON.parse(vkUser);
          console.log('🔄 Обновление активности VK пользователя:', userData.vk_id || userData.user_id);
          await fetch('https://functions.poehali.dev/d90ae010-c236-4173-bf65-6a3aef34156c', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update-activity', vk_id: userData.vk_id || userData.user_id })
          });
          console.log('✅ Активность обновлена');
        } else if (userEmail) {
          console.log('🔄 Обновление активности Email пользователя:', userEmail);
          await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update-activity', email: userEmail })
          });
          console.log('✅ Активность обновлена');
        }
      } catch (error) {
        console.error('Ошибка обновления активности на сервере:', error);
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
    const activityUpdateInterval = setInterval(updateActivityOnServer, 30000);
    
    updateActivityOnServer();

    return () => {
      events.forEach(event => window.removeEventListener(event, updateActivity));
      clearInterval(sessionCheckInterval);
      clearInterval(activityUpdateInterval);
    };
  }, [isAuthenticated, userEmail, lastActivityRef, onLogout]);
};