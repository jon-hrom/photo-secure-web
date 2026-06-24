import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="HardDriveUpload" size={20} className="text-[#FC3F1D]" />
            Подтверждение Яндекс.Диска
          </DialogTitle>
          <DialogDescription>
            В открывшемся окне Яндекса разрешите доступ к Диску. Появится код подтверждения — скопируйте его и вставьте сюда.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="Введите код подтверждения"
            inputMode="numeric"
          />
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
