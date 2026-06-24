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
}

export default function YandexDiskCodeDialog({ open, onOpenChange, onSubmit }: YandexDiskCodeDialogProps) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim());
    setValue('');
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setValue(text.trim());
        toast.success('Код вставлен');
      } else {
        toast.error('Буфер обмена пуст — сначала скопируйте код');
      }
    } catch {
      toast.error('Не удалось прочитать буфер. Вставьте код вручную (зажмите поле → «Вставить»)');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="HardDriveUpload" size={20} className="text-[#FC3F1D]" />
            Подтверждение Яндекс.Диска
          </DialogTitle>
          <DialogDescription>
            В открывшемся окне Яндекса разрешите доступ к Диску. Появится код подтверждения — скопируйте его и нажмите «Вставить из буфера».
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="flex gap-2">
            <Input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder="Введите код подтверждения"
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