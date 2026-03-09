import LoginBackground from '@/components/login/LoginBackground';
import FingerprintAnimation from '@/components/ui/FingerprintAnimation';
import { getBiometricUserData } from '@/utils/biometricAuth';

interface BiometricOverlayProps {
  backgroundImage: string | null;
  backgroundOpacity: number;
  autoAuthState: 'idle' | 'scanning' | 'success' | 'error';
  onTriggerAuth: () => void;
  onDismiss: () => void;
}

const BiometricOverlay = ({
  backgroundImage,
  backgroundOpacity,
  autoAuthState,
  onTriggerAuth,
  onDismiss,
}: BiometricOverlayProps) => {
  const overlayUserData = getBiometricUserData();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ backgroundColor: '#f8f9fa' }}>
      <LoginBackground backgroundImage={backgroundImage} backgroundOpacity={backgroundOpacity} />
      
      <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in">
        <button
          onClick={() => {
            if (autoAuthState !== 'scanning' && autoAuthState !== 'success') {
              onTriggerAuth();
            }
          }}
          className="cursor-pointer active:scale-95 transition-transform"
          disabled={autoAuthState === 'scanning' || autoAuthState === 'success'}
        >
          <FingerprintAnimation state={autoAuthState} size="lg" />
        </button>
        
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold text-white drop-shadow-lg">
            {autoAuthState === 'scanning' ? 'Приложите палец...' : 
             autoAuthState === 'success' ? 'Добро пожаловать!' :
             autoAuthState === 'error' ? 'Не удалось. Нажмите ещё раз' : 'Нажмите для входа по отпечатку'}
          </p>
          {overlayUserData && (
            <p className="text-sm text-white/70 drop-shadow">{overlayUserData.email}</p>
          )}
        </div>

        {autoAuthState !== 'success' && (
          <button
            onClick={onDismiss}
            className="mt-6 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white text-sm hover:bg-white/20 transition-all active:scale-95"
          >
            Войти другим способом
          </button>
        )}
      </div>
    </div>
  );
};

export default BiometricOverlay;
