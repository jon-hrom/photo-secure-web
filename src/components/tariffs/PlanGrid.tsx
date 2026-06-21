import { Card, CardContent } from '@/components/ui/card';
import { Plan } from './types';
import PlanCard from './PlanCard';

interface PlanGridProps {
  plans: Plan[];
  currentPlanId: number | null;
  onSelectPlan: (plan: Plan) => void;
}

const PlanGrid = ({ plans, currentPlanId, onSelectPlan }: PlanGridProps) => {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Тарифные планы</h2>
          <p className="text-sm text-muted-foreground mt-1">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-start">
          {plans.map((plan) => (
            <PlanCard
              key={plan.plan_id}
              plan={plan}
              isCurrent={currentPlanId === plan.plan_id}
              onSelect={onSelectPlan}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default PlanGrid;
