import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PromoCodeInput } from '@/components/PromoCodeInput';
import { Checkbox } from '@/components/ui/checkbox';
import { Plan } from './types';

interface SubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedPlan: Plan | null;
  userId: number | null;
  promoDiscount: number;
  promoFinalPrice: number;
  promoDuration: number;
  autoRenew: boolean;
  recurringConsent: boolean;
  paying: boolean;
  setAutoRenew: (v: boolean) => void;
  setRecurringConsent: (v: boolean) => void;
  onPromoApplied: (discount: number, finalPrice: number, duration: number, code?: string) => void;
  onPromoRemoved: () => void;
  onPay: (paymentMethod?: 'default' | 'sbp') => void;
}

const SubscribeDialog = ({
  open,
  onOpenChange,
  selectedPlan,
  userId,
  promoDiscount,
  promoFinalPrice,
  promoDuration,
  autoRenew,
  recurringConsent,
  paying,
  setAutoRenew,
  setRecurringConsent,
  onPromoApplied,
  onPromoRemoved,
  onPay,
}: SubscribeDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Оформление подписки: {selectedPlan?.plan_name}</DialogTitle>
          <DialogDescription>
            Введите промокод, чтобы получить скидку на выбранный тариф
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {selectedPlan && (
            <>
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Тариф:</span>
                  <span className="font-semibold">{selectedPlan.plan_name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Квота:</span>
                  <span>{Math.floor(selectedPlan.quota_gb)} ГБ</span>
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
                <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    Войдите в систему, чтобы оформить подписку
                  </p>
                </div>
              )}

              <div className="p-4 border rounded-lg space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Стоимость тарифа:</span>
                  <span>{Math.floor(selectedPlan.price_rub)} ₽</span>
                </div>
                
                {promoDiscount > 0 && (
                  <>
                    <div className="flex justify-between items-center text-green-600">
                      <span className="text-sm font-medium">Скидка по промокоду:</span>
                      <span>-{promoDiscount}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Длительность:</span>
                      <span>{promoDuration} {promoDuration === 1 ? 'месяц' : 'месяца'}</span>
                    </div>
                  </>
                )}
                
                <div className="pt-3 border-t flex justify-between items-center">
                  <span className="font-bold">Итого к оплате:</span>
                  <span className="text-2xl font-bold text-primary">{Math.floor(promoFinalPrice)} ₽</span>
                </div>
                
                {promoDuration > 1 && (
                  <p className="text-xs text-muted-foreground">
                    Цена указана за {promoDuration} {promoDuration === 1 ? 'месяц' : promoDuration < 5 ? 'месяца' : 'месяцев'}
                  </p>
                )}
              </div>

              {promoFinalPrice > 0 && (
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
                      <b>{Math.floor(promoFinalPrice)} ₽</b>.{' '}
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
                        <a href="/offer" target="_blank" className="text-primary underline hover:no-underline font-medium">оферте</a>{' '}
                        (п.&nbsp;5.5).{' '}
                        <span className="text-muted-foreground">Списание {Math.floor(promoFinalPrice)} ₽ каждые{' '}
                        {promoDuration} {promoDuration === 1 ? 'месяц' : 'месяца'} до отмены.</span>
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

              <div className="space-y-2">
                {promoFinalPrice <= 0 ? (
                  <Button
                    className="w-full"
                    size="lg"
                    disabled={!userId || paying}
                    onClick={() => onPay('default')}
                  >
                    <Icon name="Gift" size={18} className="mr-2" />
                    {paying ? 'Активация...' : 'Активировать бесплатно'}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full border-2 border-[#1DB954] text-[#1DB954] hover:bg-[#1DB954]/10 dark:text-[#1DB954] font-semibold disabled:opacity-50"
                    disabled={!userId || paying || (autoRenew && !recurringConsent)}
                    onClick={() => onPay('sbp')}
                  >
                    {paying ? (
                      <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                    ) : (
                      <span className="mr-2 font-bold text-base leading-none">⚡</span>
                    )}
                    {paying ? 'Переход к оплате...' : 'Оплатить через СБП'}
                    {!paying && <span className="ml-2 text-xs text-muted-foreground font-normal">QR-код</span>}
                  </Button>
                )}

                <p className="text-center text-[11px] text-muted-foreground leading-snug pt-1">
                  Оплачивая, вы соглашаетесь с{' '}
                  <a href="/offer" target="_blank" className="underline hover:no-underline">офертой</a>,{' '}
                  <a href="/privacy-policy" target="_blank" className="underline hover:no-underline">политикой конфиденциальности</a>{' '}
                  и{' '}
                  <a href="/personal-data" target="_blank" className="underline hover:no-underline">согласием на обработку&nbsp;ПДн</a>
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscribeDialog;
