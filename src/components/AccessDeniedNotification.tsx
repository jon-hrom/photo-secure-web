import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface AccessDeniedNotificationProps {
  onClose: () => void;
}

const AccessDeniedNotification = ({ onClose }: AccessDeniedNotificationProps) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
      <Card className="max-w-md w-full mx-4 p-8 shadow-2xl border-2 border-destructive/20 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-destructive/20 rounded-full animate-ping"></div>
            <div className="relative bg-destructive/10 p-6 rounded-full">
              <Icon 
                name="ShieldAlert" 
                size={64} 
                className="text-destructive"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-destructive">
              Доступ временно ограничен
            </h2>
            <p className="text-muted-foreground text-lg">
              Доступ на вход временно недоступен по техническим причинам
            </p>
          </div>
          
          <div className="w-full bg-secondary/20 rounded-lg p-4">
            <p className="text-sm text-muted-foreground">
              Пожалуйста, попробуйте позже или свяжитесь с администратором
            </p>
          </div>
          
          <button
            onClick={() => {
              setIsVisible(false);
              setTimeout(onClose, 300);
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Закрыть (автоматически через 10 секунд)
          </button>
        </div>
      </Card>
    </div>
  );
};

export default AccessDeniedNotification;
