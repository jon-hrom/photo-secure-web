import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import { sendSMSCode, generateVerificationCode } from '@/utils/smsService';

interface PhoneVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  phone: string;
}

const PhoneVerificationDialog = ({
  open,
  onClose,
  onVerified,
  phone,
}: PhoneVerificationDialogProps) => {
  const [code, setCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (open && !sentCode) {
      handleSendCode();
    }
  }, [open]);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleSendCode = async () => {
    setIsSendingCode(true);
    try {
      const verificationCode = generateVerificationCode();
      console.log('[PHONE_VERIFY] Generated code:', verificationCode);
      
      const result = await sendSMSCode(phone, verificationCode);
      
      if (result.ok) {
        setSentCode(verificationCode);
        setCooldown(60);
        toast.success('Код подтверждения отправлен на ваш телефон');
      } else {
        const errorMsg = result.error || 'Ошибка отправки SMS';
        toast.error(errorMsg, { duration: 5000 });
        console.error('[PHONE_VERIFY] SMS error:', result);
      }
    } catch (error) {
      console.error('[PHONE_VERIFY] Send error:', error);
      toast.error('Не удалось отправить SMS');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error('Введите 6-значный код');
      return;
    }

    setIsLoading(true);
    try {
      if (code === sentCode) {
        toast.success('Телефон успешно подтвержден!');
        onVerified();
        onClose();
      } else {
        toast.error('Неверный код подтверждения');
        setCode('');
      }
    } catch (error) {
      toast.error('Ошибка проверки кода');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setSentCode('');
    setCooldown(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="MessageSquare" className="text-primary" />
            Подтверждение телефона
          </DialogTitle>
          <DialogDescription>
            Введите код из SMS, отправленного на номер {phone}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="code">Код подтверждения</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={code.length !== 6 || isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <Icon name="Check" size={18} className="mr-2" />
                  Подтвердить
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={handleSendCode}
              disabled={cooldown > 0 || isSendingCode}
              className="w-full"
            >
              {isSendingCode ? (
                <>
                  <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                  Отправка...
                </>
              ) : cooldown > 0 ? (
                <>
                  <Icon name="Clock" size={18} className="mr-2" />
                  Отправить повторно ({cooldown}с)
                </>
              ) : (
                <>
                  <Icon name="RefreshCw" size={18} className="mr-2" />
                  Отправить код повторно
                </>
              )}
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700 flex items-start gap-2">
              <Icon name="Info" size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                SMS может прийти в течение нескольких минут. Проверьте папку со спамом, если код не приходит.
              </span>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhoneVerificationDialog;