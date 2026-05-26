import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface UseReserveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reserveBalance: number;
  projectBudget: number;
  projectName: string;
  onSkip: () => void;
  onUse: (amount: number) => void;
}

const UseReserveDialog = ({
  open,
  onOpenChange,
  reserveBalance,
  projectBudget,
  projectName,
  onSkip,
  onUse,
}: UseReserveDialogProps) => {
  const maxUse = Math.min(reserveBalance, projectBudget);
  const [amount, setAmount] = useState<string>(String(maxUse));

  useEffect(() => {
    if (open) setAmount(String(maxUse));
  }, [open, maxUse]);

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount > 0 && numericAmount <= maxUse;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="PiggyBank" size={20} className="text-emerald-500" />
            Использовать финансовый резерв?
          </DialogTitle>
          <DialogDescription className="pt-2">
            У клиента есть резерв <strong className="text-emerald-500">{reserveBalance.toLocaleString('ru-RU')} ₽</strong> с прошлых съёмок.
            <br />
            Бюджет нового проекта «{projectName}»: <strong className="text-foreground">{projectBudget.toLocaleString('ru-RU')} ₽</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          <Label htmlFor="reserve-amount">Сколько списать из резерва?</Label>
          <Input
            id="reserve-amount"
            type="number"
            min={0}
            max={maxUse}
            step={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-lg font-semibold"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmount(String(maxUse))}
              className="flex-1"
            >
              Всю сумму ({maxUse.toLocaleString('ru-RU')} ₽)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAmount(String(Math.floor(maxUse / 2)))}
              className="flex-1"
            >
              Половину
            </Button>
          </div>
          {numericAmount > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              После списания в резерве останется: <strong>{(reserveBalance - numericAmount).toLocaleString('ru-RU')} ₽</strong>
            </p>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={() => onUse(numericAmount)}
            disabled={!isValid}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Icon name="Check" size={16} className="mr-2" />
            Списать {numericAmount.toLocaleString('ru-RU')} ₽ из резерва
          </Button>
          <Button onClick={onSkip} variant="outline" className="w-full">
            Не использовать резерв
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UseReserveDialog;
