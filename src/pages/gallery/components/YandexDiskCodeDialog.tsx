import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface YandexDiskCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (code: string) => void;
  authUrl?: string;
}

export default function YandexDiskCodeDialog({ open, onOpenChange, onSubmit, authUrl }: YandexDiskCodeDialogProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  };

  const openYandex = () => {
    if (authUrl) window.open(authUrl, '_blank', 'noopener');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setValue(text.trim());
        toast.success('Код вставлен');
      } else {
        toast.error('Буфер обмена пуст — сначала скопируйте код на странице Яндекса');
      }
    } catch {
      toast.error('Не удалось прочитать буфер. Вставьте код вручную в поле');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="HardDriveUpload" size={20} className="text-[#FC3F1D]" />
            Сохранение на Яндекс.Диск
          </DialogTitle>
          <DialogDescription>
            Авторизуйтесь в Яндексе, скопируйте код подтверждения и вставьте его здесь.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-2.5 text-sm">
            <div className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FC3F1D] text-white text-xs font-bold flex items-center justify-center">1</span>
              <span className="text-gray-700 dark:text-gray-300">Откройте окно Яндекса и разрешите доступ к Диску</span>
            </div>
            <div className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FC3F1D] text-white text-xs font-bold flex items-center justify-center">2</span>
              <span className="text-gray-700 dark:text-gray-300">Скопируйте код подтверждения</span>
            </div>
            <div className="flex gap-2.5">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FC3F1D] text-white text-xs font-bold flex items-center justify-center">3</span>
              <span className="text-gray-700 dark:text-gray-300">Вернитесь сюда и вставьте код</span>
            </div>
          </div>

          {authUrl && (
            <Button
              type="button"
              variant="outline"
              onClick={openYandex}
              className="w-full gap-2"
            >
              <Icon name="ExternalLink" size={16} />
              Открыть окно Яндекса
            </Button>
          )}

          <div className="flex gap-2">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="Вставьте код подтверждения"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handlePaste}
              title="Вставить код из буфера обмена"
              className="flex-shrink-0 gap-1.5"
            >
              <Icon name="ClipboardPaste" size={16} />
              <span className="hidden sm:inline">Вставить</span>
            </Button>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="w-full bg-[#FC3F1D] hover:bg-[#d8330f] text-white"
          >
            Загрузить фото на Яндекс.Диск
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
