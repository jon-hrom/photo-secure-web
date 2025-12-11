import { useToast } from '@/hooks/use-toast';

const ADMIN_API = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93a2-63032b5c552c';

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

export const useAdminStorageAPI = (adminKey: string) => {
  const { toast } = useToast();

  const fetchPlans = async (setPlans: (plans: Plan[]) => void) => {
    if (!adminKey) {
      console.log('[FETCH_PLANS] Waiting for adminKey...');
      return;
    }
    try {
      console.log('[FETCH_PLANS] Starting request to:', `${ADMIN_API}?action=list-plans`);
      console.log('[FETCH_PLANS] Using adminKey:', adminKey);
      console.log('[FETCH_PLANS] Full URL:', `${ADMIN_API}?action=list-plans`);
      console.log('[FETCH_PLANS] Headers:', { 'X-Admin-Key': adminKey });
      
      const res = await fetch(`${ADMIN_API}?action=list-plans`, {
        headers: { 'X-Admin-Key': adminKey }
      });
      
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
      const res = await fetch(`${ADMIN_API}?action=list-users&limit=100&offset=0`, {
        headers: { 'X-Admin-Key': adminKey }
      });
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
        fetch(`${ADMIN_API}?action=usage-stats&days=30`, {
          headers: { 'X-Admin-Key': adminKey }
        }),
        fetch(`${ADMIN_API}?action=revenue-stats`, {
          headers: { 'X-Admin-Key': adminKey }
        })
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
      const res = await fetch(`${ADMIN_API}?action=financial-stats&period=${period}`, {
        headers: { 'X-Admin-Key': adminKey }
      });
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
      
      const res = await fetch(`${ADMIN_API}?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
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
      await fetch(`${ADMIN_API}?action=delete-plan`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
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
      
      const res = await fetch(`${ADMIN_API}?action=update-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
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
      const res = await fetch(`${ADMIN_API}?action=set-default-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': adminKey
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

  return {
    fetchPlans,
    fetchUsers,
    fetchStats,
    fetchFinancialStats,
    handleSavePlan,
    handleDeletePlan,
    handleUpdateUser,
    handleSetDefaultPlan,
  };
};