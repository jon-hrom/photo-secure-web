import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Plan, getPlanFeatures } from './types';

interface PlanCardProps {
  plan: Plan;
  isCurrent: boolean;
  isDowngrade?: boolean;
  onSelect: (plan: Plan) => void;
}

const PlanCard = ({ plan, isCurrent, isDowngrade, onSelect }: PlanCardProps) => {
  const features = getPlanFeatures(plan);
  const isPopular = !isCurrent && (
    plan.plan_name.toLowerCase().includes('проф') ||
    plan.plan_name.toLowerCase().includes('бизнес')
  );

  return (
    <Card
      className={`relative self-start transition-all duration-200 ${
        isCurrent
          ? 'border-green-500 border-2 shadow-md shadow-green-100 dark:shadow-green-900/20'
          : isPopular
          ? 'border-primary border-2 shadow-md'
          : ''
      }`}
    >
      {isCurrent && (
        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-green-500 text-white flex items-center gap-1 text-[10px] px-2 py-0.5">
          <Icon name="CheckCircle" size={11} />
          Ваш текущий план
        </Badge>
      )}
      {isPopular && (
        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary text-[10px] px-2 py-0.5">
          Популярный
        </Badge>
      )}

      <CardHeader className="p-3 pb-1.5">
        <CardTitle className="text-base">{plan.plan_name}</CardTitle>
        <CardDescription className="text-[11px] leading-tight">{plan.description}</CardDescription>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-xl font-bold">
            {plan.price_rub === 0 ? 'Бесплатно' : `${Math.floor(plan.price_rub)} ₽`}
          </span>
          {plan.price_rub > 0 && (
            <span className="text-[11px] text-muted-foreground">/ месяц</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1.5 space-y-3">
        <ul className="space-y-1">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <Icon name="Check" size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs">{feature}</span>
            </li>
          ))}
        </ul>

        {isCurrent ? (
          <Button size="sm" className="w-full h-8 text-xs bg-green-500 hover:bg-green-600 text-white cursor-default" disabled>
            <Icon name="CheckCircle" size={14} className="mr-1.5" />
            Активный тариф
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={() => onSelect(plan)}
          >
            {plan.price_rub === 0
              ? (isDowngrade ? 'Применить (бесплатно)' : 'Начать бесплатно')
              : 'Выбрать тариф'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanCard;