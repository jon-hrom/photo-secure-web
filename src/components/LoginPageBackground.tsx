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
      console.log('[LOGIN_BG] Selected video ID:', selectedVideoId);
      
      if (selectedVideoId) {
        try {
          // Загружаем список видео с сервера
          console.log('[LOGIN_BG] Fetching videos from:', API_URL);
          const response = await fetch(`${API_URL}?type=video`);
          const data = await response.json();
          console.log('[LOGIN_BG] Videos response:', data);
          
          if (data.success && data.files) {
            const selectedVideo = data.files.find((v: any) => v.id === selectedVideoId);
            console.log('[LOGIN_BG] Found video:', selectedVideo);
            if (selectedVideo) {
              setBackgroundVideo(selectedVideo.url);
              console.log('[LOGIN_BG] Video URL set:', selectedVideo.url);
            }
          }
        } catch (error) {
          console.error('[LOGIN_BG] Failed to load video:', error);
        }
      } else {
        // Если видео нет, проверяем изображение
        const selectedBgId = localStorage.getItem('loginPageBackground');
        console.log('[LOGIN_BG] Selected image ID:', selectedBgId);
        if (selectedBgId) {
          const savedImages = localStorage.getItem('backgroundImages');
          if (savedImages) {
            const images = JSON.parse(savedImages);
            const selectedImage = images.find((img: any) => img.id === selectedBgId);
            if (selectedImage) {
              setBackgroundImage(selectedImage.url);
              console.log('[LOGIN_BG] Image URL set:', selectedImage.url);
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
      console.log('[LOGIN_BG] Video change event:', videoId);
      if (videoId) {
        try {
          const response = await fetch(`${API_URL}?type=video`);
          const data = await response.json();
          console.log('[LOGIN_BG] Video change - fetched videos:', data);
          
          if (data.success && data.files) {
            const video = data.files.find((v: any) => v.id === videoId);
            console.log('[LOGIN_BG] Video change - found video:', video);
            if (video) {
              setBackgroundVideo(video.url);
              setBackgroundImage(null);
              console.log('[LOGIN_BG] Video change - URL set:', video.url);
            }
          }
        } catch (error) {
          console.error('[LOGIN_BG] Video change - failed:', error);
        }
      } else {
        console.log('[LOGIN_BG] Video change - clearing video');
        setBackgroundVideo(null);
      }
    };

    window.addEventListener('backgroundVideoChange', handleVideoChange as EventListener);
    
    return () => {
      window.removeEventListener('backgroundVideoChange', handleVideoChange as EventListener);
    };
  }, [API_URL]);

  console.log('[LOGIN_BG] Render - backgroundVideo:', backgroundVideo);
  console.log('[LOGIN_BG] Render - backgroundImage:', backgroundImage);

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
          onLoadedData={() => console.log('[LOGIN_BG] Video loaded successfully')}
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