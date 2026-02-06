import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import StatisticsHeader from '@/components/statistics/StatisticsHeader';
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

      console.log('[STATISTICS] Raw data from backend:', result);

      // Нормализуем данные: преобразуем все числа
      const normalizeNumber = (val: any): number => {
        const num = Number(val);
        return isNaN(num) || !isFinite(num) ? 0 : num;
      };

      const normalized = {
        ...result,
        general: {
          ...result.general,
          clients: {
            ...result.general?.clients,
            total: normalizeNumber(result.general?.clients?.total),
            new: normalizeNumber(result.general?.clients?.new),
            growth: normalizeNumber(result.general?.clients?.growth),
          },
          projects: {
            ...result.general?.projects,
            total: normalizeNumber(result.general?.projects?.total),
            new: normalizeNumber(result.general?.projects?.new),
            completed: normalizeNumber(result.general?.projects?.completed),
            completion_rate: normalizeNumber(result.general?.projects?.completion_rate),
          },
          bookings: {
            ...result.general?.bookings,
            total: normalizeNumber(result.general?.bookings?.total),
            new: normalizeNumber(result.general?.bookings?.new),
          },
        },
        clients: {
          ...result.clients,
          total_clients: normalizeNumber(result.clients?.total_clients),
          new_clients: normalizeNumber(result.clients?.new_clients),
          returning_clients: normalizeNumber(result.clients?.returning_clients),
          returning_rate: normalizeNumber(result.clients?.returning_rate),
          one_time_clients: normalizeNumber(result.clients?.one_time_clients),
        },
        financial: {
          ...result.financial,
          revenue_growth: normalizeNumber(result.financial?.revenue_growth),
          total_revenue: normalizeNumber(result.financial?.total_revenue),
          prev_revenue: normalizeNumber(result.financial?.prev_revenue),
          avg_check: normalizeNumber(result.financial?.avg_check),
          pending: {
            amount: normalizeNumber(result.financial?.pending?.amount),
            count: normalizeNumber(result.financial?.pending?.count),
          },
          by_method: result.financial?.by_method || [],
        },
        projects: {
          by_category: result.projects?.by_category || [],
          by_status: result.projects?.by_status || [],
        },
        charts: {
          projects_timeline: result.charts?.projects_timeline || [],
          revenue_timeline: result.charts?.revenue_timeline || [],
          clients_timeline: result.charts?.clients_timeline || [],
        },
        tops: {
          top_clients: result.tops?.top_clients || [],
          top_projects: result.tops?.top_projects || [],
        },
        alerts: {
          unpaid_orders: {
            count: normalizeNumber(result.alerts?.unpaid_orders?.count),
            amount: normalizeNumber(result.alerts?.unpaid_orders?.amount),
          },
          projects_without_date: normalizeNumber(result.alerts?.projects_without_date),
          overdue_bookings: normalizeNumber(result.alerts?.overdue_bookings),
        },
      };

      setData(normalized);
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
    const num = Number(value);
    const safeValue = isNaN(num) || !isFinite(num) ? 0 : num;
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(safeValue);
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

  const getPeriodLabel = (period: string) => {
    const labels: Record<string, string> = {
      day: 'Сегодня',
      week: 'Неделя',
      month: 'Месяц',
      quarter: 'Квартал',
      year: 'Год',
      all: 'Всё время',
      custom: 'Произвольный период',
    };
    return labels[period] || period;
  };

  const formatDateForPrint = (dateStr: string | null) => {
    if (!dateStr) return 'Не указано';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 pb-20">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold mb-2">Статистика фотостудии</h1>
          <p className="text-sm">
            Период: {getPeriodLabel(period)} 
            {data.date_range.start && data.date_range.end && 
              ` (${formatDateForPrint(data.date_range.start)} - ${formatDateForPrint(data.date_range.end)})`
            }
          </p>
          <p className="text-sm">Дата формирования: {new Date().toLocaleDateString('ru-RU')}</p>
        </div>

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

        <StatisticsCharts data={data} formatCurrency={formatCurrency} formatDate={formatDate} />
      </div>
    </div>
  );
};

export default StatisticsPage;