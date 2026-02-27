export const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

/* eslint-disable @typescript-eslint/no-explicit-any */
export const CustomTooltip = ({ active, payload, label, formatter }: any) => {
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

export const safeNumber = (value: any): number => {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? 0 : num;
};

export const safeToFixed = (value: any, digits: number = 1): string => {
  return safeNumber(value).toFixed(digits);
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface StatisticsData {
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
    net_revenue?: number;
    prev_revenue: number;
    revenue_growth: number;
    avg_check: number;
    pending: {
      amount: number;
      count: number;
    };
    refunds?: {
      total: number;
      count: number;
      cancellations_total: number;
      cancellations_count: number;
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

export interface StatisticsTabProps {
  data: StatisticsData;
  formatCurrency: (value: number) => string;
  formatDate: (dateStr: string) => string;
}
