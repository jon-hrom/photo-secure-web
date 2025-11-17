import { useEffect, useRef } from 'react';

const FUNC2URL = {
  'auth': 'https://functions.yandexcloud.net/d4e76olsffutfp4kpj9u',
  'vk-auth': 'https://functions.yandexcloud.net/d4e8n9lhp1umukr5j8t5'
};

interface UseOnlineStatusProps {
  userId: string | number | null;
  userEmail: string | null;
  vkId: string | null;
  isAuthenticated: boolean;
}

export const useOnlineStatus = ({ userId, userEmail, vkId, isAuthenticated }: UseOnlineStatusProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isAuthenticated) return;

    const updateActivity = async () => {
      try {
        if (vkId) {
          await fetch(FUNC2URL['vk-auth'], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update-activity',
              vk_id: vkId
            })
          });
        } else if (userEmail) {
          await fetch(FUNC2URL['auth'], {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update-activity',
              email: userEmail
            })
          });
        }
      } catch (error) {
        console.error('Failed to update activity:', error);
      }
    };

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    updateActivity();

    intervalRef.current = setInterval(() => {
      updateActivity();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [isAuthenticated, userEmail, vkId]);

  return { lastActivityRef };
};
