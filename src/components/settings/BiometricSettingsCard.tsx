import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import FingerprintAnimation, { type AnimationState } from '@/components/ui/FingerprintAnimation';
import {
  isBiometricSupported,
  checkBiometricAvailability,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
  authenticateWithBiometric,
  BiometricUserData,
} from '@/utils/biometricAuth';

interface BiometricSettingsCardProps {
  userId: number;
  userEmail: string;
  userToken?: string;
}

const detectPlatform = (): 'ios' | 'android' | 'desktop' => {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
};

const BiometricSettingsCard = ({ userId, userEmail, userToken }: BiometricSettingsCardProps) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [checking, setChecking] = useState(true);
  const platform = detectPlatform();

  useEffect(() => {
    const check = async () => {
      const supported = isBiometricSupported();
      if (supported) {
        const available = await checkBiometricAvailability();
        setIsAvailable(available);
      }
      setIsRegistered(isBiometricRegistered());
      setChecking(false);
    };
    check();
  }, []);

  const handleRegister = async () => {
    setAnimState('scanning');

    const userData: BiometricUserData = {
      userId,
      email: userEmail,
      token: userToken || localStorage.getItem('auth_token') || undefined,
    };

    const success = await registerBiometric(userData);

    if (success) {
      setAnimState('success');
      setIsRegistered(true);
      toast.success('Биометрия подключена! Теперь вы можете входить по отпечатку пальца или Face ID');
      setTimeout(() => setAnimState('idle'), 2500);
    } else {
      setAnimState('error');
      toast.error('Не удалось подключить биометрию. Попробуйте ещё раз');
      setTimeout(() => setAnimState('idle'), 2000);
    }
  };

  const handleRemove = () => {
    removeBiometric();
    setIsRegistered(false);
    setAnimState('idle');
    toast.success('Биометрия отключена');
  };

  const handleTest = async () => {
    setAnimState('scanning');
    const result = await authenticateWithBiometric();

    if (result) {
      setAnimState('success');
      toast.success('Проверка пройдена!');
      setTimeout(() => setAnimState('idle'), 2500);
    } else {
      setAnimState('error');
      toast.error('Проверка не пройдена');
      setTimeout(() => setAnimState('idle'), 2000);
    }
  };

  if (checking) return null;

  const biometricType = platform === 'ios' ? 'Face ID / Touch ID' : platform === 'android' ? 'отпечатку пальца' : 'Windows Hello';

  return (
    <Card className="shadow-xl overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <Icon name="Fingerprint" size={20} className="md:w-6 md:h-6" />
          Вход по биометрии
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Быстрый вход по {biometricType}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <FingerprintAnimation state={animState} />

        {!isAvailable ? (
          <div className="p-3 md:p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2 md:gap-3">
              <Icon name="AlertTriangle" className="text-amber-600 mt-0.5 flex-shrink-0" size={16} />
              <div className="text-xs md:text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Устройство не поддерживает</p>
                <p className="text-amber-700 dark:text-amber-400">
                  {platform === 'desktop'
                    ? 'Откройте сайт на телефоне (Android или iPhone) для подключения биометрии'
                    : 'Ваш браузер не поддерживает биометрию. Попробуйте Chrome или Safari'}
                </p>
              </div>
            </div>
          </div>
        ) : isRegistered ? (
          <>
            <div className="p-3 md:p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-2 md:gap-3">
                <Icon name="ShieldCheck" className="text-green-600 mt-0.5 flex-shrink-0" size={16} />
                <div className="text-xs md:text-sm">
                  <p className="font-semibold text-green-900 dark:text-green-200 mb-1">Биометрия подключена</p>
                  <p className="text-green-700 dark:text-green-400">
                    Вы можете входить в аккаунт по {biometricType} без ввода почты и пароля
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleTest}
                variant="outline"
                className="flex-1 py-5 rounded-xl"
                disabled={animState === 'scanning'}
              >
                <Icon name="ScanFace" size={18} className="mr-2" />
                Проверить
              </Button>
              <Button
                onClick={handleRemove}
                variant="destructive"
                className="flex-1 py-5 rounded-xl"
                disabled={animState === 'scanning'}
              >
                <Icon name="Trash2" size={18} className="mr-2" />
                Отключить
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="p-3 md:p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2 md:gap-3">
                <Icon name="Info" className="text-blue-600 mt-0.5 flex-shrink-0" size={16} />
                <div className="text-xs md:text-sm">
                  <p className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Быстрый вход</p>
                  <p className="text-blue-700 dark:text-blue-400">
                    Подключите {biometricType}, чтобы входить в аккаунт в одно касание — без ввода почты и пароля
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={handleRegister}
              className="w-full py-6 rounded-xl text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
              disabled={animState === 'scanning'}
            >
              {animState === 'scanning' ? (
                <>
                  <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Приложите палец...
                </>
              ) : (
                <>
                  <Icon name="Fingerprint" size={22} className="mr-2" />
                  Подключить биометрию
                </>
              )}
            </Button>
          </>
        )}

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Биометрические данные хранятся только на вашем устройстве и не передаются на сервер
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BiometricSettingsCard;
