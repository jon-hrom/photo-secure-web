import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { ADMIN_API } from './types';

interface ConsentRecord {
  id: number;
  user_id: number;
  user_email: string;
  plan_name: string;
  amount_rub: number;
  duration_months: number;
  consent_text: string;
  ip_address: string;
  offer_version: string;
  created_at: string;
}

interface ConsentSummary {
  total: number;
  unique_users: number;
  total_amount: number;
}

const formatDate = (s: string) => {
  const d = new Date(s);
  return (
    d.toLocaleDateString('ru-RU') +
    ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  );
};

const formatRub = (v: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₽';

interface Props {
  adminKey: string;
}

export const ConsentLogTab = ({ adminKey }: Props) => {
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [summary, setSummary] = useState<ConsentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 50;

  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = ['ID', 'Дата', 'Email', 'Тариф', 'Сумма (₽)', 'Период (мес)', 'IP', 'Версия оферты', 'Текст согласия'];
    const rows = records.map((r) => [
      r.id,
      formatDate(r.created_at),
      r.user_email || `ID ${r.user_id}`,
      r.plan_name || '',
      r.amount_rub,
      r.duration_months,
      r.ip_address || '',
      r.offer_version || '',
      `"${(r.consent_text || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consent_log_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const load = async (reset = false) => {
    setLoading(true);
    const p = reset ? 1 : page;
    try {
      const res = await fetch(
        `${ADMIN_API}?action=consent-log&admin_key=${adminKey}&page=${p}&limit=${PAGE_SIZE}`
      );
      const data = await res.json();
      if (data.success) {
        setRecords(reset ? data.records : (prev) => [...prev, ...data.records]);
        setSummary(data.summary);
        setHasMore(data.records.length === PAGE_SIZE);
        if (!reset) setPage(p + 1);
        else setPage(2);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminKey) load(true);
  }, [adminKey]);

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-primary">{summary.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Всего согласий</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-primary">{summary.unique_users}</p>
              <p className="text-xs text-muted-foreground mt-1">Уникальных пользователей</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="text-2xl font-bold text-primary">{formatRub(summary.total_amount)}</p>
              <p className="text-xs text-muted-foreground mt-1">Сумма подписок</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon name="ClipboardCheck" size={18} className="text-primary" />
            История согласий на автосписания
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportCSV}
              disabled={records.length === 0}
            >
              <Icon name="Download" size={14} className="mr-1.5" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => load(true)}
              disabled={loading}
            >
              <Icon name="RefreshCw" size={14} className={`mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 && !loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Icon name="FileX" size={32} className="mx-auto mb-2 opacity-30" />
              Согласий пока нет
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Дата</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Пользователь</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Тариф</th>
                      <th className="text-right px-4 py-2 font-medium text-muted-foreground">Сумма</th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">Период</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">IP</th>
                      <th className="text-center px-4 py-2 font-medium text-muted-foreground">Оферта</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-xs font-medium">{r.user_email || `ID ${r.user_id}`}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary" className="text-xs">{r.plan_name || '—'}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap">
                          {formatRub(r.amount_rub)}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                          {r.duration_months} мес.
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                          {r.ip_address || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <Badge variant="outline" className="text-xs">v{r.offer_version}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMore && (
                <div className="p-4 text-center">
                  <Button variant="outline" size="sm" onClick={() => load()} disabled={loading}>
                    {loading ? 'Загрузка...' : 'Загрузить ещё'}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};