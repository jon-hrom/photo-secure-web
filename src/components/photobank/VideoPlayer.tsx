import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import '@videojs/themes/dist/fantasy/index.css';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  onClose?: () => void;
  fileName?: string;
}

export default function VideoPlayer({ src, poster, onClose, fileName }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  console.log('[VIDEO_PLAYER] Component mounted with:', { src, poster, fileName });

  useEffect(() => {
    if (!videoRef.current) {
      console.log('[VIDEO_PLAYER] videoRef is null');
      return;
    }

    console.log('[VIDEO_PLAYER] Initializing Video.js');

    const player = videojs(videoRef.current, {
      controls: true,
      autoplay: false,
      preload: 'metadata',
      fluid: true,
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
      switch (ext) {
        case 'mp4': return 'video/mp4';
        case 'webm': return 'video/webm';
        case 'mov': return 'video/quicktime';
        case 'avi': return 'video/x-msvideo';
        case 'mkv': return 'video/x-matroska';
        default: return 'video/mp4';
      }
    };

    player.src({
      src: src,
      type: getVideoType(src)
    });

    player.on('fullscreenchange', () => {
      setIsFullscreen(player.isFullscreen());
    });

    player.on('error', (error: any) => {
      console.error('Video.js error:', error);
    });

    playerRef.current = player;

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, poster]);

  const handleDownload = async () => {
    try {
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
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <Icon name="Video" className="text-white" size={24} />
          <h3 className="text-white font-medium truncate max-w-md">
            {fileName || 'Видео'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/10"
            title="Скачать"
          >
            <Icon name="Download" size={20} />
          </Button>
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

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl">
          <div data-vjs-player>
            <video
              ref={videoRef}
              className="video-js vjs-theme-fantasy vjs-big-play-centered"
              playsInline
            />
          </div>
        </div>
      </div>

      {!isFullscreen && (
        <div className="p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-white/70">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white/10 rounded">Пробел</kbd>
                <span>Пауза/Воспр.</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white/10 rounded">← →</kbd>
                <span>±5 сек</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white/10 rounded">↑ ↓</kbd>
                <span>Громкость</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-white/10 rounded">F</kbd>
                <span>Полный экран</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}