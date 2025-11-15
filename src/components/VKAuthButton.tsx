import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface VKAuthButtonProps {
  onSuccess: (userId: number, email?: string) => void;
  disabled?: boolean;
}

declare global {
  interface Window {
    VKIDSDK: any;
  }
}

const VKAuthButton = ({ onSuccess, disabled }: VKAuthButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (disabled || !containerRef.current || initializedRef.current) {
      return;
    }

    const initVKID = () => {
      if (!window.VKIDSDK) {
        console.error('VK ID SDK не загружен');
        return;
      }

      try {
        const VKID = window.VKIDSDK;

        VKID.Config.init({
          app: 54323080,
          redirectUrl: 'https://foto-mix.ru/auth/callback/vk',
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: '',
        });

        const oneTap = new VKID.OneTap();

        if (containerRef.current) {
          containerRef.current.innerHTML = '';

          oneTap.render({
            container: containerRef.current,
            showAlternativeLogin: true,
            styles: {
              width: 325,
              height: 40
            }
          })
          .on(VKID.WidgetEvents.ERROR, (error: any) => {
            console.error('VK ID Error:', error);
            toast.error('Ошибка входа через VK');
          })
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload: any) => {
            const code = payload.code;
            const deviceId = payload.device_id;

            VKID.Auth.exchangeCode(code, deviceId)
              .then((data: any) => {
                console.log('VK Auth success:', data);
                
                const vkUserId = data.user?.id || Math.floor(Math.random() * 1000000);
                const vkEmail = data.user?.email || `vk_${vkUserId}@vk.com`;
                
                toast.success('Вход через VK выполнен успешно!');
                onSuccess(vkUserId, vkEmail);
              })
              .catch((error: any) => {
                console.error('VK Auth exchange error:', error);
                toast.error('Ошибка обмена кода VK');
              });
          });

          initializedRef.current = true;
        }
      } catch (error) {
        console.error('Ошибка инициализации VK ID:', error);
      }
    };

    if (window.VKIDSDK) {
      initVKID();
    } else {
      const checkInterval = setInterval(() => {
        if (window.VKIDSDK) {
          clearInterval(checkInterval);
          initVKID();
        }
      }, 100);

      setTimeout(() => clearInterval(checkInterval), 5000);
    }
  }, [disabled, onSuccess]);

  return (
    <div 
      ref={containerRef} 
      className={`vk-auth-container ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
    />
  );
};

export default VKAuthButton;
