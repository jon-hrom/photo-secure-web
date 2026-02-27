import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { COLORS, safeToFixed, StatisticsTabProps } from './statisticsShared';

export const ClientsTab = ({ data }: StatisticsTabProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Всего клиентов</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{data.clients.total_clients}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Общая клиентская база</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Новые клиенты</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{data.clients.new_clients}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">За выбранный период</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Постоянные клиенты</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{data.clients.returning_clients}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Icon name="Repeat" size={16} className="text-green-600" />
              <span className="text-green-600">{safeToFixed(data.clients.returning_rate, 1)}% возвращаемость</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Разовые клиенты</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{data.clients.one_time_clients}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Потенциал для развития</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export const ProjectsTab = ({ data, formatCurrency }: StatisticsTabProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Проекты по статусам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.projects.by_status.map((item) => (
                <div key={item.status} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium">{item.status}</span>
                  <span className="text-2xl font-bold text-primary">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Проекты по категориям</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.projects.by_category.map((item, index) => (
                <div key={item.category} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="font-medium">{item.category}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{item.count}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
