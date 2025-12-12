import { useEffect, useState, ReactNode } from 'react';

interface LoginPageBackgroundProps {
  children: ReactNode;
}

const LoginPageBackground = ({ children }: LoginPageBackgroundProps) => {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(20);

  useEffect(() => {
    const selectedBgId = localStorage.getItem('loginPageBackground');
    if (selectedBgId) {
      const savedImages = localStorage.getItem('backgroundImages');
      if (savedImages) {
        const images = JSON.parse(savedImages);
        const selectedImage = images.find((img: any) => img.id === selectedBgId);
        if (selectedImage) {
          setBackgroundImage(selectedImage.url);
        }
      }
    }
    
    const savedOpacity = localStorage.getItem('loginPageBackgroundOpacity');
    if (savedOpacity) {
      setBackgroundOpacity(Number(savedOpacity));
    }
  }, []);

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {backgroundImage && (
        <div 
          className="absolute inset-0 bg-background" 
          style={{ opacity: backgroundOpacity / 100 }}
        />
      )}
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
};

export default LoginPageBackground;
