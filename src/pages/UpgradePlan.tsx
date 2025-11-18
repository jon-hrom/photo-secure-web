import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Icon from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';

const STORAGE_API = 'https://functions.poehali.dev/1fc7f0b4-e29b-473f-be56-8185fa395985';

interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  is_active: boolean;
  features?: string[];
}

interface CurrentPlan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  used_gb: number;
  percent: number;
}

const UpgradePlan = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string>('');
  const [showImageUpload, setShowImageUpload] = useState(false);
  const { toast } = useToast();

  const userId = localStorage.getItem('userId') || '1';

  useEffect(() => {
    const savedBg = localStorage.getItem('upgradePlanBackground');
    if (savedBg) {
      setBackgroundImage(savedBg);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
    fetchCurrentPlan();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${STORAGE_API}?action=list-plans`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setPlans(data.plans || []);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось загрузить тарифы',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPlan = async () => {
    try {
      const res = await fetch(`${STORAGE_API}?action=usage`, {
        headers: { 'X-User-Id': userId }
      });
      const data = await res.json();
      setCurrentPlan({
        plan_id: data.plan_id || 1,
        plan_name: data.plan_name || 'Старт',
        quota_gb: data.limitGb,
        used_gb: data.usedGb,
        percent: data.percent
      });
    } catch (error) {
      console.error('Failed to fetch current plan:', error);
    }
  };

  const handleSelectPlan = (plan: Plan) => {
    toast({
      title: 'Выбран тариф',
      description: `${plan.plan_name} - ${plan.quota_gb} ГБ за ${plan.price_rub}₽/мес`,
    });
  };

  const getFeatures = (quota: number): string[] => {
    const features = [
      `${quota} ГБ хранилища`,
      'Безлимитная загрузка файлов',
      'Защищённое хранение',
    ];

    if (quota >= 20) features.push('Приоритетная поддержка');
    if (quota >= 100) features.push('API доступ');
    if (quota >= 300) features.push('Выделенный сервер', 'SLA 99.9%');

    return features;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string;
      setBackgroundImage(imageUrl);
      localStorage.setItem('upgradePlanBackground', imageUrl);
      toast({
        title: 'Фон обновлён',
        description: 'Фоновое изображение успешно установлено'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = () => {
    setBackgroundImage('');
    localStorage.removeItem('upgradePlanBackground');
    toast({
      title: 'Фон удалён',
      description: 'Фоновое изображение удалено'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icon name="Loader2" className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen p-6 relative"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {backgroundImage && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      )}
      
      <div className="relative z-10 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-center flex-1 space-y-2">
            <h1 className="text-4xl font-bold">Выберите тариф</h1>
            <p className="text-muted-foreground text-lg">
              Увеличьте объём хранилища и получите больше возможностей
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => document.getElementById('bgUpload')?.click()}
              title="Загрузить фоновое изображение"
            >
              <Icon name="ImagePlus" size={20} />
            </Button>
            {backgroundImage && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleRemoveBackground}
                title="Удалить фон"
              >
                <Icon name="X" size={20} />
              </Button>
            )}
          </div>
          <input
            id="bgUpload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
        </div>

        {currentPlan && (
          <Card className="border-primary bg-card/95 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Icon name="Info" size={20} />
                Текущий тариф
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{currentPlan.plan_name}</p>
                  <p className="text-muted-foreground">
                    Использовано: {currentPlan.used_gb.toFixed(2)} ГБ из {currentPlan.quota_gb} ГБ
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-3xl font-bold ${currentPlan.percent > 80 ? 'text-destructive' : 'text-primary'}`}>
                    {currentPlan.percent.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">заполнено</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isCurrent = currentPlan?.plan_id === plan.plan_id;
            const isUpgrade = currentPlan && plan.quota_gb > currentPlan.quota_gb;
            const features = getFeatures(plan.quota_gb);

            return (
              <Card
                key={plan.plan_id}
                className={`relative transition-all hover:shadow-xl bg-card/95 backdrop-blur-sm ${
                  isCurrent ? 'border-primary border-2' : isUpgrade ? 'border-green-500' : ''
                }`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Текущий
                  </Badge>
                )}
                {isUpgrade && !isCurrent && (
                  <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white">
                    Рекомендуем
                  </Badge>
                )}
                
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.plan_name}</CardTitle>
                  <CardDescription>
                    <span className="text-4xl font-bold text-foreground">{plan.price_rub}₽</span>
                    <span className="text-muted-foreground">/мес</span>
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="text-center py-4 border-y">
                    <div className="text-3xl font-bold">{plan.quota_gb} ГБ</div>
                    <p className="text-sm text-muted-foreground">хранилища</p>
                  </div>

                  <ul className="space-y-3">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Icon name="Check" size={18} className="text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : isUpgrade ? 'default' : 'secondary'}
                    disabled={isCurrent}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {isCurrent ? (
                      'Ваш тариф'
                    ) : (
                      <>
                        <Icon name="Zap" size={18} className="mr-2" />
                        Выбрать
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-muted/90 backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Icon name="HelpCircle" size={24} className="text-primary mt-1" />
              <div>
                <h3 className="font-semibold mb-2">Нужна помощь с выбором?</h3>
                <p className="text-sm text-muted-foreground">
                  Обратитесь в нашу поддержку, и мы поможем подобрать оптимальный тариф для ваших задач.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpgradePlan;