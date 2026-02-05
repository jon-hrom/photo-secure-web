import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
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
} from 'recharts';

const STATISTICS_API = 'https://functions.poehali.dev/459209b2-e3b0-4b54-a6cf-cda0b74e4f3f';

const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

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

const StatisticsPage = () => {
  const { toast } = useToast();
  const userId = localStorage.getItem('userId');
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<string>('month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [data, setData] = useState<StatisticsData | null>(null);

  const fetchStatistics = async () => {
    if (!userId) {
      toast({
        title: 'Ошибка',
        description: 'Необходимо войти в систему',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      let url = `${STATISTICS_API}?period=${period}`;
      if (period === 'custom' && customStartDate && customEndDate) {
        url += `&start_date=${customStartDate}&end_date=${customEndDate}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-User-Id': userId,
        },
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || 'Ошибка загрузки статистики');
      }

      setData(result);
    } catch (error: any) {
      console.error('[STATISTICS] Error:', error);
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, [period]);

  const handleCustomPeriodApply = () => {
    if (!customStartDate || !customEndDate) {
      toast({
        title: 'Ошибка',
        description: 'Укажите начальную и конечную даты',
        variant: 'destructive',
      });
      return;
    }
    fetchStatistics();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
    });
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Загрузка статистики...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Заголовок и фильтры */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Статистика</h1>
            <p className="text-muted-foreground mt-1">Полный анализ вашего бизнеса</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Сегодня</SelectItem>
                <SelectItem value="week">Неделя</SelectItem>
                <SelectItem value="month">Месяц</SelectItem>
                <SelectItem value="quarter">Квартал</SelectItem>
                <SelectItem value="year">Год</SelectItem>
                <SelectItem value="all">Всё время</SelectItem>
                <SelectItem value="custom">Произвольный</SelectItem>
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-2 border rounded-md"
                />
                <Button onClick={handleCustomPeriodApply} size="sm">
                  Применить
                </Button>
              </>
            )}

            <Button onClick={fetchStatistics} variant="outline" size="sm" disabled={loading}>
              <Icon name={loading ? 'Loader2' : 'RefreshCw'} className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Предупреждения */}
        {(data.alerts.unpaid_orders.count > 0 || data.alerts.projects_without_date > 0 || data.alerts.overdue_bookings > 0) && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <Icon name="AlertTriangle" className="h-5 w-5" />
                Требует внимания
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.alerts.unpaid_orders.count > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Неоплаченные заказы</span>
                  <span className="font-semibold">
                    {data.alerts.unpaid_orders.count} шт. на {formatCurrency(data.alerts.unpaid_orders.amount)}
                  </span>
                </div>
              )}
              {data.alerts.projects_without_date > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Проекты без даты</span>
                  <span className="font-semibold">{data.alerts.projects_without_date} шт.</span>
                </div>
              )}
              {data.alerts.overdue_bookings > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Просроченные бронирования</span>
                  <span className="font-semibold">{data.alerts.overdue_bookings} шт.</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Основные метрики */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Всего клиентов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.general.clients.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                +{data.general.clients.new} за период
                {data.general.clients.growth !== 0 && (
                  <span className={`ml-1 ${data.general.clients.growth > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ({data.general.clients.growth > 0 ? '+' : ''}{data.general.clients.growth}%)
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Всего проектов</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.general.projects.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Завершено: {data.general.projects.completed} ({data.general.projects.completion_rate}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Доход</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.financial.total_revenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {data.financial.revenue_growth !== 0 && (
                  <span className={data.financial.revenue_growth > 0 ? 'text-green-600' : 'text-red-600'}>
                    {data.financial.revenue_growth > 0 ? '+' : ''}{data.financial.revenue_growth}% к предыдущему периоду
                  </span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Средний чек</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.financial.avg_check)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Неоплачено: {formatCurrency(data.financial.pending.amount)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Табы с детальной статистикой */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Обзор</TabsTrigger>
            <TabsTrigger value="clients">Клиенты</TabsTrigger>
            <TabsTrigger value="projects">Проекты</TabsTrigger>
            <TabsTrigger value="finance">Финансы</TabsTrigger>
            <TabsTrigger value="tops">Топы</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* График проектов */}
              <Card>
                <CardHeader>
                  <CardTitle>Динамика проектов</CardTitle>
                  <CardDescription>Количество проектов по периодам</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.charts.projects_timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tickFormatter={formatDate} />
                      <YAxis />
                      <Tooltip labelFormatter={formatDate} />
                      <Bar dataKey="count" fill="#8B5CF6" name="Проекты" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* График доходов */}
              <Card>
                <CardHeader>
                  <CardTitle>Динамика доходов</CardTitle>
                  <CardDescription>Доходы по периодам</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.charts.revenue_timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tickFormatter={formatDate} />
                      <YAxis />
                      <Tooltip labelFormatter={formatDate} formatter={(value: number) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} name="Доход" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* График новых клиентов */}
              <Card>
                <CardHeader>
                  <CardTitle>Новые клиенты</CardTitle>
                  <CardDescription>Привлечение клиентов</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.charts.clients_timeline}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tickFormatter={formatDate} />
                      <YAxis />
                      <Tooltip labelFormatter={formatDate} />
                      <Bar dataKey="count" fill="#EC4899" name="Клиенты" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Проекты по категориям */}
              {data.projects.by_category.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Проекты по категориям</CardTitle>
                    <CardDescription>Распределение типов съемок</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={data.projects.by_category}
                          dataKey="count"
                          nameKey="category"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label
                        >
                          {data.projects.by_category.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="clients" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Новые клиенты</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{data.clients.new_clients}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Постоянные клиенты</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{data.clients.returning_clients}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Возвращаемость: {data.clients.returning_rate}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Разовые клиенты</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{data.clients.one_time_clients}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            {data.projects.by_status.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Проекты по статусам</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.projects.by_status.map((item) => (
                      <div key={item.status} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.status}</span>
                        <span className="text-sm text-muted-foreground">{item.count} шт.</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="finance" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Методы оплаты */}
              {data.financial.by_method.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Методы оплаты</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {data.financial.by_method.map((method) => (
                        <div key={method.method} className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{method.method}</span>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(method.total)}</div>
                            <div className="text-xs text-muted-foreground">{method.count} платежей</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Сводка */}
              <Card>
                <CardHeader>
                  <CardTitle>Финансовая сводка</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Доход за период</span>
                      <span className="font-semibold">{formatCurrency(data.financial.total_revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Доход предыдущий период</span>
                      <span className="font-semibold">{formatCurrency(data.financial.prev_revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Рост</span>
                      <span className={`font-semibold ${data.financial.revenue_growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {data.financial.revenue_growth > 0 ? '+' : ''}{data.financial.revenue_growth}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Средний чек</span>
                      <span className="font-semibold">{formatCurrency(data.financial.avg_check)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="tops" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Топ клиентов */}
              <Card>
                <CardHeader>
                  <CardTitle>Топ-5 клиентов по доходу</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.tops.top_clients.map((client, index) => (
                      <div key={client.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{client.name}</div>
                          <div className="text-xs text-muted-foreground">{client.projects_count} проектов</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(client.total_spent)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Топ проектов */}
              <Card>
                <CardHeader>
                  <CardTitle>Топ-5 самых крупных проектов</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.tops.top_projects.map((project, index) => (
                      <div key={project.id} className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{project.project_name || 'Без названия'}</div>
                          <div className="text-xs text-muted-foreground">{project.client_name}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(project.total_amount)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StatisticsPage;
