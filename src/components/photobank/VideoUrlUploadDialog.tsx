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

  const handleSubmit = async (e: React.FormEvent) => {
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
              <p><strong>Как скачать видео с Kinescope:</strong></p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Откройте страницу с видео в браузере</li>
                <li>Откройте инструменты разработчика (F12)</li>
                <li>Вкладка Network → поставьте фильтр "m3u8"</li>
                <li>Запустите видео (нажмите Play)</li>
                <li>Найдите запрос к файлу <code className="bg-muted px-1 py-0.5 rounded">master.m3u8</code></li>
                <li>ПКМ на запросе → Copy → Copy link address</li>
                <li>Вставьте URL сюда</li>
              </ol>
              <p className="mt-2 text-xs text-amber-600 font-medium">
                ⚠️ ВАЖНО: Вставляйте только .m3u8 ссылку, НЕ прямую ссылку на .mp4!
              </p>
              <p className="text-xs text-muted-foreground">
                Примечание: DRM-защищённые видео скачать невозможно
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
              type="submit"
              disabled={loading || !url.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={16} className="animate-spin mr-2" />
                  Загружаем...
                </>
              ) : (
                <>
                  <Icon name="Download" size={16} className="mr-2" />
                  Загрузить
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}