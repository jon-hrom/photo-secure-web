import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MobileNavigation from '@/components/layout/MobileNavigation';
import LegalFooter from '@/components/legal/LegalFooter';
import { toast } from 'sonner';
import { Plan, ResumablePaid, ROBOKASSA_URL, APPLY_TARIFF_URL, STORAGE_ADMIN_URL, SUBSCRIPTION_URL } from './tariffs-page/types';
import TariffsGrid from './tariffs-page/TariffsGrid';
import SubscribeDialog from './tariffs-page/SubscribeDialog';
import ResumePaidBanner from './tariffs-page/ResumePaidBanner';
import DowngradeConfirmDialog from './tariffs-page/DowngradeConfirmDialog';

const Tariffs = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoFinalPrice, setPromoFinalPrice] = useState<number>(0);
  const [promoDuration, setPromoDuration] = useState<number>(1);
  const [promoCode, setPromoCode] = useState<string>('');
  const [userId, setUserId] = useState<number | null>(null);
  const [autoRenew, setAutoRenew] = useState<boolean>(true);
  const [recurringConsent, setRecurringConsent] = useState<boolean>(false);
  const [paying, setPaying] = useState<boolean>(false);
  const [currentPlanId, setCurrentPlanId] = useState<number | null>(null);
  const [resumablePaid, setResumablePaid] = useState<ResumablePaid | null>(null);
  const [resuming, setResuming] = useState<boolean>(false);
  const [isDowngradeOpen, setIsDowngradeOpen] = useState<boolean>(false);
  const [downgradePlan, setDowngradePlan] = useState<Plan | null>(null);
  const [downgrading, setDowngrading] = useState<boolean>(false);

  useEffect(() => {
    // Получаем userId из localStorage
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      const uid = parseInt(storedUserId);
      setUserId(uid);
      loadSubscription(uid);
    }
    loadPlans();
  }, []);

  const loadSubscription = async (uid: number) => {
    try {
      const response = await fetch(SUBSCRIPTION_URL, {
        headers: { 'X-User-Id': String(uid) },
      });
      if (!response.ok) return;
      const data = await response.json();
      setCurrentPlanId(data.current_plan_id ?? null);
      setResumablePaid(data.resumable_paid ?? null);
    } catch {
      // не критично
    }
  };

  const loadPlans = async () => {
    try {
      const response = await fetch(`${STORAGE_ADMIN_URL}?action=list-plans&admin_key=public`);
      
      if (!response.ok) {
        toast.error('Не удалось загрузить тарифы');
        setLoading(false);
        return;
      }

      const data = await response.json();
      const activePlans = (data.plans || []).filter((p: Plan) => p.is_active);
      setPlans(activePlans);
    } catch (error) {
      toast.error('Ошибка загрузки тарифов');
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = plans.find((p) => p.plan_id === currentPlanId) || null;
  const isOnPaidPlan = !!(currentPlan && currentPlan.price_rub > 0);

  const handleSelectPlan = (plan: Plan) => {
    if (!userId) {
      toast.error('Войдите в систему, чтобы выбрать тариф');
      return;
    }

    // Переход на бесплатный тариф, когда пользователь сейчас на платном — с подтверждением
    if (plan.price_rub === 0 && isOnPaidPlan) {
      setDowngradePlan(plan);
      setIsDowngradeOpen(true);
      return;
    }

    setSelectedPlan(plan);
    setPromoDiscount(0);
    setPromoFinalPrice(plan.price_rub);
    setPromoDuration(1);
    setPromoCode('');
    setAutoRenew(false);
    setRecurringConsent(false);
    setIsPromoDialogOpen(true);
  };

  const handleConfirmDowngrade = async () => {
    if (!userId || !downgradePlan) return;
    setDowngrading(true);
    try {
      const response = await fetch(APPLY_TARIFF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          plan_id: downgradePlan.plan_id,
          promo_code: '',
          duration_months: 1,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(data.message || 'Вы перешли на бесплатный тариф');
        setIsDowngradeOpen(false);
        setDowngradePlan(null);
        await loadSubscription(userId);
        setTimeout(() => navigate('/tariffs?payment=success'), 800);
      } else {
        toast.error(data.error || 'Не удалось переключить тариф');
        setDowngrading(false);
      }
    } catch {
      toast.error('Ошибка переключения тарифа');
      setDowngrading(false);
    }
  };

  const handleResumePaid = async () => {
    if (!userId || !resumablePaid) return;
    setResuming(true);
    try {
      const response = await fetch(APPLY_TARIFF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume',
          user_id: userId,
          plan_id: resumablePaid.plan_id,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(data.message || 'Тариф восстановлен');
        await loadSubscription(userId);
        setTimeout(() => navigate('/tariffs?payment=success'), 800);
      } else {
        toast.error(data.error || 'Не удалось вернуть тариф');
        setResuming(false);
      }
    } catch {
      toast.error('Ошибка возврата тарифа');
      setResuming(false);
    }
  };

  const handleFreeActivation = async () => {
    if (!userId || !selectedPlan) return;
    setPaying(true);
    try {
      const response = await fetch(APPLY_TARIFF_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          plan_id: selectedPlan.plan_id,
          promo_code: promoCode,
          duration_months: promoDuration,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success(data.message || 'Тариф успешно активирован!');
        setIsPromoDialogOpen(false);
        setTimeout(() => navigate('/tariffs?payment=success'), 800);
      } else {
        toast.error(data.error || 'Не удалось активировать тариф');
        setPaying(false);
      }
    } catch {
      toast.error('Ошибка активации тарифа');
      setPaying(false);
    }
  };

  const handlePay = async (paymentMethod: 'default' | 'sbp' = 'default') => {
    if (!userId || !selectedPlan) return;
    if (promoFinalPrice <= 0) {
      await handleFreeActivation();
      return;
    }
    setPaying(true);
    try {
      // Логируем согласие на рекуррентные платежи параллельно (не блокируя редирект)
      if (autoRenew && recurringConsent) {
        fetch(ROBOKASSA_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'log_consent',
            user_id: userId,
            plan_id: selectedPlan.plan_id,
            plan_name: selectedPlan.plan_name,
            amount_rub: promoFinalPrice,
            duration_months: promoDuration,
            consent_text: `Согласие на автосписание ${Math.floor(promoFinalPrice)} ₽ каждые ${promoDuration} мес. Оферта п.5.5`,
          }),
        }).catch(() => {});
      }

      const origin = window.location.origin;
      const body: Record<string, unknown> = {
        order_type: 'tariff',
        user_id: userId,
        plan_id: selectedPlan.plan_id,
        duration_months: promoDuration,
        amount: promoFinalPrice,
        auto_renew: autoRenew,
        success_url: `${origin}/tariffs?payment=success`,
        fail_url: `${origin}/tariffs?payment=fail`,
      };
      if (paymentMethod === 'sbp') body.payment_method = 'sbp';
      const response = await fetch(ROBOKASSA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        toast.error(data.error || 'Не удалось создать платёж');
        setPaying(false);
      }
    } catch {
      toast.error('Ошибка перехода к оплате');
      setPaying(false);
    }
  };

  const handlePromoApplied = (discount: number, finalPrice: number, duration: number, code?: string) => {
    setPromoDiscount(discount);
    setPromoFinalPrice(finalPrice);
    setPromoDuration(duration);
    setPromoCode(code || '');
  };

  const handlePromoRemoved = () => {
    setPromoDiscount(0);
    setPromoFinalPrice(selectedPlan?.price_rub || 0);
    setPromoDuration(1);
    setPromoCode('');
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground">Загрузка тарифов...</p>
          </div>
        </div>
        <MobileNavigation />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-4 sm:py-6">
        {resumablePaid && (
          <ResumePaidBanner
            resumable={resumablePaid}
            resuming={resuming}
            onResume={handleResumePaid}
          />
        )}
        <TariffsGrid
          plans={plans}
          onSelectPlan={handleSelectPlan}
          onNavigateHome={() => navigate('/')}
        />
      </div>

      <LegalFooter />

      <SubscribeDialog
        open={isPromoDialogOpen}
        onOpenChange={setIsPromoDialogOpen}
        selectedPlan={selectedPlan}
        userId={userId}
        promoDiscount={promoDiscount}
        promoFinalPrice={promoFinalPrice}
        promoDuration={promoDuration}
        autoRenew={autoRenew}
        recurringConsent={recurringConsent}
        paying={paying}
        setAutoRenew={setAutoRenew}
        setRecurringConsent={setRecurringConsent}
        onPromoApplied={handlePromoApplied}
        onPromoRemoved={handlePromoRemoved}
        onPay={handlePay}
      />

      <DowngradeConfirmDialog
        open={isDowngradeOpen}
        onOpenChange={(o) => { setIsDowngradeOpen(o); if (!o) setDowngrading(false); }}
        freePlan={downgradePlan}
        paidPlanName={currentPlan?.plan_name}
        paidExpiresAt={resumablePaid?.expires_at}
        processing={downgrading}
        onConfirm={handleConfirmDowngrade}
      />

      <MobileNavigation />
    </>
  );
};

export default Tariffs;