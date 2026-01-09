import { useToast } from '@/hooks/use-toast';

const ADMIN_API = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93e2-63032b5c552c';

export interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  is_active: boolean;
  visible_to_users: boolean;
  created_at: string;
}

export interface User {
  user_id: number;
  username: string;
  plan_id: number;
  plan_name: string;
  custom_quota_gb: number | null;
  used_gb: number;
  created_at: string;
}

export interface UsageStat {
  date: string;
  uploads: number;
  total_size_gb: number;
  unique_users: number;
}

export interface RevenueStat {
  plan_name: string;
  users_count: number;
  total_revenue: number;
}

export interface FinancialStat {
  date: string;
  storage_gb: number;
  active_users: number;
  total_revenue: number;
  estimated_cost: number;
}

export interface FinancialSummary {
  total_revenue: number;
  total_cost: number;
  profit: number;
  margin_percent: number;
}

export interface PromoCode {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  duration_months: number | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  description: string;
}

export interface StorageInvoice {
  id: number;
  user_id: number;
  email: string;
  period: string;
  avg_gb: number;
  rate_rub_per_gb_month: number;
  amount_rub: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  paid_at: string | null;
}

export interface DailyUsage {
  date: string;
  user_id: number;
  email?: string;
  used_gb_end_of_day: number;
}

export interface TrashFolder {
  id: number;
  user_id: number;
  folder_name: string;
  s3_prefix: string;
  trashed_at: string;
  photos_count: number;
  total_size_mb: number;
}

export const useAdminStorageAPI = (adminKey: string) => {
  const { toast } = useToast();

  const fetchPlans = async (setPlans: (plans: Plan[]) => void) => {
    if (!adminKey) {
      console.log('[FETCH_PLANS] Waiting for adminKey...');
      return;
    }
    try {
      console.log('[FETCH_PLANS] Starting request to:', `${ADMIN_API}?action=list-plans&admin_key=${adminKey}`);
      console.log('[FETCH_PLANS] Using adminKey:', adminKey);
      
      const res = await fetch(`${ADMIN_API}?action=list-plans&admin_key=${adminKey}`);
      
      console.log('[FETCH_PLANS] Response received');
      console.log('[FETCH_PLANS] Response status:', res.status);
      console.log('[FETCH_PLANS] Response statusText:', res.statusText);
      console.log('[FETCH_PLANS] Response ok:', res.ok);
      console.log('[FETCH_PLANS] Response headers:', JSON.stringify([...res.headers.entries()]));
      
      const rawText = await res.text();
      console.log('[FETCH_PLANS] Raw response text:', rawText);
      
      let data;
      try {
        data = JSON.parse(rawText);
        console.log('[FETCH_PLANS] Parsed response data:', data);
      } catch (parseError) {
        console.error('[FETCH_PLANS] JSON parse error:', parseError);
        throw new Error(`Invalid JSON response: ${rawText.substring(0, 100)}`);
      }
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      setPlans(data.plans || []);
      console.log('[FETCH_PLANS] Plans loaded successfully:', data.plans?.length || 0);
    } catch (error: any) {
      console.error('[FETCH_PLANS] Error caught:', error);
      console.error('[FETCH_PLANS] Error name:', error.name);
      console.error('[FETCH_PLANS] Error message:', error.message);
      console.error('[FETCH_PLANS] Error stack:', error.stack);
      toast({ 
        title: 'Ошибка загрузки тарифов', 
        description: `${error.message || error}`, 
        variant: 'destructive' 
      });
    }
  };

  const fetchUsers = async (setUsers: (users: User[]) => void) => {
    if (!adminKey) {
      console.log('[FETCH_USERS] Waiting for adminKey...');
      return;
    }
    try {
      console.log('[FETCH_USERS] Starting request...');
      const res = await fetch(`${ADMIN_API}?action=list-users&limit=100&offset=0&admin_key=${adminKey}`);
      console.log('[FETCH_USERS] Response status:', res.status);
      const data = await res.json();
      console.log('[FETCH_USERS] Response data:', data);
      
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      
      setUsers(data.users || []);
      console.log('[FETCH_USERS] Users loaded:', data.users?.length || 0);
    } catch (error: any) {
      console.error('[FETCH_USERS] Error:', error);
      toast({ 
        title: 'Ошибка', 
        description: `Не удалось загрузить пользователей: ${error.message}`, 
        variant: 'destructive' 
      });
    }
  };

  const fetchStats = async (
    setUsageStats: (stats: UsageStat[]) => void,
    setRevenueStats: (stats: RevenueStat[]) => void,
    setLoading: (loading: boolean) => void
  ) => {
    if (!adminKey) {
      console.log('[FETCH_STATS] Waiting for adminKey...');
      return;
    }
    setLoading(true);
    try {
      console.log('[FETCH_STATS] Starting requests...');
      const [usageRes, revenueRes] = await Promise.all([
        fetch(`${ADMIN_API}?action=usage-stats&days=30&admin_key=${adminKey}`),
        fetch(`${ADMIN_API}?action=revenue-stats&admin_key=${adminKey}`)
      ]);

      console.log('[FETCH_STATS] Usage response status:', usageRes.status);
      console.log('[FETCH_STATS] Revenue response status:', revenueRes.status);

      const usageData = await usageRes.json();
      const revenueData = await revenueRes.json();

      console.log('[FETCH_STATS] Usage data:', usageData);
      console.log('[FETCH_STATS] Revenue data:', revenueData);

      setUsageStats(usageData.stats || []);
      setRevenueStats(revenueData.revenue || []);
    } catch (error) {
      console.error('[FETCH_STATS] Error:', error);
      toast({ title: 'Ошибка', description: 'Не удалось загрузить статистику', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialStats = async (
    period: string,
    setFinancialStats: (stats: FinancialStat[]) => void,
    setFinancialSummary: (summary: FinancialSummary | null) => void,
    setLoading: (loading: boolean) => void
  ) => {
    setLoading(true);
    try {
      console.log('[FETCH_FINANCIAL] Starting request for period:', period);
      const res = await fetch(`${ADMIN_API}?action=financial-stats&period=${period}&admin_key=${adminKey}`);
      console.log('[FETCH_FINANCIAL] Response status:', res.status);
      const data = await res.json();
      console.log('[FETCH_FINANCIAL] Response data:', data);
      setFinancialStats(data.stats || []);
      setFinancialSummary(data.summary || null);
      console.log('[FETCH_FINANCIAL] Financial stats loaded:', data.stats?.length || 0);
    } catch (error) {
      console.error('[FETCH_FINANCIAL] Error:', error);
      toast({ title: 'Ошибка', description: 'Не удалось загрузить финансовую статистику', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (editingPlan: Partial<Plan>, refetchPlans: () => void) => {
    if (!editingPlan) return;

    try {
      const action = editingPlan.plan_id ? 'update-plan' : 'create-plan';
      console.log('[SAVE_PLAN] Sending request:', { action, plan: editingPlan });
      
      const res = await fetch(`${ADMIN_API}?action=${action}&admin_key=${adminKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editingPlan)
      });

      console.log('[SAVE_PLAN] Response status:', res.status);
      const data = await res.json();
      console.log('[SAVE_PLAN] Response data:', data);
      
      if (!res.ok) {
        throw new Error(data.error || `Ошибка ${res.status}: ${res.statusText}`);
      }

      toast({ title: 'Успешно', description: 'Тариф сохранен' });
      refetchPlans();
    } catch (error: any) {
      console.error('[SAVE_PLAN] Error:', error);
      toast({ 
        title: 'Ошибка', 
        description: error.message || 'Не удалось сохранить тариф', 
        variant: 'destructive' 
      });
    }
  };

  const handleDeletePlan = async (planId: number, refetchPlans: () => void) => {
    if (!confirm('Удалить тариф?')) return;

    try {
      await fetch(`${ADMIN_API}?action=delete-plan&admin_key=${adminKey}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan_id: planId })
      });

      toast({ title: 'Успешно', description: 'Тариф удален' });
      refetchPlans();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось удалить тариф', variant: 'destructive' });
    }
  };

  const handleUpdateUser = async (
    editingUser: Partial<User> & { custom_price?: number; started_at?: string; ended_at?: string },
    refetchUsers: () => void
  ) => {
    if (!editingUser?.user_id) return;

    try {
      console.log('[UPDATE_USER] Sending request:', editingUser);
      
      const res = await fetch(`${ADMIN_API}?action=update-user&admin_key=${adminKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: editingUser.user_id,
          plan_id: editingUser.plan_id,
          custom_quota_gb: editingUser.custom_quota_gb,
          custom_price: editingUser.custom_price,
          started_at: editingUser.started_at,
          ended_at: editingUser.ended_at || null
        })
      });

      const data = await res.json();
      console.log('[UPDATE_USER] Response:', data);

      if (!res.ok) {
        throw new Error(data.error || 'Ошибка сервера');
      }

      toast({ title: 'Успешно', description: 'Тариф назначен пользователю' });
      refetchUsers();
    } catch (error: any) {
      console.error('[UPDATE_USER] Error:', error);
      toast({ 
        title: 'Ошибка', 
        description: error.message || 'Не удалось обновить пользователя', 
        variant: 'destructive' 
      });
    }
  };

  const handleSetDefaultPlan = async (planId: number, refetchUsers: () => void) => {
    if (!confirm('Назначить этот тариф всем пользователям без тарифа?')) return;

    try {
      const res = await fetch(`${ADMIN_API}?action=set-default-plan&admin_key=${adminKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan_id: planId })
      });

      const data = await res.json();
      toast({ 
        title: 'Успешно', 
        description: `Тариф назначен ${data.affected} пользователям` 
      });
      refetchUsers();
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось назначить тариф', variant: 'destructive' });
    }
  };

  const fetchPromoCodes = async (setPromoCodes: (codes: PromoCode[]) => void) => {
    if (!adminKey) return;
    try {
      const res = await fetch(`${ADMIN_API}?action=list-promo-codes&admin_key=${adminKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPromoCodes(data.promo_codes || []);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreatePromoCode = async (
    promoCode: Omit<PromoCode, 'id' | 'used_count' | 'created_at' | 'valid_from'>,
    refetchPromoCodes: () => void
  ) => {
    try {
      const res = await fetch(`${ADMIN_API}?action=create-promo-code&admin_key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promoCode)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Успешно', description: 'Промокод создан' });
      refetchPromoCodes();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const handleTogglePromoCode = async (id: number, isActive: boolean, refetchPromoCodes: () => void) => {
    try {
      const res = await fetch(`${ADMIN_API}?action=update-promo-code&admin_key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: isActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Успешно', description: isActive ? 'Промокод активирован' : 'Промокод деактивирован' });
      refetchPromoCodes();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeletePromoCode = async (id: number, refetchPromoCodes: () => void) => {
    if (!confirm('Удалить промокод?')) return;
    try {
      const res = await fetch(`${ADMIN_API}?action=delete-promo-code&id=${id}&admin_key=${adminKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Успешно', description: 'Промокод удален' });
      refetchPromoCodes();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const fetchStorageInvoices = async (
    filters: { userId?: number; period?: string; status?: string; limit?: number; offset?: number },
    setInvoices: (invoices: StorageInvoice[]) => void,
    setTotal: (total: number) => void,
    setLoading: (loading: boolean) => void
  ) => {
    setLoading(true);
    try {
      const STORAGE_CRON_API = 'https://functions.poehali.dev/58924057-0ad9-432d-8d31-c0ec8bcd0ef4';
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
      const STORAGE_CRON_API = 'https://functions.poehali.dev/58924057-0ad9-432d-8d31-c0ec8bcd0ef4';
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
      const STORAGE_CRON_API = 'https://functions.poehali.dev/58924057-0ad9-432d-8d31-c0ec8bcd0ef4';
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
      const PHOTOBANK_CRON_API = 'https://functions.poehali.dev/f9358728-7a16-4276-8ca2-d24939d69b39';
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
      const STORAGE_CRON_API = 'https://functions.poehali.dev/58924057-0ad9-432d-8d31-c0ec8bcd0ef4';
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
      const STORAGE_CRON_API = 'https://functions.poehali.dev/58924057-0ad9-432d-8d31-c0ec8bcd0ef4';
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
    fetchPlans,
    fetchUsers,
    fetchStats,
    fetchFinancialStats,
    handleSavePlan,
    handleDeletePlan,
    handleUpdateUser,
    handleSetDefaultPlan,
    fetchPromoCodes,
    handleCreatePromoCode,
    handleTogglePromoCode,
    handleDeletePromoCode,
    fetchStorageInvoices,
    updateInvoiceStatus,
    fetchDailyUsage,
    fetchTrashFolders,
    runDailySnapshot,
    runMonthlyBilling,
  };
};