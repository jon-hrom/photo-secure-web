import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface OverpaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentAmount: number;
  projectRemaining: number;
  overpayAmount: number;
  onReturnChange: () => void;
  onAddToReserve: () => void;
}

const OverpaymentDialog = ({
  open,
  onOpenChange,
  paymentAmount,
  projectRemaining,
  overpayAmount,
  onReturnChange,
  onAddToReserve,
}: OverpaymentDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Wallet" size={20} className="text-amber-500" />
            Обнаружена переплата
          </DialogTitle>
          <DialogDescription className="pt-2">
            Клиент внёс <strong className="text-foreground">{paymentAmount.toLocaleString('ru-RU')} ₽</strong>, 
            а остаток по услуге — <strong className="text-foreground">{projectRemaining.toLocaleString('ru-RU')} ₽</strong>.
            <br />
            Сдача: <strong className="text-amber-500">{overpayAmount.toLocaleString('ru-RU')} ₽</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 text-sm text-muted-foreground">
          Как поступить со сдачей?
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={onAddToReserve}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Icon name="PiggyBank" size={16} className="mr-2" />
            В резерв на следующую съёмку ({overpayAmount.toLocaleString('ru-RU')} ₽)
          </Button>
          <Button
            onClick={onReturnChange}
            variant="outline"
            className="w-full"
          >
            <Icon name="HandCoins" size={16} className="mr-2" />
            Отдать сдачу клиенту
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OverpaymentDialog;
