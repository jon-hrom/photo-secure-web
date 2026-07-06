import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

const GEO_CHECK_URL = 'https://functions.poehali.dev/21c968c3-577d-4286-9a9b-99053e0a915c';
const STORAGE_KEY = 'vpn_warning_dismissed_v1';

const VpnWarningBanner = () => {
  const [visible, setVisible] = useState(false);
  const [country, setCountry] = useState<{ name: string; emoji: string } | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* localStorage недоступен — продолжаем проверку */
    }

    const controller = new AbortController();

    fetch(GEO_CHECK_URL, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data && data.is_russia === false) {
          setCountry({ name: data.country || '', emoji: data.emoji || '' });
          setVisible(true);
        }
      })
      .catch(() => {
        /* не удалось определить страну — баннер не показываем */
      });

    return () => controller.abort();
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[9999] px-3 sm:px-4 pointer-events-none"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      role="alert"
      aria-live="polite"
    >
      <div className="pointer-events-auto max-w-3xl mx-auto rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/90 dark:to-orange-950/90 dark:border-amber-700/60 shadow-xl backdrop-blur px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/60">
            <Icon name="ShieldAlert" size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 leading-snug">
              Похоже, вы зашли из другой страны{country?.emoji ? ` ${country.emoji}` : ''}
            </p>
            <p className="text-xs sm:text-sm text-amber-800/90 dark:text-amber-200/80 leading-snug mt-1">
              Если у вас включён <span className="font-medium">VPN</span> — пожалуйста, отключите его для
              стабильной работы сайта. Иначе возможны проблемы с загрузкой и отображением фотографий.
            </p>
          </div>
          <button
            onClick={handleClose}
            type="button"
            aria-label="Закрыть"
            className="flex-shrink-0 p-1.5 rounded-full text-amber-700/70 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300/70 dark:hover:text-amber-100 dark:hover:bg-amber-900/50 transition-colors"
          >
            <Icon name="X" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VpnWarningBanner;
