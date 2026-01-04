import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface UploadResult {
  total_found: number;
  uploaded: number;
  failed: number;
}

interface UrlUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (url: string) => Promise<UploadResult>;
}

const UrlUploadDialog = ({ open, onClose, onUpload }: UrlUploadDialogProps) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{
    found: number;
    uploaded: number;
    total: number;
  } | null>(null);

  const handleUpload = async () => {
    if (!url.trim()) {
      setError('Введите URL ссылку');
      return;
    }

    // Простая валидация URL
    try {
      new URL(url);
    } catch {
      setError('Введите корректную URL ссылку');
      return;
    }

    setLoading(true);
    setError('');
    setProgress(null);

    try {
      const result = await onUpload(url);
      
      setProgress({
        found: result.total_found,
        uploaded: result.uploaded,
        total: result.total_found
      });

      // Автоматически закрываем через 2 секунды после успеха
      setTimeout(() => {
        setUrl('');
        setProgress(null);
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке файлов');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUrl('');
      setError('');
      setProgress(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Загрузить по ссылке</DialogTitle>
          <DialogDescription>
            Укажите ссылку на файлы (Яндекс Диск, Google Drive, Dropbox, OneDrive)
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Input
              type="url"
              placeholder="https://disk.yandex.ru/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError('');
              }}
              disabled={loading}
              className="w-full"
            />
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <Icon name="AlertCircle" size={14} />
                {error}
              </p>
            )}
            {progress && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Icon name="CheckCircle" size={18} />
                  <span className="font-medium">Загрузка завершена!</span>
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  <div>Найдено фото: {progress.found}</div>
                  <div>Загружено: {progress.uploaded}</div>
                  {progress.found > progress.uploaded && (
                    <div className="text-orange-600 dark:text-orange-400">
                      Не удалось: {progress.found - progress.uploaded}
                    </div>
                  )}
                  {progress.found > 5 && (
                    <div className="text-blue-600 dark:text-blue-400 mt-2">
                      ℹ️ Загружается по 5 фото за раз. Повторите для следующей порции.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Отмена
            </Button>
            <Button
              onClick={handleUpload}
              disabled={loading || !url.trim()}
            >
              {loading ? (
                <>
                  <Icon name="Loader2" className="mr-2 animate-spin" size={18} />
                  {progress ? 'Загружаем...' : 'Анализируем ссылку...'}
                </>
              ) : (
                <>
                  <Icon name="Download" className="mr-2" size={18} />
                  Скачать
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UrlUploadDialog;