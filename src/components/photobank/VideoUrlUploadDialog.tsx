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
        <DialogContent className="w-[95vw] max-w-[700px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Icon name="Download" size={20} className="text-blue-600 sm:w-6 sm:h-6" />
              Как скачать видео
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Инструкция для скачивания через yt-dlp
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            <Alert className="text-xs sm:text-sm">
              <Icon name="Info" size={14} className="sm:w-4 sm:h-4" />
              <AlertDescription>
                <strong>yt-dlp</strong> — программа для скачивания видео
              </AlertDescription>
            </Alert>

            <div className="space-y-3 sm:space-y-4">
              <div className="border rounded-lg p-3 sm:p-4 bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm sm:text-base">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm flex-shrink-0">1</span>
                  Установите yt-dlp
                </h3>
                <div className="ml-7 sm:ml-8 space-y-2 text-xs sm:text-sm">
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

              <div className="border rounded-lg p-3 sm:p-4 bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm sm:text-base">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm flex-shrink-0">2</span>
                  Откройте командную строку
                </h3>
                <div className="ml-7 sm:ml-8 space-y-2 text-xs sm:text-sm text-muted-foreground">
                  <p><strong>Windows:</strong> Win + R → введите <code className="bg-muted px-1">cmd</code> → Enter</p>
                  <p><strong>Mac/Linux:</strong> Откройте Terminal</p>
                </div>
              </div>

              <div className="border rounded-lg p-3 sm:p-4 bg-muted/50">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm sm:text-base">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm flex-shrink-0">3</span>
                  Перейдите в папку с yt-dlp
                </h3>
                <div className="ml-7 sm:ml-8 space-y-2 text-xs sm:text-sm">
                  <code className="bg-black text-white px-2 py-1 rounded block text-[10px] sm:text-xs overflow-x-auto">cd /d "C:\путь\к\папке\с\yt-dlp"</code>
                  <p className="text-muted-foreground text-[10px] sm:text-xs">Замените путь на свой</p>
                </div>
              </div>

              <div className="border rounded-lg p-3 sm:p-4 bg-green-50 dark:bg-green-950">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm sm:text-base">
                  <span className="bg-green-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm flex-shrink-0">4</span>
                  Скопируйте команду
                </h3>
                <div className="ml-7 sm:ml-8 space-y-3">
                  <div>
                    <p className="text-xs sm:text-sm font-medium mb-2">Максимальное качество:</p>
                    <div className="relative">
                      <code className="bg-black text-green-400 px-2 sm:px-3 py-2 rounded block text-[10px] sm:text-sm overflow-x-auto pr-10">
                        {ytDlpCommand}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-1 right-1 h-6 w-6 p-0 sm:h-7 sm:w-7"
                        onClick={() => copyToClipboard(ytDlpCommand)}
                      >
                        <Icon name="Copy" size={12} className="sm:w-3.5 sm:h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs sm:text-sm font-medium mb-2">Выбрать качество:</p>
                    <div className="space-y-2">
                      <div className="relative">
                        <code className="bg-black text-yellow-400 px-2 sm:px-3 py-2 rounded block text-[10px] sm:text-sm overflow-x-auto pr-10">
                          {ytDlpWithFormat}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute top-1 right-1 h-6 w-6 p-0 sm:h-7 sm:w-7"
                          onClick={() => copyToClipboard(ytDlpWithFormat)}
                        >
                          <Icon name="Copy" size={12} className="sm:w-3.5 sm:h-3.5" />
                        </Button>
                      </div>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Покажет список форматов. Затем:</p>
                      <code className="bg-black text-white px-2 py-1 rounded block text-[10px] sm:text-xs overflow-x-auto">yt-dlp -f 135+140 "ссылка"</code>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">135 = видео, 140 = аудио</p>
                    </div>
                  </div>
                </div>
              </div>

              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-xs sm:text-sm">
                <Icon name="Sparkles" size={14} className="text-amber-600 sm:w-4 sm:h-4" />
                <AlertDescription className="text-xs sm:text-sm">
                  <strong>Полезные советы:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground text-[10px] sm:text-xs">
                    <li>Обновите: <code className="bg-muted px-1">yt-dlp -U</code></li>
                    <li>Видео сохраняется в текущей папке</li>
                    <li>YouTube, VK, Rutube и 1000+ сайтов</li>
                    <li>Можно скачать целый плейлист</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDownloadInstructions(false)}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              <Icon name="ArrowLeft" size={14} className="mr-1 sm:mr-2 sm:w-4 sm:h-4" />
              Назад
            </Button>
            <Button
              onClick={() => {
                setShowDownloadInstructions(false);
                handleClose();
              }}
              className="text-xs sm:text-sm h-8 sm:h-9"
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
      <DialogContent className="w-[95vw] max-w-[600px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="Video" size={20} className="text-purple-600 sm:w-6 sm:h-6" />
            Загрузить видео
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            .mp4, .mov, HLS (.m3u8), Kinescope
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUploadToPhotobank} className="space-y-3 sm:space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-url" className="text-xs sm:text-sm">Ссылка на видео</Label>
            <Input
              id="video-url"
              type="url"
              placeholder="https://example.com/video.mp4"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="font-mono text-xs sm:text-sm h-9 sm:h-10"
            />
          </div>

          {error && (
            <Alert variant="destructive" className="text-xs sm:text-sm">
              <Icon name="AlertCircle" size={14} className="sm:w-4 sm:h-4" />
              <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <Alert className="text-xs sm:text-sm">
            <Icon name="Info" size={14} className="sm:w-4 sm:h-4" />
            <AlertDescription className="text-xs sm:text-sm space-y-2">
              <p className="font-medium">Два способа:</p>
              <div className="space-y-2 text-[10px] sm:text-xs">
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                  <p className="font-medium text-blue-900 dark:text-blue-100">📥 Скачать на компьютер</p>
                  <p className="text-blue-700 dark:text-blue-300 mt-1">Kinescope, YouTube, VK — инструкция yt-dlp</p>
                </div>
                <div className="p-2 bg-purple-50 dark:bg-purple-950 rounded">
                  <p className="font-medium text-purple-900 dark:text-purple-100">☁️ В фотобанк (до 3 мин)</p>
                  <p className="text-purple-700 dark:text-purple-300 mt-1">Ссылка на .m3u8 плейлист</p>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <div className="flex gap-2 justify-end flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              Отмена
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDirectDownload}
              disabled={loading || !url.trim()}
              className="text-xs sm:text-sm h-8 sm:h-9"
            >
              <Icon name="ExternalLink" size={14} className="mr-1 sm:mr-2 sm:w-4 sm:h-4" />
              Скачать
            </Button>
            <Button
              type="submit"
              disabled={loading || !url.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-xs sm:text-sm h-8 sm:h-9"
              onClick={handleUploadToPhotobank}
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={14} className="animate-spin mr-1 sm:mr-2 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Загружаем...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <Icon name="CloudUpload" size={14} className="mr-1 sm:mr-2 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">В фотобанк</span>
                  <span className="sm:hidden">Загрузить</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}