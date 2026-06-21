import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Plan } from './types';
import TariffPlanCard from './TariffPlanCard';

interface TariffsGridProps {
  plans: Plan[];
  onSelectPlan: (plan: Plan) => void;
  onNavigateHome: () => void;
}

const TariffsGrid = ({ plans, onSelectPlan, onNavigateHome }: TariffsGridProps) => {
  return (
    <div className="w-full mx-auto px-2 sm:px-4 lg:px-6 xl:px-8 2xl:px-12">
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigateHome}
          className="gap-2 hover:bg-primary/10"
        >
          <Icon name="ArrowLeft" size={16} />
          Главная
        </Button>
      </div>

      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1.5">Тарифные планы</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">Выберите подходящий план для вашего бизнеса</p>
      </div>
      
      {plans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Нет доступных тарифов</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-6xl mx-auto items-start">
          {plans.map((plan) => (
            <TariffPlanCard
              key={plan.plan_id}
              plan={plan}
              onSelect={onSelectPlan}
            />
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Нужен индивидуальный план?</p>
        <Button variant="outline" size="sm" className="gap-2">
          <Icon name="MessageCircle" size={16} />
          Связаться с нами
        </Button>
      </div>
    </div>
  );
};

export default TariffsGrid;
