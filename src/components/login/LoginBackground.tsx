import { useState, useEffect, useRef } from 'react';
import funcUrls from '../../../backend/func2url.json';

interface LoginBackgroundProps {
  backgroundImage: string | null;
  backgroundOpacity: number;
}

const LoginBackground = ({ backgroundImage, backgroundOpacity }: LoginBackgroundProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [backgroundVideo, setBackgroundVideo] = useState<string | null>(null);
  const video1Ref = useRef<HTMLVideoElement>(null);
  const API_URL = funcUrls['background-media'];

  // Загружаем видео с сервера
  useEffect(() => {
    const loadVideo = async () => {
      const selectedVideoId = localStorage.getItem('loginPageVideo');
      const selectedVideoUrl = localStorage.getItem('loginPageVideoUrl');
      console.log('[LOGIN_BG] Selected video ID:', selectedVideoId);
      console.log('[LOGIN_BG] Selected video URL:', selectedVideoUrl);
      
      // Если есть URL в localStorage, используем его напрямую (быстрее)
      if (selectedVideoUrl) {
        console.log('[LOGIN_BG] Using cached video URL:', selectedVideoUrl);
        setBackgroundVideo(selectedVideoUrl);
        return;
      }
      
      // Иначе загружаем с сервера (для старых данных)
      if (selectedVideoId) {
        try {
          console.log('[LOGIN_BG] Fetching videos from:', API_URL);
          const response = await fetch(`${API_URL}?type=video`);
          const data = await response.json();
          console.log('[LOGIN_BG] Videos response:', data);
          
          if (data.success && data.files) {
            const selectedVideo = data.files.find((v: any) => v.id === selectedVideoId);
            console.log('[LOGIN_BG] Found video:', selectedVideo);
            if (selectedVideo) {
              setBackgroundVideo(selectedVideo.url);
              // Кешируем URL для следующего раза
              localStorage.setItem('loginPageVideoUrl', selectedVideo.url);
              console.log('[LOGIN_BG] Video URL set:', selectedVideo.url);
            }
          }
        } catch (error) {
          console.error('[LOGIN_BG] Failed to load video:', error);
        }
      }
    };

    loadVideo();

    // Слушаем изменения видео
    const handleVideoChange = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;
      console.log('[LOGIN_BG] Video change event:', detail);
      
      // detail может быть объектом {id, url} или просто null
      if (detail && typeof detail === 'object') {
        const { id, url } = detail;
        console.log('[LOGIN_BG] Video change - id:', id, 'url:', url);
        
        if (url) {
          // Используем URL напрямую из события
          setBackgroundVideo(url);
          setCurrentImage(null);
          localStorage.setItem('loginPageVideoUrl', url);
          console.log('[LOGIN_BG] Video change - URL set from event:', url);
        } else {
          // Загружаем с сервера (fallback)
          try {
            const response = await fetch(`${API_URL}?type=video`);
            const data = await response.json();
            console.log('[LOGIN_BG] Video change - fetched videos:', data);
            
            if (data.success && data.files) {
              const video = data.files.find((v: any) => v.id === id);
              console.log('[LOGIN_BG] Video change - found video:', video);
              if (video) {
                setBackgroundVideo(video.url);
                setCurrentImage(null);
                localStorage.setItem('loginPageVideoUrl', video.url);
                console.log('[LOGIN_BG] Video change - URL set:', video.url);
              }
            }
          } catch (error) {
            console.error('[LOGIN_BG] Video change - failed:', error);
          }
        }
      } else {
        console.log('[LOGIN_BG] Video change - clearing video');
        setBackgroundVideo(null);
        localStorage.removeItem('loginPageVideoUrl');
      }
    };

    window.addEventListener('backgroundVideoChange', handleVideoChange);
    return () => window.removeEventListener('backgroundVideoChange', handleVideoChange);
  }, [API_URL]);

  // Загружаем изображение
  useEffect(() => {
    if (!backgroundImage || backgroundVideo) {
      setIsLoaded(false);
      setCurrentImage(null);
      return;
    }

    setIsLoaded(false);
    const img = new Image();
    
    img.onload = () => {
      setCurrentImage(backgroundImage);
      setIsLoaded(true);
    };
    
    img.onerror = () => {
      setCurrentImage(backgroundImage);
      setIsLoaded(true);
    };
    
    img.src = backgroundImage;
  }, [backgroundImage, backgroundVideo]);



  console.log('[LOGIN_BG] Render - backgroundVideo:', backgroundVideo);
  console.log('[LOGIN_BG] Render - currentImage:', currentImage);

  return (
    <>
      {!isLoaded && !backgroundVideo && backgroundImage && (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" style={{ zIndex: 0 }} />
      )}
      
      {backgroundVideo && (
        <>
          <video
            ref={video1Ref}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="fixed inset-0 w-full h-full object-cover"
            style={{ zIndex: 0 }}
            onLoadedData={() => console.log('[LOGIN_BG] Video loaded')}
            onError={(e) => console.error('[LOGIN_BG] Video error:', e)}
          >
            <source src={backgroundVideo} type="video/mp4" />
            <source src={backgroundVideo} type="video/webm" />
          </video>
          
          <div 
            className="fixed inset-0"
            style={{
              backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity / 100})`,
              zIndex: 1
            }}
          />
        </>
      )}
      
      {!backgroundVideo && currentImage && (
        <>
          <div 
            className={`fixed inset-0 transition-opacity duration-700 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url(${currentImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              zIndex: 0
            }}
          />
          <div 
            className={`fixed inset-0 transition-opacity duration-700 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity / 100})`,
              zIndex: 1
            }}
          />
        </>
      )}
    </>
  );
};

export default LoginBackground;