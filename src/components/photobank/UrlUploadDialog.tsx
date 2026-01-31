import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface UploadResult {
  total_found: number;
  uploaded: number;
  failed: number;
  folder_id?: number;
}

interface UrlUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (url: string, folderId?: number) => Promise<UploadResult>;
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
  const [uploadingProgress, setUploadingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [totalUploaded, setTotalUploaded] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);
  const [createdFolderId, setCreatedFolderId] = useState<number | null>(null);

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
    setTotalUploaded(0);
    setCancelled(false);
    cancelledRef.current = false;
    setCreatedFolderId(null);
    setUploadingProgress({ current: 0, total: 5 });

    try {
      let totalFound = 0;
      let totalUploadedCount = 0;
      let targetFolderId: number | null = null;

      // Первый запрос для получения общего количества
      const firstResult = await onUpload(url, undefined);
      
      totalFound = firstResult.total_found;
      totalUploadedCount = firstResult.uploaded;
      targetFolderId = firstResult.folder_id || null;
      
      setCreatedFolderId(targetFolderId);
      setTotalUploaded(totalUploadedCount);
      setProgress({
        found: totalFound,
        uploaded: totalUploadedCount,
        total: totalFound
      });
      
      // Если загружено всё или меньше 5 — завершаем
      if (totalUploadedCount >= totalFound || firstResult.uploaded < 5) {
        setUploadingProgress(null);
        setLoading(false);
        setTimeout(() => {
          setUrl('');
          setProgress(null);
          setTotalUploaded(0);
          onClose();
        }, 2000);
        return;
      }

      // Загружаем остальные порции по 5 фото
      while (totalUploadedCount < totalFound) {
        // Проверяем отмену ДО следующего запроса (используем ref для синхронной проверки)
        if (cancelledRef.current) {
          setLoading(false);
          setUploadingProgress(null);
          return;
        }

        setUploadingProgress({ current: 0, total: 5 });
        
        const result = await onUpload(url, targetFolderId || undefined);
        
        totalUploadedCount += result.uploaded;
        setTotalUploaded(totalUploadedCount);
        setProgress({
          found: totalFound,
          uploaded: totalUploadedCount,
          total: totalFound
        });
        
        // Если загрузили меньше 5 — больше файлов нет
        if (result.uploaded < 5) {
          break;
        }
      }
      
      // Завершение загрузки
      setUploadingProgress(null);
      setLoading(false);
      setTimeout(() => {
        setUrl('');
        setProgress(null);
        setTotalUploaded(0);
        onClose();
      }, 2000);
      
    } catch (err: any) {
      setUploadingProgress(null);
      setError(err.message || 'Ошибка при загрузке файлов');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) {
      setCancelled(true);
      cancelledRef.current = true;
      setLoading(false);
      setUploadingProgress(null);
    } else {
      setUrl('');
      setError('');
      setProgress(null);
      setUploadingProgress(null);
      setTotalUploaded(0);
      cancelledRef.current = false;
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
            {progress && progress.found > 0 && loading && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg space-y-2">
                <div className="text-purple-700 dark:text-purple-300">
                  <div className="font-semibold text-lg">📁 Обнаружено: {progress.found} фото</div>
                  <div className="text-sm mt-1">✅ Загружено: {progress.uploaded} из {progress.found}</div>
                  {progress.found > 0 && (
                    <div className="w-full bg-purple-200 dark:bg-purple-900 rounded-full h-2 overflow-hidden mt-2">
                      <div 
                        className="bg-purple-600 dark:bg-purple-400 h-full transition-all duration-300 ease-out"
                        style={{ width: `${(progress.uploaded / progress.found) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {uploadingProgress && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <Icon name="Loader2" className="animate-spin" size={18} />
                  <span className="font-medium">
                    {uploadingProgress.current === 0 ? 'Анализируем ссылку...' : 'Загружаем фото...'}
                  </span>
                </div>
                {uploadingProgress.current > 0 && (
                  <>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      Текущая порция: {uploadingProgress.current} из {uploadingProgress.total}
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-600 dark:bg-blue-400 h-full transition-all duration-300 ease-out"
                        style={{ width: `${(uploadingProgress.current / uploadingProgress.total) * 100}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            {progress && (
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Icon name="CheckCircle" size={18} />
                  <span className="font-medium">Загрузка завершена!</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="text-green-600 dark:text-green-400">
                    <div>📁 Найдено фото по ссылке: <span className="font-semibold">{progress.found}</span></div>
                    <div>✅ Загружено всего: <span className="font-semibold">{progress.uploaded}</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
            >
              {loading ? 'Остановить' : 'Отмена'}
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