import { toast } from 'sonner';
import { Client, Payment, Refund } from '@/components/clients/ClientsTypes';
import { todayLocalDate } from '@/utils/dateFormat';

export const createAddRefundHandler = (
  localClient: Client,
  payments: Payment[],
  refunds: Refund[],
  newRefund: { paymentId: string; projectId: string; amount: string; reason: string; type: string; method: string; date: string },
  setNewRefund: (refund: { paymentId: string; projectId: string; amount: string; reason: string; type: string; method: string; date: string }) => void,
  onUpdate: (client: Client) => void
) => {
  return () => {
    if (!newRefund.amount || parseFloat(newRefund.amount) <= 0) {
      toast.error('Укажите сумму возврата');
      return;
    }

    const amount = parseFloat(newRefund.amount);

    if (newRefund.paymentId) {
      const payment = payments.find(p => p.id === parseInt(newRefund.paymentId));
      if (payment) {
        const existingRefunds = refunds.filter(r => r.paymentId === payment.id && r.status === 'completed');
        const alreadyRefunded = existingRefunds.reduce((sum, r) => sum + r.amount, 0);
        const maxRefund = payment.amount - alreadyRefunded;
        if (amount > maxRefund) {
          toast.error(`Максимальная сумма возврата: ${maxRefund.toLocaleString('ru-RU')} ₽`);
          return;
        }
      }
    }

    const refundDate = newRefund.date ? new Date(newRefund.date) : new Date();

    const refund: Refund = {
      id: Date.now() + Math.random(),
      paymentId: newRefund.paymentId ? parseInt(newRefund.paymentId) : undefined,
      projectId: newRefund.projectId ? parseInt(newRefund.projectId) : undefined,
      amount,
      reason: newRefund.reason || '',
      type: newRefund.type || 'refund',
      status: 'completed',
      method: newRefund.method || undefined,
      date: refundDate.toISOString(),
    };

    const updatedClient = {
      ...localClient,
      refunds: [...refunds, refund],
    };

    onUpdate(updatedClient);
    setNewRefund({
      paymentId: '',
      projectId: '',
      amount: '',
      reason: '',
      type: 'refund',
      method: '',
      date: todayLocalDate(),
    });
    toast.success(refund.type === 'cancellation' ? 'Аннулирование оформлено' : 'Возврат оформлен');
  };
};

export const createDeleteRefundHandler = (
  localClient: Client,
  refunds: Refund[],
  onUpdate: (client: Client) => void
) => {
  return (refundId: number) => {
    const updatedRefunds = refunds.filter(r => r.id !== refundId);
    const updatedClient = {
      ...localClient,
      refunds: updatedRefunds,
    };
    onUpdate(updatedClient);
    toast.success('Возврат удалён');
  };
};