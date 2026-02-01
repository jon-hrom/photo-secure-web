import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import VKAuthButton from '@/components/VKAuthButton';
import { useState, useEffect, useRef } from 'react';

interface OAuthProvidersProps {
  authProviders: {
    yandex: boolean;
    vk: boolean;
    google: boolean;
    telegram?: boolean;
  };
  isBlocked: boolean;
  privacyAccepted: boolean;
  onLoginSuccess: (userId: number, email?: string) => void;
  onOAuthLogin: (provider: 'yandex' | 'vk' | 'google') => void;
}

const OAuthProviders = ({ 
  authProviders, 
  isBlocked,
  privacyAccepted, 
  onLoginSuccess, 
  onOAuthLogin 
}: OAuthProvidersProps) => {
  const [googleButtonText, setGoogleButtonText] = useState<'full' | 'short' | 'letter'>('full');
  const [yandexButtonText, setYandexButtonText] = useState<'full' | 'short' | 'letter'>('full');
  const googleButtonRef = useRef<HTMLButtonElement>(null);
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

  const handleOAuthClick = (provider: 'yandex' | 'vk' | 'google') => {
    playSuccessSound();
    onOAuthLogin(provider);
  };

  useEffect(() => {
    const checkButtonWidths = () => {
      if (googleButtonRef.current) {
        const buttonWidth = googleButtonRef.current.offsetWidth;
        const availableWidth = buttonWidth - 48;
        
        if (availableWidth >= 140) {
          setGoogleButtonText('full');
        } else if (availableWidth >= 60) {
          setGoogleButtonText('short');
        } else {
          setGoogleButtonText('letter');
        }
      }

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
  }, [authProviders.google, authProviders.yandex]);

  const handleTelegramLogin = () => {
    const botUsername = 'FotooMixx_bot';
    const telegramUrl = `https://t.me/${botUsername}?start=web_auth`;
    window.open(telegramUrl, '_blank');
  };

  if (!authProviders.yandex && !authProviders.vk && !authProviders.google && !authProviders.telegram) {
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

      {(authProviders.yandex || authProviders.google) && (
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
          {authProviders.google && (
            <Button
              ref={googleButtonRef}
              variant="outline"
              onClick={() => handleOAuthClick('google')}
              disabled={isBlocked || !privacyAccepted}
              className="rounded-xl flex-1 flex items-center justify-center gap-2 hover:border-[#4285F4] hover:bg-[#4285F4]/5 hover:shadow-lg hover:scale-105 transition-all duration-300 group"
              title="Войти через Google"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleButtonText === 'full' && (
                <span className="font-medium bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#FBBC05] bg-clip-text text-transparent whitespace-nowrap">
                  Вход через Google
                </span>
              )}
              {googleButtonText === 'short' && (
                <span className="font-medium bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#FBBC05] bg-clip-text text-transparent">
                  Google
                </span>
              )}
              {googleButtonText === 'letter' && (
                <span className="text-xl font-bold bg-gradient-to-r from-[#4285F4] via-[#EA4335] to-[#FBBC05] bg-clip-text text-transparent">
                  G
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