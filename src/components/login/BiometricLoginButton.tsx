import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  checkBiometricAvailability,
  isBiometricRegistered,
  authenticateWithBiometric,
  getBiometricUserData,
} from '@/utils/biometricAuth';

interface BiometricLoginButtonProps {
  onLoginSuccess: (userId: number, email?: string, token?: string) => void;
  biometricGlobalEnabled: boolean;
}

const BiometricLoginButton = ({ onLoginSuccess, biometricGlobalEnabled }: BiometricLoginButtonProps) => {
  const [available, setAvailable] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    const check = async () => {
      if (!biometricGlobalEnabled) return;
      const supported = await checkBiometricAvailability();
      const registered = isBiometricRegistered();
      setAvailable(supported && registered);
    };
    check();
  }, [biometricGlobalEnabled]);

  if (!available || !biometricGlobalEnabled) return null;

  const userData = getBiometricUserData();
  if (!userData) return null;

  const handleBiometricLogin = async () => {
    setAuthenticating(true);
    try {
      const result = await authenticateWithBiometric();
      if (result) {
        onLoginSuccess(result.userId, result.email, result.token);
      }
    } catch {
      console.error('[Biometric] Login failed');
    }
    setAuthenticating(false);
  };

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
        disabled={authenticating}
        variant="outline"
        className="w-full h-14 text-base gap-3 border-2 border-primary/30 hover:border-primary/60 transition-all"
      >
        <Icon
          name={authenticating ? 'Loader2' : 'Fingerprint'}
          size={24}
          className={authenticating ? 'animate-spin text-primary' : 'text-primary'}
        />
        <div className="flex flex-col items-start">
          <span className="font-medium">Войти по биометрии</span>
          <span className="text-xs text-muted-foreground">{userData.email}</span>
        </div>
      </Button>
    </div>
  );
};

export default BiometricLoginButton;
