import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

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
        /* не удалось определить страну — окно не показываем */
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
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-live="assertive"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-amber-300/70 bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 dark:border-amber-700/60 shadow-2xl px-6 py-7 text-center animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={handleClose}
          type="button"
          aria-label="Закрыть"
          className="absolute top-3 right-3 p-1.5 rounded-full text-amber-700/70 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300/70 dark:hover:text-amber-100 dark:hover:bg-amber-900/50 transition-colors"
        >
          <Icon name="X" size={18} />
        </button>

        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/60">
          <Icon name="ShieldAlert" size={28} className="text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="text-lg font-bold text-amber-900 dark:text-amber-100">
          Похоже, вы зашли из другой страны{country?.emoji ? ` ${country.emoji}` : ''}
        </h2>

        <p className="mt-3 text-sm text-amber-800/90 dark:text-amber-200/80 leading-relaxed">
          Если у вас включён <span className="font-semibold">VPN</span> — пожалуйста, отключите его
          для стабильной работы сайта. Иначе возможны проблемы с загрузкой и отображением
          фотографий.
        </p>

        <Button
          onClick={handleClose}
          className="mt-6 w-full rounded-full bg-amber-500 hover:bg-amber-600 text-white font-medium"
        >
          Понятно
        </Button>
      </div>
    </div>
  );
};

export default VpnWarningBanner;
