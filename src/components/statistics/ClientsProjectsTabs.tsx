import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { COLORS, safeToFixed, StatisticsTabProps } from './statisticsShared';
import { getShootingStyles } from '@/data/shootingStyles';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новые',
  in_progress: 'В работе',
  completed: 'Завершённые',
  cancelled: 'Отменённые',
};

const getStatusLabel = (status: string) => STATUS_LABELS[status] || status;

const getCategoryLabel = (category: string) => {
  if (!category || category === 'Не указано') return 'Не указано';
  const style = getShootingStyles().find((s) => s.id === category);
  return style ? style.name : category;
};

const getCategoryColor = (category: string) => {
  if (!category || category === 'Не указано') return '#9CA3AF';
  const num = parseInt(category, 10);
  const idx = Number.isNaN(num) ? category.length : num;
  return COLORS[idx % COLORS.length];
};

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
                  <span className="font-medium">{getStatusLabel(item.status)}</span>
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
              {data.projects.by_category.map((item) => (
                <div key={item.category} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getCategoryColor(item.category) }} />
                    <span className="font-medium">{getCategoryLabel(item.category)}</span>
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