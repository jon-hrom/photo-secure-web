import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Payment, Project, Refund } from '@/components/clients/ClientsTypes';

interface NewRefundState {
  paymentId: string;
  projectId: string;
  amount: string;
  reason: string;
  type: string;
  method: string;
  date: string;
}

interface ClientDetailRefundsProps {
  refunds: Refund[];
  payments: Payment[];
  projects: Project[];
  newRefund: NewRefundState;
  setNewRefund: (refund: NewRefundState) => void;
  handleAddRefund: () => void;
  handleDeleteRefund: (refundId: number) => void;
  formatDate: (dateString: string) => string;
}

const ClientDetailRefunds = ({
  refunds,
  payments,
  projects,
  newRefund,
  setNewRefund,
  handleAddRefund,
  handleDeleteRefund,
  formatDate,
}: ClientDetailRefundsProps) => {
  const [refundOpen, setRefundOpen] = useState(false);
  const completedPayments = payments.filter(p => p.status === 'completed');

  const getPaymentLabel = (payment: Payment) => {
    const project = projects.find(p => p.id === payment.projectId);
    const projectName = project ? project.name : '';
    return `${payment.amount.toLocaleString('ru-RU')} ₽ — ${projectName || 'Без проекта'} (${formatDate(payment.date)})`;
  };

  const getMaxRefundForPayment = (paymentId: number) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return 0;
    const refunded = refunds
      .filter(r => r.paymentId === paymentId && r.status === 'completed')
      .reduce((sum, r) => sum + r.amount, 0);
    return payment.amount - refunded;
  };

  const selectedPaymentId = newRefund.paymentId ? parseInt(newRefund.paymentId) : null;
  const maxRefund = selectedPaymentId ? getMaxRefundForPayment(selectedPaymentId) : null;

  const getRefundTypeBadge = (refund: Refund) => {
    if (refund.type === 'cancellation') {
      return <Badge variant="destructive" className="text-[10px] px-1.5">Аннулирование</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] px-1.5 bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300">Возврат</Badge>;
  };

  const getRefundStatusBadge = (status: Refund['status']) => {
    switch (status) {
      case 'completed':
        return <Badge variant="secondary" className="text-[10px] px-1.5 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">Выполнен</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-[10px] px-1.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">Ожидает</Badge>;
      case 'rejected':
        return <Badge variant="secondary" className="text-[10px] px-1.5 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">Отклонён</Badge>;
    }
  };

  const totalRefunded = refunds
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <>
      {totalRefunded > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950">
                <Icon name="RotateCcw" size={18} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего возвращено</p>
                <p className="text-lg font-bold text-orange-600">{totalRefunded.toLocaleString('ru-RU')} ₽</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">Возвратов: {refunds.filter(r => r.status === 'completed').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader
          className="cursor-pointer select-none hover:bg-muted/50 transition-colors rounded-t-lg"
          onClick={() => setRefundOpen(!refundOpen)}
        >
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Icon name="RotateCcw" size={18} />
            Оформить возврат
            <Icon
              name={refundOpen ? "ChevronUp" : "ChevronDown"}
              size={18}
              className="ml-auto text-muted-foreground"
            />
          </CardTitle>
        </CardHeader>
        {refundOpen && (
        <CardContent className="space-y-4 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Тип</Label>
              <Select
                value={newRefund.type}
                onValueChange={(value) => setNewRefund({ ...newRefund, type: value })}
              >
                <SelectTrigger className="text-xs sm:text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="refund">Возврат средств</SelectItem>
                  <SelectItem value="cancellation">Аннулирование заказа</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Привязать к платежу</Label>
              <Select
                value={newRefund.paymentId}
                onValueChange={(value) => {
                  const payment = completedPayments.find(p => p.id === parseInt(value));
                  setNewRefund({
                    ...newRefund,
                    paymentId: value,
                    projectId: payment?.projectId ? String(payment.projectId) : newRefund.projectId,
                  });
                }}
              >
                <SelectTrigger className="text-xs sm:text-sm h-9">
                  <SelectValue placeholder="Выберите платёж (необяз.)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без привязки</SelectItem>
                  {completedPayments.map(payment => (
                    <SelectItem key={payment.id} value={String(payment.id)}>
                      {getPaymentLabel(payment)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Сумма возврата (₽) *</Label>
              <Input
                type="number"
                value={newRefund.amount}
                onChange={(e) => setNewRefund({ ...newRefund, amount: e.target.value })}
                placeholder={maxRefund !== null ? `Макс: ${maxRefund.toLocaleString('ru-RU')}` : '0'}
                className="text-xs sm:text-sm h-9"
              />
              {maxRefund !== null && maxRefund > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Доступно к возврату: {maxRefund.toLocaleString('ru-RU')} ₽
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Дата возврата</Label>
              <Input
                type="date"
                value={newRefund.date}
                onChange={(e) => setNewRefund({ ...newRefund, date: e.target.value })}
                className="text-xs sm:text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Способ возврата</Label>
              <Select
                value={newRefund.method}
                onValueChange={(value) => setNewRefund({ ...newRefund, method: value })}
              >
                <SelectTrigger className="text-xs sm:text-sm h-9">
                  <SelectValue placeholder="Выберите" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">На карту</SelectItem>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="transfer">Переводом</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs sm:text-sm">Причина возврата</Label>
            <Textarea
              value={newRefund.reason}
              onChange={(e) => setNewRefund({ ...newRefund, reason: e.target.value })}
              placeholder="Укажите причину..."
              rows={2}
              className="text-xs sm:text-sm resize-none"
            />
          </div>

          {newRefund.type === 'cancellation' && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
              <Icon name="AlertTriangle" size={14} className="mt-0.5 shrink-0" />
              <p className="leading-tight">
                Аннулирование означает полную отмену заказа с возвратом средств. Это будет отражено в статистике как отменённая сделка.
              </p>
            </div>
          )}

          <Button
            onClick={handleAddRefund}
            variant="destructive"
            className="w-full sm:w-auto h-11 text-sm font-semibold touch-manipulation"
          >
            <Icon name="RotateCcw" size={18} className="mr-2" />
            {newRefund.type === 'cancellation' ? 'Аннулировать' : 'Оформить возврат'}
          </Button>
        </CardContent>
        )}
      </Card>

      {refunds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">История возвратов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {refunds.slice().reverse().map((refund) => {
                const linkedPayment = refund.paymentId ? payments.find(p => p.id === refund.paymentId) : null;
                const project = refund.projectId ? projects.find(p => p.id === refund.projectId) : null;
                return (
                  <div key={refund.id} className="border rounded-lg p-3 sm:p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base sm:text-lg text-orange-600">
                          −{refund.amount.toLocaleString('ru-RU')} ₽
                        </span>
                        {getRefundTypeBadge(refund)}
                        {getRefundStatusBadge(refund.status)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRefund(refund.id)}
                        className="shrink-0"
                      >
                        <Icon name="Trash2" size={16} />
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span>{formatDate(refund.date)}</span>
                      {refund.method && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span>
                            {refund.method === 'card' && 'На карту'}
                            {refund.method === 'cash' && 'Наличные'}
                            {refund.method === 'transfer' && 'Переводом'}
                          </span>
                        </>
                      )}
                      {project && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span>{project.name}</span>
                        </>
                      )}
                      {linkedPayment && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span>к платежу {linkedPayment.amount.toLocaleString('ru-RU')} ₽</span>
                        </>
                      )}
                    </div>
                    {refund.reason && (
                      <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        {refund.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default ClientDetailRefunds;