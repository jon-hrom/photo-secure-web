import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface SaveDesignDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

const SaveDesignDialog = ({ open, onClose, onSave }: SaveDesignDialogProps) => {
  const [step, setStep] = useState<'confirm' | 'name' | 'success'>('confirm');
  const [designName, setDesignName] = useState('');

  const handleConfirm = () => {
    setStep('name');
  };

  const handleSave = () => {
    if (designName.trim()) {
      onSave(designName);
      setStep('success');
      setTimeout(() => {
        onClose();
        setStep('confirm');
        setDesignName('');
      }, 2000);
    }
  };

  const handleClose = () => {
    onClose();
    setStep('confirm');
    setDesignName('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm">
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Сохранение дизайна</DialogTitle>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <Icon name="X" size={20} />
                </Button>
              </div>
            </DialogHeader>
            <div className="py-4">
              <p className="text-muted-foreground">
                Во избежание потери изменений, рекомендуем сохранить дизайн
              </p>
            </div>
            <div className="flex justify-end">
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                onClick={handleConfirm}
              >
                Сохранить
              </Button>
            </div>
          </>
        )}

        {step === 'name' && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Сохранение дизайна</DialogTitle>
                <Button variant="ghost" size="icon" onClick={handleClose}>
                  <Icon name="X" size={20} />
                </Button>
              </div>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="design-name">Название дизайна:</Label>
              <Input
                id="design-name"
                value={designName}
                onChange={(e) => setDesignName(e.target.value)}
                placeholder="Введите название"
                className="mt-2 border-2 border-purple-600 focus:border-purple-700"
                autoFocus
              />
            </div>
            <div className="flex justify-end">
              <Button
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                onClick={handleSave}
                disabled={!designName.trim()}
              >
                Сохранить
              </Button>
            </div>
          </>
        )}

        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle>Дизайн сохранен</DialogTitle>
            </DialogHeader>
            <div className="py-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Icon name="Check" size={28} className="text-green-600" />
              </div>
              <p className="text-muted-foreground flex-1">
                Ваш дизайн был успешно сохранен и добавлен в раздел Мои дизайны
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaveDesignDialog;