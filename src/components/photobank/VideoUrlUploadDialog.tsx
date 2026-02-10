import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function VideoUrlUploadDialog({
  open,
  onOpenChange,
  userId,
  folderId,
  onSuccess
}: VideoUrlUploadDialogProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const handleDirectDownload = () => {
    if (!url.trim()) {
      setError('Введите ссылку на видео');
      return;
    }

    const trimmedUrl = url.trim();
    
    if (trimmedUrl.includes('.m3u8')) {
      setError('M3U8 плейлисты нельзя скачать напрямую. Используйте yt-dlp или ffmpeg на компьютере, либо загрузите в фотобанк (будет скачано первые 8 минут)');
      return;
    }

    window.open(trimmedUrl, '_blank');
    
    toast({
      title: 'Скачивание начато',
      description: 'Видео откроется в новой вкладке для скачивания',
      duration: 3000
    });
  };

  const handleUploadToPhotobank = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Введите ссылку на видео');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(func2url['video-url-upload'], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          url: url.trim(),
          folder_id: folderId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Ошибка загрузки видео');
      }

      toast({
        title: 'Видео загружено!',
        description: `Файл: ${data.filename}`,
        duration: 3000
      });

      setUrl('');
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }

    } catch (err) {
      console.error('[VIDEO_UPLOAD_DIALOG] Error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Не удалось загрузить видео';
      setError(errorMessage);
      
      toast({
        variant: 'destructive',
        title: 'Ошибка',
        description: errorMessage
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUrl('');
      setError('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Video" size={24} className="text-purple-600" />
            Загрузить видео по ссылке
          </DialogTitle>
          <DialogDescription>
            Поддерживаются: прямые ссылки (.mp4, .mov), HLS потоки (.m3u8), Kinescope
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-url">Ссылка на видео</Label>
            <Input
              id="video-url"
              type="url"
              placeholder="https://example.com/video.mp4 или https://kinescope.io/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="font-mono text-sm"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <Icon name="AlertCircle" size={16} />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Alert>
            <Icon name="Info" size={16} />
            <AlertDescription className="text-sm space-y-2">
              <p><strong>Два способа работы с видео:</strong></p>
              <div className="space-y-2 text-xs">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <p className="font-medium text-blue-900 dark:text-blue-100">📥 Скачать на компьютер (рекомендуется для длинных видео)</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">Вставьте прямую ссылку на .mp4 или .mov файл — откроется в браузере для скачивания</p>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded">
                  <p className="font-medium text-purple-900 dark:text-purple-100">☁️ Загрузить в фотобанк (до 8 минут)</p>
                  <p className="text-purple-700 dark:text-purple-300 mt-1">Вставьте ссылку на .m3u8 плейлист — будет скачано первые 50 сегментов (~8 минут видео)</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Для Kinescope: F12 → Network → фильтр "m3u8" → Play видео → скопируйте ссылку на master.m3u8
              </p>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDirectDownload}
              disabled={loading || !url.trim()}
            >
              <Icon name="ExternalLink" size={16} className="mr-2" />
              Скачать на ПК
            </Button>
            <Button
              type="submit"
              disabled={loading || !url.trim()}
              className="bg-purple-600 hover:bg-purple-700"
              onClick={handleUploadToPhotobank}
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={16} className="animate-spin mr-2" />
                  Загружаем...
                </>
              ) : (
                <>
                  <Icon name="CloudUpload" size={16} className="mr-2" />
                  В фотобанк
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}