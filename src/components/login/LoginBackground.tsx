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
  const animationFrameRef = useRef<number | null>(null);
  const API_URL = funcUrls['background-media'];
  const SETTINGS_API = funcUrls['background-settings'];

  // Определяем мобильное устройство
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Загружаем мобильный фон (картинка/GIF)
  useEffect(() => {
    const loadMobileBackground = async () => {
      try {
        if (!SETTINGS_API) throw new Error('SETTINGS_API URL not configured');
        const response = await fetch(SETTINGS_API);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (data.success && data.settings?.login_mobile_background_url) {
          const mobileUrl = data.settings.login_mobile_background_url;
          setMobileBackgroundImage(mobileUrl);
          localStorage.setItem('loginPageMobileBackgroundUrl', mobileUrl);
          return;
        }
      } catch (error) {
        console.error('[LOGIN_BG] Failed to load mobile background from DB:', error);
      }
      
      // Fallback на localStorage
      const mobileBackgroundUrl = localStorage.getItem('loginPageMobileBackgroundUrl');
      if (mobileBackgroundUrl) {
        setMobileBackgroundImage(mobileBackgroundUrl);
      }
    };
    
    loadMobileBackground();

    const handleMobileBackgroundChange = (e: CustomEvent) => {
      setMobileBackgroundImage(e.detail);
    };

    window.addEventListener('mobileBackgroundChange', handleMobileBackgroundChange as EventListener);
    return () => window.removeEventListener('mobileBackgroundChange', handleMobileBackgroundChange as EventListener);
  }, [SETTINGS_API]);

  // Загружаем видео с сервера
  useEffect(() => {
    const loadVideo = async () => {
      // Получаем videoId из БД
      let videoId: string | null = localStorage.getItem('loginPageVideo');
      let mobileUrl: string | null = null;

      try {
        if (!SETTINGS_API) throw new Error('SETTINGS_API URL not configured');
        const response = await fetch(SETTINGS_API);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.success && data.settings) {
          const dbVideoId = data.settings.login_background_video_id;
          if (dbVideoId) videoId = dbVideoId;
          mobileUrl = data.settings.login_mobile_background_url || null;
        }
      } catch (error) {
        console.error('[LOGIN_BG] Failed to load settings from DB:', error);
      }

      if (!videoId) return;

      // Всегда получаем свежий presigned URL из S3
      try {
        if (!API_URL) throw new Error('API_URL not configured');
        const res = await fetch(`${API_URL}?type=video`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        if (d.success && d.files) {
          const found = d.files.find((v: { id: string; url: string }) => v.id === videoId);
          if (found) {
            setBackgroundVideo(found.url);
            setMobileVideo(mobileUrl || found.url);
            localStorage.setItem('loginPageVideoUrl', found.url);
            localStorage.setItem('loginPageVideo', videoId);
            if (mobileUrl) localStorage.setItem('loginPageMobileBackgroundUrl', mobileUrl);
            return;
          }
        }
      } catch (error) {
        console.error('[LOGIN_BG] Failed to get fresh video URL from S3:', error);
      }

      // Fallback — закешированный URL из localStorage
      const cachedUrl = localStorage.getItem('loginPageVideoUrl');
      if (cachedUrl) {
        setBackgroundVideo(cachedUrl);
        setMobileVideo(mobileUrl || cachedUrl);
      }
    };

    loadVideo();

    // Слушаем изменения видео
    const handleVideoChange = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail;

      
      // detail может быть объектом {id, url} или просто null
      if (detail && typeof detail === 'object') {
        const { id, url } = detail;

        
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

        } else {
          // Загружаем с сервера (fallback)
          try {
            if (!API_URL) throw new Error('API_URL not configured');
            const response = await fetch(`${API_URL}?type=video`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            
            if (data.success && data.files) {
              const video = data.files.find((v: { id: string; url: string }) => v.id === id);

              if (video) {
                setBackgroundVideo(video.url);
                setCurrentImage(null);
                localStorage.setItem('loginPageVideoUrl', video.url);

              }
            }
          } catch (error) {
            console.error('[LOGIN_BG] Video change - failed:', error);
          }
        }
      } else {

        setBackgroundVideo(null);
        setMobileVideo(null);
        localStorage.removeItem('loginPageVideoUrl');
        localStorage.removeItem('loginPageMobileVideoUrl');
      }
    };

    window.addEventListener('backgroundVideoChange', handleVideoChange);
    return () => window.removeEventListener('backgroundVideoChange', handleVideoChange);
  }, [API_URL]);

  // Плавная анимация fade через requestAnimationFrame
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !backgroundVideo) return;

    const fadeDuration = 1.5;
    const easeInOutQuad = (t: number) => {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    };

    const updateFade = () => {
      if (!video) return;
      
      const timeLeft = video.duration - video.currentTime;
      
      if (timeLeft <= fadeDuration) {
        const progress = 1 - (timeLeft / fadeDuration);
        const opacity = easeInOutQuad(progress);
        setFadeOpacity(opacity);
      } else if (video.currentTime <= fadeDuration) {
        const progress = video.currentTime / fadeDuration;
        const opacity = 1 - easeInOutQuad(progress);
        setFadeOpacity(opacity);
      } else {
        setFadeOpacity(0);
      }

      animationFrameRef.current = requestAnimationFrame(updateFade);
    };

    animationFrameRef.current = requestAnimationFrame(updateFade);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [backgroundVideo]);

  // Загружаем изображение (всегда, даже если есть видео — как fallback)
  useEffect(() => {
    if (!backgroundImage) {
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
            preload="metadata"
            className="fixed inset-0 w-full h-full object-cover"
            style={{ 
              zIndex: 0,
              filter: 'saturate(1.3) contrast(1.1)'
            }}
            onLoadedData={() => {
              console.log('[LOGIN_BG] Video loaded');
              const video = videoRef.current;
              if (video) {
                video.play().catch(() => {});
              }
            }}
            onError={async () => {
              console.error('[LOGIN_BG] Video URL expired, refreshing from S3...');
              localStorage.removeItem('loginPageVideoUrl');
              const videoId = localStorage.getItem('loginPageVideo');
              if (videoId) {
                try {
                  const res = await fetch(`${API_URL}?type=video`);
                  const d = await res.json();
                  if (d.success && d.files) {
                    const found = d.files.find((v: { id: string; url: string }) => v.id === videoId);
                    if (found) {
                      localStorage.setItem('loginPageVideoUrl', found.url);
                      setBackgroundVideo(found.url);
                      return;
                    }
                  }
                } catch (e) {
                  console.error('[LOGIN_BG] Failed to refresh video URL:', e);
                }
              }
              setBackgroundVideo(null);
              setMobileVideo(null);
            }}
          >
            {effectiveBackgroundVideo?.includes('.webm') ? (
              <source src={effectiveBackgroundVideo} type="video/webm" />
            ) : (
              <source src={effectiveBackgroundVideo} type="video/mp4" />
            )}
          </video>
          
          {/* Fade-слой для плавного перехода */}
          <div 
            className="fixed inset-0"
            style={{
              backgroundColor: 'black',
              opacity: fadeOpacity,
              zIndex: 0.5,
              pointerEvents: 'none'
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