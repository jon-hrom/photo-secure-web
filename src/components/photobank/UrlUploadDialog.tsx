import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';

interface UrlUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onUpload: (url: string) => Promise<void>;
}

const UrlUploadDialog = ({ open, onClose, onUpload }: UrlUploadDialogProps) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

    try {
      await onUpload(url);
      setUrl('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка при загрузке файлов');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setUrl('');
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Загрузить по ссылке</DialogTitle>
          <DialogDescription>
            Укажите ссылку на файлы (Яндекс Диск, Google Drive и др.)
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
                  Загрузка...
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
