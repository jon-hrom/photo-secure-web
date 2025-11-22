import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface TwoFactorDialogProps {
  open: boolean;
  userId: number;
  userEmail: string;
  type: 'email';
  onSuccess: () => void;
  onCancel: () => void;
}

const VERIFICATION_API = 'https://functions.poehali.dev/3d5a433c-aa3d-4275-8da2-739ec932d08f';

const TwoFactorDialog = ({ open, userId, userEmail, type, onSuccess, onCancel }: TwoFactorDialogProps) => {
  const [code, setCode] = useState(['', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);

  useEffect(() => {
    if (open && userEmail) {
      handleSendCode();
    }
  }, [open]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (!userEmail || !userEmail.includes('@')) {
      setError('Email не указан в профиле');
      return;
    }

    setIsSendingCode(true);
    try {
      const response = await fetch(VERIFICATION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-2fa-code',
          user_id: userId.toString(),
          email: userEmail,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Код отправлен на ' + userEmail);
        setCountdown(60);
      } else {
        setError(data.error || 'Ошибка отправки кода');
      }
    } catch (err) {
      console.error('Error sending 2FA code:', err);
      setError('Ошибка подключения к серверу');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 5) {
      setError('Введите 5-значный код');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(VERIFICATION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'verify-2fa-code', 
          user_id: userId.toString(), 
          code: fullCode 
        })
      });

      const data = await res.json();
      
      if (res.ok && data.valid) {
        toast.success('Код подтверждён!');
        onSuccess();
      } else {
        setError('Неверный код');
        setCode(['', '', '', '', '']);
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

    if (value && index < 4) {
      const nextInput = document.getElementById(`2fa-code-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`2fa-code-input-${index - 1}`);
      prevInput?.focus();
    } else if (e.key === 'Enter' && code.join('').length === 5) {
      handleVerify();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 5);
    const newCode = [...code];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);
    
    if (pastedData.length === 5) {
      handleVerify();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Shield" size={24} />
            Двухфакторная аутентификация
          </DialogTitle>
          <DialogDescription>
            Введите 5-значный код, отправленный на <strong>{userEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <Input
                key={index}
                id={`2fa-code-input-${index}`}
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

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleVerify}
              disabled={loading || code.join('').length !== 5}
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
            
            <Button
              variant="outline"
              onClick={handleSendCode}
              disabled={countdown > 0 || isSendingCode}
              className="w-full"
              size="lg"
            >
              {isSendingCode ? (
                <>
                  <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                  Отправка...
                </>
              ) : countdown > 0 ? (
                `Отправить повторно (${countdown}с)`
              ) : (
                <>
                  <Icon name="Mail" size={18} className="mr-2" />
                  Отправить повторно
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={loading}
              className="w-full"
            >
              Отмена
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwoFactorDialog;