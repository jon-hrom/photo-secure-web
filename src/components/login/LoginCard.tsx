import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { ReactNode, useState, useEffect } from 'react';

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
  const [cardBackgroundImages, setCardBackgroundImages] = useState<BackgroundImage[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [transitionTime, setTransitionTime] = useState(5);
  const [cardOpacity, setCardOpacity] = useState(95);

  useEffect(() => {
    const savedCardImages = localStorage.getItem('cardBackgroundImages');
    const savedTransitionTime = localStorage.getItem('cardTransitionTime');
    const savedCardOpacity = localStorage.getItem('loginCardOpacity');
    
    if (savedCardImages) {
      setCardBackgroundImages(JSON.parse(savedCardImages));
    }
    
    if (savedTransitionTime) {
      setTransitionTime(Number(savedTransitionTime));
    }

    if (savedCardOpacity) {
      setCardOpacity(Number(savedCardOpacity));
    }

    const handleTransitionTimeChange = (e: CustomEvent) => {
      setTransitionTime(e.detail);
    };

    const handleCardOpacityChange = (e: CustomEvent) => {
      setCardOpacity(e.detail);
    };

    window.addEventListener('cardTransitionTimeChange', handleTransitionTimeChange as EventListener);
    window.addEventListener('cardOpacityChange', handleCardOpacityChange as EventListener);
    
    return () => {
      window.removeEventListener('cardTransitionTimeChange', handleTransitionTimeChange as EventListener);
      window.removeEventListener('cardOpacityChange', handleCardOpacityChange as EventListener);
    };
  }, []);

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