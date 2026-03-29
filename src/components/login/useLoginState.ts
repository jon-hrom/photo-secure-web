import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  isBiometricRegistered,
  authenticateWithBiometric,
  getBiometricUserData,
} from '@/utils/biometricAuth';

interface UseLoginStateProps {
  onLoginSuccess: (userId: number, email?: string, token?: string) => void;
}

export const useLoginState = ({ onLoginSuccess }: UseLoginStateProps) => {
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
    telegram: true,
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
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricUserData, setBiometricUserData] = useState<{ userId: number; email: string; token?: string } | null>(null);
  const [autoAuthTriggered, setAutoAuthTriggered] = useState(false);
  const [autoAuthState, setAutoAuthState] = useState<'idle' | 'scanning' | 'success' | 'error'>('idle');
  const [showBiometricOverlay, setShowBiometricOverlay] = useState(false);

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
        const [providersRes, biometricRes] = await Promise.all([
          fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=auth_providers'),
          fetch('https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0?key=biometric_enabled'),
        ]);
        const providersData = await providersRes.json();
        const biometricData = await biometricRes.json();
        if (providersData.value) {
          setAuthProviders(providersData.value);
        }
        if (biometricData.value === true) {
          setBiometricEnabled(true);
        }
      } catch (error) {
        console.error('Ошибка загрузки настроек провайдеров:', error);
      }
    };
    loadAuthProviders();
  }, []);

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

  const triggerBiometricAuth = async () => {
    setAutoAuthState('scanning');
    try {
      console.log('[BIO_AUTO] Calling authenticateWithBiometric...');
      const result = await authenticateWithBiometric();
      console.log('[BIO_AUTO] Auth result:', !!result);
      if (result) {
        setAutoAuthState('success');
        playSuccessSound();
        sessionStorage.setItem('login_method', 'biometric');
        setTimeout(() => {
          onLoginSuccess(result.userId, result.email, result.token);
        }, 600);
      } else {
        setAutoAuthState('error');
        setTimeout(() => setAutoAuthState('idle'), 2000);
      }
    } catch (err) {
      console.error('[BIO_AUTO] Error:', err);
      setAutoAuthState('error');
      setTimeout(() => setAutoAuthState('idle'), 2000);
    }
  };

  useEffect(() => {
    if (autoAuthTriggered) return;

    const registered = isBiometricRegistered();
    const userData = getBiometricUserData();
    console.log('[BIO_AUTO] Check:', { registered, hasUserData: !!userData });
    if (!registered || !userData) return;

    setAutoAuthTriggered(true);
    setShowBiometricOverlay(true);
    setAutoAuthState('idle');
    console.log('[BIO_AUTO] Overlay shown, waiting for tap...');
  }, [autoAuthTriggered]);

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
    playSuccessSound();
    if (!email || !password) {
      toast.error('Заполните все поля');
      return;
    }

    if (!privacyAccepted) {
      toast.error('Необходимо согласие на обработку персональных данных');
      return;
    }

    if (isBlocked) {
      toast.error(`Слишком много попыток. Подождите ${formatTime(blockTimeRemaining)}`);
      return;
    }

    try {
      let gpsLocation = null;
      try {
        const { getUserGeolocation, formatGeolocationForBackend } = await import('@/utils/geolocation');
        const location = await getUserGeolocation();
        gpsLocation = formatGeolocationForBackend(location);
        
        if (gpsLocation) {
          console.log('[LOGIN] GPS location obtained, sending to backend');
        }
      } catch (gpsError) {
        console.log('[LOGIN] GPS unavailable, backend will use IP geolocation');
      }

      let deviceId = localStorage.getItem('fm_device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('fm_device_id', deviceId);
      }

      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'login', 
          email, 
          password,
          gps_location: gpsLocation,
          device_id: deviceId
        }),
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
          
          if (data.token) {
            localStorage.setItem('auth_token', data.token);
            localStorage.setItem('auth_session_id', data.session_id);
          }
          
          toast.success('Вход выполнен успешно!');

          const tryRegisterBiometric = async () => {
            try {
              const { checkBiometricAvailability: checkAvail, isBiometricRegistered: isReg, registerBiometric: regBio } = await import('@/utils/biometricAuth');
              const available = await checkAvail();
              const alreadyRegistered = isReg();
              console.log('[BIO_LOGIN] Auto-register check:', { available, alreadyRegistered, biometricEnabled });
              if (available && !alreadyRegistered) {
                const success = await regBio({ userId: data.userId, email, token: data.token });
                console.log('[BIO_LOGIN] Auto-register result:', success);
                if (success) {
                  toast.success('Биометрия привязана! В следующий раз войдёте по отпечатку');
                }
              }
            } catch (err) {
              console.log('[BIO_LOGIN] Auto-register skipped:', err);
            }
          };

          if (biometricEnabled) {
            await tryRegisterBiometric();
          }

          onLoginSuccess(data.userId, email, data.token);
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

    if (!privacyAccepted) {
      toast.error('Необходимо согласие на обработку персональных данных');
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
    if (!privacyAccepted) {
      toast.error('Необходимо согласие на обработку персональных данных');
      return;
    }

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

  return {
    email,
    setEmail,
    password,
    showPassword,
    setShowPassword,
    isRegistering,
    phone,
    setPhone,
    isBlocked,
    remainingAttempts,
    blockTimeRemaining,
    is2FADialogOpen,
    twoFactorCode,
    pendingUserId,
    twoFactorType,
    passwordError,
    backgroundImage,
    backgroundOpacity,
    authProviders,
    showAppealDialog,
    setShowAppealDialog,
    blockedUserData,
    showForgotPassword,
    setShowForgotPassword,
    loginAttemptFailed,
    showGarland,
    privacyAccepted,
    setPrivacyAccepted,
    showPrivacyPolicy,
    setShowPrivacyPolicy,
    biometricEnabled,
    showBiometricPrompt,
    setShowBiometricPrompt,
    biometricUserData,
    autoAuthState,
    showBiometricOverlay,
    setShowBiometricOverlay,
    formatTime,
    handleLogin,
    handleRegister,
    handleOAuthLogin,
    handle2FASuccess,
    handle2FACancel,
    handlePasswordChange,
    handleToggleMode,
    triggerBiometricAuth,
  };
};

export default useLoginState;