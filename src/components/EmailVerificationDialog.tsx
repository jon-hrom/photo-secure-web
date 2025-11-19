import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface EmailVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  userId: string;
  userEmail: string;
  isVerified?: boolean;
}

const EMAIL_VERIFICATION_API = 'https://functions.poehali.dev/3d5a433c-aa3d-4275-8da2-739ec932d08f';

const EmailVerificationDialog = ({ open, onClose, onVerified, userId, userEmail, isVerified = false }: EmailVerificationDialogProps) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && resendCooldown === 0) {
      handleSendCode();
    }
  }, [open]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendCode = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(EMAIL_VERIFICATION_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ action: 'send_code' })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success('Код отправлен на почту');
        setResendCooldown(60);
      } else if (res.status === 429) {
        const retryIn = data.retryInSec || 60;
        setResendCooldown(retryIn);
        setError(data.error || 'Слишком много попыток');
      } else if (res.status === 409) {
        toast.success('Email уже подтверждён');
        onVerified();
      } else {
        setError(data.error || 'Ошибка отправки кода');
      }
    } catch (err: any) {
      setError('Не удалось отправить код');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(EMAIL_VERIFICATION_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ action: 'verify_code', code: fullCode })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success('Email успешно подтверждён!');
        onVerified();
        onClose();
      } else if (res.status === 423) {
        const retryIn = data.retryInSec || 900;
        const minutes = Math.ceil(retryIn / 60);
        setError(`Слишком много попыток. Повторите через ${minutes} мин.`);
      } else if (res.status === 410) {
        setError('Код истёк. Запросите новый.');
      } else {
        setError(data.error || 'Неверный код');
      }
    } catch (err: any) {
      setError('Ошибка проверки кода');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);

    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`);
      prevInput?.focus();
    } else if (e.key === 'Enter' && code.join('').length === 6) {
      handleVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);
    
    const lastFilledIndex = pastedData.length - 1;
    const nextInput = document.getElementById(`code-input-${Math.min(lastFilledIndex + 1, 5)}`);
    nextInput?.focus();
  };

  if (isVerified) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="CheckCircle2" size={24} className="text-green-600" />
              Почта подтверждена
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Icon name="Check" size={32} className="text-green-600" />
            </div>
            <p className="text-lg font-medium mb-2">Ваша почта успешно подтверждена!</p>
            <p className="text-sm text-muted-foreground mb-6">{userEmail}</p>
            <Button onClick={onClose} className="w-full" size="lg">
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Mail" size={24} />
            Подтвердите почту
          </DialogTitle>
          <DialogDescription>
            Мы отправили 6-значный код на <strong>{userEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <Input
                key={index}
                id={`code-input-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold"
                disabled={loading}
              />
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <Icon name="AlertCircle" size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <Button
            onClick={handleVerify}
            disabled={loading || code.join('').length !== 6}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                Проверка...
              </>
            ) : (
              <>
                <Icon name="Check" size={20} className="mr-2" />
                Подтвердить
              </>
            )}
          </Button>

          <div className="text-center">
            {resendCooldown > 0 ? (
              <p className="text-sm text-muted-foreground">
                Отправить код повторно через {resendCooldown} сек
              </p>
            ) : (
              <Button
                variant="ghost"
                onClick={handleSendCode}
                disabled={loading}
                size="sm"
              >
                <Icon name="RefreshCw" size={16} className="mr-2" />
                Отправить код повторно
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailVerificationDialog;