import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface UnsavedDataDialogProps {
  open: boolean;
  onContinue: () => void;
  onClear: () => void;
  onCancel: () => void;
  clientData: {
    name: string;
    phone: string;
    email: string;
  } | null;
}

const UnsavedDataDialog = ({ open, onContinue, onClear, onCancel, clientData }: UnsavedDataDialogProps) => {
  if (!clientData) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-md" aria-describedby="unsaved-data-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="AlertTriangle" className="text-orange-500" size={24} />
            Остались несохранённые данные
          </DialogTitle>
          <DialogDescription id="unsaved-data-description">
            Вы начали заполнять карточку клиента, но не завершили создание
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3 bg-muted/50 rounded-lg p-4">
          <div className="text-sm">
            <span className="font-medium">Клиент:</span> {clientData.name || '(не указано)'}
          </div>
          {clientData.phone && (
            <div className="text-sm">
              <span className="font-medium">Телефон:</span> {clientData.phone}
            </div>
          )}
          {clientData.email && (
            <div className="text-sm">
              <span className="font-medium">Email:</span> {clientData.email}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={onClear}
            className="w-full sm:w-auto"
          >
            <Icon name="Trash2" size={16} className="mr-2" />
            Очистить
          </Button>
          <Button
            onClick={onContinue}
            className="w-full sm:w-auto"
          >
            <Icon name="Play" size={16} className="mr-2" />
            Продолжить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnsavedDataDialog;
