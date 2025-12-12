import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface PromoCodeInputProps {
  planId: number;
  userId: number;
  originalPrice: number;
  onPromoApplied: (discount: number, finalPrice: number, duration: number) => void;
  onPromoRemoved: () => void;
}

interface PromoValidation {
  valid: boolean;
  original_price: number;
  discount_amount: number;
  final_price: number;
  savings_percent: number;
  promo_code: {
    duration_months: number | null;
  };
}

const APPLY_PROMO_URL = 'https://functions.poehali.dev/233b546e-1cf3-4a9e-8de2-36d84c8931e8';

export const PromoCodeInput = ({
  planId,
  userId,
  originalPrice,
  onPromoApplied,
  onPromoRemoved,
}: PromoCodeInputProps) => {
  const [promoCode, setPromoCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoValidation | null>(null);

  const handleValidate = async () => {
    if (!promoCode.trim()) {
      toast.error('Введите промокод');
      return;
    }

    setIsValidating(true);
    console.log('[PROMO] Validating code:', promoCode);

    try {
      const response = await fetch(
        `${APPLY_PROMO_URL}?code=${encodeURIComponent(promoCode.toUpperCase())}&user_id=${userId}&plan_id=${planId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      console.log('[PROMO] Validation response:', data);

      if (!response.ok) {
        toast.error(data.error || 'Промокод недействителен');
        return;
      }

      if (data.valid) {
        setAppliedPromo(data);
        onPromoApplied(
          data.discount_amount,
          data.final_price,
          data.promo_code.duration_months || 1
        );
        toast.success(`Промокод применен! Скидка ${data.savings_percent}%`);
      }
    } catch (error) {
      console.error('[PROMO] Validation error:', error);
      toast.error('Ошибка проверки промокода');
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    setAppliedPromo(null);
    setPromoCode('');
    onPromoRemoved();
    toast.info('Промокод удален');
  };

  const handleApply = async () => {
    if (!appliedPromo) return;

    console.log('[PROMO] Applying promo code...');

    try {
      const response = await fetch(APPLY_PROMO_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: promoCode.toUpperCase(),
          user_id: userId,
          plan_id: planId,
        }),
      });

      const data = await response.json();
      console.log('[PROMO] Apply response:', data);

      if (!response.ok) {
        toast.error(data.error || 'Ошибка применения промокода');
        return;
      }

      toast.success('Промокод успешно применен! Подписка активирована');
      // Можно добавить редирект или обновление состояния
    } catch (error) {
      console.error('[PROMO] Apply error:', error);
      toast.error('Ошибка применения промокода');
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="space-y-2">
        <Label htmlFor="promo-code">Промокод</Label>
        <div className="flex gap-2">
          <Input
            id="promo-code"
            placeholder="SUMMER2024"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            disabled={!!appliedPromo}
            className="font-mono uppercase"
          />
          {appliedPromo ? (
            <Button type="button" variant="outline" onClick={handleRemove}>
              <Icon name="X" className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleValidate} disabled={isValidating}>
              {isValidating ? (
                <Icon name="Loader2" className="h-4 w-4 animate-spin" />
              ) : (
                'Проверить'
              )}
            </Button>
          )}
        </div>
      </div>

      {appliedPromo && (
        <div className="space-y-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <Icon name="Check" className="h-5 w-5" />
            <span className="font-semibold">Промокод действителен!</span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Цена без скидки:</span>
              <span className="line-through text-red-600 dark:text-red-400 font-semibold">
                {appliedPromo.original_price} ₽
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Скидка:</span>
              <span className="text-green-600 dark:text-green-400 font-semibold">
                −{appliedPromo.discount_amount.toFixed(2)} ₽ ({appliedPromo.savings_percent}%)
              </span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-semibold">Итого:</span>
              <span className="text-xl font-bold text-foreground">
                {appliedPromo.final_price.toFixed(2)} ₽
              </span>
            </div>

            {appliedPromo.promo_code.duration_months && (
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Срок подписки:</span>
                <span>{appliedPromo.promo_code.duration_months} {appliedPromo.promo_code.duration_months === 1 ? 'месяц' : 'месяца'}</span>
              </div>
            )}
          </div>

          <Button className="w-full" onClick={handleApply}>
            <Icon name="Sparkles" className="mr-2 h-4 w-4" />
            Применить и оформить подписку
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Введите промокод, чтобы получить скидку на выбранный тариф
      </p>
    </div>
  );
};
