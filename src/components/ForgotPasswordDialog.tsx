import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ForgotPasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

const ForgotPasswordDialog = ({ open, onClose }: ForgotPasswordDialogProps) => {
  const [step, setStep] = useState<'contact' | 'method' | 'code' | 'password'>('contact');
  const [contact, setContact] = useState('');
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [minPasswordLength, setMinPasswordLength] = useState(8);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [canUseEmail, setCanUseEmail] = useState(false);
  const [canUseSms, setCanUseSms] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch('https://functions.poehali.dev/68eb5b20-e2c3-4741-aa83-500a5301ff4a');
        const data = await response.json();
        if (data.settings?.passwordMinLength) {
          setMinPasswordLength(data.settings.passwordMinLength);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    if (open) {
      loadSettings();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setStep('contact');
      setContact('');
      setMethod('email');
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setSessionToken('');
      setUserEmail('');
      setUserPhone('');
      setCanUseEmail(false);
      setCanUseSms(false);
    }
  }, [open]);

  const handleContactSubmit = async () => {
    if (!contact) {
      toast.error('Введите email или телефон');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/9c80d4b8-f659-41f4-a792-64cdff4bba7d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'check_contact', 
          contact 
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUserEmail(data.email || '');
        setUserPhone(data.phone || '');
        setCanUseEmail(data.canUseEmail);
        setCanUseSms(data.canUseSms);
        
        if (data.hasBothMethods) {
          setStep('method');
        } else if (data.canUseEmail) {
          setMethod('email');
          await sendCode('email');
        } else if (data.canUseSms) {
          setMethod('sms');
          await sendCode('sms');
        } else {
          toast.error('У пользователя нет контактных данных');
        }
      } else {
        toast.error(data.error || 'Пользователь не найден');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async (selectedMethod: 'email' | 'sms') => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/9c80d4b8-f659-41f4-a792-64cdff4bba7d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'send_code', 
          contact,
          method: selectedMethod
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSessionToken(data.session_token);
        setStep('code');
        toast.success(`Код отправлен на ${selectedMethod === 'email' ? 'email' : 'телефон'}`);
      } else {
        toast.error(data.error || 'Ошибка отправки кода');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = async () => {
    await sendCode(method);
  };

  const handleCodeVerify = async () => {
    if (!code) {
      toast.error('Введите код');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/9c80d4b8-f659-41f4-a792-64cdff4bba7d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'verify_code', 
          contact,
          code,
          session_token: sessionToken
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStep('password');
        toast.success('Код подтвержден');
      } else {
        toast.error(data.error || 'Неверный код');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Заполните все поля');
      return;
    }

    if (newPassword.length < minPasswordLength) {
      toast.error(`Пароль должен содержать минимум ${minPasswordLength} символов`);
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/9c80d4b8-f659-41f4-a792-64cdff4bba7d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reset_password', 
          contact,
          new_password: newPassword,
          session_token: sessionToken
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Пароль успешно изменен!');
        onClose();
      } else {
        toast.error(data.error || 'Ошибка изменения пароля');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon name="KeyRound" size={24} className="text-primary" />
          </div>
          <DialogTitle className="text-center">Восстановление пароля</DialogTitle>
          <DialogDescription className="text-center">
            {step === 'contact' && (
              <>
                Введите email или телефон, который указывали в настройках аккаунта
                <br />
                <span className="text-xs text-muted-foreground mt-1 block">
                  После проверки будет предложен способ получения кода
                </span>
              </>
            )}
            {step === 'method' && 'Выберите способ получения кода'}
            {step === 'code' && 'Введите код из сообщения'}
            {step === 'password' && 'Создайте новый пароль'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {step === 'contact' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="reset-contact">Email или телефон</Label>
                <Input
                  id="reset-contact"
                  type="text"
                  placeholder="example@mail.com или +7 (900) 123-45-67"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleContactSubmit()}
                />
              </div>
              <Button
                onClick={handleContactSubmit}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Проверка...' : 'Продолжить'}
              </Button>
            </>
          )}

          {step === 'method' && (
            <>
              <div className="space-y-2">
                <Label>Способ получения кода</Label>
                <Select value={method} onValueChange={(value: 'email' | 'sms') => setMethod(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canUseEmail && (
                      <SelectItem value="email">
                        <div className="flex items-center gap-2">
                          <Icon name="Mail" size={16} />
                          Отправить на {userEmail}
                        </div>
                      </SelectItem>
                    )}
                    {canUseSms && (
                      <SelectItem value="sms">
                        <div className="flex items-center gap-2">
                          <Icon name="Smartphone" size={16} />
                          Отправить SMS на {userPhone}
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleMethodSelect}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Отправка...' : 'Отправить код'}
              </Button>
            </>
          )}

          {step === 'code' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="code">Код подтверждения</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="Введите код"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCodeVerify()}
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  <Icon name="Clock" size={12} className="inline mr-1" />
                  Код действителен 10 минут
                </p>
              </div>
              <Button
                onClick={handleCodeVerify}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Проверка...' : 'Подтвердить код'}
              </Button>
            </>
          )}

          {step === 'password' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">Новый пароль</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Введите новый пароль"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={18} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Минимум {minPasswordLength} символов
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Подтвердите пароль</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Повторите новый пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordReset()}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name={showConfirmPassword ? 'EyeOff' : 'Eye'} size={18} />
                  </button>
                </div>
              </div>

              <Button
                onClick={handlePasswordReset}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Изменение...' : 'Изменить пароль'}
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full"
          >
            Отмена
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForgotPasswordDialog;