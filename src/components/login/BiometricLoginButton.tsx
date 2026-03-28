import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import FingerprintAnimation, { type AnimationState } from '@/components/ui/FingerprintAnimation';
import {
  checkBiometricAvailability,
  isBiometricRegistered,
  authenticateWithBiometric,
  getBiometricUserData,
} from '@/utils/biometricAuth';

interface BiometricLoginButtonProps {
  onLoginSuccess: (userId: number, email?: string, token?: string) => void;
  biometricGlobalEnabled: boolean;
  autoAuthState?: AnimationState;
}

const BiometricLoginButton = ({ onLoginSuccess, biometricGlobalEnabled, autoAuthState }: BiometricLoginButtonProps) => {
  const [available, setAvailable] = useState(false);
  const [animState, setAnimState] = useState<AnimationState>('idle');

  useEffect(() => {
    const check = async () => {
      if (!biometricGlobalEnabled) return;
      const supported = await checkBiometricAvailability();
      const registered = isBiometricRegistered();
      setAvailable(supported && registered);
    };
    check();
  }, [biometricGlobalEnabled]);

  const displayState = autoAuthState && autoAuthState !== 'idle' ? autoAuthState : animState;

  if (!available || !biometricGlobalEnabled) return null;

  const userData = getBiometricUserData();
  if (!userData) return null;

  const handleBiometricLogin = async () => {
    if (displayState === 'scanning') return;
    setAnimState('scanning');
    try {
      const result = await authenticateWithBiometric();
      if (result) {
        setAnimState('success');
        sessionStorage.setItem('login_method', 'biometric');
        setTimeout(() => {
          onLoginSuccess(result.userId, result.email, result.token);
        }, 600);
      } else {
        setAnimState('error');
        setTimeout(() => setAnimState('idle'), 2000);
      }
    } catch {
      setAnimState('error');
      setTimeout(() => setAnimState('idle'), 2000);
    }
  };

  const stateLabel = displayState === 'scanning'
    ? 'Приложите палец...'
    : displayState === 'success'
    ? 'Вход выполнен!'
    : displayState === 'error'
    ? 'Попробуйте ещё раз'
    : 'Войти по биометрии';

  return (
    <div className="w-full space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white dark:bg-gray-900 px-2 text-muted-foreground">
            или
          </span>
        </div>
      </div>

      <Button
        onClick={handleBiometricLogin}
        disabled={displayState === 'scanning'}
        variant="outline"
        className="w-full h-auto py-4 text-base gap-3 border-2 border-primary/30 hover:border-primary/60 transition-all flex flex-col items-center"
      >
        <FingerprintAnimation state={displayState} size="sm" />
        <div className="flex flex-col items-center">
          <span className="font-medium">{stateLabel}</span>
          <span className="text-xs text-muted-foreground">{userData.email}</span>
        </div>
      </Button>
    </div>
  );
};

export default BiometricLoginButton;