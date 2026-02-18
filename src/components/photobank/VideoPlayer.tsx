import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/themes/dist/fantasy/index.css';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onClose?: () => void;
  fileName?: string;
  downloadDisabled?: boolean;
}

const getVideoMimeType = (url: string): string => {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || '';
  const mimeMap: Record<string, string> = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'm4v': 'video/mp4',
  };
  return mimeMap[ext] || 'video/mp4';
};

export default function VideoPlayer({ src, poster, onClose, fileName, downloadDisabled = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeVideoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastTap, setLastTap] = useState<{ time: number; x: number } | null>(null);
  const [useNativePlayer, setUseNativePlayer] = useState(false);
  const [hasDecodeError, setHasDecodeError] = useState(false);
  const [corruptedSegments, setCorruptedSegments] = useState<Array<{start: number, end: number}>>([]);
  const { toast } = useToast();

  // Определяем мобильное устройство
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isAndroid = /Android/i.test(navigator.userAgent);

  useEffect(() => {
    // Всегда используем нативный плеер (и на мобильных, и на десктопе)
    console.log('[VIDEO_PLAYER] Using native HTML5 player');
    setUseNativePlayer(true);
    return;

    // Код ниже больше не используется
    if (!videoRef.current || useNativePlayer) return;

    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: false,
      preload: 'metadata',
      fluid: false,
      responsive: true,
      aspectRatio: '16:9',
      poster: poster,
      playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'playbackRateMenuButton',
          'qualitySelector',
          'fullscreenToggle'
        ],
        volumePanel: {
          inline: false
        }
      },
      userActions: {
        hotkeys: true
      }
    });

    const getVideoType = (url: string): string => {
      const ext = url.split('.').pop()?.toLowerCase().split('?')[0];
      console.log('[VIDEO_PLAYER] Video extension:', ext, 'URL:', url);
      switch (ext) {
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'mov': return 'video/mp4'; // MOV часто содержит H.264, пробуем как MP4
        case 'avi': return 'video/mp4';
        case 'mkv': return 'video/mp4';
        default: return 'video/mp4';
      }
    };

    const videoType = getVideoType(src);
    console.log('[VIDEO_PLAYER] Setting video source:', { src, type: videoType });

    player.src({
      src: src,
      type: videoType
    });

    player.on('fullscreenchange', () => {
      setIsFullscreen(player.isFullscreen());
    });

    player.on('error', (error: any) => {
      console.error('[VIDEO_PLAYER] Video.js error:', error);
      const mediaError = player.error();
      if (mediaError) {
        console.error('[VIDEO_PLAYER] Media error details:', {
          code: mediaError.code,
          message: mediaError.message,
          MEDIA_ERR_ABORTED: mediaError.MEDIA_ERR_ABORTED,
          MEDIA_ERR_NETWORK: mediaError.MEDIA_ERR_NETWORK,
          MEDIA_ERR_DECODE: mediaError.MEDIA_ERR_DECODE,
          MEDIA_ERR_SRC_NOT_SUPPORTED: mediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
        });
        
        // Если Video.js не может воспроизвести, переключаемся на нативный плеер
        if (mediaError.code === 3 || mediaError.code === 4) {
          console.log('[VIDEO_PLAYER] Switching to native HTML5 player');
          setUseNativePlayer(true);
        }
      }
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster]);

  // useEffect для нативного HTML5 плеера
  useEffect(() => {
    if (!useNativePlayer || !nativeVideoRef.current) return;
    
    const video = nativeVideoRef.current;
    
    const handleError = (e: Event) => {
      console.error('[NATIVE_VIDEO] Error:', e);
      const videoElement = e.target as HTMLVideoElement;
      if (videoElement.error) {
        console.error('[NATIVE_VIDEO] Error details:', {
          code: videoElement.error.code,
          message: videoElement.error.message,
          currentTime: videoElement.currentTime
        });
        
        // На мобильных — сразу показываем ошибку, без попыток восстановления
        if (isMobile) {
          if (videoElement.error.code === 3 || videoElement.error.code === 4) {
            setHasDecodeError(true);
          }
          return;
        }
        
        // На десктопе — пытаемся восстановить только при ошибке декодирования
        if (videoElement.error.code === 3) {
          const errorTime = videoElement.currentTime;
          console.log(`[NATIVE_VIDEO] Decode error at ${errorTime}s - trying to skip corrupted segment`);
          
          const newSegment = { start: Math.floor(errorTime), end: Math.floor(errorTime) + 3 };
          setCorruptedSegments(prev => {
            const exists = prev.some(s => s.start === newSegment.start);
            if (exists) return prev;
            return [...prev, newSegment];
          });
          
          const nextTime = errorTime + 3;
          if (nextTime < videoElement.duration) {
            console.log(`[NATIVE_VIDEO] Skipping to ${nextTime}s and resuming playback`);
            videoElement.load();
            videoElement.currentTime = nextTime;
            setTimeout(() => {
              videoElement.play().catch(err => {
                console.error('[NATIVE_VIDEO] Failed to resume playback:', err);
                setHasDecodeError(true);
              });
            }, 200);
          } else {
            setHasDecodeError(true);
          }
        } else if (videoElement.error.code === 4) {
          setHasDecodeError(true);
        }
      }
    };
    
    const handleTimeUpdate = () => {
      // Пропускаем проблемные сегменты только на десктопе
      if (isMobile) return;
      
      for (const segment of corruptedSegments) {
        if (video.currentTime >= segment.start && video.currentTime < segment.end && !video.seeking) {
          console.log(`[NATIVE_VIDEO] In corrupted segment ${segment.start}-${segment.end}s, skipping to ${segment.end}s`);
          const wasPlaying = !video.paused;
          video.currentTime = segment.end;
          if (wasPlaying) {
            setTimeout(() => {
              video.play().catch(err => console.error('[NATIVE_VIDEO] Failed to resume after skip:', err));
            }, 100);
          }
          break;
        }
      }
    };
    
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [useNativePlayer, corruptedSegments, isMobile]);

  const handleDoubleTap = (e: React.TouchEvent | React.MouseEvent) => {
    const currentTime = Date.now();
    const clickX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const screenWidth = window.innerWidth;
    
    if (lastTap && currentTime - lastTap.time < 300 && Math.abs(clickX - lastTap.x) < 50) {
      if (playerRef.current) {
        const player = playerRef.current;
        const currentVideoTime = player.currentTime();
        
        if (clickX < screenWidth / 3) {
          player.currentTime(Math.max(0, currentVideoTime - 10));
        } else if (clickX > (screenWidth * 2) / 3) {
          player.currentTime(Math.min(player.duration(), currentVideoTime + 10));
        } else {
          if (player.isFullscreen()) {
            player.exitFullscreen();
          } else {
            player.requestFullscreen();
          }
        }
      }
      setLastTap(null);
    } else {
      setLastTap({ time: currentTime, x: clickX });
    }
  };

  const handleDownload = async () => {
    try {
      toast({
        title: 'Загрузка начата',
        description: 'Видео сохраняется на устройство'
      });
      
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || 'video.mp4';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: 'Готово!',
        description: 'Видео сохранено на устройство'
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось скачать видео',
        variant: 'destructive'
      });
    }
  };

  // Нативный HTML5 плеер для мобильных устройств и fallback
  if (useNativePlayer) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between p-3 md:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/80 to-transparent shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            <Icon name="Video" className="text-white shrink-0" size={isMobile ? 20 : 24} />
            <h3 className="text-white font-medium truncate text-sm md:text-base">
              {fileName || 'Видео'}
            </h3>
          </div>
          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {!downloadDisabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDownload}
                className="text-white hover:bg-white/10 h-8 w-8 md:h-10 md:w-10"
                title="Скачать"
              >
                <Icon name="Download" size={isMobile ? 18 : 20} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-white hover:bg-white/10 h-10 w-10 md:h-10 md:w-10 min-w-[44px] min-h-[44px] animate-pulse-once"
            >
              <Icon name="X" size={isMobile ? 22 : 24} />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-hidden">
          {hasDecodeError ? (
            <div className="text-center max-w-lg px-4">
              <Icon name="AlertCircle" size={isMobile ? 48 : 64} className="text-yellow-500 mx-auto mb-4" />
              <h3 className="text-white text-xl font-semibold mb-3">
                Видео не поддерживается браузером
              </h3>
              <p className="text-white/70 mb-4">
                Видео использует кодек, который не поддерживается вашим браузером.
                {!downloadDisabled && ' Скачайте файл и откройте его в видеоплеере на вашем устройстве.'}
              </p>
              <div className="bg-white/10 rounded-lg p-3 mb-6 text-sm text-white/60 text-left">
                <p className="font-medium text-white/80 mb-1">Техническая информация:</p>
                <p>• Рекомендуемый формат: MP4 (H.264 + AAC)</p>
                <p>• Текущее видео может использовать H.265 или другой неподдерживаемый кодек</p>
              </div>
              {!downloadDisabled && (
                <Button
                  onClick={handleDownload}
                  className="bg-white hover:bg-white/90 text-black"
                >
                  <Icon name="Download" size={20} className="mr-2" />
                  Скачать видео
                </Button>
              )}
            </div>
          ) : (
            <video
              ref={nativeVideoRef}
              poster={poster}
              controls
              controlsList="nodownload"
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              x5-video-player-type="h5"
              x5-video-player-fullscreen="true"
              x-webkit-airplay="allow"
              preload="metadata"
              autoPlay={false}
              className="w-full h-full object-contain max-w-full max-h-full"
              style={{ maxHeight: isMobile ? '100%' : 'calc(100vh - 180px)' }}
            >
              <source src={src} type={getVideoMimeType(src)} />
              Ваш браузер не поддерживает воспроизведение видео.
            </video>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))] bg-gradient-to-b from-black/80 to-transparent shrink-0">
        <div className="flex items-center gap-3">
          <Icon name="Video" className="text-white" size={24} />
          <h3 className="text-white font-medium truncate max-w-md">
            {fileName || 'Видео'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!downloadDisabled && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="text-white hover:bg-white/10"
              title="Скачать"
            >
              <Icon name="Download" size={20} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10 min-w-[44px] min-h-[44px] animate-pulse-once"
          >
            <Icon name="X" size={24} />
          </Button>
        </div>
      </div>

      <div 
        className="flex-1 flex items-center justify-center overflow-hidden p-4"
        onTouchStart={handleDoubleTap}
        onClick={handleDoubleTap}
      >
        <div className="w-full max-w-6xl" style={{ maxHeight: 'calc(100vh - 180px)' }}>
          <div data-vjs-player style={{ width: '100%', maxHeight: 'calc(100vh - 180px)' }}>
            <video
              ref={videoRef}
              className="video-js vjs-theme-fantasy vjs-big-play-centered"
              style={{ width: '100%', height: 'auto', maxHeight: 'calc(100vh - 180px)' }}
              playsInline
            />
          </div>
        </div>
      </div>

      {!isFullscreen && (
        <div className="p-3 bg-gradient-to-t from-black/80 to-transparent shrink-0">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 bg-white/10 rounded text-xs">2x тап слева</kbd>
                <span>-10 сек</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 bg-white/10 rounded text-xs">2x тап справа</kbd>
                <span>+10 сек</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 bg-white/10 rounded text-xs">2x тап центр</kbd>
                <span>Полный экран</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}