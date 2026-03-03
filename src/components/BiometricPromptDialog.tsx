import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import FingerprintAnimation, { type AnimationState } from '@/components/ui/FingerprintAnimation';
import {
  checkBiometricAvailability,
  isBiometricRegistered,
  registerBiometric,
  type BiometricUserData,
} from '@/utils/biometricAuth';

interface BiometricPromptDialogProps {
  open: boolean;
  userData: BiometricUserData;
  onClose: () => void;
}

const BiometricPromptDialog = ({ open, userData, onClose }: BiometricPromptDialogProps) => {
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!open) return;
      const supported = await checkBiometricAvailability();
      const alreadyRegistered = isBiometricRegistered();
      const dismissed = localStorage.getItem('biometric_prompt_dismissed');
      setShouldShow(supported && !alreadyRegistered && !dismissed);
    };
    check();
  }, [open]);

  const handleRegister = async () => {
    setAnimState('scanning');
    const success = await registerBiometric(userData);
    if (success) {
      setAnimState('success');
      toast.success('Биометрия привязана! Теперь можно входить одним касанием');
      setTimeout(() => onClose(), 1500);
    } else {
      setAnimState('error');
      toast.error('Не удалось привязать биометрию');
      setTimeout(() => setAnimState('idle'), 2000);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('biometric_prompt_dismissed', 'true');
    onClose();
  };

  if (!shouldShow) {
    if (open) onClose();
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            Быстрый вход
          </DialogTitle>
          <DialogDescription className="text-center">
            Хотите входить по отпечатку пальца или Face ID?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <FingerprintAnimation state={animState} size="md" />

          <p className="text-sm text-muted-foreground text-center">
            Привяжите биометрию, чтобы в следующий раз войти одним касанием без ввода пароля
          </p>

          <div className="flex gap-2">
            <Button onClick={handleRegister} disabled={animState === 'scanning'} className="flex-1">
              {animState === 'scanning' ? 'Приложите палец...' : 'Привязать'}
            </Button>
            <Button onClick={handleDismiss} variant="outline" className="flex-1">
              Не сейчас
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BiometricPromptDialog;
