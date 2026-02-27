import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
} from 'recharts';
import { COLORS, CustomTooltip, safeNumber, safeToFixed, StatisticsTabProps } from './statisticsShared';

const OverviewTab = ({ data, formatCurrency }: StatisticsTabProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Клиенты</CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{data.general.clients.total}</CardTitle>
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
            <CardTitle className="text-2xl sm:text-3xl">{data.general.projects.total}</CardTitle>
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
            <CardTitle className="text-2xl sm:text-3xl">{formatCurrency(data.financial.total_revenue)}</CardTitle>
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
            <CardTitle className="text-2xl sm:text-3xl">{formatCurrency(data.financial.avg_check)}</CardTitle>
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
            <ResponsiveContainer width="100%" height={250}>
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
            <ResponsiveContainer width="100%" height={250}>
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
            <ResponsiveContainer width="100%" height={250}>
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
            <ResponsiveContainer width="100%" height={250}>
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
    </div>
  );
};

export default OverviewTab;
