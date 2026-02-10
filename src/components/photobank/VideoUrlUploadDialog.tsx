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
  const [showDownloadInstructions, setShowDownloadInstructions] = useState(false);
  const { toast } = useToast();

  const handleDirectDownload = () => {
    if (!url.trim()) {
      setError('Введите ссылку на видео');
      return;
    }

    const trimmedUrl = url.trim();
    
    if (trimmedUrl.includes('.m3u8') || trimmedUrl.includes('kinescope') || trimmedUrl.includes('youtube') || trimmedUrl.includes('vk.com')) {
      setShowDownloadInstructions(true);
      setError('');
      return;
    }

    window.open(trimmedUrl, '_blank');
    setError('');
    
    toast({
      title: 'Скачивание начато',
      description: 'Видео откроется в новой вкладке для скачивания',
      duration: 3000
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Скопировано!',
      description: 'Команда скопирована в буфер обмена',
      duration: 2000
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

  if (showDownloadInstructions) {
    const ytDlpCommand = `yt-dlp "${url.trim()}"`;
    const ytDlpWithFormat = `yt-dlp -F "${url.trim()}"`;
    
    return (
      <Dialog open={open} onOpenChange={() => { setShowDownloadInstructions(false); handleClose(); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Download" size={24} className="text-blue-600" />
              Как скачать видео на компьютер
            </DialogTitle>
            <DialogDescription>
              Пошаговая инструкция для скачивания через yt-dlp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <Icon name="Info" size={16} />
              <AlertDescription>
                <strong>yt-dlp</strong> — бесплатная программа для скачивания видео с YouTube, Kinescope, VK и 1000+ других сайтов
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                  Установите yt-dlp
                </h3>
                <div className="ml-8 space-y-2 text-sm">
                  <p><strong>Windows:</strong></p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Скачайте готовый архив с <a href="https://disk.yandex.ru/d/tQQhq8c3bH9gXA" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Яндекс.Диска</a> (содержит yt-dlp + ffmpeg)</li>
                    <li>Или скачайте с <a href="https://github.com/yt-dlp/yt-dlp/releases" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">GitHub</a> файл yt-dlp.exe</li>
                  </ul>
                  <p className="mt-2"><strong>Mac:</strong></p>
                  <code className="bg-black text-white px-2 py-1 rounded block mt-1">brew install yt-dlp</code>
                  <p className="mt-2"><strong>Linux:</strong></p>
                  <code className="bg-black text-white px-2 py-1 rounded block mt-1">sudo apt install yt-dlp</code>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                  Откройте командную строку
                </h3>
                <div className="ml-8 space-y-2 text-sm text-muted-foreground">
                  <p><strong>Windows:</strong> Win + R → введите <code className="bg-muted px-1">cmd</code> → Enter</p>
                  <p><strong>Mac/Linux:</strong> Откройте Terminal</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">3</span>
                  Перейдите в папку с yt-dlp
                </h3>
                <div className="ml-8 space-y-2 text-sm">
                  <code className="bg-black text-white px-2 py-1 rounded block">cd /d "C:\путь\к\папке\с\yt-dlp"</code>
                  <p className="text-muted-foreground text-xs">Замените путь на свой. Кавычки нужны, если в пути есть пробелы</p>
                </div>
              </div>

              <div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <span className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">4</span>
                  Скопируйте и выполните команду
                </h3>
                <div className="ml-8 space-y-3">
                  <div>
                    <p className="text-sm font-medium mb-2">Простое скачивание (максимальное качество):</p>
                    <div className="relative">
                      <code className="bg-black text-green-400 px-3 py-2 rounded block text-sm overflow-x-auto">
                        {ytDlpCommand}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1 h-7"
                        onClick={() => copyToClipboard(ytDlpCommand)}
                      >
                        <Icon name="Copy" size={14} />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Выбрать качество вручную:</p>
                    <div className="space-y-2">
                      <div className="relative">
                        <code className="bg-black text-yellow-400 px-3 py-2 rounded block text-sm overflow-x-auto">
                          {ytDlpWithFormat}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-1 right-1 h-7"
                          onClick={() => copyToClipboard(ytDlpWithFormat)}
                        >
                          <Icon name="Copy" size={14} />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Покажет список форматов с ID. Затем скачайте нужный:</p>
                      <code className="bg-black text-white px-2 py-1 rounded block text-xs">yt-dlp -f 135+140 "ссылка"</code>
                      <p className="text-xs text-muted-foreground">где 135 = видео, 140 = аудио (примеры ID)</p>
                    </div>
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <Icon name="Sparkles" size={16} className="text-amber-600" />
                <AlertDescription className="text-sm">
                  <strong>Полезные советы:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground text-xs">
                    <li>Если видео не скачивается — обновите yt-dlp командой: <code className="bg-muted px-1">yt-dlp -U</code></li>
                    <li>Видео сохраняется в папку, где вы запустили команду</li>
                    <li>Работает с YouTube, Kinescope, VK, Rutube и 1000+ сайтов</li>
                    <li>Можно скачать весь плейлист — просто вставьте ссылку на него</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDownloadInstructions(false)}
            >
              <Icon name="ArrowLeft" size={16} className="mr-2" />
              Назад
            </Button>
            <Button
              onClick={() => {
                setShowDownloadInstructions(false);
                handleClose();
              }}
            >
              Понятно
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

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

        <form onSubmit={handleUploadToPhotobank} className="space-y-4">
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
                  <p className="font-medium text-blue-900 dark:text-blue-100">📥 Скачать на компьютер (любая длина видео)</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">Для Kinescope, YouTube, VK — откроется инструкция по скачиванию через yt-dlp. Для прямых .mp4/.mov — откроется в браузере</p>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded">
                  <p className="font-medium text-purple-900 dark:text-purple-100">☁️ Загрузить в фотобанк (до 3 минут)</p>
                  <p className="text-purple-700 dark:text-purple-300 mt-1">Вставьте ссылку на .m3u8 плейлист — будет скачано первые 20 сегментов (~3 минуты видео)</p>
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