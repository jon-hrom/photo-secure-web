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
const ENERGY_URL = 'https://functions.poehali.dev/b78fe245-efbd-4bd0-8db1-2515e8dfafb6';
const ENERGY_RATE_RUB = 25;

const PRESETS = [500, 1000, 2500, 5000];

interface PromoResult {
  final_price: number;
  discount_amount: number;
  bonus_energy: number;
  energy_total: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  userId: number | string;
  currentBalance: number;
  onSuccess?: () => void;
}

export const EnergyTopupDialog = ({ open, onClose, userId, currentBalance, onSuccess }: Props) => {
  const [amount, setAmount] = useState<string>('2500');
  const [loading, setLoading] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promo, setPromo] = useState<PromoResult | null>(null);

  const numericAmount = parseInt(amount, 10) || 0;
  const payAmount = promo ? promo.final_price : numericAmount;

  const resetPromo = () => { setPromo(null); };

  const handleSetAmount = (val: string) => {
    setAmount(val);
    resetPromo();
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) {
      toast.error('Введите промокод');
      return;
    }
    if (numericAmount < ENERGY_RATE_RUB) {
      toast.error(`Минимальная сумма — ${ENERGY_RATE_RUB} ₽`);
      return;
    }
    setPromoLoading(true);
    try {
      const res = await fetch(`${ENERGY_URL}?action=validate-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
        body: JSON.stringify({ code: promoCode.trim(), amount: numericAmount }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        toast.error(data.error || 'Промокод не применён');
        setPromo(null);
        return;
      }
      setPromo({
        final_price: data.final_price,
        discount_amount: data.discount_amount,
        bonus_energy: data.bonus_energy,
        energy_total: data.energy_total,
      });
      toast.success('Промокод применён!');
    } catch {
      toast.error('Ошибка проверки промокода');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleTopup = async (paymentMethod: 'default' | 'sbp' = 'default') => {
    if (numericAmount < ENERGY_RATE_RUB) {
      toast.error(`Минимальная сумма пополнения — ${ENERGY_RATE_RUB} ₽`);
      return;
    }
    setLoading(true);
    try {
      // 100% скидка — начисляем без Робокассы
      if (promo && promo.final_price <= 0) {
        const res = await fetch(`${ENERGY_URL}?action=apply-free`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
          body: JSON.stringify({ code: promoCode.trim(), amount: numericAmount }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error(data.error || 'Не удалось применить промокод');
          return;
        }
        toast.success(data.message || 'Энергия зачислена!');
        onSuccess?.();
        onClose();
        return;
      }

      const body: Record<string, unknown> = {
        order_type: 'energy',
        user_id: Number(userId),
        amount: numericAmount,
        code: promo ? promoCode.trim() : '',
        success_url: `${window.location.origin}/?energy=success`,
        fail_url: `${window.location.origin}/?energy=fail`,
      };
      if (paymentMethod === 'sbp') body.payment_method = 'sbp';

      const res = await fetch(ROBOKASSA_CREATE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const isFree = promo && promo.final_price <= 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
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
              onChange={(e) => handleSetAmount(e.target.value)}
              className="text-lg sm:text-2xl font-bold h-12 sm:h-14"
              placeholder="2500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {PRESETS.map((rub) => {
              const active = numericAmount === rub;
              return (
                <button
                  key={rub}
                  type="button"
                  onClick={() => handleSetAmount(String(rub))}
                  className={`flex items-center gap-2 sm:gap-3 rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
                    active
                      ? 'border-primary bg-primary/10 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Icon name="Zap" size={20} className={active ? 'text-primary' : 'text-yellow-500'} />
                  </div>
                  <div className={`font-bold ${active ? 'text-primary' : ''}`}>{rub} ₽</div>
                </button>
              );
            })}
          </div>

          {!showPromo ? (
            <button
              type="button"
              onClick={() => setShowPromo(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Icon name="Ticket" size={16} />
              Ввести промокод
            </button>
          ) : (
            <div className="space-y-2 animate-fade-in">
              <label className="text-sm text-muted-foreground">Промокод</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={promoCode}
                  onChange={(e) => { setPromoCode(e.target.value); resetPromo(); }}
                  placeholder="Введите промокод"
                  className="uppercase"
                />
                <Button variant="outline" onClick={applyPromo} disabled={promoLoading} className="shrink-0">
                  {promoLoading ? <Icon name="Loader2" className="h-4 w-4 animate-spin" /> : 'Применить'}
                </Button>
              </div>
              {promo && (
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 text-sm space-y-1">
                  {promo.discount_amount > 0 && (
                    <div className="flex justify-between text-green-700 dark:text-green-400">
                      <span>Скидка</span>
                      <span>−{promo.discount_amount} ₽</span>
                    </div>
                  )}
                  {promo.bonus_energy > 0 && (
                    <div className="flex justify-between text-green-700 dark:text-green-400">
                      <span>Бонус энергии</span>
                      <span>+{promo.bonus_energy} ⚡</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Итого к оплате</span>
                    <span>{promo.final_price} ₽</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {isFree ? (
              <Button
                className="w-full h-12 text-base"
                size="lg"
                onClick={() => handleTopup('default')}
                disabled={loading || numericAmount < ENERGY_RATE_RUB}
              >
                {loading ? (
                  <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Icon name="Gift" className="mr-2 h-5 w-5" />
                )}
                {loading ? 'Обработка...' : 'Получить энергию бесплатно'}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full h-12 text-base border-2 border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10 dark:text-[#1DB954] font-semibold"
                onClick={() => handleTopup('sbp')}
                disabled={loading || numericAmount < ENERGY_RATE_RUB}
              >
                {loading ? (
                  <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <span className="mr-2 font-bold text-base leading-none">⚡</span>
                )}
                {loading ? 'Обработка...' : `Оплатить через СБП ${payAmount} ₽`}
                {!loading && <span className="ml-2 text-xs text-muted-foreground font-normal">QR-код</span>}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnergyTopupDialog;