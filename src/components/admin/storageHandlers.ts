import { STORAGE_CRON_API, PHOTOBANK_CRON_API, StorageInvoice, DailyUsage, TrashFolder } from './types';

export const createStorageHandlers = (toast: any) => {
  const fetchStorageInvoices = async (
    filters: { userId?: number; period?: string; status?: string; limit?: number; offset?: number },
    setInvoices: (invoices: StorageInvoice[]) => void,
    setTotal: (total: number) => void,
    setLoading: (loading: boolean) => void
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId.toString());
      if (filters.period) params.append('period', filters.period);
      if (filters.status) params.append('status', filters.status);
      params.append('limit', (filters.limit || 50).toString());
      params.append('offset', (filters.offset || 0).toString());

      const res = await fetch(`${STORAGE_CRON_API}?action=get-invoices&${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch invoices');
      
      setInvoices(data.invoices || []);
      setTotal(data.total || 0);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: `Не удалось загрузить счета: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const updateInvoiceStatus = async (invoiceId: number, status: string, refetch: () => void) => {
    try {
      const res = await fetch(`${STORAGE_CRON_API}?action=update-invoice-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, status })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to update invoice');
      
      toast({ title: 'Успешно', description: 'Статус счёта обновлён' });
      refetch();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const fetchDailyUsage = async (
    filters: { userId?: number; days?: number },
    setUsage: (usage: DailyUsage[]) => void,
    setLoading: (loading: boolean) => void
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.userId) params.append('userId', filters.userId.toString());
      params.append('days', (filters.days || 30).toString());

      const res = await fetch(`${STORAGE_CRON_API}?action=get-daily-usage&${params.toString()}`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch usage');
      
      setUsage(data.usage || []);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: `Не удалось загрузить статистику: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTrashFolders = async (
    setFolders: (folders: TrashFolder[]) => void,
    setLoading: (loading: boolean) => void
  ) => {
    setLoading(true);
    try {
      const res = await fetch(`${PHOTOBANK_CRON_API}?action=list-trash`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to fetch trash folders');
      
      setFolders(data.folders || []);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: `Не удалось загрузить корзину: ${error.message}`, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const runDailySnapshot = async () => {
    try {
      const res = await fetch(`${STORAGE_CRON_API}?action=daily-snapshot`, { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to run snapshot');
      
      toast({ title: 'Успешно', description: `Обработано пользователей: ${data.usersProcessed}` });
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const runMonthlyBilling = async (period?: string) => {
    try {
      const res = await fetch(`${STORAGE_CRON_API}?action=monthly-billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to run billing');
      
      toast({ 
        title: 'Успешно', 
        description: `Выставлено счетов: ${data.invoicesCreated} за период ${data.period}` 
      });
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  return {
    fetchStorageInvoices,
    updateInvoiceStatus,
    fetchDailyUsage,
    fetchTrashFolders,
    runDailySnapshot,
    runMonthlyBilling,
  };
};
