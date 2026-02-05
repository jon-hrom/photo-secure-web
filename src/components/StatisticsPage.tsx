import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import StatisticsHeader from '@/components/statistics/StatisticsHeader';
import StatisticsAlerts from '@/components/statistics/StatisticsAlerts';
import StatisticsCharts from '@/components/statistics/StatisticsCharts';

const STATISTICS_API = 'https://functions.poehali.dev/459209b2-e3b0-4b54-a6cf-cda0b74e4f3f';

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
        <StatisticsHeader
          period={period}
          setPeriod={setPeriod}
          customStartDate={customStartDate}
          setCustomStartDate={setCustomStartDate}
          customEndDate={customEndDate}
          setCustomEndDate={setCustomEndDate}
          handleCustomPeriodApply={handleCustomPeriodApply}
          fetchStatistics={fetchStatistics}
          loading={loading}
          data={data}
        />

        <StatisticsAlerts alerts={data.alerts} formatCurrency={formatCurrency} />

        <StatisticsCharts data={data} formatCurrency={formatCurrency} formatDate={formatDate} />
      </div>
    </div>
  );
};

export default StatisticsPage;
