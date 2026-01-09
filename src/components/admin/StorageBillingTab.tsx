import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAdminStorageAPI, type StorageInvoice, type User } from './AdminStorageAPI';

interface StorageBillingTabProps {
  adminKey: string;
  users: User[];
}

export const StorageBillingTab = ({ adminKey, users }: StorageBillingTabProps) => {
  const [invoices, setInvoices] = useState<StorageInvoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    userId: undefined as number | undefined,
    period: '',
    status: '',
    limit: 50,
    offset: 0,
  });

  const api = useAdminStorageAPI(adminKey);

  const loadInvoices = () => {
    api.fetchStorageInvoices(filters, setInvoices, setTotal, setLoading);
  };

  useEffect(() => {
    if (adminKey) {
      loadInvoices();
    }
  }, [adminKey, filters]);

  const handleStatusChange = (invoiceId: number, status: string) => {
    api.updateInvoiceStatus(invoiceId, status, loadInvoices);
  };

  const handleRunBilling = () => {
    if (!confirm('Выставить счета за прошлый месяц всем пользователям?')) return;
    api.runMonthlyBilling();
    setTimeout(loadInvoices, 1000);
  };

  const handleRunSnapshot = () => {
    api.runDailySnapshot();
  };

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount_rub, 0);
  const paidAmount = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount_rub, 0);
  const pendingAmount = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount_rub, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Всего счетов</p>
              <p className="text-2xl font-bold">{total}</p>
            </div>
            <Icon name="FileText" className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            На сумму: {totalAmount.toFixed(2)} ₽
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Оплачено</p>
              <p className="text-2xl font-bold text-green-600">{paidAmount.toFixed(2)} ₽</p>
            </div>
            <Icon name="CheckCircle" className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {invoices.filter(inv => inv.status === 'paid').length} счёт(ов)
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ожидает оплаты</p>
              <p className="text-2xl font-bold text-orange-600">{pendingAmount.toFixed(2)} ₽</p>
            </div>
            <Icon name="Clock" className="h-8 w-8 text-orange-600" />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {invoices.filter(inv => inv.status === 'pending').length} счёт(ов)
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold">Счета за хранилище</h3>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleRunSnapshot}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Icon name="Camera" className="h-4 w-4 mr-1" />
              Снимок сегодня
            </Button>
            <Button
              onClick={handleRunBilling}
              variant="default"
              size="sm"
              className="text-xs"
            >
              <Icon name="Calculator" className="h-4 w-4 mr-1" />
              Выставить счета
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Пользователь</label>
            <Select
              value={filters.userId?.toString() || 'all'}
              onValueChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  userId: value === 'all' ? undefined : parseInt(value),
                  offset: 0,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Все пользователи" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все пользователи</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.user_id} value={user.user_id.toString()}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Период</label>
            <Select
              value={filters.period}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, period: value, offset: 0 }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Все периоды" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все периоды</SelectItem>
                <SelectItem value="2026-01">Январь 2026</SelectItem>
                <SelectItem value="2025-12">Декабрь 2025</SelectItem>
                <SelectItem value="2025-11">Ноябрь 2025</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Статус</label>
            <Select
              value={filters.status}
              onValueChange={(value) =>
                setFilters((prev) => ({ ...prev, status: value, offset: 0 }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Все статусы</SelectItem>
                <SelectItem value="pending">Ожидает оплаты</SelectItem>
                <SelectItem value="paid">Оплачено</SelectItem>
                <SelectItem value="cancelled">Отменён</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-12">
            <Icon name="FileX" className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Счета не найдены</p>
            <p className="text-sm text-muted-foreground mt-2">
              Выставьте счета за прошлый месяц или измените фильтры
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Период</TableHead>
                  <TableHead className="text-right">Средний GB</TableHead>
                  <TableHead className="text-right">Тариф</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата создания</TableHead>
                  <TableHead>Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">#{invoice.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.email}</p>
                        <p className="text-xs text-muted-foreground">ID: {invoice.user_id}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{invoice.period}</TableCell>
                    <TableCell className="text-right">
                      {invoice.avg_gb.toFixed(2)} GB
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.rate_rub_per_gb_month.toFixed(2)} ₽/GB
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {invoice.amount_rub.toFixed(2)} ₽
                    </TableCell>
                    <TableCell>
                      {invoice.status === 'pending' && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                          <Icon name="Clock" className="h-3 w-3 mr-1" />
                          Ожидает
                        </Badge>
                      )}
                      {invoice.status === 'paid' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <Icon name="CheckCircle" className="h-3 w-3 mr-1" />
                          Оплачено
                        </Badge>
                      )}
                      {invoice.status === 'cancelled' && (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          <Icon name="XCircle" className="h-3 w-3 mr-1" />
                          Отменён
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(invoice.created_at).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {invoice.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(invoice.id, 'paid')}
                              className="h-8 px-2"
                            >
                              <Icon name="CheckCircle" className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStatusChange(invoice.id, 'cancelled')}
                              className="h-8 px-2"
                            >
                              <Icon name="XCircle" className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between mt-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Показано {invoices.length} из {total} счёт(ов)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setFilters((prev) => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))
              }
              disabled={filters.offset === 0}
            >
              <Icon name="ChevronLeft" className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFilters((prev) => ({ ...prev, offset: prev.offset + prev.limit }))}
              disabled={filters.offset + filters.limit >= total}
            >
              <Icon name="ChevronRight" className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4">💡 Как работает биллинг хранилища</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Icon name="Camera" className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Ежедневный снимок (02:00)</p>
              <p>Система автоматически записывает, сколько GB занимает каждый клиент на конец дня</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="Calculator" className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Расчёт счетов (конец месяца)</p>
              <p>Считается среднее использование GB за месяц × тариф (2.16 ₽/GB/мес)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Icon name="CheckCircle" className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">Управление статусом</p>
              <p>Отмечайте счета как оплаченные вручную или отменяйте при необходимости</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
