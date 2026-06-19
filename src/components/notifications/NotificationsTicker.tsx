import { useEffect, useRef } from 'react';

const TICK_URL = 'https://functions.poehali.dev/79d17544-9f53-446b-bf9f-474f171be865';
const INTERVAL_MS = 10 * 60 * 1000; // 10 минут
const MIN_GAP_MS = 60 * 1000; // не чаще раза в минуту с одной вкладки

const NotificationsTicker = () => {
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    const ping = () => {
      const now = Date.now();
      if (now - lastPingRef.current < MIN_GAP_MS) return;
      if (document.visibilityState === 'hidden') return;
      lastPingRef.current = now;
      fetch(TICK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ source: 'realtime' }),
        keepalive: true,
      }).catch(() => {});
    };

    // Пинг при заходе на сайт
    ping();

    // Регулярный пинг каждые 10 минут, пока вкладка открыта
    const interval = setInterval(ping, INTERVAL_MS);

    // Пинг при возвращении на вкладку
    const onVisible = () => {
      if (document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
};

export default NotificationsTicker;
