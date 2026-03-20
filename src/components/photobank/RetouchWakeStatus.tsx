import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';

interface RetouchWakeStatusProps {
  waking: boolean;
  wakeStatus: string | null;
}

const RetouchWakeStatus = ({ waking, wakeStatus }: RetouchWakeStatusProps) => {
  const [visible, setVisible] = useState(true);

  const isSuccess = wakeStatus?.includes('готов') || wakeStatus?.includes('работает');

  useEffect(() => {
    if (isSuccess && !waking) {
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
    setVisible(true);
  }, [isSuccess, waking, wakeStatus]);

  if (!wakeStatus || !visible) return null;

  if (waking) {
    return (
      <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 dark:border-amber-800 p-3 sm:p-5 flex items-start gap-3 sm:gap-4 shadow-sm">
        <div className="relative flex-shrink-0 mt-0.5">
          <div className="absolute inset-0 rounded-full bg-amber-400/20 animate-ping" />
          <Icon name="Loader2" size={20} className="animate-spin text-amber-600 dark:text-amber-400 relative sm:w-[22px] sm:h-[22px]" />
        </div>
        <div className="flex flex-col gap-0.5 sm:gap-1">
          <span className="text-xs sm:text-sm font-medium text-amber-900 dark:text-amber-100">
            Сервис запускается, пожалуйста подождите
          </span>
          <span className="text-[10px] sm:text-xs text-amber-600/80 dark:text-amber-400/70">
            Обычно это занимает около минуты
          </span>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 dark:border-green-800 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm transition-opacity duration-500">
        <Icon name="CheckCircle" size={18} className="text-green-600 dark:text-green-400 flex-shrink-0 sm:w-5 sm:h-5" />
        <span className="text-xs sm:text-sm font-medium text-green-800 dark:text-green-200">Сервис готов к обработке</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 dark:border-red-800 p-3 sm:p-4 flex items-center gap-2 sm:gap-3 shadow-sm">
      <Icon name="AlertCircle" size={18} className="text-red-600 dark:text-red-400 flex-shrink-0 sm:w-5 sm:h-5" />
      <span className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-200">{wakeStatus}</span>
    </div>
  );
};

export default RetouchWakeStatus;
