import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const SUBSCRIPTION_URL = 'https://functions.poehali.dev/fbfc26c3-5cb7-4b8f-aeb7-891bbf9a0015';

interface SubscriptionCardProps {
  userId: string | number | null;
}

interface Recurring {
  id: number;
  plan_id: number;
  duration_months: number;
  locked_price_rub: number;
  next_charge_at: string;
}

interface Subscription {
  plan_name: string | null;
  expires_at: string | null;
  locked_price_rub: number | null;
  duration_months: number | null;
}

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
};

const SubscriptionCard = ({ userId }: SubscriptionCardProps) => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [recurring, setRecurring] = useState<Recurring | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(SUBSCRIPTION_URL, { headers: { 'X-User-Id': String(userId) } });
      const data = await res.json();
      if (data.success) {
        setSubscription(data.subscription);
        setRecurring(data.recurring);
      }
    } catch {
      // тихо
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const cancelAutoRenew = async () => {
    if (!userId) return;
    setCancelling(true);
    try {
      const res = await fetch(SUBSCRIPTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': String(userId) },
        body: JSON.stringify({ action: 'cancel_auto_renew' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Автопродление отключено');
        setRecurring(null);
      } else {
        toast.error(data.error || 'Не удалось отключить автопродление');
      }
    } catch {
      toast.error('Ошибка сети');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground">
        <Icon name="Loader2" size={18} className="animate-spin mr-2" />
        Загрузка...
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="rounded-xl border p-4 space-y-3 bg-card text-sm">
        <div className="flex items-center gap-2">
          <Icon name="CreditCard" size={18} className="text-primary" />
          <span className="font-semibold">Подписка</span>
        </div>
        <div className="rounded-lg bg-muted/50 border p-3 text-muted-foreground flex items-center gap-2">
          <Icon name="Info" size={14} />
          У вас сейчас бесплатный тариф. Платная подписка не оформлена.
        </div>
        <Button
          className="w-full rounded-xl"
          onClick={() => { window.location.href = '/tariffs'; }}
        >
          <Icon name="Sparkles" size={16} className="mr-2" />
          Выбрать тариф
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4 space-y-3 bg-card">
      <div className="flex items-center gap-2">
        <Icon name="CreditCard" size={18} className="text-primary" />
        <span className="font-semibold">Подписка</span>
      </div>

      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between items-start gap-3">
          <span className="text-muted-foreground shrink-0">Тариф</span>
          <span className="font-medium text-right break-words min-w-0">{subscription.plan_name || '—'}</span>
        </div>
        <div className="flex justify-between items-start gap-3">
          <span className="text-muted-foreground shrink-0">Действует до</span>
          <span className="font-medium text-right break-words min-w-0">
            {subscription.expires_at ? formatDate(subscription.expires_at) : 'Бессрочно'}
          </span>
        </div>
        {subscription.locked_price_rub != null && (
          <div className="flex justify-between items-start gap-3">
            <span className="text-muted-foreground shrink-0">Цена периода</span>
            <span className="font-medium text-right shrink-0">{Math.floor(subscription.locked_price_rub)} ₽</span>
          </div>
        )}
      </div>

      {recurring ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3 text-sm">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
              <Icon name="RefreshCw" size={14} />
              Автопродление включено
            </div>
            <p className="text-muted-foreground mt-1">
              Следующее списание {Math.floor(recurring.locked_price_rub)} ₽ — {formatDate(recurring.next_charge_at)}.
              Уведомление придёт на email за 3 дня.
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full rounded-xl">
                <Icon name="X" size={16} className="mr-2" />
                Отключить автопродление
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Отключить автопродление?</AlertDialogTitle>
                <AlertDialogDescription>
                  Автоматические списания прекратятся. Доступ к тарифу сохранится
                  до конца уже оплаченного периода — {formatDate(subscription.expires_at)}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Оставить</AlertDialogCancel>
                <AlertDialogAction onClick={cancelAutoRenew} disabled={cancelling}>
                  {cancelling ? 'Отключаем...' : 'Отключить'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : (
        <div className="rounded-lg bg-muted/50 border p-3 text-sm text-muted-foreground flex items-center gap-2">
          <Icon name="Info" size={14} />
          Автопродление выключено
        </div>
      )}
    </div>
  );
};

export default SubscriptionCard;