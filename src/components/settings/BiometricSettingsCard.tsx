import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  isBiometricSupported,
  checkBiometricAvailability,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
  getBiometricUserData,
  BiometricUserData,
} from '@/utils/biometricAuth';

type AnimationState = 'idle' | 'scanning' | 'success' | 'error';

interface BiometricSettingsCardProps {
  userId: number;
  userEmail: string;
  userToken?: string;
}

const FingerprintAnimation = ({ state }: { state: AnimationState }) => {
  const baseColor = state === 'success' ? '#22c55e' : state === 'error' ? '#ef4444' : state === 'scanning' ? '#3b82f6' : '#94a3b8';
  const pulseColor = state === 'scanning' ? 'rgba(59, 130, 246, 0.3)' : state === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'transparent';

  return (
    <div className="relative flex items-center justify-center w-28 h-28 mx-auto">
      {state === 'scanning' && (
        <>
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: pulseColor, animationDuration: '1.5s' }}
          />
          <div
            className="absolute inset-2 rounded-full animate-ping"
            style={{ backgroundColor: pulseColor, animationDuration: '2s', animationDelay: '0.3s' }}
          />
        </>
      )}

      {state === 'success' && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', animationDuration: '1s' }}
        />
      )}

      <div
        className="relative z-10 w-20 h-20 flex items-center justify-center rounded-full transition-all duration-500"
        style={{
          background: `linear-gradient(135deg, ${baseColor}15, ${baseColor}30)`,
          border: `2px solid ${baseColor}`,
          boxShadow: state !== 'idle' ? `0 0 20px ${baseColor}40` : 'none',
        }}
      >
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke={baseColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={state === 'scanning' ? 'animate-fingerprint-scan' : ''}
        >
          <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
          <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
          <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
          <path d="M2 12a10 10 0 0 1 18-6" />
          <path d="M2 16h.01" />
          <path d="M21.8 16c.2-2 .131-5.354 0-6" />
          <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
          <path d="M8.65 22c.21-.66.45-1.32.57-2" />
          <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
        </svg>

        {state === 'scanning' && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div
              className="w-full h-1 bg-blue-400/60 absolute animate-scan-line"
              style={{ boxShadow: '0 0 8px rgba(59, 130, 246, 0.6)' }}
            />
          </div>
        )}

        {state === 'success' && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-scale-in">
            <Icon name="Check" size={14} className="text-white" />
          </div>
        )}

        {state === 'error' && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shadow-lg animate-scale-in">
            <Icon name="X" size={14} className="text-white" />
          </div>
        )}
      </div>
    </div>
  );
};

const BiometricSettingsCard = ({ userId, userEmail, userToken }: BiometricSettingsCardProps) => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const [checking, setChecking] = useState(true);

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

    const { authenticateWithBiometric } = await import('@/utils/biometricAuth');
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

  return (
    <Card className="shadow-xl overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <Icon name="Fingerprint" size={20} className="md:w-6 md:h-6" />
          Вход по биометрии
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Быстрый вход по отпечатку пальца или Face ID
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <style>{`
          @keyframes scan-line {
            0% { top: 0; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
          }
          @keyframes scale-in {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          @keyframes fingerprint-scan {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .animate-scan-line { animation: scan-line 1.5s ease-in-out infinite; }
          .animate-scale-in { animation: scale-in 0.3s ease-out; }
          .animate-fingerprint-scan { animation: fingerprint-scan 1.5s ease-in-out infinite; }
        `}</style>

        <FingerprintAnimation state={animState} />

        {!isAvailable ? (
          <div className="p-3 md:p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2 md:gap-3">
              <Icon name="AlertTriangle" className="text-amber-600 mt-0.5 flex-shrink-0" size={16} />
              <div className="text-xs md:text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Устройство не поддерживает</p>
                <p className="text-amber-700 dark:text-amber-400">
                  Ваше устройство или браузер не поддерживает биометрическую аутентификацию.
                  Попробуйте открыть в Chrome или Safari на телефоне.
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
                    Вы можете входить в аккаунт по отпечатку пальца или Face ID без ввода почты и пароля
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
                    Подключите отпечаток пальца или Face ID, чтобы входить в аккаунт в одно касание — без ввода почты и пароля
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

        {isRegistered && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Биометрические данные хранятся только на вашем устройстве
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BiometricSettingsCard;
