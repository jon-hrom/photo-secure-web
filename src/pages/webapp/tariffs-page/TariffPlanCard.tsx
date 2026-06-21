import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Plan, getPlanFeatures, getPlanIcon } from './types';

interface TariffPlanCardProps {
  plan: Plan;
  onSelect: (plan: Plan) => void;
}

const TariffPlanCard = ({ plan, onSelect }: TariffPlanCardProps) => {
  const features = getPlanFeatures(plan);
  const isPopular = plan.plan_name.toLowerCase().includes('проф');
  const icon = getPlanIcon(plan.plan_name);

  return (
    <Card 
      className={`relative bg-white dark:bg-gray-800 self-start ${
        isPopular ? 'ring-2 ring-primary shadow-lg' : 'shadow-md'
      }`}
    >
      {isPopular && (
        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary text-white px-2.5 py-0.5 rounded-full text-[10px] font-medium">
          Популярный
        </Badge>
      )}
      
      <CardHeader className="p-3 pb-1.5">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-md">
            <Icon name={icon} size={16} className="text-primary" />
          </div>
          <CardTitle className="text-base">{plan.plan_name}</CardTitle>
        </div>
        <CardDescription className="text-[11px] leading-tight">{plan.description}</CardDescription>
        
        <div className="mt-1.5 flex items-baseline gap-1">
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            {plan.price_rub === 0 ? 'Бесплатно' : `${Math.floor(plan.price_rub)} ₽`}
          </div>
          {plan.price_rub > 0 && (
            <div className="text-[11px] text-gray-600 dark:text-gray-400">/ месяц</div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-1.5">
        <ul className="space-y-1 mb-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-1.5">
              <Icon name="Check" size={14} className="text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-xs text-gray-700 dark:text-gray-300">{feature}</span>
            </li>
          ))}
        </ul>
        
        <Button 
          size="sm"
          className={`w-full h-8 text-xs ${isPopular ? 'bg-gradient-to-r from-primary to-secondary' : ''}`}
          variant={isPopular ? 'default' : 'outline'}
          onClick={() => onSelect(plan)}
        >
          {plan.price_rub === 0 ? 'Начать бесплатно' : 'Выбрать план'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default TariffPlanCard;
