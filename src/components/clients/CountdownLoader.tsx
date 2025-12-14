import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface CountdownLoaderProps {
  open: boolean;
  seconds?: number;
  onComplete?: () => void;
}

const CountdownLoader = ({ open, seconds = 3, onComplete }: CountdownLoaderProps) => {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    console.log('[COUNTDOWN] Open state changed:', open);
    if (open) {
      console.log('[COUNTDOWN] Starting countdown from', seconds);
      setCount(seconds);
      let currentCount = seconds;
      
      const interval = setInterval(() => {
        currentCount--;
        console.log('[COUNTDOWN] Count:', currentCount);
        setCount(currentCount);
        
        if (currentCount <= 0) {
          clearInterval(interval);
          console.log('[COUNTDOWN] Countdown finished! Calling onComplete');
          if (onComplete) {
            onComplete();
          }
        }
      }, 1000);

      return () => {
        console.log('[COUNTDOWN] Cleanup');
        clearInterval(interval);
      };
    }
  }, [open, seconds, onComplete]);

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md border-0 bg-gradient-to-br from-primary/5 via-purple-50/50 to-blue-50/50 backdrop-blur-xl">
        <div className="flex flex-col items-center justify-center py-8 space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur-2xl opacity-30 animate-pulse" />
            <div className="relative bg-gradient-to-br from-primary to-secondary rounded-full p-8 shadow-2xl animate-bounce">
              <Icon name="UserPlus" size={48} className="text-white" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Создаём карточку клиента
            </h3>
            <p className="text-sm text-muted-foreground">
              Подготовка данных...
            </p>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-full blur-3xl animate-pulse" />
            <div className="relative text-8xl font-black bg-gradient-to-br from-primary via-purple-500 to-secondary bg-clip-text text-transparent animate-scale-pulse">
              {count}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
            <span>Загрузка данных</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CountdownLoader;