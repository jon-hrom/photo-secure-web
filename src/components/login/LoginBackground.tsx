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
  const [mobileVideo, setMobileVideo] = useState<string | null>(null);
  const [mobileBackgroundImage, setMobileBackgroundImage] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const API_URL = funcUrls['background-media'];
  const SETTINGS_API = funcUrls['background-settings'];

  // Определяем мобильное устройство
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
      console.log('[LOGIN_BG] Device is mobile:', mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Загружаем мобильный фон (картинка/GIF)
  useEffect(() => {
    const loadMobileBackground = async () => {
      try {
        // Пробуем загрузить из БД
        const response = await fetch(SETTINGS_API);
        const data = await response.json();
        
        if (data.success && data.settings?.login_mobile_background_url) {
          const mobileUrl = data.settings.login_mobile_background_url;
          setMobileBackgroundImage(mobileUrl);
          localStorage.setItem('loginPageMobileBackgroundUrl', mobileUrl);
          console.log('[LOGIN_BG] Mobile background from DB:', mobileUrl);
          return;
        }
      } catch (error) {
        console.error('[LOGIN_BG] Failed to load mobile background from DB:', error);
      }
      
      // Fallback на localStorage
      const mobileBackgroundUrl = localStorage.getItem('loginPageMobileBackgroundUrl');
      if (mobileBackgroundUrl) {
        setMobileBackgroundImage(mobileBackgroundUrl);
        console.log('[LOGIN_BG] Mobile background from localStorage:', mobileBackgroundUrl);
      }
    };
    
    loadMobileBackground();

    const handleMobileBackgroundChange = (e: CustomEvent) => {
      setMobileBackgroundImage(e.detail);
      console.log('[LOGIN_BG] Mobile background changed:', e.detail);
    };

    window.addEventListener('mobileBackgroundChange', handleMobileBackgroundChange as EventListener);
    return () => window.removeEventListener('mobileBackgroundChange', handleMobileBackgroundChange as EventListener);
  }, [SETTINGS_API]);

  // Загружаем видео с сервера
  useEffect(() => {
    const loadVideo = async () => {
      console.log('[LOGIN_BG] ===== VIDEO LOAD START =====');
      
      // СНАЧАЛА пробуем загрузить из БД
      try {
        console.log('[LOGIN_BG] Fetching settings from database...');
        const response = await fetch(SETTINGS_API);
        const data = await response.json();
        console.log('[LOGIN_BG] Database settings:', data);
        
        if (data.success && data.settings) {
          const videoUrl = data.settings.login_background_video_url;
          const mobileUrl = data.settings.login_mobile_background_url;
          
          if (videoUrl) {
            console.log('[LOGIN_BG] Video URL from DB:', videoUrl);
            setBackgroundVideo(videoUrl);
            setMobileVideo(mobileUrl || videoUrl);
            
            // Синхронизируем localStorage
            localStorage.setItem('loginPageVideoUrl', videoUrl);
            if (mobileUrl) {
              localStorage.setItem('loginPageMobileVideoUrl', mobileUrl);
            }
            
            console.log('[LOGIN_BG] ===== VIDEO LOAD SUCCESS (from DB) =====');
            return;
          }
        }
      } catch (error) {
        console.error('[LOGIN_BG] Failed to load from DB, falling back to localStorage:', error);
      }
      
      // Fallback на localStorage (для обратной совместимости)
      const selectedVideoId = localStorage.getItem('loginPageVideo');
      const selectedVideoUrl = localStorage.getItem('loginPageVideoUrl');
      const selectedMobileVideoUrl = localStorage.getItem('loginPageMobileVideoUrl');
      console.log('[LOGIN_BG] Fallback - Selected video ID:', selectedVideoId);
      console.log('[LOGIN_BG] Fallback - Selected video URL:', selectedVideoUrl);
      
      if (selectedVideoUrl) {
        console.log('[LOGIN_BG] Using cached video URL:', selectedVideoUrl);
        setBackgroundVideo(selectedVideoUrl);
        setMobileVideo(selectedMobileVideoUrl || selectedVideoUrl);
        console.log('[LOGIN_BG] ===== VIDEO LOAD SUCCESS (cached) =====');
        return;
      }
      
      // Последний fallback - загружаем с файлового сервера
      if (selectedVideoId) {
        try {
          console.log('[LOGIN_BG] Fetching videos from:', API_URL);
          const response = await fetch(`${API_URL}?type=video`);
          const data = await response.json();
          
          if (data.success && data.files) {
            const selectedVideo = data.files.find((v: any) => v.id === selectedVideoId);
            if (selectedVideo) {
              setBackgroundVideo(selectedVideo.url);
              localStorage.setItem('loginPageVideoUrl', selectedVideo.url);
              console.log('[LOGIN_BG] ===== VIDEO LOAD SUCCESS (from media server) =====');
            }
          }
        } catch (error) {
          console.error('[LOGIN_BG] ===== FAILED TO LOAD VIDEO =====', error);
        }
      } else {
        console.log('[LOGIN_BG] ===== NO VIDEO CONFIGURED =====');
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
          const { mobileUrl } = detail;
          setBackgroundVideo(url);
          setMobileVideo(mobileUrl || url);
          setCurrentImage(null);
          localStorage.setItem('loginPageVideoUrl', url);
          if (mobileUrl) {
            localStorage.setItem('loginPageMobileVideoUrl', mobileUrl);
          }
          console.log('[LOGIN_BG] Video change - URL set from event:', url, 'mobile:', mobileUrl);
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
        setMobileVideo(null);
        localStorage.removeItem('loginPageVideoUrl');
        localStorage.removeItem('loginPageMobileVideoUrl');
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

  // На мобильных устройствах: если есть мобильная картинка, показываем её вместо видео
  const shouldShowMobileImage = isMobile && mobileBackgroundImage;
  const effectiveBackgroundVideo = shouldShowMobileImage ? null : backgroundVideo;

  return (
    <>
      {!isLoaded && !effectiveBackgroundVideo && backgroundImage && !shouldShowMobileImage && (
        <div className="fixed inset-0 bg-black" style={{ zIndex: 0 }} />
      )}
      
      {/* Мобильная картинка/GIF (приоритет на мобильных) */}
      {shouldShowMobileImage && (
        <>
          <img
            src={mobileBackgroundImage}
            alt="Mobile background"
            className="fixed inset-0 w-full h-full object-cover"
            style={{ zIndex: 0 }}
            loading="eager"
          />
          <div 
            className="fixed inset-0"
            style={{
              backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity / 100})`,
              zIndex: 1
            }}
          />
        </>
      )}
      
      {/* Видео (только на десктопе или если нет мобильной картинки) */}
      {effectiveBackgroundVideo && !shouldShowMobileImage && (
        <>
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="fixed inset-0 w-full h-full object-cover"
            style={{ 
              zIndex: 0,
              filter: 'saturate(1.3) contrast(1.1)'
            }}
            onLoadedData={(e) => {
              console.log('[LOGIN_BG] Video loaded');
              e.currentTarget.playbackRate = 0.85; // 85% скорости
            }}
            onError={(e) => console.error('[LOGIN_BG] Video error:', e)}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              const timeLeft = video.duration - video.currentTime;
              const fadeDuration = 1.5; // Длительность fade в секундах
              
              // Easing функция для плавного перехода (ease-in-out)
              const easeInOutQuad = (t: number) => {
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
              };
              
              // За 1.5 сек до конца - начинаем затемнение
              if (timeLeft <= fadeDuration) {
                const progress = 1 - (timeLeft / fadeDuration);
                const opacity = easeInOutQuad(progress);
                setFadeOpacity(opacity);
              }
              // Первые 1.5 сек - осветление
              else if (video.currentTime <= fadeDuration) {
                const progress = video.currentTime / fadeDuration;
                const opacity = 1 - easeInOutQuad(progress);
                setFadeOpacity(opacity);
              }
              // Остальное время - прозрачно
              else {
                setFadeOpacity(0);
              }
            }}
          >
            <source src={effectiveBackgroundVideo} type="video/mp4" />
            <source src={effectiveBackgroundVideo} type="video/webm" />
          </video>
          
          {/* Fade-слой для плавного перехода */}
          <div 
            className="fixed inset-0"
            style={{
              backgroundColor: 'black',
              opacity: fadeOpacity,
              zIndex: 0.5,
              pointerEvents: 'none',
              transition: 'opacity 0.1s linear'
            }}
          />
          
          {/* Overlay с настраиваемой прозрачностью */}
          <div 
            className="fixed inset-0"
            style={{
              backgroundColor: `rgba(0, 0, 0, ${backgroundOpacity / 100})`,
              zIndex: 1
            }}
          />
        </>
      )}
      
      {/* Обычное фоновое изображение (когда нет видео и мобильной картинки) */}
      {!effectiveBackgroundVideo && currentImage && !shouldShowMobileImage && (
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