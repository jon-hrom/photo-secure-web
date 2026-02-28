import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import func2url from '../../../backend/func2url.json';

interface VideoUrlUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  folderId?: number | null;
  onSuccess?: () => void;
}

interface VideoInfo {
  title: string;
  download_url: string;
  thumbnail: string;
  duration: number;
  filesize: number;
  ext: string;
}

export default function VideoUrlUploadDialog({
  open,
  onOpenChange,
  userId,
  folderId,
  onSuccess
}: VideoUrlUploadDialogProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const { toast } = useToast();

  const supportedSources = [
    'YouTube', 'VK Видео', 'RuTube', 'Одноклассники',
    'Дзен', 'Telegram', 'Instagram', 'TikTok',
    'Прямые ссылки (.mp4, .mov)',
    'Файлообменники', 'M3U8'
  ];

  const handleExtract = async () => {
    if (!url.trim()) {
      setError('Вставьте ссылку на видео');
      return;
    }

    setExtracting(true);
    setError('');
    setVideoInfo(null);

    try {
      const response = await fetch(func2url['video-url-upload'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ url: url.trim(), mode: 'extract' })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Не удалось получить информацию о видео');
      }

      setVideoInfo(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка';
      setError(msg);
    } finally {
      setExtracting(false);
    }
  };

  const handleDownloadToDevice = () => {
    if (!videoInfo?.download_url) return;

    const a = document.createElement('a');
    a.href = videoInfo.download_url;
    a.download = `${videoInfo.title || 'video'}.${videoInfo.ext || 'mp4'}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast({
      title: 'Скачивание начато',
      description: 'Видео загружается на ваше устройство'
    });
  };

  const handleUploadToS3 = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(func2url['video-url-upload'], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          url: url.trim(),
          folder_id: folderId,
          mode: 'upload'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки видео');
      }

      toast({
        title: 'Видео загружено в фотобанк!',
        description: `Файл: ${data.filename}`,
        duration: 4000
      });

      resetState();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось загрузить видео';
      setError(msg);
      toast({ variant: 'destructive', title: 'Ошибка', description: msg });
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setUrl('');
    setError('');
    setVideoInfo(null);
  };

  const handleClose = () => {
    if (!loading && !extracting) {
      resetState();
      onOpenChange(false);
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec) return '';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} ГБ`;
    return `${(bytes / 1048576).toFixed(1)} МБ`;
  };

  const isProcessing = loading || extracting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-[560px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="Video" size={20} className="text-blue-600" />
            Скачать видео по ссылке
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Вставьте ссылку — видео скачается автоматически без установки программ
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex gap-2">
            <Input
              placeholder="https://youtube.com/watch?v=... или любая другая ссылка"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (videoInfo) setVideoInfo(null);
                if (error) setError('');
              }}
              disabled={isProcessing}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isProcessing) handleExtract();
              }}
            />
            <Button
              onClick={handleExtract}
              disabled={isProcessing || !url.trim()}
              size="default"
              variant="outline"
              className="shrink-0"
            >
              {extracting ? (
                <Icon name="Loader2" size={16} className="animate-spin" />
              ) : (
                <Icon name="Search" size={16} />
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <Icon name="AlertCircle" size={14} />
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </Alert>
          )}

          {videoInfo && (
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex gap-3">
                {videoInfo.thumbnail && (
                  <img
                    src={videoInfo.thumbnail}
                    alt=""
                    className="w-24 h-16 sm:w-32 sm:h-20 object-cover rounded flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{videoInfo.title || 'Видео'}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                    {videoInfo.duration > 0 && (
                      <span className="flex items-center gap-1">
                        <Icon name="Clock" size={12} />
                        {formatDuration(videoInfo.duration)}
                      </span>
                    )}
                    {videoInfo.filesize > 0 && (
                      <span className="flex items-center gap-1">
                        <Icon name="HardDrive" size={12} />
                        {formatSize(videoInfo.filesize)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  onClick={handleDownloadToDevice}
                  variant="outline"
                  className="w-full"
                  disabled={isProcessing}
                >
                  <Icon name="Download" size={16} className="mr-2" />
                  Скачать на устройство
                </Button>
                <Button
                  onClick={handleUploadToS3}
                  className="w-full"
                  disabled={isProcessing}
                >
                  {loading ? (
                    <>
                      <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Icon name="CloudUpload" size={16} className="mr-2" />
                      В фотобанк
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {!videoInfo && !error && (
            <div className="border rounded-lg p-3 bg-muted/20">
              <p className="text-xs font-medium mb-2 text-muted-foreground">Поддерживаемые источники:</p>
              <div className="flex flex-wrap gap-1.5">
                {supportedSources.map((source) => (
                  <span
                    key={source}
                    className="px-2 py-0.5 bg-background border rounded text-[10px] sm:text-xs text-muted-foreground"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <Icon name="Loader2" size={20} className="animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-medium">Скачиваю и загружаю в фотобанк...</p>
                <p className="text-xs text-muted-foreground">
                  Это может занять 1-3 минуты в зависимости от размера видео
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
