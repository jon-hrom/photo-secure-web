import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const ROBOKASSA_CREATE_URL = 'https://functions.poehali.dev/97e25c3b-c738-44e0-8922-87bbb4dc339d';
const ENERGY_RATE_RUB = 25;

const PRESETS = [
  { rub: 500, energy: 20 },
  { rub: 1000, energy: 40 },
  { rub: 2500, energy: 100 },
  { rub: 5000, energy: 200 },
];

interface Props {
  open: boolean;
  onClose: () => void;
  userId: number | string;
  currentBalance: number;
}

export const EnergyTopupDialog = ({ open, onClose, userId, currentBalance }: Props) => {
  const [amount, setAmount] = useState<string>('2500');
  const [loading, setLoading] = useState(false);

  const numericAmount = parseInt(amount, 10) || 0;
  const energyToGet = Math.floor(numericAmount / ENERGY_RATE_RUB);

  const handleTopup = async () => {
    if (numericAmount < ENERGY_RATE_RUB) {
      toast.error(`Минимальная сумма пополнения — ${ENERGY_RATE_RUB} ₽`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(ROBOKASSA_CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_type: 'energy',
          user_id: Number(userId),
          amount: numericAmount,
          success_url: `${window.location.origin}/?energy=success`,
          fail_url: `${window.location.origin}/?energy=fail`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.payment_url) {
        toast.error(data.error || 'Не удалось создать оплату');
        return;
      }
      toast.success('Переходим к оплате...');
      window.location.href = data.payment_url;
    } catch {
      toast.error('Ошибка при создании оплаты');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Icon name="Zap" size={22} className="text-primary" />
            Пополнение энергии
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">Текущий баланс</span>
            <span className="flex items-center gap-1 font-semibold">
              <Icon name="Zap" size={16} className="text-yellow-500" />
              {currentBalance} энергии
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Выберите сумму пополнения (₽)</label>
            <Input
              type="number"
              min={ENERGY_RATE_RUB}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl font-bold h-14"
              placeholder="2500"
            />
            {energyToGet > 0 && (
              <p className="text-xs text-muted-foreground">
                Вы получите <span className="font-semibold text-foreground">{energyToGet}</span> единиц энергии
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {PRESETS.map((p) => {
              const active = numericAmount === p.rub;
              return (
                <button
                  key={p.rub}
                  type="button"
                  onClick={() => setAmount(String(p.rub))}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Icon name="Zap" size={20} className={active ? 'text-primary' : 'text-yellow-500'} />
                  </div>
                  <div>
                    <div className={`font-bold ${active ? 'text-primary' : ''}`}>{p.rub} ₽</div>
                    <div className="text-xs text-muted-foreground">{p.energy} запросов*</div>
                  </div>
                </button>
              );
            })}
          </div>

          <Button
            className="w-full h-12 text-base"
            size="lg"
            onClick={handleTopup}
            disabled={loading || numericAmount < ENERGY_RATE_RUB}
          >
            {loading ? (
              <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Icon name="CreditCard" className="mr-2 h-5 w-5" />
            )}
            {loading ? 'Обработка...' : `Пополнить на ${numericAmount} ₽`}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            * Энергия списывается за обработку запросов. Оплата через Робокассу.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnergyTopupDialog;
