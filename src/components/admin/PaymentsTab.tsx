import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { ADMIN_API } from './types';

interface Payment {
  id: number;
  order_number: string;
  amount: number;
  duration_months: number;
  paid_at: string | null;
  user_id: number;
  user_name: string;
  user_email: string;
  plan_name: string;
}

interface ByPlan {
  plan_name: string;
  payments_count: number;
  revenue: number;
}

interface Summary {
  total_revenue: number;
  total_payments: number;
  paying_users: number;
}

type Period = 'all' | 'day' | 'week' | 'month' | 'year';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'all', label: 'Всё время' },
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

const formatRub = (v: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₽';

const formatDate = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

export const PaymentsTab = ({ adminKey }: { adminKey: string }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [byPlan, setByPlan] = useState<ByPlan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>('all');

  const load = async () => {
    if (!adminKey) return;
    setLoading(true);
    try {
      const res = await fetch(`${ADMIN_API}?action=payment-stats&period=${period}&admin_key=${adminKey}`);
      if (!res.ok) return;
      const data = await res.json();
      setPayments(data.payments || []);
      setByPlan(data.by_plan || []);
      setSummary(data.summary || null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey, period]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? 'default' : 'outline'}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <Icon name="RefreshCw" className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
              <Icon name="Wallet" className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Общий доход</p>
              <p className="text-2xl font-bold">{summary ? formatRub(summary.total_revenue) : '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Icon name="CreditCard" className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Оплат всего</p>
              <p className="text-2xl font-bold">{summary ? summary.total_payments : '—'}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Icon name="Users" className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Платящих фотографов</p>
              <p className="text-2xl font-bold">{summary ? summary.paying_users : '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {byPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Доход по тарифам</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byPlan.map((p) => (
              <div key={p.plan_name} className="flex items-center justify-between">
                <span className="font-medium">{p.plan_name}</span>
                <span className="text-sm text-muted-foreground">
                  {p.payments_count} опл. · <span className="font-semibold text-foreground">{formatRub(p.revenue)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">История оплат</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Загрузка...</div>
          ) : payments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">Оплат пока нет</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Дата</th>
                    <th className="py-2 pr-4 font-medium">Фотограф</th>
                    <th className="py-2 pr-4 font-medium">Тариф</th>
                    <th className="py-2 pr-4 font-medium">Срок</th>
                    <th className="py-2 pr-4 font-medium text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(p.paid_at)}</td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{p.user_name}</div>
                        <div className="text-xs text-muted-foreground">{p.user_email}</div>
                      </td>
                      <td className="py-2 pr-4">{p.plan_name}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{p.duration_months} мес.</td>
                      <td className="py-2 pr-4 text-right font-semibold whitespace-nowrap">{formatRub(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsTab;
