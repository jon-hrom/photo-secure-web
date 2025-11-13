import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface LoginPageProps {
  onLoginSuccess: (userId: number) => void;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [phone, setPhone] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  const [is2FADialogOpen, setIs2FADialogOpen] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [twoFactorType, setTwoFactorType] = useState<'sms' | 'email'>('email');

  useEffect(() => {
    const savedBlockData = localStorage.getItem('loginBlock');
    if (savedBlockData) {
      const { blockUntil, attempts } = JSON.parse(savedBlockData);
      const now = Date.now();
      if (blockUntil > now) {
        const remainingSeconds = Math.floor((blockUntil - now) / 1000);
        setBlockTimeRemaining(remainingSeconds);
        setIsBlocked(true);
        setRemainingAttempts(0);
      } else {
        localStorage.removeItem('loginBlock');
        setRemainingAttempts(attempts || 5);
      }
    }
  }, []);

  useEffect(() => {
    if (blockTimeRemaining > 0) {
      const timer = setInterval(() => {
        setBlockTimeRemaining((prev) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            setIsBlocked(false);
            setRemainingAttempts(5);
            localStorage.removeItem('loginBlock');
            return 0;
          }
          return newValue;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [blockTimeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Заполните все поля');
      return;
    }

    if (isBlocked) {
      toast.error(`Слишком много попыток. Подождите ${formatTime(blockTimeRemaining)}`);
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requires2FA) {
          setPendingUserId(data.userId);
          setTwoFactorType(data.twoFactorType);
          setIs2FADialogOpen(true);
          toast.success(`Код отправлен на ${data.twoFactorType === 'sms' ? 'телефон' : 'email'}`);
        } else {
          setRemainingAttempts(5);
          localStorage.removeItem('loginBlock');
          toast.success('Вход выполнен успешно!');
          onLoginSuccess(data.userId);
        }
      } else {
        const newAttempts = remainingAttempts - 1;
        setRemainingAttempts(newAttempts);
        
        if (newAttempts <= 0) {
          const blockUntil = Date.now() + 600000;
          localStorage.setItem('loginBlock', JSON.stringify({ blockUntil, attempts: 0 }));
          setIsBlocked(true);
          setBlockTimeRemaining(600);
          toast.error('Превышен лимит попыток. Доступ заблокирован на 10 минут');
        } else {
          localStorage.setItem('loginBlock', JSON.stringify({ blockUntil: 0, attempts: newAttempts }));
          toast.error(`Неверные данные. Осталось попыток: ${newAttempts}`);
        }
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  const handleRegister = async () => {
    if (!email || !password) {
      toast.error('Заполните обязательные поля');
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', email, password, phone }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Регистрация успешна! Теперь войдите в систему');
        setIsRegistering(false);
        setPassword('');
      } else {
        toast.error(data.error || 'Ошибка регистрации');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  const handleOAuthLogin = (provider: 'yandex' | 'vk' | 'google') => {
    toast.info(`OAuth через ${provider} будет доступен в следующей версии`);
  };

  const handle2FASubmit = async () => {
    if (!twoFactorCode || !pendingUserId) {
      toast.error('Введите код подтверждения');
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-2fa', userId: pendingUserId, code: twoFactorCode }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Вход выполнен успешно!');
        setIs2FADialogOpen(false);
        onLoginSuccess(pendingUserId);
      } else {
        toast.error(data.error || 'Неверный код');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon name="Lock" size={32} className="text-primary" />
          </div>
          <CardTitle className="text-2xl">{isRegistering ? 'Регистрация' : 'Вход в систему'}</CardTitle>
          <CardDescription>
            {isRegistering ? 'Создайте новый аккаунт' : 'Войдите в свой аккаунт'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isBlocked && (
            <div className="p-4 bg-destructive/10 border-2 border-destructive rounded-xl text-center">
              <Icon name="ShieldAlert" size={32} className="text-destructive mx-auto mb-2" />
              <p className="font-bold text-destructive">Доступ временно заблокирован</p>
              <p className="text-2xl font-mono font-bold mt-2">{formatTime(blockTimeRemaining)}</p>
            </div>
          )}

          {!isBlocked && remainingAttempts < 5 && (
            <div className="p-3 bg-orange-50 border-2 border-orange-300 rounded-xl">
              <p className="text-sm text-orange-700 flex items-center gap-2">
                <Icon name="AlertTriangle" size={16} />
                Осталось попыток: <strong>{remainingAttempts}</strong>
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isBlocked}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isBlocked}
                className="rounded-xl"
                onKeyDown={(e) => e.key === 'Enter' && !isRegistering && handleLogin()}
              />
            </div>

            {isRegistering && (
              <div className="space-y-2">
                <Label htmlFor="phone">Телефон (необязательно)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+7 (___) ___-__-__"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}

            <Button
              onClick={isRegistering ? handleRegister : handleLogin}
              disabled={isBlocked}
              className="w-full rounded-xl"
            >
              {isRegistering ? 'Зарегистрироваться' : 'Войти'}
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setPassword('');
              }}
              className="w-full rounded-xl"
            >
              {isRegistering ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Или войти через</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('yandex')}
              disabled={isBlocked}
              className="rounded-xl"
            >
              <Icon name="Circle" size={20} className="text-red-500" />
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('vk')}
              disabled={isBlocked}
              className="rounded-xl"
            >
              <Icon name="MessageCircle" size={20} className="text-blue-500" />
            </Button>
            <Button
              variant="outline"
              onClick={() => handleOAuthLogin('google')}
              disabled={isBlocked}
              className="rounded-xl"
            >
              <Icon name="Mail" size={20} className="text-red-600" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={is2FADialogOpen} onOpenChange={setIs2FADialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Shield" className="text-primary" size={24} />
              Двухфакторная аутентификация
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
              <p className="text-sm text-center">
                Код подтверждения отправлен на {twoFactorType === 'sms' ? 'ваш телефон' : 'вашу почту'}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Введите код</Label>
              <Input
                placeholder={twoFactorType === 'sms' ? '123456' : '12345'}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                maxLength={twoFactorType === 'sms' ? 6 : 5}
                className="rounded-xl text-center text-2xl tracking-widest font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handle2FASubmit()}
              />
            </div>
            <Button onClick={handle2FASubmit} className="w-full rounded-xl">
              <Icon name="Check" size={18} className="mr-2" />
              Подтвердить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;