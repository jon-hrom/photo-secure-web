import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface SessionTimeoutWarningProps {
  onExtendSession: () => void;
  onLogout: () => void;
}

export const SessionTimeoutWarning = ({ onExtendSession, onLogout }: SessionTimeoutWarningProps) => {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [warningMinutes, setWarningMinutes] = useState(1);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(7);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [warningRes, timeoutRes] = await Promise.all([
          fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=session_warning_minutes'),
          fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=session_timeout_minutes')
        ]);
        
        const warningData = await warningRes.json();
        const timeoutData = await timeoutRes.json();
        
        setWarningMinutes(warningData.value || 1);
        setSessionTimeoutMinutes(timeoutData.value || 7);
      } catch (error) {
        console.warn('[SESSION_WARNING] Failed to load settings');
      }
    };

    loadSettings();
  }, []);

  useEffect(() => {
    const checkWarning = () => {
      const authSession = localStorage.getItem('authSession');
      if (!authSession) return;

      try {
        const session = JSON.parse(authSession);
        const lastActivity = session.lastActivity;
        const now = Date.now();
        const timeSinceActivity = now - lastActivity;
        
        const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
        const warningMs = warningMinutes * 60 * 1000;
        const warningThreshold = timeoutMs - warningMs;

        if (timeSinceActivity >= warningThreshold && timeSinceActivity < timeoutMs) {
          const remaining = Math.floor((timeoutMs - timeSinceActivity) / 1000);
          setSecondsLeft(remaining);
          setShowWarning(true);
        } else {
          setShowWarning(false);
        }
      } catch (error) {
        console.error('[SESSION_WARNING] Error checking session:', error);
      }
    };

    const interval = setInterval(checkWarning, 5000);
    checkWarning();

    return () => clearInterval(interval);
  }, [warningMinutes, sessionTimeoutMinutes]);

  useEffect(() => {
    if (!showWarning) return;

    const countdown = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [showWarning, onLogout]);

  const handleExtend = () => {
    setShowWarning(false);
    onExtendSession();
  };

  if (!showWarning) return null;

  return (
    <Dialog open={showWarning} onOpenChange={(open) => !open && onLogout()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Icon name="Clock" className="animate-pulse" />
            Сессия скоро завершится
          </DialogTitle>
          <DialogDescription className="space-y-2">
            <p>
              Ваша сессия истечёт через <strong className="text-orange-600 text-lg">{secondsLeft}</strong> секунд из-за неактивности.
            </p>
            <p className="text-sm text-muted-foreground">
              Нажмите "Продолжить работу" чтобы остаться в системе, или "Выйти" чтобы завершить сессию.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onLogout}
            className="w-full sm:w-auto"
          >
            <Icon name="LogOut" size={16} className="mr-2" />
            Выйти
          </Button>
          <Button
            onClick={handleExtend}
            className="w-full sm:w-auto"
          >
            <Icon name="RefreshCw" size={16} className="mr-2" />
            Продолжить работу
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionTimeoutWarning;
