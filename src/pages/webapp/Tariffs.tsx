import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import MobileNavigation from '@/components/layout/MobileNavigation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PromoCodeInput } from '@/components/PromoCodeInput';

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

const STORAGE_ADMIN_URL = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93e2-63032b5c552c';

const Tariffs = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState<number>(0);
  const [promoFinalPrice, setPromoFinalPrice] = useState<number>(0);
  const [promoDuration, setPromoDuration] = useState<number>(1);
  const [userId, setUserId] = useState<number | null>(null);

  useEffect(() => {
    // Получаем userId из localStorage
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      setUserId(parseInt(storedUserId));
    }
    loadPlans();
  }, []);

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
    
    features.push(`${Math.floor(plan.max_clients)} ${plan.max_clients === 1 ? 'клиент' : plan.max_clients < 5 ? 'клиента' : 'клиентов'}`);
    features.push(`${Math.floor(plan.quota_gb)} ГБ хранилища`);
    
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

  const getPlanIcon = (planName: string): string => {
    const name = planName.toLowerCase();
    if (name.includes('старт') || name.includes('базов')) return 'Package';
    if (name.includes('проф')) return 'Zap';
    if (name.includes('бизнес')) return 'Crown';
    return 'Package';
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="gap-2 hover:bg-primary/10"
            >
              <Icon name="ArrowLeft" size={18} />
              Главная
            </Button>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Тарифные планы</h1>
            <p className="text-gray-600 dark:text-gray-300">Выберите подходящий план для вашего бизнеса</p>
          </div>
          
          {plans.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Нет доступных тарифов</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const features = getPlanFeatures(plan);
                const isPopular = plan.plan_name.toLowerCase().includes('проф');
                const icon = getPlanIcon(plan.plan_name);

                return (
                  <Card 
                    key={plan.plan_id}
                    className={`relative bg-white dark:bg-gray-800 ${
                      isPopular ? 'ring-2 ring-primary shadow-xl' : 'shadow-lg'
                    }`}
                  >
                    {isPopular && (
                      <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary text-white px-4 py-1 rounded-full text-sm font-medium">
                        Популярный
                      </Badge>
                    )}
                    
                    <CardHeader>
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-xl">
                          <Icon name={icon} size={24} className="text-primary" />
                        </div>
                        <CardTitle className="text-2xl">{plan.plan_name}</CardTitle>
                      </div>
                      <CardDescription className="text-base">{plan.description}</CardDescription>
                      
                      <div className="mt-6">
                        <div className="text-4xl font-bold text-gray-900 dark:text-white">
                          {plan.price_rub === 0 ? 'Бесплатно' : `${Math.floor(plan.price_rub)} ₽`}
                        </div>
                        {plan.price_rub > 0 && (
                          <div className="text-gray-600 dark:text-gray-400">в месяц</div>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      <ul className="space-y-3 mb-6">
                        {features.map((feature, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <Icon name="Check" size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <Button 
                        className={`w-full ${isPopular ? 'bg-gradient-to-r from-primary to-secondary' : ''}`}
                        variant={isPopular ? 'default' : 'outline'}
                        onClick={() => handleSelectPlan(plan)}
                      >
                        {plan.price_rub === 0 ? 'Начать бесплатно' : 'Выбрать план'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="mt-10 text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-4">Нужен индивидуальный план?</p>
            <Button variant="outline" className="gap-2">
              <Icon name="MessageCircle" size={18} />
              Связаться с нами
            </Button>
          </div>
        </div>
      </div>

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
                    onPromoApplied={handlePromoApplied}
                    onPromoRemoved={handlePromoRemoved}
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

                <Button 
                  className="w-full" 
                  size="lg"
                  disabled={!userId}
                  onClick={() => {
                    toast.success('Переход к оплате...');
                    // Здесь будет логика перехода к оплате
                  }}
                >
                  <Icon name="CreditCard" size={18} className="mr-2" />
                  Перейти к оплате
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <MobileNavigation />
    </>
  );
};

export default Tariffs;