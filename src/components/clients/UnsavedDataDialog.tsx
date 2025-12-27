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
      <DialogContent className="max-w-[95vw] sm:max-w-md mx-4" aria-describedby="unsaved-data-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="AlertTriangle" className="text-orange-500 flex-shrink-0" size={20} />
            <span className="leading-tight">Остались несохранённые данные</span>
          </DialogTitle>
          <DialogDescription id="unsaved-data-description" className="text-sm">
            Вы начали заполнять карточку клиента, но не завершили создание
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-3 sm:py-4 space-y-2 sm:space-y-3 bg-muted/50 rounded-lg p-3 sm:p-4">
          <div className="text-xs sm:text-sm">
            <span className="font-medium">Клиент:</span> {clientData.name || '(не указано)'}
          </div>
          {clientData.phone && (
            <div className="text-xs sm:text-sm">
              <span className="font-medium">Телефон:</span> {clientData.phone}
            </div>
          )}
          {clientData.email && (
            <div className="text-xs sm:text-sm break-all">
              <span className="font-medium">Email:</span> {clientData.email}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto order-3 sm:order-1 text-sm h-10"
          >
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={onClear}
            className="w-full sm:w-auto order-2 text-sm h-10"
          >
            <Icon name="Trash2" size={16} className="mr-2" />
            Очистить
          </Button>
          <Button
            onClick={onContinue}
            className="w-full sm:w-auto order-1 sm:order-3 text-sm h-10 shadow-lg"
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