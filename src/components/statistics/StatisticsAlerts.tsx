import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface AlertsData {
  unpaid_orders: {
    count: number;
    amount: number;
  };
  projects_without_date: number;
  overdue_bookings: number;
}

interface StatisticsAlertsProps {
  alerts: AlertsData;
  formatCurrency: (value: number) => string;
}

const StatisticsAlerts = ({ alerts, formatCurrency }: StatisticsAlertsProps) => {
  if (alerts.unpaid_orders.count === 0 && alerts.projects_without_date === 0 && alerts.overdue_bookings === 0) {
    return null;
  }

  return (
    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
          <Icon name="AlertTriangle" size={20} />
          Требуют внимания
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {alerts.unpaid_orders.count > 0 && (
            <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
              <Icon name="DollarSign" size={20} className="text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Неоплаченные заказы</p>
                <p className="text-2xl font-bold text-orange-600">{alerts.unpaid_orders.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(alerts.unpaid_orders.amount)}</p>
              </div>
            </div>
          )}

          {alerts.projects_without_date > 0 && (
            <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
              <Icon name="Calendar" size={20} className="text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Проекты без даты</p>
                <p className="text-2xl font-bold text-orange-600">{alerts.projects_without_date}</p>
                <p className="text-xs text-muted-foreground">Требуется установить дату</p>
              </div>
            </div>
          )}

          {alerts.overdue_bookings > 0 && (
            <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg">
              <Icon name="Clock" size={20} className="text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Просроченные брони</p>
                <p className="text-2xl font-bold text-orange-600">{alerts.overdue_bookings}</p>
                <p className="text-xs text-muted-foreground">Необходимо обработать</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatisticsAlerts;
