import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { PromoCodeInput } from '../PromoCodeInput';
import { Plan } from './types';

interface SubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlan: Plan | null;
  userId?: string | number | null;
  promoDiscount: number;
  promoFinalPrice: number;
  promoDuration: number;
  isApplying: boolean;
  autoRenew: boolean;
  recurringConsent: boolean;
  setAutoRenew: (v: boolean) => void;
  setRecurringConsent: (v: boolean) => void;
  onPromoApplied: (discount: number, finalPrice: number, duration: number, code?: string) => void;
  onPromoRemoved: () => void;
  onApplyTariff: () => void;
}

const SubscribeDialog = ({
  open,
  onOpenChange,
  selectedPlan,
  userId,
  promoDiscount,
  promoFinalPrice,
  promoDuration,
  isApplying,
  autoRenew,
  recurringConsent,
  setAutoRenew,
  setRecurringConsent,
  onPromoApplied,
  onPromoRemoved,
  onApplyTariff,
}: SubscribeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Оформление подписки: {selectedPlan?.plan_name}</DialogTitle>
          <DialogDescription>
            Введите промокод, чтобы получить скидку на выбранный тариф
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {selectedPlan && (
            <>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between items-start gap-3">
                  <span className="text-sm font-medium shrink-0">Тариф:</span>
                  <span className="font-semibold text-right break-words min-w-0">{selectedPlan.plan_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Квота:</span>
                  <span>{Math.floor(selectedPlan.quota_gb)} GB</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Макс. клиентов:</span>
                  <span>{Math.floor(selectedPlan.max_clients)}</span>
                </div>
              </div>

              {userId && (
                <PromoCodeInput
                  planId={selectedPlan.plan_id}
                  userId={userId}
                  originalPrice={selectedPlan.price_rub}
                  onPromoApplied={onPromoApplied}
                  onPromoRemoved={onPromoRemoved}
                />
              )}

              {!userId && (
                <div className="p-4 border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Войдите в систему, чтобы использовать промокод и оформить подписку
                  </p>
                </div>
              )}

              {promoDiscount === 0 && selectedPlan.price_rub > 0 && (
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Итого:</span>
                    <span className="text-2xl font-bold">
                      {Math.floor(selectedPlan.price_rub)} ₽
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Срок подписки: 1 месяц
                  </p>
                </div>
              )}

              {selectedPlan.price_rub === 0 && (
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={onApplyTariff}
                  disabled={isApplying}
                >
                  {isApplying ? (
                    <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Icon name="Check" className="mr-2 h-5 w-5" />
                  )}
                  {isApplying ? 'Активация...' : 'Активировать бесплатный тариф'}
                </Button>
              )}

              {(() => {
                const payAmount = promoDiscount > 0 ? promoFinalPrice : selectedPlan.price_rub * promoDuration;
                return selectedPlan.price_rub > 0 && payAmount > 0;
              })() && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-4 space-y-3">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                    <Icon name="RefreshCw" size={12} />
                    Автоматическое продление
                  </p>

                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="auto-renew"
                      checked={autoRenew}
                      onCheckedChange={(v) => {
                        setAutoRenew(v === true);
                        if (!v) setRecurringConsent(false);
                      }}
                      className="mt-0.5"
                    />
                    <label htmlFor="auto-renew" className="text-sm leading-snug cursor-pointer">
                      Включить автопродление — каждые{' '}
                      {promoDuration} {promoDuration === 1 ? 'месяц' : promoDuration < 5 ? 'месяца' : 'месяцев'} будет списываться{' '}
                      <b>{Math.floor(promoDiscount > 0 ? promoFinalPrice : selectedPlan.price_rub * promoDuration)} ₽</b>.{' '}
                      <span className="text-muted-foreground">Уведомление за 3 дня. Отключить — в личном кабинете.</span>
                    </label>
                  </div>

                  {autoRenew && (
                    <div className="flex items-start gap-3 pt-2 border-t border-primary/20">
                      <Checkbox
                        id="recurring-consent"
                        checked={recurringConsent}
                        onCheckedChange={(v) => setRecurringConsent(v === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="recurring-consent" className="text-sm leading-snug cursor-pointer">
                        Я согласен на автоматические списания согласно{' '}
                        <a href="/offer" target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline font-medium">оферте</a>{' '}
                        (п.&nbsp;5.5) и{' '}
                        <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline font-medium">политике конфиденциальности</a>.
                      </label>
                    </div>
                  )}

                  {autoRenew && !recurringConsent && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Icon name="AlertCircle" size={12} />
                      Отметьте согласие, чтобы продолжить
                    </p>
                  )}
                </div>
              )}

              {selectedPlan.price_rub > 0 && promoDiscount === 0 && (
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={onApplyTariff}
                  disabled={isApplying || (autoRenew && !recurringConsent)}
                >
                  {isApplying ? (
                    <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Icon name="CreditCard" className="mr-2 h-5 w-5" />
                  )}
                  {isApplying ? 'Обработка...' : 'Оплатить и применить тариф'}
                </Button>
              )}

              {selectedPlan.price_rub > 0 && promoDiscount > 0 && (
                <div className="space-y-4">
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Итого к оплате:</span>
                      <span className="text-2xl font-bold text-green-600">
                        {promoFinalPrice.toFixed(2)} ₽
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Срок подписки: {promoDuration} {promoDuration === 1 ? 'месяц' : 'месяца'}
                    </p>
                    <p className="text-xs text-green-600">
                      Экономия: {promoDiscount.toFixed(2)} ₽
                    </p>
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={onApplyTariff}
                    disabled={isApplying || (autoRenew && !recurringConsent)}
                  >
                    {isApplying ? (
                      <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
                    ) : (
                      <Icon name="Sparkles" className="mr-2 h-5 w-5" />
                    )}
                    {isApplying ? 'Обработка...' : 'Оплатить и применить тариф'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscribeDialog;
