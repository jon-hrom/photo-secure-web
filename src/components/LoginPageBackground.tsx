import { useEffect, useState, ReactNode } from 'react';

interface LoginPageBackgroundProps {
  children: ReactNode;
}

const LoginPageBackground = ({ children }: LoginPageBackgroundProps) => {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundVideo, setBackgroundVideo] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(20);

  useEffect(() => {
    // Проверяем видео
    const selectedVideoId = localStorage.getItem('loginPageVideo');
    if (selectedVideoId) {
      const savedVideos = localStorage.getItem('backgroundVideos');
      if (savedVideos) {
        const videos = JSON.parse(savedVideos);
        const selectedVideo = videos.find((v: any) => v.id === selectedVideoId);
        if (selectedVideo) {
          setBackgroundVideo(selectedVideo.url);
        }
      }
    } else {
      // Если видео нет, проверяем изображение
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
    }
    
    const savedOpacity = localStorage.getItem('loginPageBackgroundOpacity');
    if (savedOpacity) {
      setBackgroundOpacity(Number(savedOpacity));
    }

    // Слушаем изменения видео
    const handleVideoChange = (e: CustomEvent) => {
      const videoId = e.detail;
      if (videoId) {
        const savedVideos = localStorage.getItem('backgroundVideos');
        if (savedVideos) {
          const videos = JSON.parse(savedVideos);
          const video = videos.find((v: any) => v.id === videoId);
          if (video) {
            setBackgroundVideo(video.url);
            setBackgroundImage(null);
          }
        }
      } else {
        setBackgroundVideo(null);
      }
    };

    window.addEventListener('backgroundVideoChange', handleVideoChange as EventListener);
    
    return () => {
      window.removeEventListener('backgroundVideoChange', handleVideoChange as EventListener);
    };
  }, []);

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: !backgroundVideo && backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {backgroundVideo && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ zIndex: 0 }}
        >
          <source src={backgroundVideo} type="video/webm" />
          <source src={backgroundVideo} type="video/mp4" />
        </video>
      )}
      
      {(backgroundImage || backgroundVideo) && (
        <div 
          className="absolute inset-0 bg-background" 
          style={{ opacity: backgroundOpacity / 100, zIndex: 1 }}
        />
      )}
      
      <div className="relative z-10 w-full max-w-md">
        {children}
      </div>
    </div>
  );
};

export default LoginPageBackground;