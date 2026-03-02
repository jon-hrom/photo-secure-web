import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
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
  const [registering, setRegistering] = useState(false);
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
    setRegistering(true);
    const success = await registerBiometric(userData);
    if (success) {
      toast.success('Биометрия привязана! Теперь можно входить одним касанием');
      onClose();
    } else {
      toast.error('Не удалось привязать биометрию');
    }
    setRegistering(false);
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
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Fingerprint" size={24} className="text-primary" />
            Быстрый вход
          </DialogTitle>
          <DialogDescription>
            Хотите входить по отпечатку пальца или Face ID?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Привяжите биометрию, чтобы в следующий раз войти одним касанием без ввода пароля.
          </p>

          <div className="flex gap-2">
            <Button onClick={handleRegister} disabled={registering} className="flex-1">
              <Icon
                name={registering ? 'Loader2' : 'Fingerprint'}
                size={16}
                className={registering ? 'animate-spin mr-2' : 'mr-2'}
              />
              Привязать
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
