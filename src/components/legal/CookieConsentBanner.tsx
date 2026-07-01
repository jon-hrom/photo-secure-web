import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'cookie_consent_accepted_v1';

const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY);
      if (!accepted) {
        const t = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* localStorage может быть недоступен — просто скрываем */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9999] px-3 sm:px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      role="dialog"
      aria-live="polite"
      aria-label="Уведомление об использовании файлов cookie"
    >
      <div className="pointer-events-auto max-w-5xl mx-auto rounded-2xl border border-border bg-background/95 backdrop-blur shadow-xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <p className="text-xs sm:text-sm text-muted-foreground leading-snug flex-1">
            Мы используем cookies и бережно храним ваши данные, чтобы сделать ваш опыт использования
            сайта удобным и безопасным. Узнать подробнее об использовании{' '}
            <a
              href="/personal-data"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline whitespace-nowrap"
            >
              персональных данных
            </a>{' '}
            и{' '}
            <a
              href="/cookie-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline whitespace-nowrap"
            >
              файлов cookie
            </a>
            .
          </p>
          <Button
            onClick={handleAccept}
            variant="outline"
            className="w-full sm:w-auto shrink-0 rounded-full border-primary text-primary hover:bg-primary hover:text-primary-foreground px-6"
          >
            Хорошо
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsentBanner;
