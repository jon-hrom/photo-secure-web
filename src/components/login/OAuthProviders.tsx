import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import VKAuthButton from '@/components/VKAuthButton';

interface OAuthProvidersProps {
  authProviders: {
    yandex: boolean;
    vk: boolean;
    google: boolean;
  };
  isBlocked: boolean;
  onLoginSuccess: (userId: number, email?: string) => void;
  onOAuthLogin: (provider: 'yandex' | 'vk' | 'google') => void;
}

const OAuthProviders = ({ 
  authProviders, 
  isBlocked, 
  onLoginSuccess, 
  onOAuthLogin 
}: OAuthProvidersProps) => {
  if (!authProviders.yandex && !authProviders.vk && !authProviders.google) {
    return null;
  }

  return (
    <>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Или войти через</span>
        </div>
      </div>

      {authProviders.vk && (
        <div className="flex justify-center">
          <VKAuthButton onSuccess={onLoginSuccess} disabled={isBlocked} />
        </div>
      )}

      {(authProviders.yandex || authProviders.google) && (
        <div className="flex justify-center gap-3">
          {authProviders.yandex && (
            <Button
              variant="outline"
              onClick={() => onOAuthLogin('yandex')}
              disabled={isBlocked}
              className="rounded-xl flex-1"
              title="Войти через Яндекс"
            >
              <Icon name="Circle" size={20} className="text-red-500" />
            </Button>
          )}
          {authProviders.google && (
            <Button
              variant="outline"
              onClick={() => onOAuthLogin('google')}
              disabled={isBlocked}
              className="rounded-xl flex-1"
              title="Войти через Google"
            >
              <Icon name="Mail" size={20} className="text-red-600" />
            </Button>
          )}
        </div>
      )}
    </>
  );
};

export default OAuthProviders;
