import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface FinancialStat {
  date: string;
  storage_gb: number;
  active_users: number;
  total_revenue: number;
  estimated_cost: number;
}

interface FinancialSummary {
  total_revenue: number;
  total_cost: number;
  profit: number;
  margin_percent: number;
}

interface FinancialTabProps {
  financialStats: FinancialStat[];
  financialSummary: FinancialSummary | null;
  financialPeriod: 'day' | 'week' | 'month' | 'year';
  onPeriodChange: (period: 'day' | 'week' | 'month' | 'year') => void;
}

export const FinancialTab = ({ financialStats, financialSummary, financialPeriod, onPeriodChange }: FinancialTabProps) => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Финансовая аналитика</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={financialPeriod === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange('day')}
            >
              День
            </Button>
            <Button
              variant={financialPeriod === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange('week')}
            >
              Неделя
            </Button>
            <Button
              variant={financialPeriod === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange('month')}
            >
              Месяц
            </Button>
            <Button
              variant={financialPeriod === 'year' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onPeriodChange('year')}
            >
              Год
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {financialSummary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Доход</p>
                  <p className="text-2xl font-bold text-green-600">
                    {financialSummary.total_revenue.toLocaleString()} ₽
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Расход</p>
                  <p className="text-2xl font-bold text-red-600">
                    {financialSummary.total_cost.toLocaleString()} ₽
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Прибыль</p>
                  <p className={`text-2xl font-bold ${financialSummary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {financialSummary.profit.toLocaleString()} ₽
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Маржа</p>
                  <p className={`text-2xl font-bold ${financialSummary.margin_percent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {financialSummary.margin_percent.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold mb-4">Доходы и расходы</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={financialStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total_revenue" stroke="#10b981" name="Доход (₽)" />
              <Line type="monotone" dataKey="estimated_cost" stroke="#ef4444" name="Расход (₽)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Прибыль по дням</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={financialStats.map(s => ({
              ...s,
              profit: (s.total_revenue || 0) - (s.estimated_cost || 0)
            }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="profit" fill="#10b981" name="Прибыль (₽)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
