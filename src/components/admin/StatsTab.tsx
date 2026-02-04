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
  cloudStorageStats?: any[];
  cloudStorageSummary?: any;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const StatsTab = ({ usageStats, revenueStats, totalRevenue, loading, cloudStorageStats = [], cloudStorageSummary = {} }: StatsTabProps) => {
  const totalGb = cloudStorageSummary.total_gb || 0;
  const gbHours = cloudStorageSummary.gb_hours || 0;
  const days = cloudStorageSummary.days || 30;
  
  // Расчёты
  const avgGbPerDay = totalGb; // текущий размер = среднее за последние дни
  const hoursInPeriod = days * 24;
  const avgGbCalculated = gbHours / hoursInPeriod; // среднее за период
  
  // Тарификация Яндекс.Облака
  const pricePerGbHour = 2.71 / 1000; // ₽ за 1 ГБ×час
  const costFor30Days = gbHours * pricePerGbHour;
  const costPerMonth = (totalGb * 24 * 30) * pricePerGbHour; // прогноз на месяц от текущего размера
  const costPerYear = costPerMonth * 12;
  
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Database" className="h-6 w-6 text-blue-600" />
            Использование облачного хранилища (Яндекс.Облако Object Storage)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <div className="space-y-6">
              {/* Основные метрики */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="HardDrive" className="h-5 w-5 text-blue-600" />
                    <h4 className="text-sm font-medium text-muted-foreground">Текущий размер</h4>
                  </div>
                  <p className="text-3xl font-bold text-blue-600">{totalGb.toFixed(2)} ГБ</p>
                  <p className="text-xs text-muted-foreground mt-1">{(totalGb * 1024).toFixed(0)} МБ</p>
                </div>
                
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Clock" className="h-5 w-5 text-purple-600" />
                    <h4 className="text-sm font-medium text-muted-foreground">ГБ×час за {days} дн.</h4>
                  </div>
                  <p className="text-3xl font-bold text-purple-600">{gbHours.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Средний размер: {avgGbCalculated.toFixed(2)} ГБ</p>
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="DollarSign" className="h-5 w-5 text-green-600" />
                    <h4 className="text-sm font-medium text-muted-foreground">Стоимость за {days} дн.</h4>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{costFor30Days.toFixed(2)} ₽</p>
                  <p className="text-xs text-muted-foreground mt-1">По факту использования</p>
                </div>
                
                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border-2 border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="TrendingUp" className="h-5 w-5 text-orange-600" />
                    <h4 className="text-sm font-medium text-muted-foreground">Прогноз на месяц</h4>
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{costPerMonth.toFixed(2)} ₽</p>
                  <p className="text-xs text-muted-foreground mt-1">От текущего размера {totalGb.toFixed(2)} ГБ</p>
                </div>
              </div>

              {/* Подробный расчёт */}
              <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Icon name="Calculator" className="h-6 w-6" />
                  Подробный расчёт стоимости хранения
                </h3>
                
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Левая колонка - Фактические данные */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg mb-3 text-blue-600">📊 Фактические данные за {days} дней:</h4>
                    
                    <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-950 rounded-lg">
                      <span className="text-sm">Общий объём данных:</span>
                      <span className="font-bold">{totalGb.toFixed(2)} ГБ</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-950 rounded-lg">
                      <span className="text-sm">Период хранения:</span>
                      <span className="font-bold">{days} дней = {hoursInPeriod} часов</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-950 rounded-lg">
                      <span className="text-sm">Средний размер за период:</span>
                      <span className="font-bold">{avgGbCalculated.toFixed(2)} ГБ</span>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-purple-100 dark:bg-purple-950 rounded-lg border-2 border-purple-300 dark:border-purple-700">
                      <span className="text-sm font-semibold">Метрика тарификации:</span>
                      <span className="font-bold text-purple-600">{gbHours.toFixed(2)} ГБ×час</span>
                    </div>
                    
                    <div className="mt-4 p-4 bg-blue-100 dark:bg-blue-950 rounded-lg border-2 border-blue-300 dark:border-blue-700">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold">Тариф Яндекс.Облака:</span>
                        <span className="font-bold text-blue-600">2.71 ₽ за 1000 ГБ×час</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Стоимость за {days} дней:</span>
                        <span className="font-bold text-green-600 text-xl">{costFor30Days.toFixed(2)} ₽</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">
                        Расчёт: {gbHours.toFixed(2)} × 2.71 ÷ 1000 = {costFor30Days.toFixed(2)} ₽
                      </div>
                    </div>
                  </div>
                  
                  {/* Правая колонка - Прогнозы */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-lg mb-3 text-orange-600">🔮 Прогноз расходов:</h4>
                    
                    <div className="p-4 bg-white dark:bg-slate-950 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">При текущем объёме <span className="font-bold">{totalGb.toFixed(2)} ГБ</span>:</p>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">💰 Месяц (30 дней):</span>
                          <span className="font-bold text-lg text-orange-600">{costPerMonth.toFixed(2)} ₽</span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-sm">📅 Год (365 дней):</span>
                          <span className="font-bold text-lg text-orange-600">{costPerYear.toFixed(2)} ₽</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-xs text-muted-foreground">
                          Расчёт месяца: {totalGb.toFixed(2)} ГБ × 24 ч × 30 дн × 0.00271 ₽ = {costPerMonth.toFixed(2)} ₽
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border-2 border-yellow-300 dark:border-yellow-700">
                      <h5 className="font-semibold mb-2 flex items-center gap-2">
                        <Icon name="Lightbulb" className="h-5 w-5" />
                        Что такое ГБ×час?
                      </h5>
                      <p className="text-sm mb-2">
                        <strong>ГБ×час</strong> — единица измерения хранения данных во времени.
                      </p>
                      <div className="text-sm space-y-1">
                        <p>• Если хранить <strong>1 ГБ</strong> в течение <strong>1 часа</strong> = <strong>1 ГБ×час</strong></p>
                        <p>• Если хранить <strong>10 ГБ</strong> в течение <strong>24 часов</strong> = <strong>240 ГБ×час</strong></p>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-300 dark:border-green-700">
                      <h5 className="font-semibold mb-2 flex items-center gap-2">
                        <Icon name="Info" className="h-5 w-5" />
                        Итого за месяц
                      </h5>
                      <div className="text-sm space-y-1">
                        <p>✅ <strong>Object Storage</strong> (хранение): <span className="text-green-600 font-bold">{costPerMonth.toFixed(2)} ₽</span></p>
                        <p>✅ <strong>Cloud Functions</strong> (вызовы): <span className="text-green-600 font-bold">0.00 ₽</span> (бесплатный лимит)</p>
                        <p>✅ <strong>Database</strong> (PostgreSQL): <span className="text-green-600 font-bold">0.00 ₽</span> (бесплатный лимит)</p>
                        <p className="pt-2 mt-2 border-t border-green-300 dark:border-green-700 font-bold text-lg">
                          Общая стоимость: <span className="text-green-600">{costPerMonth.toFixed(2)} ₽/мес</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* График динамики */}
              {cloudStorageStats && cloudStorageStats.length > 0 && (
                <div className="p-6 bg-white dark:bg-slate-950 rounded-xl border-2 border-slate-200 dark:border-slate-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Icon name="TrendingUp" className="h-6 w-6 text-blue-600" />
                    Динамика роста хранилища за {days} дней
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={cloudStorageStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis label={{ value: 'ГБ', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        formatter={(value: any) => [`${Number(value).toFixed(2)} ГБ`, 'Размер']}
                        labelFormatter={(label) => `Дата: ${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="total_size_gb" 
                        stroke="#3b82f6" 
                        name="Объём хранилища (ГБ)" 
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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