import { useRef, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';

interface ProfessionalVideoPlayerProps {
  src: string;
  onClose?: () => void;
  autoPlay?: boolean;
}

const ProfessionalVideoPlayer = ({ src, onClose, autoPlay = false }: ProfessionalVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();
  const { toast } = useToast();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => setPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playing) {
      video.play().catch(() => {
        setPlaying(false);
        toast({
          title: 'Ошибка воспроизведения',
          description: 'Не удалось запустить видео',
          variant: 'destructive'
        });
      });
    } else {
      video.pause();
    }
  }, [playing]);

  const togglePlay = () => setPlaying(!playing);

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (video) {
      video.volume = value[0] / 100;
      setVolume(value[0]);
      setMuted(value[0] === 0);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !muted;
      setMuted(!muted);
    }
  };

  const changePlaybackRate = (rate: number) => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = rate;
      setPlaybackRate(rate);
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(0, Math.min(video.currentTime + seconds, duration));
    }
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!fullscreen) {
      if (video.requestFullscreen) {
        video.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setFullscreen(!fullscreen);
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const downloadVideo = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video_${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Загрузка началась',
        description: 'Видео сохраняется на устройство'
      });
    } catch (error) {
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось скачать видео',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="relative overflow-hidden bg-black" onMouseMove={handleMouseMove}>
      <div className="relative">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-auto max-h-[70vh] object-contain"
          playsInline
          onClick={togglePlay}
        />

        {/* Controls Overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* Top Controls */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center">
            <div className="text-white font-semibold">Видео</div>
            {onClose && (
              <Button size="icon" variant="ghost" onClick={onClose} className="text-white hover:bg-white/20">
                <Icon name="X" size={24} />
              </Button>
            )}
          </div>

          {/* Center Play Button */}
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                size="icon"
                onClick={togglePlay}
                className="h-20 w-20 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm"
              >
                <Icon name="Play" size={40} className="text-white" />
              </Button>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <span className="text-white text-sm font-mono min-w-[45px]">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                onValueChange={handleSeek}
                max={duration || 100}
                step={0.1}
                className="flex-1"
              />
              <span className="text-white text-sm font-mono min-w-[45px]">
                {formatTime(duration)}
              </span>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" onClick={togglePlay} className="text-white hover:bg-white/20">
                  <Icon name={playing ? 'Pause' : 'Play'} size={24} />
                </Button>

                <Button size="icon" variant="ghost" onClick={() => skip(-10)} className="text-white hover:bg-white/20">
                  <Icon name="Rewind" size={20} />
                </Button>

                <Button size="icon" variant="ghost" onClick={() => skip(10)} className="text-white hover:bg-white/20">
                  <Icon name="FastForward" size={20} />
                </Button>

                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="ghost" onClick={toggleMute} className="text-white hover:bg-white/20">
                    <Icon name={muted ? 'VolumeX' : volume > 50 ? 'Volume2' : 'Volume1'} size={20} />
                  </Button>
                  <Slider
                    value={[muted ? 0 : volume]}
                    onValueChange={handleVolumeChange}
                    max={100}
                    className="w-24 hidden md:block"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Playback Speed */}
                <div className="flex gap-1">
                  {[0.5, 1, 1.5, 2].map((rate) => (
                    <Button
                      key={rate}
                      size="sm"
                      variant={playbackRate === rate ? 'default' : 'ghost'}
                      onClick={() => changePlaybackRate(rate)}
                      className={playbackRate === rate ? '' : 'text-white hover:bg-white/20'}
                    >
                      {rate}x
                    </Button>
                  ))}
                </div>

                <Button size="icon" variant="ghost" onClick={downloadVideo} className="text-white hover:bg-white/20">
                  <Icon name="Download" size={20} />
                </Button>

                <Button size="icon" variant="ghost" onClick={toggleFullscreen} className="text-white hover:bg-white/20">
                  <Icon name={fullscreen ? 'Minimize' : 'Maximize'} size={20} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProfessionalVideoPlayer;
