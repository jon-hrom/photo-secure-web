import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { safeNumber, safeToFixed, StatisticsTabProps } from './statisticsShared';

const FinancialTab = ({ data, formatCurrency }: StatisticsTabProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Общий доход</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{formatCurrency(data.financial.total_revenue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Icon name={safeNumber(data.financial.revenue_growth) >= 0 ? 'TrendingUp' : 'TrendingDown'} size={16} className={safeNumber(data.financial.revenue_growth) >= 0 ? 'text-green-600' : 'text-red-600'} />
              <span className={safeNumber(data.financial.revenue_growth) >= 0 ? 'text-green-600' : 'text-red-600'}>
                {safeNumber(data.financial.revenue_growth) >= 0 ? '+' : ''}{safeToFixed(data.financial.revenue_growth, 1)}%
              </span>
              <span className="text-muted-foreground">к прошлому периоду</span>
            </div>
          </CardContent>
        </Card>

        <Card className={data.financial.refunds && data.financial.refunds.total > 0 ? 'border-green-200' : ''}>
          <CardHeader className="pb-2">
            <CardDescription>Чистый доход</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl text-green-600">{formatCurrency(data.financial.net_revenue ?? data.financial.total_revenue)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">За вычетом возвратов</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Средний чек</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{formatCurrency(data.financial.avg_check)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">На один проект</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="pb-2">
            <CardDescription>Неоплачено</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl text-orange-600">{formatCurrency(data.alerts.unpaid_orders.amount)}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{data.alerts.unpaid_orders.count} проектов</p>
          </CardContent>
        </Card>
      </div>

      {data.financial.refunds && data.financial.refunds.total > 0 && (
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="RotateCcw" size={18} className="text-orange-600" />
              Возвраты за период
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              <div className="p-3 sm:p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2">Сумма возвратов</p>
                <p className="text-2xl font-bold text-orange-600">{formatCurrency(data.financial.refunds.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">{data.financial.refunds.count} операций</p>
              </div>
              {data.financial.refunds.cancellations_count > 0 && (
                <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2">Аннулирования</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(data.financial.refunds.cancellations_total)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{data.financial.refunds.cancellations_count} отменённых заказов</p>
                </div>
              )}
              <div className="p-3 sm:p-4 bg-muted/50 rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-2">Доля возвратов</p>
                <p className="text-2xl font-bold">
                  {data.financial.total_revenue > 0
                    ? safeToFixed((data.financial.refunds.total / data.financial.total_revenue) * 100, 1)
                    : '0'}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">от общего дохода</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Методы оплаты</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.financial.by_method.map((method) => (
              <div key={method.method} className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">{method.method}</p>
                <p className="text-2xl font-bold">{formatCurrency(method.total)}</p>
                <p className="text-xs text-muted-foreground mt-1">{method.count} операций</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialTab;
