import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import Icon from '@/components/ui/icon';

const STORAGE_API = 'https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985';

interface StorageUsage {
  usedGb: number;
  limitGb: number;
  percent: number;
  remainingGb: number;
  warning: boolean;
  plan_name?: string;
  plan_id?: number;
}

interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  is_active: boolean;
}

const StorageWarning = () => {
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [upgradeDissmissed, setUpgradeDismissed] = useState(false);
  const [nextPlan, setNextPlan] = useState<Plan | null>(null);
  const userId = localStorage.getItem('userId') || '1';

  useEffect(() => {
    fetchUsage();
    const dismissedKey = 'storageWarningDismissed';
    const isDismissed = localStorage.getItem(dismissedKey);
    const upgradeKey = 'upgradeWarningDismissed';
    const isUpgradeDismissed = localStorage.getItem(upgradeKey);
    if (isDismissed) {
      setDismissed(true);
    }
    if (isUpgradeDismissed) {
      setUpgradeDismissed(true);
    }
  }, []);

  const fetchUsage = async () => {
    try {
      const res = await fetch(`${STORAGE_API}?action=usage`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setUsage(data);
      
      // Если заполнено 90%+, найти следующий тариф
      if (data.percent >= 90 && data.plan_id) {
        const plansRes = await fetch(`${STORAGE_API}?action=list-plans`);
        const plansData = await plansRes.json();
        const plans = plansData.plans || [];
        
        // Найти следующий тариф с большей квотой
        const currentPlanIndex = plans.findIndex((p: Plan) => p.plan_id === data.plan_id);
        if (currentPlanIndex >= 0 && currentPlanIndex < plans.length - 1) {
          setNextPlan(plans[currentPlanIndex + 1]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch storage usage:', error);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('storageWarningDismissed', 'true');
  };
  
  const handleUpgradeDismiss = () => {
    setUpgradeDismissed(true);
    localStorage.setItem('upgradeWarningDismissed', 'true');
  };

  if (!usage || usage.percent < 90 || dismissed) {
    return null;
  }

  // Показать предложение обновиться, если есть следующий тариф
  if (nextPlan && !upgradeDissmissed) {
    return (
      <Alert className="bg-blue-50 border-blue-500 relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={handleUpgradeDismiss}
        >
          <Icon name="X" size={16} />
        </Button>
        <Icon name="TrendingUp" className="h-5 w-5 text-blue-600" />
        <AlertTitle className="text-blue-800 font-semibold">
          Рекомендуем перейти на «{nextPlan.plan_name}»
        </AlertTitle>
        <AlertDescription className="text-blue-700">
          Вы использовали {(usage.percent || 0).toFixed(1)}% хранилища ({(usage.usedGb || 0).toFixed(2)} ГБ из {(usage.limitGb || 5).toFixed(0)} ГБ). 
          Тариф «{nextPlan.plan_name}» даст вам {nextPlan.quota_gb} ГБ за {nextPlan.price_rub} ₽/мес.
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="default">
              Перейти на {nextPlan.plan_name}
            </Button>
            <Button size="sm" variant="outline" onClick={handleUpgradeDismiss}>
              Потом
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Обычное предупреждение
  return (
    <Alert className="bg-orange-50 border-orange-500 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={handleDismiss}
      >
        <Icon name="X" size={16} />
      </Button>
      <Icon name="AlertTriangle" className="h-5 w-5 text-orange-600" />
      <AlertTitle className="text-orange-800 font-semibold">
        Хранилище заканчивается
      </AlertTitle>
      <AlertDescription className="text-orange-700">
        Использовано {(usage.usedGb || 0).toFixed(2)} ГБ из {(usage.limitGb || 5).toFixed(0)} ГБ ({(usage.percent || 0).toFixed(1)}%).
        Осталось только {(usage.remainingGb || 0).toFixed(2)} ГБ свободного места.
        <div className="mt-3 text-sm">
          Обратитесь к администратору для увеличения лимита хранилища.
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default StorageWarning;