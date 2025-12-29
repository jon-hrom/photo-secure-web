import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PromoCodeInput } from './PromoCodeInput';

interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  max_clients: number;
  description: string;
  is_active: boolean;
  stats_enabled: boolean;
  track_storage_usage: boolean;
  track_client_count: boolean;
  track_booking_analytics: boolean;
  track_revenue: boolean;
  track_upload_history: boolean;
  track_download_stats: boolean;
}

interface TariffsPageProps {
  userId?: number;
}

const STORAGE_ADMIN_URL = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93e2-63032b5c552c';

const TariffsPage = ({ userId }: TariffsPageProps) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoFinalPrice, setPromoFinalPrice] = useState<number>(0);
  const [promoDuration, setPromoDuration] = useState<number>(1);

  useEffect(() => {
    loadPlans();
  }, []);

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
    setIsPromoDialogOpen(true);
  };

  const handlePromoApplied = (discount: number, finalPrice: number, duration: number) => {
    setPromoDiscount(discount);
    setPromoFinalPrice(finalPrice);
    setPromoDuration(duration);
  };

  const handlePromoRemoved = () => {
    setPromoDiscount(0);
    setPromoFinalPrice(selectedPlan?.price_rub || 0);
    setPromoDuration(1);
  };

  const getPlanFeatures = (plan: Plan): string[] => {
    const features: string[] = [];
    
    features.push(`${plan.max_clients} ${plan.max_clients === 1 ? 'клиент' : 'клиентов'}`);
    features.push(`${plan.quota_gb} GB хранилища`);
    
    if (plan.stats_enabled) {
      features.push('Статистика и аналитика');
    }
    if (plan.track_booking_analytics) {
      features.push('Аналитика бронирований');
    }
    if (plan.track_revenue) {
      features.push('Отслеживание доходов');
    }
    if (plan.track_upload_history) {
      features.push('История загрузок');
    }
    if (plan.track_download_stats) {
      features.push('Статистика скачиваний');
    }
    
    return features;
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Тарифные планы</h2>
          <p className="text-muted-foreground mt-2">
            Выберите подходящий тариф для вашего бизнеса
          </p>
        </div>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Нет доступных тарифов</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const features = getPlanFeatures(plan);
            const isPopular = plan.plan_name.toLowerCase().includes('проф') || 
                             plan.plan_name.toLowerCase().includes('бизнес');

            return (
              <Card 
                key={plan.plan_id} 
                className={`relative ${isPopular ? 'border-primary border-2 shadow-lg' : ''}`}
              >
                {isPopular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                    Популярный
                  </Badge>
                )}
                
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.plan_name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">
                      {plan.price_rub === 0 ? 'Бесплатно' : `${plan.price_rub} ₽`}
                    </span>
                    {plan.price_rub > 0 && (
                      <span className="text-muted-foreground ml-2">/ месяц</span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Icon name="Check" size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    className="w-full"
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {plan.price_rub === 0 ? 'Начать бесплатно' : 'Выбрать тариф'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isPromoDialogOpen} onOpenChange={setIsPromoDialogOpen}>
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
                    <span>{selectedPlan.quota_gb} GB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Макс. клиентов:</span>
                    <span>{selectedPlan.max_clients}</span>
                  </div>
                </div>

                {userId && (
                  <PromoCodeInput
                    planId={selectedPlan.plan_id}
                    userId={userId}
                    originalPrice={selectedPlan.price_rub}
                    onPromoApplied={handlePromoApplied}
                    onPromoRemoved={handlePromoRemoved}
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
                        {selectedPlan.price_rub} ₽
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Срок подписки: 1 месяц
                    </p>
                  </div>
                )}

                {selectedPlan.price_rub === 0 && (
                  <Button className="w-full" size="lg">
                    <Icon name="Check" className="mr-2 h-5 w-5" />
                    Активировать бесплатный тариф
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TariffsPage;