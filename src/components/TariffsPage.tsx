import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plan } from './tariffs/types';
import PlanGrid from './tariffs/PlanGrid';
import SubscribeDialog from './tariffs/SubscribeDialog';
import { logClick } from '@/lib/activityLog';

interface TariffsPageProps {
  userId?: string | number | null;
}

const STORAGE_ADMIN_URL = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93e2-63032b5c552c';

const STORAGE_URL = 'https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985';

const TariffsPage = ({ userId }: TariffsPageProps) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoFinalPrice, setPromoFinalPrice] = useState<number>(0);
  const [promoDuration, setPromoDuration] = useState<number>(1);
  const [isApplying, setIsApplying] = useState(false);
  const [appliedPromoCode, setAppliedPromoCode] = useState<string>('');
  const [autoRenew, setAutoRenew] = useState(false);
  const [recurringConsent, setRecurringConsent] = useState(false);

  useEffect(() => {
    loadPlans();
    if (userId) {
      fetch(`${STORAGE_URL}?action=usage`, { headers: { 'X-User-Id': String(userId) } })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d?.plan_id) setCurrentPlanId(d.plan_id); })
        .catch(() => {});
    }

    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') {
      toast.success('Оплата прошла успешно! Тариф активирован.');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (payment === 'fail') {
      toast.error('Оплата не завершена. Попробуйте ещё раз.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [userId]);

  const loadPlans = async () => {
    try {
      // Загружаем без admin_key, т.к. это публичная страница
      const response = await fetch(`${STORAGE_ADMIN_URL}?action=list-plans&admin_key=public`);
      
      if (!response.ok) {
        toast.error('Не удалось загрузить тарифы');
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      // Фильтруем только активные тарифы для пользователей
      const activePlans = (data.plans || []).filter((p: Plan) => p.is_active);
      setPlans(activePlans);
    } catch (error) {
      toast.error('Ошибка загрузки тарифов');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    if (!userId) {
      toast.error('Войдите в систему, чтобы выбрать тариф');
      return;
    }

    setSelectedPlan(plan);
    setPromoDiscount(0);
    setPromoFinalPrice(plan.price_rub);
    setPromoDuration(1);
    setAutoRenew(false);
    setRecurringConsent(false);
    setIsPromoDialogOpen(true);
  };

  const handlePromoApplied = (discount: number, finalPrice: number, duration: number, code?: string) => {
    setPromoDiscount(discount);
    setPromoFinalPrice(finalPrice);
    setPromoDuration(duration);
    setAppliedPromoCode(code || '');
  };

  const handlePromoRemoved = () => {
    setPromoDiscount(0);
    setPromoFinalPrice(selectedPlan?.price_rub || 0);
    setPromoDuration(1);
    setAppliedPromoCode('');
  };

  const handleApplyTariff = async () => {
    if (!selectedPlan || !userId) return;

    // Сумма к оплате: с учётом промокода, если применён
    const amountToPay = promoDiscount > 0 ? promoFinalPrice : selectedPlan.price_rub * promoDuration;

    // Бесплатный тариф или полностью покрытый промокодом — применяем сразу
    if (amountToPay <= 0) {
      setIsApplying(true);
      try {
        const applyTariffUrl = 'https://functions.poehali.dev/7565304f-3423-48fd-a77c-95c59c65714d';
        const response = await fetch(applyTariffUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            plan_id: selectedPlan.plan_id,
            promo_code: appliedPromoCode,
            duration_months: promoDuration,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          toast.error(data.error || 'Ошибка применения тарифа');
          return;
        }
        toast.success(data.message || 'Тариф успешно применён!');
        setIsPromoDialogOpen(false);
        setTimeout(() => window.location.reload(), 2000);
      } catch (error) {
        toast.error('Ошибка применения тарифа');
      } finally {
        setIsApplying(false);
      }
      return;
    }

    // Платный тариф — создаём заказ в Робокассе и редиректим на оплату
    setIsApplying(true);
    try {
      const robokassaUrl = 'https://functions.poehali.dev/97e25c3b-c738-44e0-8922-87bbb4dc339d';

      logClick(
        `Оформление тарифа «${selectedPlan.plan_name}» — ${Math.floor(amountToPay)} ₽ / ${promoDuration} мес.${autoRenew ? ' (автопродление)' : ''}`,
        { plan_id: selectedPlan.plan_id, auto_renew: autoRenew, recurring_consent: recurringConsent },
      );

      // Логируем согласие на автосписания (в фоне, не блокируя переход)
      if (autoRenew && recurringConsent) {
        fetch(robokassaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log_consent',
            user_id: Number(userId),
            plan_id: selectedPlan.plan_id,
            plan_name: selectedPlan.plan_name,
            amount_rub: amountToPay,
            duration_months: promoDuration,
            consent_text: `Согласие на автосписание ${Math.floor(amountToPay)} ₽ каждые ${promoDuration} мес. Оферта п.5.5`,
          }),
        }).catch(() => {});
      }

      const response = await fetch(robokassaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: Number(userId),
          plan_id: selectedPlan.plan_id,
          duration_months: promoDuration,
          amount: amountToPay,
          auto_renew: autoRenew,
          success_url: `${window.location.origin}/tariffs?payment=success`,
          fail_url: `${window.location.origin}/tariffs?payment=fail`,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.payment_url) {
        toast.error(data.error || 'Не удалось создать оплату');
        return;
      }
      toast.success('Переходим к оплате...');
      window.location.href = data.payment_url;
    } catch (error) {
      toast.error('Ошибка при создании оплаты');
    } finally {
      setIsApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlanGrid
        plans={plans}
        currentPlanId={currentPlanId}
        onSelectPlan={handleSelectPlan}
      />

      <SubscribeDialog
        open={isPromoDialogOpen}
        onOpenChange={setIsPromoDialogOpen}
        selectedPlan={selectedPlan}
        userId={userId}
        promoDiscount={promoDiscount}
        promoFinalPrice={promoFinalPrice}
        promoDuration={promoDuration}
        isApplying={isApplying}
        autoRenew={autoRenew}
        recurringConsent={recurringConsent}
        setAutoRenew={setAutoRenew}
        setRecurringConsent={setRecurringConsent}
        onPromoApplied={handlePromoApplied}
        onPromoRemoved={handlePromoRemoved}
        onApplyTariff={handleApplyTariff}
      />
    </div>
  );
};

export default TariffsPage;