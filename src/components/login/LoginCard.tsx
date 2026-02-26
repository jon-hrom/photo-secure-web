import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { ReactNode, useState, useEffect } from 'react';
import funcUrls from '../../../backend/func2url.json';

interface BackgroundImage {
  id: string;
  url: string;
  name: string;
}

interface LoginCardProps {
  isRegistering: boolean;
  children: ReactNode;
}

const LoginCard = ({ isRegistering, children }: LoginCardProps) => {
  const SETTINGS_API = funcUrls['background-settings'];
  const [cardBackgroundImages, setCardBackgroundImages] = useState<BackgroundImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [transitionTime, setTransitionTime] = useState(5);
  const [cardOpacity, setCardOpacity] = useState(95);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(SETTINGS_API);
        const data = await response.json();
        if (data.success && data.settings) {
          const s = data.settings;
          if (s.login_card_images) {
            const imgs = typeof s.login_card_images === 'string'
              ? JSON.parse(s.login_card_images)
              : s.login_card_images;
            setCardBackgroundImages(imgs);
          }
          if (s.login_card_transition_time) setTransitionTime(Number(s.login_card_transition_time));
          if (s.login_card_opacity) setCardOpacity(Number(s.login_card_opacity));
          return;
        }
      } catch (e) {
        console.error('[LOGIN_CARD] Failed to load settings from DB:', e);
      }
      const savedTransitionTime = localStorage.getItem('cardTransitionTime');
      const savedCardOpacity = localStorage.getItem('loginCardOpacity');
      if (savedTransitionTime) setTransitionTime(Number(savedTransitionTime));
      if (savedCardOpacity) setCardOpacity(Number(savedCardOpacity));
    };

    loadSettings();

    const handleTransitionTimeChange = (e: CustomEvent) => setTransitionTime(e.detail);
    const handleCardOpacityChange = (e: CustomEvent) => setCardOpacity(e.detail);
    const handleCardImagesChange = (e: CustomEvent) => setCardBackgroundImages(e.detail);

    window.addEventListener('cardTransitionTimeChange', handleTransitionTimeChange as EventListener);
    window.addEventListener('cardOpacityChange', handleCardOpacityChange as EventListener);
    window.addEventListener('cardBackgroundImagesChange', handleCardImagesChange as EventListener);

    return () => {
      window.removeEventListener('cardTransitionTimeChange', handleTransitionTimeChange as EventListener);
      window.removeEventListener('cardOpacityChange', handleCardOpacityChange as EventListener);
      window.removeEventListener('cardBackgroundImagesChange', handleCardImagesChange as EventListener);
    };
  }, [SETTINGS_API]);

  useEffect(() => {
    if (cardBackgroundImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % cardBackgroundImages.length);
    }, transitionTime * 1000);

    return () => clearInterval(interval);
  }, [cardBackgroundImages.length, transitionTime]);

  const currentBackground = cardBackgroundImages.length > 0 
    ? cardBackgroundImages[currentImageIndex].url 
    : 'https://cdn.poehali.dev/files/b5e1f5a0-ccfd-4d76-a06a-5112979ef8eb.jpg';

  return (
    <Card 
      className="w-full max-w-md shadow-2xl relative z-10 overflow-hidden"
      style={{
        backgroundImage: `url(${currentBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        transition: 'background-image 1s ease-in-out',
      }}
    >
      <div 
        className="absolute inset-0 bg-background backdrop-blur-sm z-0" 
        style={{ opacity: cardOpacity / 100 }}
      />
      <div className="relative z-10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Icon name="Lock" size={32} className="text-primary" />
          </div>
          <CardTitle className="text-2xl">Foto-Mix</CardTitle>
          <CardDescription className="text-base">Умная платформа для фотографов</CardDescription>
          <div className="mt-3 text-sm text-muted-foreground">
            {isRegistering ? 'Создайте новый аккаунт' : 'Вход в систему'}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {children}
        </CardContent>
      </div>
    </Card>
  );
};

export default LoginCard;