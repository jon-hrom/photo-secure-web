import { useEffect, useState, ReactNode } from 'react';
import funcUrls from '../../backend/func2url.json';

interface LoginPageBackgroundProps {
  children: ReactNode;
}

const LoginPageBackground = ({ children }: LoginPageBackgroundProps) => {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundVideo, setBackgroundVideo] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(20);
  const API_URL = funcUrls['background-media'];

  useEffect(() => {
    const loadBackground = async () => {
      // Проверяем видео
      const selectedVideoId = localStorage.getItem('loginPageVideo');

      
      if (selectedVideoId) {
        try {
          // Загружаем список видео с сервера

          const response = await fetch(`${API_URL}?type=video`);
          const data = await response.json();

          
          if (data.success && data.files) {
            const selectedVideo = data.files.find((v: any) => v.id === selectedVideoId);

            if (selectedVideo) {
              setBackgroundVideo(selectedVideo.url);

            }
          }
        } catch (error) {
          console.error('[LOGIN_BG] Failed to load video:', error);
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
    };

    loadBackground();

    // Слушаем изменения видео
    const handleVideoChange = async (e: CustomEvent) => {
      const videoId = e.detail;

      if (videoId) {
        try {
          const response = await fetch(`${API_URL}?type=video`);
          const data = await response.json();

          
          if (data.success && data.files) {
            const video = data.files.find((v: any) => v.id === videoId);

            if (video) {
              setBackgroundVideo(video.url);
              setBackgroundImage(null);

            }
          }
        } catch (error) {
          console.error('[LOGIN_BG] Video change - failed:', error);
        }
      } else {

        setBackgroundVideo(null);
      }
    };

    window.addEventListener('backgroundVideoChange', handleVideoChange as EventListener);
    
    return () => {
      window.removeEventListener('backgroundVideoChange', handleVideoChange as EventListener);
    };
  }, [API_URL]);

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

          onError={(e) => console.error('[LOGIN_BG] Video load error:', e)}
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