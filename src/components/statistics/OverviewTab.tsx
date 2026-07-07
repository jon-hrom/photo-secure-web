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
import { getShootingStyles } from '@/data/shootingStyles';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Подсказка для столбцов «Динамика проектов» — показывает названия проектов за дату
const ProjectsBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload || {};
  const names: string[] = item.project_names || [];
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 max-w-[260px]">
      {label && <p className="text-sm font-medium text-foreground mb-1">{label}</p>}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8B5CF6' }} />
        <span className="text-sm text-muted-foreground">Проектов:</span>
        <span className="text-sm font-semibold text-foreground">{item.count}</span>
      </div>
      {names.length > 0 && (
        <ul className="space-y-0.5 border-t border-border pt-2">
          {names.map((n, i) => (
            <li key={i} className="text-xs text-foreground flex gap-1.5">
              <span className="text-muted-foreground">{i + 1}.</span>
              <span className="break-words">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Выноска с названием категории (стиля съёмки) от сектора круга
const renderCategoryLabel = (props: any) => {
  const { cx, cy, midAngle, outerRadius, fill, displayName, count } = props;
  const RAD = Math.PI / 180;
  const sin = Math.sin(-midAngle * RAD);
  const cos = Math.cos(-midAngle * RAD);
  const sx = cx + (outerRadius + 2) * cos;
  const sy = cy + (outerRadius + 2) * sin;
  const mx = cx + (outerRadius + 16) * cos;
  const my = cy + (outerRadius + 16) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 14;
  const ey = my;
  const anchor = cos >= 0 ? 'start' : 'end';
  const shortName =
    displayName && displayName.length > 22 ? `${displayName.slice(0, 20)}…` : displayName;

  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" strokeWidth={1.5} />
      <circle cx={ex} cy={ey} r={2.5} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 6 : -6)}
        y={ey}
        textAnchor={anchor}
        dominantBaseline="central"
        className="fill-foreground"
        fontSize={11}
      >
        {shortName}
      </text>
      <text
        x={ex + (cos >= 0 ? 6 : -6)}
        y={ey + 13}
        textAnchor={anchor}
        dominantBaseline="central"
        fill={fill}
        fontSize={11}
        fontWeight={600}
      >
        {count} шт.
      </text>
    </g>
  );
};

const CategoryTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload || {};
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 max-w-[240px]">
      <p className="text-sm font-medium text-foreground mb-1 break-words">{item.displayName}</p>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: payload[0].color }} />
        <span className="text-sm text-muted-foreground">Проектов:</span>
        <span className="text-sm font-semibold text-foreground">{item.count}</span>
      </div>
    </div>
  );
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const OverviewTab = ({ data, formatCurrency }: StatisticsTabProps) => {
  const styles = getShootingStyles();
  const styleName = (id: string): string => {
    if (!id || id === 'Не указано') return 'Не указано';
    const found = styles.find((s) => String(s.id) === String(id));
    return found ? found.name : `Категория ${id}`;
  };

  const categoryData = data.projects.by_category.map((c) => ({
    ...c,
    displayName: styleName(c.category),
  }));

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
              <BarChart data={data.charts.projects_timeline} barCategoryGap="10%">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip content={<ProjectsBarTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
                <Legend />
                <Bar dataKey="count" fill="#8B5CF6" name="Проекты" barSize={14} radius={[3, 3, 0, 0]} />
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
            <ResponsiveContainer width="100%" height={320}>
              <PieChart margin={{ top: 20, right: 90, bottom: 20, left: 90 }}>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCategoryLabel}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                  isAnimationActive={false}
                >
                  {categoryData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CategoryTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {categoryData.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                {categoryData.map((item, index) => (
                  <div key={item.category} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-foreground">{item.displayName}</span>
                    <span className="text-muted-foreground">— {item.count} шт.</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OverviewTab;