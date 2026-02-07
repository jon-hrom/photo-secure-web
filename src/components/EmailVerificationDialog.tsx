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
  const [codeExpiry, setCodeExpiry] = useState(0);
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    if (open) {
      console.log('[EMAIL_VERIFY] Dialog opened - userId:', userId, 'email:', userEmail);
      
      if (!userId || userId === '' || userId === 'undefined') {
        console.error('[EMAIL_VERIFY] Invalid userId:', userId);
        toast.error('Ошибка: не удалось определить пользователя');
        return;
      }
      
      const savedExpiry = localStorage.getItem(`email_code_expiry_${userId}`);
      if (savedExpiry) {
        const expiryTime = parseInt(savedExpiry);
        const remainingTime = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
        if (remainingTime > 0) {
          setCodeExpiry(remainingTime);
          setCodeSent(true);
          const cooldown = Math.max(0, 60 - (600 - remainingTime));
          if (cooldown > 0) {
            setResendCooldown(cooldown);
          }
        }
      }
    } else {
      setCode(['', '', '', '', '', '']);
      setError('');
    }
  }, [open, userId, userEmail]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (codeExpiry > 0) {
      const timer = setTimeout(() => setCodeExpiry(codeExpiry - 1), 1000);
      return () => clearTimeout(timer);
    } else if (codeExpiry === 0 && codeSent) {
      setError('Код истёк. Запросите новый.');
    }
  }, [codeExpiry, codeSent]);

  const handleSendCode = async (method: 'email' | 'sms' = 'email') => {
    try {
      setLoading(true);
      setError('');
      
      console.log('[EMAIL_VERIFY] Sending code via:', method, 'userId:', userId, 'email:', userEmail);
      
      const res = await fetch(EMAIL_VERIFICATION_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({ action: method === 'sms' ? 'send_sms_code' : 'send_code' })
      });

      console.log('[EMAIL_VERIFY] Response status:', res.status);
      const data = await res.json();
      console.log('[EMAIL_VERIFY] Response data:', data);
      
      if (res.ok) {
        toast.success(method === 'sms' ? 'Код отправлен по SMS' : 'Код отправлен на почту');
        setResendCooldown(60);
        setCodeExpiry(600);
        setCodeSent(true);
        const expiryTime = Date.now() + 600000;
        localStorage.setItem(`email_code_expiry_${userId}`, expiryTime.toString());
      } else if (res.status === 429) {
        const retryIn = data.retryInSec || 60;
        setResendCooldown(retryIn);
        const errorMsg = data.error || 'Слишком много попыток';
        setError(errorMsg);
        toast.error(errorMsg);
      } else if (res.status === 409) {
        toast.success('Email уже подтверждён');
        onVerified();
      } else if (res.status === 400) {
        const errorMsg = data.error || 'Добавьте email в настройках перед подтверждением';
        toast.error(errorMsg);
        console.error('[EMAIL_VERIFY] 400 error:', errorMsg);
        onClose();
      } else {
        const errorMsg = data.error || 'Ошибка отправки кода';
        setError(errorMsg);
        toast.error(errorMsg);
        console.error('[EMAIL_VERIFY] Error:', res.status, errorMsg);
      }
    } catch (err) {
      const errorMsg = 'Не удалось отправить код';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('[EMAIL_VERIFY] Exception:', err);
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
        localStorage.removeItem(`email_code_expiry_${userId}`);
        localStorage.setItem(`email_verification_dismissed_${userId}`, 'true');
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
    } catch (err) {
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
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg md:text-xl">
              <Icon name="CheckCircle2" size={20} className="text-green-600 md:w-6 md:h-6" />
              Почта подтверждена
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 md:py-6 text-center">
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Icon name="Mail" size={20} className="md:w-6 md:h-6" />
            Подтвердите почту
          </DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Отправляем 6-значный код на <strong>{userEmail}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!codeSent ? (
            <div className="text-center space-y-4">
              <p className="text-xs md:text-sm text-muted-foreground">Выберите способ получения кода подтверждения</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={() => handleSendCode('email')}
                  disabled={loading}
                  className="flex-1"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Icon name="Mail" size={20} className="mr-2" />
                      На Email
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleSendCode('sms')}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                      Отправка...
                    </>
                  ) : (
                    <>
                      <Icon name="Smartphone" size={20} className="mr-2" />
                      SMS
                    </>
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  localStorage.setItem(`email_verification_dismissed_${userId}`, 'true');
                  onClose();
                }}
                className="w-full"
              >
                Позже
              </Button>
            </div>
          ) : (
            <>
              {codeExpiry > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="Clock" size={20} className="text-blue-500" />
                    <span className="text-sm text-blue-700 font-medium">Код действителен</span>
                  </div>
                  <span className="text-lg font-bold text-blue-700">
                    {Math.floor(codeExpiry / 60)}:{String(codeExpiry % 60).padStart(2, '0')}
                  </span>
                </div>
              )}

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
                    disabled={loading || codeExpiry === 0}
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
                disabled={loading || code.join('').length !== 6 || codeExpiry === 0}
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

              <div className="space-y-2">
                {resendCooldown > 0 ? (
                  <Button variant="outline" disabled className="w-full" size="sm">
                    <Icon name="Clock" size={16} className="mr-2" />
                    Повторно через {resendCooldown} сек
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleSendCode('email')}
                      disabled={loading}
                      className="flex-1"
                      size="sm"
                    >
                      <Icon name="Mail" size={16} className="mr-2" />
                      На Email
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSendCode('sms')}
                      disabled={loading}
                      className="flex-1"
                      size="sm"
                    >
                      <Icon name="Smartphone" size={16} className="mr-2" />
                      SMS
                    </Button>
                  </div>
                )}
                <Button
                  variant="ghost"
                  onClick={() => {
                    localStorage.setItem(`email_verification_dismissed_${userId}`, 'true');
                    onClose();
                  }}
                  className="w-full"
                  size="sm"
                >
                  Позже
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailVerificationDialog;