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

export default function VideoPlayer({ src, poster, onClose, fileName, downloadDisabled = false }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastTap, setLastTap] = useState<{ time: number; x: number } | null>(null);
  const [useNativePlayer, setUseNativePlayer] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
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

  // Нативный HTML5 плеер как fallback
  if (useNativePlayer) {
    return (
      <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent shrink-0">
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
              className="text-white hover:bg-white/10"
            >
              <Icon name="X" size={24} />
            </Button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
          <video
            src={src}
            poster={poster}
            controls
            playsInline
            className="w-full max-w-6xl"
            style={{ maxHeight: 'calc(100vh - 180px)' }}
          >
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent shrink-0">
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
            className="text-white hover:bg-white/10"
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