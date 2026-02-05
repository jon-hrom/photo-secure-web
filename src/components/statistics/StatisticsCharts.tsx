import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';

const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

// Кастомный тултип для темной темы
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
      {label && <p className="text-sm font-medium text-foreground mb-2">{label}</p>}
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-muted-foreground">{entry.name}:</span>
          <span className="text-sm font-semibold text-foreground">
            {formatter ? formatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

interface StatisticsData {
  period: string;
  date_range: {
    start: string | null;
    end: string | null;
  };
  general: {
    clients: {
      total: number;
      new: number;
      growth: number;
    };
    projects: {
      total: number;
      new: number;
      completed: number;
      completion_rate: number;
    };
    bookings: {
      total: number;
      new: number;
    };
  };
  clients: {
    total_clients: number;
    new_clients: number;
    returning_clients: number;
    returning_rate: number;
    one_time_clients: number;
  };
  projects: {
    by_category: Array<{ category: string; count: number; revenue: number }>;
    by_status: Array<{ status: string; count: number }>;
  };
  financial: {
    total_revenue: number;
    prev_revenue: number;
    revenue_growth: number;
    avg_check: number;
    pending: {
      amount: number;
      count: number;
    };
    by_method: Array<{ method: string; count: number; total: number }>;
  };
  charts: {
    projects_timeline: Array<{ period: string; count: number }>;
    revenue_timeline: Array<{ period: string; revenue: number }>;
    clients_timeline: Array<{ period: string; count: number }>;
  };
  tops: {
    top_clients: Array<{
      id: number;
      name: string;
      phone: string;
      total_spent: number;
      projects_count: number;
    }>;
    top_projects: Array<{
      id: number;
      project_name: string;
      client_name: string;
      total_amount: number;
      status: string;
      created_at: string;
    }>;
  };
  alerts: {
    unpaid_orders: {
      count: number;
      amount: number;
    };
    projects_without_date: number;
    overdue_bookings: number;
  };
}

interface StatisticsChartsProps {
  data: StatisticsData;
  formatCurrency: (value: number) => string;
  formatDate: (dateStr: string) => string;
}

const StatisticsCharts = ({ data, formatCurrency, formatDate }: StatisticsChartsProps) => {
  const safeNumber = (value: any): number => {
    const num = Number(value);
    return isNaN(num) || !isFinite(num) ? 0 : num;
  };

  const safeToFixed = (value: any, digits: number = 1): string => {
    return safeNumber(value).toFixed(digits);
  };

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="overview">Обзор</TabsTrigger>
        <TabsTrigger value="clients">Клиенты</TabsTrigger>
        <TabsTrigger value="projects">Проекты</TabsTrigger>
        <TabsTrigger value="financial">Финансы</TabsTrigger>
        <TabsTrigger value="tops">Топы</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Клиенты</CardDescription>
              <CardTitle className="text-3xl">{data.general.clients.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Icon name={data.general.clients.growth >= 0 ? 'TrendingUp' : 'TrendingDown'} size={16} className={data.general.clients.growth >= 0 ? 'text-green-600' : 'text-red-600'} />
                <span className={safeNumber(data.general.clients.growth) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {safeNumber(data.general.clients.growth) >= 0 ? '+' : ''}{safeToFixed(data.general.clients.growth, 1)}%
                </span>
                <span className="text-muted-foreground">новых: {data.general.clients.new}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Проекты</CardDescription>
              <CardTitle className="text-3xl">{data.general.projects.total}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Icon name="CheckCircle" size={16} className="text-green-600" />
                <span className="text-muted-foreground">
                  завершено: {data.general.projects.completed} ({safeToFixed(data.general.projects.completion_rate, 0)}%)
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Доход</CardDescription>
              <CardTitle className="text-3xl">{formatCurrency(data.financial.total_revenue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Icon name={data.financial.revenue_growth >= 0 ? 'TrendingUp' : 'TrendingDown'} size={16} className={data.financial.revenue_growth >= 0 ? 'text-green-600' : 'text-red-600'} />
                <span className={data.financial.revenue_growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {data.financial.revenue_growth >= 0 ? '+' : ''}{data.financial.revenue_growth.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Средний чек</CardDescription>
              <CardTitle className="text-3xl">{formatCurrency(data.financial.avg_check)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Icon name="DollarSign" size={16} className="text-blue-600" />
                <span className="text-muted-foreground">на проект</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Динамика проектов</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.charts.projects_timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="count" fill="#8B5CF6" name="Проекты" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Динамика доходов</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.charts.revenue_timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip formatter={(value: number) => formatCurrency(value)} />} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#EC4899" strokeWidth={2} name="Доход" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Новые клиенты</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data.charts.clients_timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line type="monotone" dataKey="count" stroke="#10B981" strokeWidth={2} name="Клиенты" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Проекты по категориям</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.projects.by_category}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ category, count }) => `${category}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {data.projects.by_category.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="clients" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Всего клиентов</CardDescription>
              <CardTitle className="text-3xl">{data.clients.total_clients}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Общая клиентская база</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Новые клиенты</CardDescription>
              <CardTitle className="text-3xl">{data.clients.new_clients}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">За выбранный период</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Постоянные клиенты</CardDescription>
              <CardTitle className="text-3xl">{data.clients.returning_clients}</CardTitle>
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
              <CardTitle className="text-3xl">{data.clients.one_time_clients}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Потенциал для развития</p>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="projects" className="space-y-6">
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
      </TabsContent>

      <TabsContent value="financial" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Общий доход</CardDescription>
              <CardTitle className="text-3xl">{formatCurrency(data.financial.total_revenue)}</CardTitle>
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

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Средний чек</CardDescription>
              <CardTitle className="text-3xl">{formatCurrency(data.financial.avg_check)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">На один проект</p>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="pb-2">
              <CardDescription>Неоплачено</CardDescription>
              <CardTitle className="text-3xl text-orange-600">{formatCurrency(data.financial.pending.amount)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{data.financial.pending.count} заказов</p>
            </CardContent>
          </Card>
        </div>

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
      </TabsContent>

      <TabsContent value="tops" className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>ТОП-5 клиентов по доходу</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.tops.top_clients.map((client, index) => (
                  <div key={client.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{client.name}</p>
                      <p className="text-sm text-muted-foreground">{client.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatCurrency(client.total_spent)}</p>
                      <p className="text-xs text-muted-foreground">{client.projects_count} проектов</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>ТОП-5 проектов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.tops.top_projects.map((project, index) => (
                  <div key={project.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary text-secondary-foreground font-bold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{project.project_name}</p>
                      <p className="text-sm text-muted-foreground">{project.client_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{formatCurrency(project.total_amount)}</p>
                      <p className="text-xs text-muted-foreground">{project.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
};

export default StatisticsCharts;