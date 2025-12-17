import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

interface SyncIndicatorProps {
  isLoading: boolean;
  lastSyncTime?: Date;
}

const SyncIndicator = ({ isLoading, lastSyncTime }: SyncIndicatorProps) => {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    if (!lastSyncTime) return;

    const updateTimeAgo = () => {
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastSyncTime.getTime()) / 1000);

      if (diff < 60) {
        setTimeAgo('только что');
      } else if (diff < 3600) {
        const minutes = Math.floor(diff / 60);
        setTimeAgo(`${minutes} мин. назад`);
      } else {
        const hours = Math.floor(diff / 3600);
        setTimeAgo(`${hours} ч. назад`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 30000); // Обновляем каждые 30 сек

    return () => clearInterval(interval);
  }, [lastSyncTime]);

  if (!isLoading && !lastSyncTime) return null;

  return (
    <div className="fixed top-20 right-4 z-50">
      <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
        {isLoading ? (
          <>
            <Icon 
              name="RefreshCw" 
              size={14} 
              className="text-primary animate-spin" 
            />
            <span className="text-xs font-medium text-gray-700">
              Синхронизация...
            </span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-600">
              {timeAgo}
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default SyncIndicator;
