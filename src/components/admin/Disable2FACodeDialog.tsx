import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface Disable2FACodeDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string | number;
  disableType: 'sms' | 'email' | 'both';
  onSuccess: () => void;
}

const API_URL = 'https://functions.poehali.dev/d0cbcec4-bc93-4819-8609-38c55cbe35e4';

const Disable2FACodeDialog = ({ open, onClose, userId, disableType, onSuccess }: Disable2FACodeDialogProps) => {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const typeText = {
    'sms': 'SMS-аутентификации',
    'email': 'Email-аутентификации',
    'both': 'всей двухфакторной аутентификации'
  }[disableType];

  const handleVerify = async () => {
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      setError('Введите 6-значный код');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_code', userId, code: fullCode })
      });

      const data = await res.json();
      
      if (res.ok) {
        toast.success(`Отключена ${typeText}`);
        onSuccess();
        onClose();
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
      const nextInput = document.getElementById(`disable-2fa-code-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`disable-2fa-code-input-${index - 1}`);
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
    const nextInput = document.getElementById(`disable-2fa-code-input-${Math.min(lastFilledIndex + 1, 5)}`);
    nextInput?.focus();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="ShieldOff" size={24} className="text-red-500" />
            Код от пользователя
          </DialogTitle>
          <DialogDescription>
            Пользователь должен ввести код из письма для подтверждения отключения {typeText}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <Input
                key={index}
                id={`disable-2fa-code-input-${index}`}
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

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              Отмена
            </Button>
            <Button
              onClick={handleVerify}
              disabled={loading || code.join('').length !== 6}
              className="w-full"
              size="lg"
              variant="destructive"
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                  Проверка...
                </>
              ) : (
                <>
                  <Icon name="ShieldOff" size={20} className="mr-2" />
                  Отключить 2FA
                </>
              )}
            </Button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>⚠️ Внимание:</strong> Пользователь должен ввести код из полученного письма. Код действителен бессрочно.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Disable2FACodeDialog;
