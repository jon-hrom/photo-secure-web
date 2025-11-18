import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LineChart,
  Line,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface UsageStat {
  date: string;
  uploads: number;
  total_size_gb: number;
  unique_users: number;
}

interface RevenueStat {
  plan_name: string;
  users_count: number;
  total_revenue: number;
}

interface StatsTabProps {
  usageStats: UsageStat[];
  revenueStats: RevenueStat[];
  totalRevenue: number;
  loading: boolean;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const StatsTab = ({ usageStats, revenueStats, totalRevenue, loading }: StatsTabProps) => {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Статистика загрузок (30 дней)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Активность пользователей</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={usageStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="uploads" stroke="#8884d8" name="Загрузок" />
                    <Line yAxisId="right" type="monotone" dataKey="unique_users" stroke="#82ca9d" name="Уникальных пользователей" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">Объем загрузок</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={usageStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total_size_gb" stroke="#ffc658" name="Объем (GB)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Доходы по тарифам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Распределение дохода</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={revenueStats}
                    dataKey="total_revenue"
                    nameKey="plan_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {revenueStats.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Детализация по тарифам</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тариф</TableHead>
                    <TableHead>Пользователей</TableHead>
                    <TableHead>Доход</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueStats.map((stat, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{stat.plan_name}</TableCell>
                      <TableCell>{stat.users_count}</TableCell>
                      <TableCell className="text-green-600 font-semibold">
                        {stat.total_revenue.toLocaleString()} ₽
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold">
                    <TableCell>ИТОГО</TableCell>
                    <TableCell>{revenueStats.reduce((sum, s) => sum + s.users_count, 0)}</TableCell>
                    <TableCell className="text-green-600">
                      {totalRevenue.toLocaleString()} ₽
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
};
