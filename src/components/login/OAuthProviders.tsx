import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import VKAuthButton from '@/components/VKAuthButton';
import { useState, useEffect, useRef } from 'react';

interface OAuthProvidersProps {
  authProviders: {
    yandex: boolean;
    vk: boolean;
    telegram?: boolean;
  };
  isBlocked: boolean;
  privacyAccepted: boolean;
  onLoginSuccess: (userId: number, email?: string) => void;
  onOAuthLogin: (provider: 'yandex' | 'vk') => void;
}

const OAuthProviders = ({ 
  authProviders, 
  isBlocked,
  privacyAccepted, 
  onLoginSuccess, 
  onOAuthLogin 
}: OAuthProvidersProps) => {
  const [yandexButtonText, setYandexButtonText] = useState<'full' | 'short' | 'letter'>('full');
  const yandexButtonRef = useRef<HTMLButtonElement>(null);

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

  const handleOAuthClick = (provider: 'yandex' | 'vk') => {
    playSuccessSound();
    onOAuthLogin(provider);
  };

  useEffect(() => {
    const checkButtonWidths = () => {
      if (yandexButtonRef.current) {
        const buttonWidth = yandexButtonRef.current.offsetWidth;
        const availableWidth = buttonWidth - 48;
        
        if (availableWidth >= 140) {
          setYandexButtonText('full');
        } else if (availableWidth >= 60) {
          setYandexButtonText('short');
        } else {
          setYandexButtonText('letter');
        }
      }
    };

    checkButtonWidths();
    const timer = setTimeout(checkButtonWidths, 100);
    window.addEventListener('resize', checkButtonWidths);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkButtonWidths);
    };
  }, [authProviders.yandex]);

  const handleTelegramLogin = () => {
    const botUsername = 'FotooMixx_bot';
    const telegramUrl = `https://t.me/${botUsername}?start=web_auth`;
    window.open(telegramUrl, '_blank');
  };

  if (!authProviders.yandex && !authProviders.vk && !authProviders.telegram) {
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

      {authProviders.telegram && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleTelegramLogin}
            disabled={isBlocked || !privacyAccepted}
            className="w-full rounded-xl flex items-center justify-center gap-2 hover:border-[#0088cc] hover:bg-[#0088cc]/5 hover:shadow-lg hover:scale-105 transition-all duration-300 group"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
              <path fill="#0088cc" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
            </svg>
            <span className="font-medium text-[#0088cc]">Войти через Telegram</span>
          </Button>
        </div>
      )}

      {authProviders.vk && (
        <div className="flex justify-center">
          <VKAuthButton onSuccess={onLoginSuccess} disabled={isBlocked || !privacyAccepted} />
        </div>
      )}

      {authProviders.yandex && (
        <div className="flex justify-center gap-3">
          {authProviders.yandex && (
            <Button
              ref={yandexButtonRef}
              variant="outline"
              onClick={() => handleOAuthClick('yandex')}
              disabled={isBlocked || !privacyAccepted}
              className="rounded-xl flex-1 flex items-center justify-center gap-2 hover:border-[#FF0000] hover:bg-[#FF0000]/5 hover:shadow-lg hover:scale-105 transition-all duration-300 group"
              title="Войти через Яндекс"
            >
              <svg viewBox="0 0 32 32" className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                <circle cx="16" cy="16" r="16" fill="#FF0000"/>
                <path d="M13.5 9h2.8c2.4 0 4 1.5 4 3.7 0 1.7-1 3-2.6 3.4l2.8 7.4h-2.9l-2.5-7H15v7h-2.5V9h1zm2.5 5.5c1.5 0 2.3-.9 2.3-2.1 0-1.2-.8-2-2.3-2H15v4.1h1z" fill="#FFFFFF"/>
              </svg>
              {yandexButtonText === 'full' && (
                <span className="font-medium text-[#FF0000] whitespace-nowrap">
                  Вход через Яндекс
                </span>
              )}
              {yandexButtonText === 'short' && (
                <span className="font-medium text-[#FF0000]">
                  Яндекс
                </span>
              )}
              {yandexButtonText === 'letter' && (
                <span className="text-xl font-bold text-[#FF0000]">
                  Я
                </span>
              )}
            </Button>
          )}
        </div>
      )}
    </>
  );
};

export default OAuthProviders;