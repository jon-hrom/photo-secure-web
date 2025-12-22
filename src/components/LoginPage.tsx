import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import TwoFactorDialog from '@/components/TwoFactorDialog';
import BlockedUserAppeal from '@/components/BlockedUserAppeal';
import ForgotPasswordDialog from '@/components/ForgotPasswordDialog';
import LoginBackground from '@/components/login/LoginBackground';
import LoginCard from '@/components/login/LoginCard';
import LoginFormFields from '@/components/login/LoginFormFields';
import OAuthProviders from '@/components/login/OAuthProviders';
import NewYearDecorations from '@/components/NewYearDecorations';

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
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(20);
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
  const [showGarland, setShowGarland] = useState(
    localStorage.getItem('garlandEnabled') === 'true'
  );

  useEffect(() => {
    const selectedBgId = localStorage.getItem('loginPageBackground');
    let imageLoaded = false;
    
    if (selectedBgId) {
      const savedImages = localStorage.getItem('backgroundImages');
      if (savedImages) {
        const images = JSON.parse(savedImages);
        const selectedImage = images.find((img: any) => img.id === selectedBgId);
        if (selectedImage) {
          setBackgroundImage(selectedImage.url);
          imageLoaded = true;
        }
      }
    }
    
    if (!imageLoaded) {
      setBackgroundImage('https://cdn.poehali.dev/files/b5e1f5a0-ccfd-4d76-a06a-5112979ef8eb.jpg');
    }
    
    const savedOpacity = localStorage.getItem('loginPageBackgroundOpacity');
    if (savedOpacity) {
      setBackgroundOpacity(Number(savedOpacity));
    }

    const handleGarlandToggle = (e: CustomEvent) => {
      setShowGarland(e.detail);
    };

    window.addEventListener('garlandToggle', handleGarlandToggle as EventListener);
    
    return () => {
      window.removeEventListener('garlandToggle', handleGarlandToggle as EventListener);
    };
  }, []);

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

  const playSuccessSound = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  };

  const handleLogin = async () => {
    playSuccessSound();
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

    playSuccessSound();

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

  const handleOAuthLogin = (provider: 'yandex' | 'vk' | 'google') => {
    if (provider === 'google') {
      window.location.href = 'https://functions.poehali.dev/a362a521-0759-4577-adbf-7960bf063100';
    } else {
      toast.info(`OAuth через ${provider} будет доступен в следующей версии`);
    }
  };

  const handle2FASuccess = () => {
    if (pendingUserId) {
      setRemainingAttempts(5);
      localStorage.removeItem('loginBlock');
      setIs2FADialogOpen(false);
      toast.success('Вход выполнен успешно!');
      onLoginSuccess(pendingUserId, email);
      setPendingUserId(null);
    }
  };

  const handle2FACancel = () => {
    setIs2FADialogOpen(false);
    setPendingUserId(null);
    toast.info('Вход отменён');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (isRegistering && value.length > 0 && value.length < 8) {
      setPasswordError('Минимум 8 символов');
    } else {
      setPasswordError('');
    }
  };

  const handleToggleMode = () => {
    setIsRegistering(!isRegistering);
    setPassword('');
    setPasswordError('');
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: backgroundImage ? undefined : '#f8f9fa',
      }}
    >
      <LoginBackground 
        backgroundImage={backgroundImage} 
        backgroundOpacity={backgroundOpacity} 
      />

      {showGarland && <NewYearDecorations />}

      <LoginCard isRegistering={isRegistering}>
        <LoginFormFields
          email={email}
          password={password}
          showPassword={showPassword}
          isRegistering={isRegistering}
          phone={phone}
          isBlocked={isBlocked}
          remainingAttempts={remainingAttempts}
          blockTimeRemaining={blockTimeRemaining}
          passwordError={passwordError}
          loginAttemptFailed={loginAttemptFailed}
          onEmailChange={setEmail}
          onPasswordChange={handlePasswordChange}
          onPhoneChange={setPhone}
          onShowPasswordToggle={() => setShowPassword(!showPassword)}
          onSubmit={isRegistering ? handleRegister : handleLogin}
          onToggleMode={handleToggleMode}
          onForgotPassword={() => setShowForgotPassword(true)}
          formatTime={formatTime}
        />

        <OAuthProviders
          authProviders={authProviders}
          isBlocked={isBlocked}
          onLoginSuccess={onLoginSuccess}
          onOAuthLogin={handleOAuthLogin}
        />
      </LoginCard>

      {is2FADialogOpen && pendingUserId && (
        <TwoFactorDialog
          open={is2FADialogOpen}
          userId={pendingUserId}
          type={twoFactorType}
          onSuccess={handle2FASuccess}
          onCancel={handle2FACancel}
        />
      )}

      <ForgotPasswordDialog 
        open={showForgotPassword} 
        onClose={() => setShowForgotPassword(false)}
      />

      <Dialog open={showAppealDialog} onOpenChange={setShowAppealDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Форма обращения к администратору</DialogTitle>
          </DialogHeader>
          <BlockedUserAppeal
            userId={blockedUserData?.userId}
            userEmail={blockedUserData?.userEmail}
            authMethod={blockedUserData?.authMethod}
            onClose={() => setShowAppealDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;