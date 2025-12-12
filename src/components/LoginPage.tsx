import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import TwoFactorDialog from '@/components/TwoFactorDialog';
import BlockedUserAppeal from '@/components/BlockedUserAppeal';
import ForgotPasswordDialog from '@/components/ForgotPasswordDialog';
import LoginForm from '@/components/login/LoginForm';
import RegisterForm from '@/components/login/RegisterForm';
import LoginPageBackground from '@/components/login/LoginPageBackground';

interface LoginPageProps {
  onLoginSuccess: (userId: number, email?: string) => void;
}

const LoginPage = ({ onLoginSuccess }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [phone, setPhone] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  const [is2FADialogOpen, setIs2FADialogOpen] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [twoFactorType, setTwoFactorType] = useState<'email'>('email');
  const [passwordError, setPasswordError] = useState('');
  const [authProviders, setAuthProviders] = useState({
    yandex: true,
    vk: true,
    google: true,
  });
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [blockedUserData, setBlockedUserData] = useState<{
    userId?: number;
    userEmail?: string;
    authMethod?: string;
  } | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loginAttemptFailed, setLoginAttemptFailed] = useState(false);

  useEffect(() => {
    const loadAuthProviders = async () => {
      try {
        const response = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=auth_providers');
        const data = await response.json();
        if (data.value) {
          setAuthProviders(data.value);
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек провайдеров:', error);
      }
    };
    loadAuthProviders();
  }, []);

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
          return;
        } else {
          setRemainingAttempts(5);
          localStorage.removeItem('loginBlock');
          toast.success('Вход выполнен успешно!');
          onLoginSuccess(data.userId, email);
        }
      } else {
        if (response.status === 403 && data.blocked) {
          toast.error(data.message || 'Ваш аккаунт заблокирован администратором');
          setBlockedUserData({
            userId: data.user_id,
            userEmail: data.user_email || email,
            authMethod: 'password'
          });
          setShowAppealDialog(true);
          return;
        }
        
        if (response.status === 404) {
          toast.error('Пользователь с такой почтой не зарегистрирован!');
          return;
        }
        
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
          setLoginAttemptFailed(true);
        }
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !phone) {
      toast.error('Заполните все обязательные поля: email, пароль и телефон');
      return;
    }

    if (password.length < 8) {
      toast.error('Пароль должен содержать минимум 8 символов');
      setPasswordError('Минимум 8 символов');
      return;
    }
    setPasswordError('');

    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith('8')) {
      normalizedPhone = '+7' + normalizedPhone.slice(1);
    }

    try {
      const settingsResponse = await fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0');
      const settings = await settingsResponse.json();
      
      if (!settings.registration_enabled) {
        toast.error('Регистрация новых пользователей временно отключена');
        return;
      }

      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', email, password, phone: normalizedPhone }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Регистрация успешна! Подтвердите email');
        onLoginSuccess(data.userId, email);
      
      } else {
        toast.error(data.error || 'Ошибка регистрации');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  const handle2FAVerify = async () => {
    if (!twoFactorCode || !pendingUserId) {
      toast.error('Введите код подтверждения');
      return;
    }

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_2fa',
          userId: pendingUserId,
          code: twoFactorCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Код подтвержден!');
        setIs2FADialogOpen(false);
        setTwoFactorCode('');
        onLoginSuccess(pendingUserId, email);
      } else {
        toast.error(data.error || 'Неверный код');
      }
    } catch (error) {
      toast.error('Ошибка подключения к серверу');
    }
  };

  const handleVKSuccess = (userId: number, vkEmail?: string) => {
    onLoginSuccess(userId, vkEmail);
  };

  const handleVKBlocked = (userId?: number, userEmail?: string) => {
    setBlockedUserData({
      userId,
      userEmail,
      authMethod: 'vk'
    });
    setShowAppealDialog(true);
  };

  return (
    <LoginPageBackground>
      <Card>
        <CardHeader>
          <CardTitle>{isRegistering ? 'Регистрация' : 'Вход в систему'}</CardTitle>
          <CardDescription>
            {isRegistering
              ? 'Создайте новый аккаунт для доступа к фотосервису'
              : 'Войдите в свой аккаунт для управления фотосервисом'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isRegistering ? (
            <RegisterForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              phone={phone}
              setPhone={setPhone}
              passwordError={passwordError}
              onRegister={handleRegister}
            />
          ) : (
            <LoginForm
              email={email}
              setEmail={setEmail}
              password={password}
              setPassword={setPassword}
              showPassword={showPassword}
              setShowPassword={setShowPassword}
              onLogin={handleLogin}
              onVKSuccess={handleVKSuccess}
              authProviders={authProviders}
              isBlocked={isBlocked}
              blockTimeRemaining={blockTimeRemaining}
              formatTime={formatTime}
              loginAttemptFailed={loginAttemptFailed}
              onForgotPasswordClick={() => setShowForgotPassword(true)}
            />
          )}

          <div className="text-center text-sm text-muted-foreground">
            {isRegistering ? (
              <>
                Уже есть аккаунт?{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => setIsRegistering(false)}>
                  Войти
                </Button>
              </>
            ) : (
              <>
                Нет аккаунта?{' '}
                <Button variant="link" className="p-0 h-auto" onClick={() => setIsRegistering(true)}>
                  Зарегистрироваться
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <TwoFactorDialog
        open={is2FADialogOpen}
        onOpenChange={setIs2FADialogOpen}
        code={twoFactorCode}
        onCodeChange={setTwoFactorCode}
        onVerify={handle2FAVerify}
        type={twoFactorType}
      />

      <BlockedUserAppeal
        open={showAppealDialog}
        onClose={() => {
          setShowAppealDialog(false);
          setBlockedUserData(null);
        }}
        userId={blockedUserData?.userId}
        userEmail={blockedUserData?.userEmail}
        authMethod={blockedUserData?.authMethod}
      />

      <ForgotPasswordDialog
        open={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
      />
    </LoginPageBackground>
  );
};

export default LoginPage;
